import { ButtonLink } from "@/components/ui";
import { ManageGymPeopleTable, type ManageGymPerson } from "@/components/gym/manage-gym-people-table";
import { requireAuthSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/types/database";

export const dynamic = "force-dynamic";

type GymRow = Pick<Database["public"]["Tables"]["gyms"]["Row"], "id" | "name">;
type TeamRow = Pick<Database["public"]["Tables"]["teams"]["Row"], "id" | "name" | "primary_coach_profile_id">;
type AthleteRow = Pick<Database["public"]["Tables"]["athletes"]["Row"], "id">;
type AssignmentRow = Pick<Database["public"]["Tables"]["athlete_team_assignments"]["Row"], "athlete_id" | "team_id">;
type LicenseRow = Pick<
  Database["public"]["Tables"]["gym_coach_licenses"]["Row"],
  "id" | "coach_profile_id" | "created_at" | "credential_levels" | "license_seat_name" | "seat_role" | "status"
>;
type TeamCoachRow = Pick<Database["public"]["Tables"]["team_coaches"]["Row"], "team_id" | "coach_profile_id">;
type ProfileRow = Pick<Database["public"]["Tables"]["profiles"]["Row"], "id" | "display_name" | "email">;

type ManageGymTeamRow = {
  id: string;
  name: string;
  athleteCount: number;
  coachNames: string;
};

function isMissingCredentialLevelsColumn(error: { message?: string; code?: string } | null | undefined) {
  return error?.code === "42703" || /credential_levels/i.test(error?.message ?? "");
}

function formatJoinedAt(value: string | null) {
  if (!value) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}

function formatSeatRole(value: string | null | undefined): ManageGymPerson["role"] {
  switch (value) {
    case "staff":
      return "Staff";
    case "assistant":
      return "Assistant";
    case "coach":
      return "Coach";
    default:
      return "";
  }
}

async function loadGymLicenses(admin: ReturnType<typeof createAdminClient>, gymId: string) {
  const withCredentials = await admin
    .from("gym_coach_licenses" as never)
    .select("id, coach_profile_id, created_at, credential_levels, license_seat_name, seat_role, status" as never)
    .eq("gym_id", gymId as never)
    .in("status", ["active", "pending"] as never);

  if (!withCredentials.error) {
    return (withCredentials.data ?? []) as LicenseRow[];
  }

  if (!isMissingCredentialLevelsColumn(withCredentials.error)) {
    console.error("[manage-my-gym] Failed to load gym licenses.", withCredentials.error);
    return [] as LicenseRow[];
  }

  const withoutCredentials = await admin
    .from("gym_coach_licenses" as never)
    .select("id, coach_profile_id, created_at, license_seat_name, seat_role, status" as never)
    .eq("gym_id", gymId as never)
    .in("status", ["active", "pending"] as never);

  if (withoutCredentials.error) {
    console.error("[manage-my-gym] Failed to load fallback gym licenses.", withoutCredentials.error);
    return [] as LicenseRow[];
  }

  return ((withoutCredentials.data ?? []) as Array<Omit<LicenseRow, "credential_levels">>).map((license) => ({
    ...license,
    credential_levels: []
  })) as LicenseRow[];
}

async function resolveManageGymOverview(userId: string, primaryGymId: string | null) {
  const admin = createAdminClient();
  let gymId = primaryGymId;

  if (!gymId) {
    const { data: ownedGym } = await admin
      .from("gyms" as never)
      .select("id, name" as never)
      .eq("owner_profile_id", userId as never)
      .maybeSingle();

    gymId = (ownedGym as GymRow | null)?.id ?? null;
  }

  if (!gymId) {
    return {
      stats: [
        { label: "Active coaches", value: "0", copy: "No linked gym found" },
        { label: "Teams", value: "0", copy: "No linked gym found" },
        { label: "Athletes", value: "0", copy: "No linked gym found" }
      ],
      teams: [] as ManageGymTeamRow[],
      people: [] as ManageGymPerson[]
    };
  }

  const [licenseRows, teamsResult, gymAthletesResult] = await Promise.all([
    loadGymLicenses(admin, gymId),
    admin
      .from("teams" as never)
      .select("id, name, primary_coach_profile_id" as never)
      .eq("gym_id", gymId as never),
    admin
      .from("athletes" as never)
      .select("id" as never)
      .eq("gym_id", gymId as never)
  ]);

  const teamRows = (teamsResult.data ?? []) as TeamRow[];
  const teamIds = teamRows.map((team) => team.id);
  const directAthleteIds = new Set(((gymAthletesResult.data ?? []) as AthleteRow[]).map((athlete) => athlete.id));
  const athleteCountsByTeamId = new Map<string, Set<string>>();
  const coachIdsByTeamId = new Map<string, Set<string>>();

  if (teamIds.length) {
    const [assignmentsResult, teamCoachesResult] = await Promise.all([
      admin
        .from("athlete_team_assignments" as never)
        .select("athlete_id, team_id" as never)
        .in("team_id", teamIds as never),
      admin
        .from("team_coaches" as never)
        .select("team_id, coach_profile_id" as never)
        .in("team_id", teamIds as never)
    ]);

    for (const assignment of (assignmentsResult.data ?? []) as AssignmentRow[]) {
      directAthleteIds.add(assignment.athlete_id);
      const currentAthletes = athleteCountsByTeamId.get(assignment.team_id) ?? new Set<string>();
      currentAthletes.add(assignment.athlete_id);
      athleteCountsByTeamId.set(assignment.team_id, currentAthletes);
    }

    for (const team of teamRows) {
      if (team.primary_coach_profile_id) {
        const currentCoaches = coachIdsByTeamId.get(team.id) ?? new Set<string>();
        currentCoaches.add(team.primary_coach_profile_id);
        coachIdsByTeamId.set(team.id, currentCoaches);
      }
    }

    for (const coach of (teamCoachesResult.data ?? []) as TeamCoachRow[]) {
      const currentCoaches = coachIdsByTeamId.get(coach.team_id) ?? new Set<string>();
      currentCoaches.add(coach.coach_profile_id);
      coachIdsByTeamId.set(coach.team_id, currentCoaches);
    }
  }

  const licenseCoachIds = licenseRows.map((license) => license.coach_profile_id);
  const coachIds = Array.from(new Set([
    ...licenseCoachIds,
    ...Array.from(coachIdsByTeamId.values()).flatMap((ids) => Array.from(ids))
  ]));
  let profileById = new Map<string, ProfileRow>();

  if (coachIds.length) {
    const { data: profiles } = await admin
      .from("profiles" as never)
      .select("id, display_name, email" as never)
      .in("id", coachIds as never);

    profileById = new Map(((profiles ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]));
  }

  const teams: ManageGymTeamRow[] = teamRows.map((team) => {
    const coachNames = Array.from(coachIdsByTeamId.get(team.id) ?? [])
      .map((coachId) => {
        const profile = profileById.get(coachId);
        return profile?.display_name || profile?.email || null;
      })
      .filter((name): name is string => Boolean(name));

    return {
      id: team.id,
      name: team.name,
      athleteCount: athleteCountsByTeamId.get(team.id)?.size ?? 0,
      coachNames: coachNames.length ? coachNames.join(", ") : "No coaches assigned"
    };
  });

  const teamCountsByCoachId = new Map<string, number>();

  for (const coachIdsForTeam of coachIdsByTeamId.values()) {
    for (const coachId of coachIdsForTeam) {
      teamCountsByCoachId.set(coachId, (teamCountsByCoachId.get(coachId) ?? 0) + 1);
    }
  }

  const people: ManageGymPerson[] = licenseRows.map((license) => {
    const profile = profileById.get(license.coach_profile_id);
    const name = profile?.display_name || license.license_seat_name || profile?.email || "Invited staff";
    const role = formatSeatRole(license.seat_role);
    const teamCount = teamCountsByCoachId.get(license.coach_profile_id) ?? 0;

    return {
      id: license.coach_profile_id,
      name,
      email: profile?.email ?? "",
      joinedAt: formatJoinedAt(license.created_at),
      role,
      staffFunction: role === "Staff" ? "Program staff" : "",
      credentialLevels: Array.isArray(license.credential_levels)
        ? license.credential_levels.filter((credential): credential is string => typeof credential === "string")
        : [],
      membershipAssigned: license.status === "active",
      membershipLabel: license.status === "active" ? "Gym Access Active" : "View Only",
      teams: teamCount ? `${teamCount} ${teamCount === 1 ? "team" : "teams"}` : "No teams",
      classes: "No classes"
    };
  });

  return {
    stats: [
      { label: "Active coaches", value: String(licenseRows.filter((license) => license.status === "active").length), copy: "Under assigned gym licenses" },
      { label: "Teams", value: String(teamRows.length), copy: "Across all licensed coaches" },
      { label: "Athletes", value: String(directAthleteIds.size), copy: "Visible at organization level" }
    ],
    teams,
    people
  };
}

export default async function ManageMyGymPage() {
  const session = await requireAuthSession("gym");
  const { stats: gymStats, teams, people } = await resolveManageGymOverview(session.userId, session.primaryGymId);
  const gymName = session.primaryGymName?.trim();

  return (
    <main className="workspace-shell page-stack">
      <section className="surface-card panel-pad settings-hero">
        <div className="metric-label">Manage my gym</div>
        <h1 className="page-title settings-title">{gymName || "Manage My Gym"}</h1>
        <p className="page-copy">
          Manage your staff, teams, and athlete structure with the clarity needed to build a stronger gym and run a successful season.
        </p>
        {!gymName ? (
          <div className="settings-inline-actions">
            <ButtonLink href="/gym/profile" variant="primary">Configura Tu Perfil</ButtonLink>
          </div>
        ) : null}
      </section>

      <section className="surface-card panel-pad settings-section">
        <div className="metric-label">Gym overview</div>
        <div className="dashboard-summary-grid manage-gym-overview-grid">
          {gymStats.map((item) => (
            <article className="dashboard-summary-card" key={item.label}>
              <span className="metric-label">{item.label}</span>
              <div className="metric-value">{item.value}</div>
              <div className="metric-subtext">{item.copy}</div>
            </article>
          ))}
        </div>
      </section>

      <section className="surface-card panel-pad settings-section">
        <ManageGymPeopleTable initialPeople={people} />
      </section>

      <section className="surface-card panel-pad settings-section">
        <div className="metric-label">Teams</div>
        <div className="settings-data-table-wrap">
          <table className="settings-data-table manage-gym-teams-table">
            <thead>
              <tr>
                <th scope="col">Team Name</th>
                <th scope="col">Athletes</th>
                <th scope="col">Coaches</th>
              </tr>
            </thead>
            <tbody>
              {teams.length ? (
                teams.map((team) => (
                  <tr key={team.id}>
                    <td>
                      <strong>{team.name}</strong>
                    </td>
                    <td>{team.athleteCount}</td>
                    <td>{team.coachNames}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3}>No teams found for this gym.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
