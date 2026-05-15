import { ButtonLink } from "@/components/ui";
import { ManageGymPeopleTable, type ManageGymPerson } from "@/components/gym/manage-gym-people-table";
import { ManageGymTeamsTable, type ManageGymCoachOption, type ManageGymTeamAthleteScore, type ManageGymTeamRow } from "@/components/gym/manage-gym-teams-table";
import { requireAuthSession, type AppRole } from "@/lib/auth/session";
import { ensureOwnerProgramDirectorSeat, formatGymSeatRole } from "@/lib/services/gym-access";
import { loadActiveGymTeamSeasonState } from "@/lib/services/gym-team-seasons";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/types/database";

export const dynamic = "force-dynamic";

type GymRow = Pick<Database["public"]["Tables"]["gyms"]["Row"], "id" | "name" | "owner_profile_id">;
type WorkspaceRootRow = {
  id: string;
  scope_type: "coach" | "gym";
  gym_id: string | null;
  owner_profile_id: string | null;
};
type TeamRow = Pick<Database["public"]["Tables"]["teams"]["Row"], "id" | "division" | "metadata" | "name" | "primary_coach_profile_id">;
type AthleteRow = Pick<Database["public"]["Tables"]["athletes"]["Row"], "id" | "first_name" | "last_name" | "registration_number">;
type AssignmentRow = Pick<Database["public"]["Tables"]["athlete_team_assignments"]["Row"], "athlete_id" | "team_id">;
type PlannerTryoutRecordRow = Pick<Database["public"]["Tables"]["planner_tryout_records"]["Row"], "athlete_id" | "created_at" | "occurred_at" | "record">;
type LicenseRow = Pick<
  Database["public"]["Tables"]["gym_coach_licenses"]["Row"],
  "id" | "coach_profile_id" | "created_at" | "credential_levels" | "license_seat_name" | "seat_role" | "status"
>;
type TeamCoachRow = Pick<Database["public"]["Tables"]["team_coaches"]["Row"], "team_id" | "coach_profile_id">;
type ProfileRow = Pick<Database["public"]["Tables"]["profiles"]["Row"], "id" | "display_name" | "email">;

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

function uniqueRowsById<T extends { id: string }>(rows: T[]) {
  return Array.from(new Map(rows.map((row) => [row.id, row])).values());
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asMetadataString(metadata: Record<string, unknown>, key: string, fallback = "") {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatAthleteName(athlete: AthleteRow | null | undefined) {
  const name = [athlete?.first_name, athlete?.last_name].filter(Boolean).join(" ").trim();
  return name || "Unnamed athlete";
}

function formatEvaluationDate(value: string | null) {
  if (!value) {
    return "No tryout record";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "No tryout record";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(parsed);
}

function getTryoutRecordPayload(record: unknown) {
  const root = asRecord(record);
  const nestedRecord = asRecord(root.record);
  return Object.keys(nestedRecord).length ? nestedRecord : root;
}

function getTryoutScoreSummary(record: unknown) {
  const payload = getTryoutRecordPayload(record);
  const summary = asRecord(payload.resultSummary);
  const totalBaseScore = asNumber(summary.totalBaseScore) ?? 0;
  const totalExtraScore = asNumber(summary.totalExtraScore) ?? 0;
  const totalScore = totalBaseScore + totalExtraScore;
  const highlights = Array.isArray(summary.highlights) ? summary.highlights : [];
  const topHighlight = asRecord(highlights[0]);
  const qualifiedLevel = asMetadataString(topHighlight, "levelLabel", asMetadataString(topHighlight, "bucketLabel", "Not evaluated"));

  return {
    scoreLabel: totalScore > 0 ? formatNumber(totalScore) : "No score",
    qualifiedLevel
  };
}

async function loadLatestTryoutScores(admin: ReturnType<typeof createAdminClient>, athleteIds: string[]) {
  if (!athleteIds.length) {
    return new Map<string, Pick<ManageGymTeamAthleteScore, "scoreLabel" | "qualifiedLevel" | "lastEvaluatedAt">>();
  }

  const { data, error } = await admin
    .from("planner_tryout_records" as never)
    .select("athlete_id, created_at, occurred_at, record" as never)
    .in("athlete_id", athleteIds as never);

  if (error) {
    console.error("[manage-my-gym] Failed to load athlete tryout scores.", error);
    return new Map<string, Pick<ManageGymTeamAthleteScore, "scoreLabel" | "qualifiedLevel" | "lastEvaluatedAt">>();
  }

  const latestByAthleteId = new Map<string, PlannerTryoutRecordRow>();

  for (const row of (data ?? []) as PlannerTryoutRecordRow[]) {
    const current = latestByAthleteId.get(row.athlete_id);
    const rowTime = new Date(row.occurred_at ?? row.created_at).getTime();
    const currentTime = current ? new Date(current.occurred_at ?? current.created_at).getTime() : -1;

    if (!current || rowTime > currentTime) {
      latestByAthleteId.set(row.athlete_id, row);
    }
  }

  return new Map(Array.from(latestByAthleteId.entries()).map(([athleteId, row]) => {
    const scoreSummary = getTryoutScoreSummary(row.record);
    return [athleteId, {
      ...scoreSummary,
      lastEvaluatedAt: formatEvaluationDate(row.occurred_at ?? row.created_at)
    }];
  }));
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

async function resolveManageGymOverview(userId: string, primaryGymId: string | null, role: AppRole) {
  const admin = createAdminClient();
  let gymId = primaryGymId;
  let gymRow: GymRow | null = null;

  if (gymId) {
    const { data: linkedGym } = await admin
      .from("gyms" as never)
      .select("id, name, owner_profile_id" as never)
      .eq("id", gymId as never)
      .maybeSingle();

    gymRow = linkedGym as GymRow | null;
  }

  if (!gymId) {
    const { data: ownedGym } = await admin
      .from("gyms" as never)
      .select("id, name, owner_profile_id" as never)
      .eq("owner_profile_id", userId as never)
      .maybeSingle();

    gymRow = ownedGym as GymRow | null;
    gymId = gymRow?.id ?? null;
  }

  if (!gymId) {
    return {
      stats: [
        { label: "Active coaches", value: "0", copy: "No linked gym found" },
        { label: "Teams", value: "0", copy: "No linked gym found" },
        { label: "Athletes", value: "0", copy: "No linked gym found" }
      ],
      teams: [] as ManageGymTeamRow[],
      coachOptions: [] as ManageGymCoachOption[],
      people: [] as ManageGymPerson[],
      canManageAdministration: false
    };
  }

  if (gymRow) {
    await ensureOwnerProgramDirectorSeat(admin, gymRow, userId);
  }

  const gymOwnerProfileId = gymRow?.owner_profile_id ?? userId;
  const { data: workspaceRoots } = await admin
    .from("workspace_roots" as never)
    .select("id, scope_type, gym_id, owner_profile_id" as never)
    .or(`gym_id.eq.${gymId},owner_profile_id.eq.${gymOwnerProfileId}` as never);
  const relatedWorkspaceRootIds = ((workspaceRoots ?? []) as WorkspaceRootRow[])
    .filter((root) => (
      (root.scope_type === "gym" && root.gym_id === gymId)
      || (root.scope_type === "coach" && root.owner_profile_id === gymOwnerProfileId)
    ))
    .map((root) => root.id);

  const [licenseRows, gymTeamsResult, rootTeamsResult, gymAthletesResult, rootAthletesResult] = await Promise.all([
    loadGymLicenses(admin, gymId),
    admin
      .from("teams" as never)
      .select("id, division, metadata, name, primary_coach_profile_id" as never)
      .eq("gym_id", gymId as never)
      .is("deleted_at", null),
    relatedWorkspaceRootIds.length
      ? admin
        .from("teams" as never)
        .select("id, division, metadata, name, primary_coach_profile_id" as never)
        .in("workspace_root_id", relatedWorkspaceRootIds as never)
        .is("deleted_at", null)
      : Promise.resolve({ data: [] }),
    admin
      .from("athletes" as never)
      .select("id, first_name, last_name, registration_number" as never)
      .eq("gym_id", gymId as never)
      .is("deleted_at", null),
    relatedWorkspaceRootIds.length
      ? admin
        .from("athletes" as never)
        .select("id, first_name, last_name, registration_number" as never)
        .in("workspace_root_id", relatedWorkspaceRootIds as never)
        .is("deleted_at", null)
      : Promise.resolve({ data: [] })
  ]);

  let teamRows = uniqueRowsById([
    ...((gymTeamsResult.data ?? []) as TeamRow[]),
    ...((rootTeamsResult.data ?? []) as TeamRow[])
  ]);
  const activeSeasonState = await loadActiveGymTeamSeasonState(admin, gymId, userId);

  if (activeSeasonState?.profiles.length) {
    const activeProfiles = activeSeasonState.profiles.filter((profile) => profile.status === "active");
    const profileByTeamId = new Map(activeProfiles.map((profile) => [profile.team_id, profile]));
    const activeTeamIds = new Set(activeProfiles.map((profile) => profile.team_id));
    const missingTeamIds = Array.from(activeTeamIds).filter((teamId) => !teamRows.some((team) => team.id === teamId));

    if (missingTeamIds.length) {
      const { data: missingTeams } = await admin
        .from("teams" as never)
        .select("id, division, metadata, name, primary_coach_profile_id" as never)
        .in("id", missingTeamIds as never);

      teamRows = uniqueRowsById([
        ...teamRows,
        ...((missingTeams ?? []) as TeamRow[])
      ]);
    }

    teamRows = teamRows
      .filter((team) => activeTeamIds.has(team.id))
      .map((team) => {
        const profile = profileByTeamId.get(team.id);
        const metadata = asRecord(team.metadata);

        return profile
          ? {
            ...team,
            name: profile.name_snapshot || team.name,
            division: profile.division ?? team.division,
            metadata: {
              ...metadata,
              teamLevel: profile.level_label ?? asMetadataString(metadata, "teamLevel"),
              ageCategory: profile.category ?? asMetadataString(metadata, "ageCategory")
            }
          } as TeamRow
          : team;
      });
  }

  const teamIds = teamRows.map((team) => team.id);
  const gymAthletes = (gymAthletesResult.data ?? []) as AthleteRow[];
  const rootAthletes = (rootAthletesResult.data ?? []) as AthleteRow[];
  const athleteById = new Map<string, AthleteRow>([
    ...gymAthletes.map((athlete) => [athlete.id, athlete] as const),
    ...rootAthletes.map((athlete) => [athlete.id, athlete] as const)
  ]);
  const directAthleteIds = new Set([
    ...gymAthletes.map((athlete) => athlete.id),
    ...rootAthletes.map((athlete) => athlete.id)
  ]);
  const athleteCountsByTeamId = new Map<string, Set<string>>();
  const athleteIdsByTeamId = new Map<string, Set<string>>();
  const coachIdsByTeamId = new Map<string, Set<string>>();

  if (teamIds.length && activeSeasonState?.profiles.length) {
    const activeTeamIdSet = new Set(teamIds);

    for (const assignment of activeSeasonState.roster.filter((row) => activeTeamIdSet.has(row.team_id))) {
      directAthleteIds.add(assignment.athlete_id);
      const currentAthletes = athleteCountsByTeamId.get(assignment.team_id) ?? new Set<string>();
      currentAthletes.add(assignment.athlete_id);
      athleteCountsByTeamId.set(assignment.team_id, currentAthletes);
      const currentRosterAthletes = athleteIdsByTeamId.get(assignment.team_id) ?? new Set<string>();
      currentRosterAthletes.add(assignment.athlete_id);
      athleteIdsByTeamId.set(assignment.team_id, currentRosterAthletes);
    }

    for (const coach of activeSeasonState.coaches.filter((row) => activeTeamIdSet.has(row.team_id))) {
      const currentCoaches = coachIdsByTeamId.get(coach.team_id) ?? new Set<string>();
      currentCoaches.add(coach.coach_profile_id);
      coachIdsByTeamId.set(coach.team_id, currentCoaches);
    }
  } else if (teamIds.length) {
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
      const currentRosterAthletes = athleteIdsByTeamId.get(assignment.team_id) ?? new Set<string>();
      currentRosterAthletes.add(assignment.athlete_id);
      athleteIdsByTeamId.set(assignment.team_id, currentRosterAthletes);
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

  const missingAthleteIds = Array.from(directAthleteIds).filter((athleteId) => !athleteById.has(athleteId));
  if (missingAthleteIds.length) {
    const { data: missingAthletes } = await admin
      .from("athletes" as never)
      .select("id, first_name, last_name, registration_number" as never)
      .in("id", missingAthleteIds as never);

    for (const athlete of (missingAthletes ?? []) as AthleteRow[]) {
      athleteById.set(athlete.id, athlete);
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

  const currentUserLicense = licenseRows.find((license) => license.coach_profile_id === userId) ?? null;
  const canManageAdministration = role === "admin"
    || gymOwnerProfileId === userId
    || currentUserLicense?.seat_role === "program_director";
  const visibleTeamRows = canManageAdministration
    ? teamRows
    : teamRows.filter((team) => coachIdsByTeamId.get(team.id)?.has(userId));
  const visibleTeamIds = new Set(visibleTeamRows.map((team) => team.id));
  const visibleAthleteIds = canManageAdministration
    ? directAthleteIds
    : new Set(
      Array.from(visibleTeamIds).flatMap((teamId) => Array.from(athleteCountsByTeamId.get(teamId) ?? []))
    );
  const visibleRosterAthleteIds = Array.from(new Set(
    Array.from(visibleTeamIds).flatMap((teamId) => Array.from(athleteIdsByTeamId.get(teamId) ?? []))
  ));
  const latestTryoutScoresByAthleteId = await loadLatestTryoutScores(admin, visibleRosterAthleteIds);
  const teams = visibleTeamRows.map((team) => {
    const coachNames = Array.from(coachIdsByTeamId.get(team.id) ?? [])
      .map((coachId) => {
        const profile = profileById.get(coachId);
        return profile?.display_name || profile?.email || null;
      })
      .filter((name): name is string => Boolean(name));
    const athletes = Array.from(athleteIdsByTeamId.get(team.id) ?? [])
      .map((athleteId): ManageGymTeamAthleteScore => {
        const athlete = athleteById.get(athleteId);
        const score = latestTryoutScoresByAthleteId.get(athleteId);

        return {
          id: athleteId,
          name: formatAthleteName(athlete),
          registrationNumber: athlete?.registration_number ?? "",
          scoreLabel: score?.scoreLabel ?? "No score",
          qualifiedLevel: score?.qualifiedLevel ?? "Not evaluated",
          lastEvaluatedAt: score?.lastEvaluatedAt ?? "No tryout record"
        };
      })
      .sort((left, right) => left.name.localeCompare(right.name));

    return {
      id: team.id,
      name: team.name,
      athleteCount: athleteCountsByTeamId.get(team.id)?.size ?? 0,
      coachNames: coachNames.length ? coachNames.join(", ") : "No coaches assigned",
      athletes
    };
  });

  const teamCountsByCoachId = new Map<string, number>();

  for (const coachIdsForTeam of coachIdsByTeamId.values()) {
    for (const coachId of coachIdsForTeam) {
      teamCountsByCoachId.set(coachId, (teamCountsByCoachId.get(coachId) ?? 0) + 1);
    }
  }

  const people: ManageGymPerson[] = (canManageAdministration ? licenseRows : licenseRows.filter((license) => license.coach_profile_id === userId)).map((license) => {
    const profile = profileById.get(license.coach_profile_id);
    const name = profile?.display_name || license.license_seat_name || profile?.email || "Invited staff";
    const role = formatGymSeatRole(license.seat_role) as ManageGymPerson["role"];
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
      assignedTeamIds: Array.from(coachIdsByTeamId.entries())
        .filter(([, coachIdsForTeam]) => coachIdsForTeam.has(license.coach_profile_id))
        .map(([teamId]) => teamId),
      teams: teamCount ? `${teamCount} ${teamCount === 1 ? "team" : "teams"}` : "No teams",
      classes: "No classes"
    };
  });

  const coachOptions: ManageGymCoachOption[] = licenseRows
    .filter((license) => license.status === "active" && license.seat_role !== "staff")
    .map((license) => {
      const profile = profileById.get(license.coach_profile_id);

      return {
        id: license.coach_profile_id,
        name: profile?.display_name || license.license_seat_name || profile?.email || "Invited staff",
        role: formatGymSeatRole(license.seat_role) || "Coach"
      };
    });

  return {
    stats: [
      { label: "Active coaches", value: String(licenseRows.filter((license) => license.status === "active").length), copy: "Under assigned gym licenses" },
      { label: "Teams", value: String(visibleTeamRows.length), copy: canManageAdministration ? "Across all licensed coaches" : "Assigned to your account" },
      { label: "Athletes", value: String(visibleAthleteIds.size), copy: canManageAdministration ? "Visible at organization level" : "Assigned through your teams" }
    ],
    teams: teams.map((team) => {
      const metadata = asRecord((teamRows.find((row) => row.id === team.id) as TeamRow | undefined)?.metadata);
      const sourceTeam = teamRows.find((row) => row.id === team.id);
      const coachIds = Array.from(coachIdsByTeamId.get(team.id) ?? []);

      return {
        ...team,
        level: asMetadataString(metadata, "teamLevel", "Not set"),
        category: asMetadataString(metadata, "ageCategory", sourceTeam?.division ?? "Not set"),
        coachIds
      };
    }),
    coachOptions,
    people,
    canManageAdministration
  };
}

export default async function ManageMyGymPage() {
  const session = await requireAuthSession("gym");
  const { stats: gymStats, teams, coachOptions, people, canManageAdministration } = await resolveManageGymOverview(session.userId, session.primaryGymId, session.role);
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

      {canManageAdministration ? (
        <section className="surface-card panel-pad settings-section">
          <ManageGymPeopleTable initialPeople={people} availableTeams={teams.map((team) => ({ id: team.id, name: team.name }))} />
        </section>
      ) : null}

      <section className="surface-card panel-pad settings-section">
        <ManageGymTeamsTable initialTeams={teams} coachOptions={coachOptions} canManageTeams={canManageAdministration} />
      </section>
    </main>
  );
}
