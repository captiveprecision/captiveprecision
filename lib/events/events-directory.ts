import type { AuthSession } from "@/lib/auth/session";
import { formatGymSeatRole, resolveGymForUser } from "@/lib/services/gym-access";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/types/database";

import type { CalendarCoach, CalendarTeam, EventsCalendarDirectory, EventsCalendarWorkspace } from "./events-calendar";

type GymRow = Pick<Database["public"]["Tables"]["gyms"]["Row"], "id" | "owner_profile_id">;
type ProfileRow = Pick<Database["public"]["Tables"]["profiles"]["Row"], "id" | "display_name" | "email">;
type LicenseRow = Pick<
  Database["public"]["Tables"]["gym_coach_licenses"]["Row"],
  "coach_profile_id" | "license_seat_name" | "seat_role" | "status"
>;
type TeamRow = Pick<
  Database["public"]["Tables"]["teams"]["Row"],
  "id" | "division" | "metadata" | "name" | "primary_coach_profile_id"
>;
type TeamCoachRow = Pick<Database["public"]["Tables"]["team_coaches"]["Row"], "team_id" | "coach_profile_id">;

const EMPTY_DIRECTORY: EventsCalendarDirectory = {
  teams: [],
  coaches: []
};

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asMetadataString(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function getProfileLabel(profile: ProfileRow | null | undefined, fallback: string | null | undefined) {
  return profile?.display_name || fallback || profile?.email || "Staff";
}

function getTeamLevel(team: TeamRow) {
  const metadata = asRecord(team.metadata);
  return (
    asMetadataString(metadata, "teamLevel") ||
    asMetadataString(metadata, "level") ||
    asMetadataString(metadata, "programLevel") ||
    team.division ||
    "Team"
  );
}

async function loadProfiles(admin: ReturnType<typeof createAdminClient>, profileIds: string[]) {
  if (!profileIds.length) {
    return new Map<string, ProfileRow>();
  }

  const { data, error } = await admin
    .from("profiles" as never)
    .select("id, display_name, email" as never)
    .in("id", profileIds as never);

  if (error) {
    console.error("[events-directory] Failed to load profiles.", error);
    return new Map<string, ProfileRow>();
  }

  return new Map(((data ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]));
}

async function loadGymStaff(
  admin: ReturnType<typeof createAdminClient>,
  gym: GymRow
) {
  const { data, error } = await admin
    .from("gym_coach_licenses" as never)
    .select("coach_profile_id, license_seat_name, seat_role, status" as never)
    .eq("gym_id", gym.id as never)
    .eq("status", "active" as never);

  if (error) {
    console.error("[events-directory] Failed to load gym staff.", error);
    return [] as CalendarCoach[];
  }

  const licenses = (data ?? []) as LicenseRow[];
  const profileIds = uniqueStrings([
    gym.owner_profile_id,
    ...licenses.map((license) => license.coach_profile_id)
  ]);
  const profilesById = await loadProfiles(admin, profileIds);
  const licenseByCoachId = new Map(licenses.map((license) => [license.coach_profile_id, license]));

  return profileIds
    .map((profileId) => {
      const profile = profilesById.get(profileId);
      const license = licenseByCoachId.get(profileId);
      const role = profileId === gym.owner_profile_id
        ? "Program Director"
        : formatGymSeatRole(license?.seat_role) || "Staff";

      return {
        id: profileId,
        name: getProfileLabel(profile, license?.license_seat_name),
        email: profile?.email ?? "",
        role
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

async function loadGymTeams(
  admin: ReturnType<typeof createAdminClient>,
  gymId: string,
  staffIds: Set<string>
) {
  const { data, error } = await admin
    .from("teams" as never)
    .select("id, division, metadata, name, primary_coach_profile_id" as never)
    .eq("gym_id", gymId as never)
    .is("deleted_at", null);

  if (error) {
    console.error("[events-directory] Failed to load gym teams.", error);
    return [] as CalendarTeam[];
  }

  const teams = (data ?? []) as TeamRow[];
  const teamIds = teams.map((team) => team.id);
  const coachIdsByTeamId = new Map<string, Set<string>>();

  for (const team of teams) {
    coachIdsByTeamId.set(team.id, new Set(uniqueStrings([team.primary_coach_profile_id])));
  }

  if (teamIds.length) {
    const { data: teamCoachRows, error: teamCoachesError } = await admin
      .from("team_coaches" as never)
      .select("team_id, coach_profile_id" as never)
      .in("team_id", teamIds as never);

    if (teamCoachesError) {
      console.error("[events-directory] Failed to load team coach assignments.", teamCoachesError);
    }

    for (const assignment of (teamCoachRows ?? []) as TeamCoachRow[]) {
      const coachIds = coachIdsByTeamId.get(assignment.team_id) ?? new Set<string>();
      coachIds.add(assignment.coach_profile_id);
      coachIdsByTeamId.set(assignment.team_id, coachIds);
    }
  }

  return teams
    .map((team) => ({
      id: team.id,
      name: team.name,
      level: getTeamLevel(team),
      assignedCoachIds: Array.from(coachIdsByTeamId.get(team.id) ?? []).filter((coachId) => staffIds.has(coachId))
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export async function buildEventsCalendarDirectory(
  _workspace: EventsCalendarWorkspace,
  session: AuthSession | null
): Promise<EventsCalendarDirectory> {
  if (!session) {
    return EMPTY_DIRECTORY;
  }

  try {
    const admin = createAdminClient();
    const gym = await resolveGymForUser(admin, session.userId, session.primaryGymId);

    if (!gym) {
      return {
        teams: [],
        coaches: [{
          id: session.userId,
          name: session.displayName || session.email || "Coach",
          email: session.email || "",
          role: "Coach"
        }]
      };
    }

    const coaches = await loadGymStaff(admin, gym);
    const staffIds = new Set(coaches.map((coach) => coach.id));
    const teams = await loadGymTeams(admin, gym.id, staffIds);

    return {
      teams,
      coaches
    };
  } catch (error) {
    console.error("[events-directory] Failed to build events directory.", error);
    return EMPTY_DIRECTORY;
  }
}
