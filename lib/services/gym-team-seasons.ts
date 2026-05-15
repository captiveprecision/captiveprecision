import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/lib/types/database";

type AdminClient = ReturnType<typeof createAdminClient>;
type GymSeasonRow = Database["public"]["Tables"]["gym_seasons"]["Row"];
type TeamRow = Database["public"]["Tables"]["teams"]["Row"];
type TeamCoachRow = Database["public"]["Tables"]["team_coaches"]["Row"];
type WorkspaceRootRow = {
  id: string;
  scope_type: "coach" | "gym";
  gym_id: string | null;
  owner_profile_id: string | null;
};

export type GymTeamSeasonProfileRow = Database["public"]["Tables"]["gym_team_season_profiles"]["Row"];
export type GymTeamSeasonCoachRow = Database["public"]["Tables"]["gym_team_season_coaches"]["Row"];
export type GymTeamSeasonRosterRow = Database["public"]["Tables"]["gym_team_season_roster"]["Row"];

export type GymActiveTeamSeasonState = {
  season: GymSeasonRow;
  profiles: GymTeamSeasonProfileRow[];
  coaches: GymTeamSeasonCoachRow[];
  roster: GymTeamSeasonRosterRow[];
};

function asRecord(value: Json | unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function addOneYear(dateValue: string) {
  const date = new Date(`${dateValue}T00:00:00.000Z`);
  date.setUTCFullYear(date.getUTCFullYear() + 1);
  return date.toISOString().slice(0, 10);
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function isMissingSeasonTablesError(error: { code?: string; message?: string } | null | undefined) {
  return error?.code === "42P01" || error?.code === "42703" || /gym_team_season_/i.test(error?.message ?? "");
}

function buildProfileInsertFromTeam(
  gymId: string,
  team: Pick<TeamRow, "division" | "id" | "metadata" | "name">,
  seasonId: string,
  actorProfileId: string | null
) {
  const metadata = asRecord(team.metadata);

  return {
    gym_id: gymId,
    gym_season_id: seasonId,
    team_id: team.id,
    name_snapshot: team.name,
    level_label: asString(metadata.teamLevel) || null,
    category: asString(metadata.ageCategory) || asString(team.division) || null,
    division: asString(team.division) || null,
    status: "active",
    metadata: { backfilledFrom: "teams-current-state" },
    created_by_profile_id: actorProfileId
  };
}

async function listPermanentGymTeamRows(admin: AdminClient, gymId: string) {
  const { data: gymRow } = await admin
    .from("gyms" as never)
    .select("owner_profile_id" as never)
    .eq("id", gymId as never)
    .maybeSingle();
  const ownerProfileId = (gymRow as { owner_profile_id?: string | null } | null)?.owner_profile_id ?? null;
  const { data: roots } = ownerProfileId
    ? await admin
      .from("workspace_roots" as never)
      .select("id, scope_type, gym_id, owner_profile_id" as never)
      .or(`gym_id.eq.${gymId},owner_profile_id.eq.${ownerProfileId}` as never)
    : { data: [] as unknown[] };
  const relatedRootIds = ((roots ?? []) as WorkspaceRootRow[])
    .filter((root) => (
      (root.scope_type === "gym" && root.gym_id === gymId)
      || (root.scope_type === "coach" && root.owner_profile_id === ownerProfileId)
    ))
    .map((root) => root.id);
  const { data: gymTeams } = await admin
    .from("teams" as never)
    .select("*" as never)
    .eq("gym_id", gymId as never)
    .is("deleted_at" as never, null);
  const { data: rootTeams } = relatedRootIds.length
    ? await admin
      .from("teams" as never)
      .select("*" as never)
      .in("workspace_root_id", relatedRootIds as never)
      .is("deleted_at" as never, null)
    : { data: [] as unknown[] };
  const byId = new Map<string, TeamRow>();

  for (const team of [...((gymTeams ?? []) as TeamRow[]), ...((rootTeams ?? []) as TeamRow[])]) {
    byId.set(team.id, team);
  }

  return [...byId.values()];
}

async function backfillLegacyTeamsIntoSeason(
  admin: AdminClient,
  gymId: string,
  seasonId: string,
  actorProfileId: string | null
) {
  const teamRows = await listPermanentGymTeamRows(admin, gymId);

  if (!teamRows.length) {
    return;
  }

  await admin
    .from("gym_team_season_profiles" as never)
    .upsert(teamRows.map((team) => buildProfileInsertFromTeam(gymId, team, seasonId, actorProfileId)) as never, {
      onConflict: "gym_season_id,team_id",
      ignoreDuplicates: true
    });

  const teamIds = teamRows.map((team) => team.id);
  const { data: legacyCoaches } = await admin
    .from("team_coaches" as never)
    .select("*" as never)
    .in("team_id", teamIds as never);
  const coachRows = (legacyCoaches ?? []) as TeamCoachRow[];

  if (coachRows.length) {
    await admin
      .from("gym_team_season_coaches" as never)
      .upsert(coachRows.map((coach) => ({
        gym_id: gymId,
        gym_season_id: seasonId,
        team_id: coach.team_id,
        coach_profile_id: coach.coach_profile_id,
        role: coach.role
      })) as never, { onConflict: "gym_season_id,team_id,coach_profile_id", ignoreDuplicates: true });
  }
}

export async function ensureActiveGymSeasonForGym(
  admin: AdminClient,
  gymId: string,
  actorProfileId: string | null
) {
  const { data: activeSeason, error: activeError } = await admin
    .from("gym_seasons" as never)
    .select("*" as never)
    .eq("gym_id", gymId as never)
    .eq("status", "active" as never)
    .order("season_number" as never, { ascending: false })
    .limit(1)
    .maybeSingle();

  if (activeError) {
    return null;
  }

  if (activeSeason) {
    return activeSeason as GymSeasonRow;
  }

  const { data: latestSeason } = await admin
    .from("gym_seasons" as never)
    .select("season_number" as never)
    .eq("gym_id", gymId as never)
    .order("season_number" as never, { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSeasonNumber = (((latestSeason as { season_number?: number } | null)?.season_number ?? 0) + 1);
  const startDate = todayDate();

  const { data: insertedSeason, error: insertError } = await admin
    .from("gym_seasons" as never)
    .insert({
      gym_id: gymId,
      season_number: nextSeasonNumber,
      label: `Season ${nextSeasonNumber}`,
      start_date: startDate,
      end_date: addOneYear(startDate),
      status: "active",
      created_by_profile_id: actorProfileId
    } as never)
    .select("*" as never)
    .single();

  if (insertError || !insertedSeason) {
    return null;
  }

  return insertedSeason as GymSeasonRow;
}

export async function seedActiveGymSeasonStructure(
  admin: AdminClient,
  gymId: string,
  seasonId: string,
  actorProfileId: string | null
) {
  const { data: existingProfiles, error: existingError } = await admin
    .from("gym_team_season_profiles" as never)
    .select("id" as never)
    .eq("gym_id", gymId as never)
    .eq("gym_season_id", seasonId as never)
    .limit(1);

  if (isMissingSeasonTablesError(existingError)) {
    return;
  }

  if (existingError) {
    return;
  }

  if ((existingProfiles ?? []).length) {
    await backfillLegacyTeamsIntoSeason(admin, gymId, seasonId, actorProfileId);
    return;
  }

  const { data: previousSeason } = await admin
    .from("gym_seasons" as never)
    .select("id" as never)
    .eq("gym_id", gymId as never)
    .neq("id", seasonId as never)
    .order("season_number" as never, { ascending: false })
    .limit(1)
    .maybeSingle();
  const previousSeasonId = (previousSeason as { id?: string } | null)?.id ?? null;

  if (previousSeasonId) {
    const { data: previousProfiles } = await admin
      .from("gym_team_season_profiles" as never)
      .select("*" as never)
      .eq("gym_id", gymId as never)
      .eq("gym_season_id", previousSeasonId as never)
      .eq("status", "active" as never);
    const profiles = (previousProfiles ?? []) as GymTeamSeasonProfileRow[];

    if (profiles.length) {
      await admin
        .from("gym_team_season_profiles" as never)
        .upsert(profiles.map((profile) => ({
          gym_id: gymId,
          gym_season_id: seasonId,
          team_id: profile.team_id,
          name_snapshot: profile.name_snapshot,
          level_label: profile.level_label,
          category: profile.category,
          division: profile.division,
          status: "active",
          metadata: { ...asRecord(profile.metadata), copiedFromSeasonId: previousSeasonId },
          created_by_profile_id: actorProfileId
        })) as never, { onConflict: "gym_season_id,team_id", ignoreDuplicates: true });

      const { data: previousCoaches } = await admin
        .from("gym_team_season_coaches" as never)
        .select("*" as never)
        .eq("gym_id", gymId as never)
        .eq("gym_season_id", previousSeasonId as never);
      const coaches = (previousCoaches ?? []) as GymTeamSeasonCoachRow[];

      if (coaches.length) {
        await admin
          .from("gym_team_season_coaches" as never)
          .upsert(coaches.map((coach) => ({
            gym_id: gymId,
            gym_season_id: seasonId,
            team_id: coach.team_id,
            coach_profile_id: coach.coach_profile_id,
            role: coach.role
          })) as never, { onConflict: "gym_season_id,team_id,coach_profile_id", ignoreDuplicates: true });
      }

      await backfillLegacyTeamsIntoSeason(admin, gymId, seasonId, actorProfileId);
      return;
    }
  }

  await backfillLegacyTeamsIntoSeason(admin, gymId, seasonId, actorProfileId);
}

export async function loadActiveGymTeamSeasonState(
  admin: AdminClient,
  gymId: string,
  actorProfileId: string | null
): Promise<GymActiveTeamSeasonState | null> {
  const season = await ensureActiveGymSeasonForGym(admin, gymId, actorProfileId);

  if (!season) {
    return null;
  }

  await seedActiveGymSeasonStructure(admin, gymId, season.id, actorProfileId);

  const [profilesResult, coachesResult, rosterResult] = await Promise.all([
    admin
      .from("gym_team_season_profiles" as never)
      .select("*" as never)
      .eq("gym_id", gymId as never)
      .eq("gym_season_id", season.id as never)
      .eq("status", "active" as never),
    admin
      .from("gym_team_season_coaches" as never)
      .select("*" as never)
      .eq("gym_id", gymId as never)
      .eq("gym_season_id", season.id as never),
    admin
      .from("gym_team_season_roster" as never)
      .select("*" as never)
      .eq("gym_id", gymId as never)
      .eq("gym_season_id", season.id as never)
  ]);

  if (
    isMissingSeasonTablesError(profilesResult.error)
    || isMissingSeasonTablesError(coachesResult.error)
    || isMissingSeasonTablesError(rosterResult.error)
  ) {
    return null;
  }

  if (profilesResult.error || coachesResult.error || rosterResult.error) {
    return null;
  }

  return {
    season,
    profiles: (profilesResult.data ?? []) as GymTeamSeasonProfileRow[],
    coaches: (coachesResult.data ?? []) as GymTeamSeasonCoachRow[],
    roster: (rosterResult.data ?? []) as GymTeamSeasonRosterRow[]
  };
}

export async function upsertActiveGymTeamSeasonProfile(
  admin: AdminClient,
  input: {
    gymId: string;
    seasonId: string;
    teamId: string;
    name: string;
    level: string | null;
    category: string | null;
    division?: string | null;
    actorProfileId: string | null;
    metadata?: Record<string, unknown>;
  }
) {
  const { error } = await admin
    .from("gym_team_season_profiles" as never)
    .upsert({
      gym_id: input.gymId,
      gym_season_id: input.seasonId,
      team_id: input.teamId,
      name_snapshot: input.name,
      level_label: input.level,
      category: input.category,
      division: input.division ?? input.category,
      status: "active",
      metadata: input.metadata ?? {},
      created_by_profile_id: input.actorProfileId
    } as never, { onConflict: "gym_season_id,team_id" });

  if (error) {
    throw new Error("Unable to update active season team profile.");
  }
}

export async function replaceActiveGymTeamSeasonCoaches(
  admin: AdminClient,
  input: {
    gymId: string;
    seasonId: string;
    teamId: string;
    coachIds: string[];
  }
) {
  const { error: deleteError } = await admin
    .from("gym_team_season_coaches" as never)
    .delete()
    .eq("gym_id", input.gymId as never)
    .eq("gym_season_id", input.seasonId as never)
    .eq("team_id", input.teamId as never);

  if (deleteError) {
    throw new Error("Unable to update active season team coaches.");
  }

  if (!input.coachIds.length) {
    return;
  }

  const { error: insertError } = await admin
    .from("gym_team_season_coaches" as never)
    .insert(input.coachIds.map((coachId, index) => ({
      gym_id: input.gymId,
      gym_season_id: input.seasonId,
      team_id: input.teamId,
      coach_profile_id: coachId,
      role: index === 0 ? "head" : "assistant"
    })) as never);

  if (insertError) {
    throw new Error("Unable to update active season team coaches.");
  }
}

export async function replaceActiveGymTeamSeasonRoster(
  admin: AdminClient,
  input: {
    gymId: string;
    seasonId: string;
    teamId: string;
    athleteIds: string[];
  }
) {
  const { error: deleteError } = await admin
    .from("gym_team_season_roster" as never)
    .delete()
    .eq("gym_id", input.gymId as never)
    .eq("gym_season_id", input.seasonId as never)
    .eq("team_id", input.teamId as never);

  if (deleteError) {
    throw new Error("Unable to update active season roster.");
  }

  if (!input.athleteIds.length) {
    return;
  }

  const { error: insertError } = await admin
    .from("gym_team_season_roster" as never)
    .insert(input.athleteIds.map((athleteId) => ({
      gym_id: input.gymId,
      gym_season_id: input.seasonId,
      team_id: input.teamId,
      athlete_id: athleteId
    })) as never);

  if (insertError) {
    throw new Error("Unable to update active season roster.");
  }
}

export async function markActiveGymTeamSeasonProfileInactive(
  admin: AdminClient,
  input: {
    gymId: string;
    seasonId: string;
    teamId: string;
  }
) {
  const { error: profileError } = await admin
    .from("gym_team_season_profiles" as never)
    .update({ status: "inactive" } as never)
    .eq("gym_id", input.gymId as never)
    .eq("gym_season_id", input.seasonId as never)
    .eq("team_id", input.teamId as never);

  if (profileError) {
    throw new Error("Unable to remove team from active season.");
  }

  await admin
    .from("gym_team_season_coaches" as never)
    .delete()
    .eq("gym_id", input.gymId as never)
    .eq("gym_season_id", input.seasonId as never)
    .eq("team_id", input.teamId as never);

  await admin
    .from("gym_team_season_roster" as never)
    .delete()
    .eq("gym_id", input.gymId as never)
    .eq("gym_season_id", input.seasonId as never)
    .eq("team_id", input.teamId as never);
}
