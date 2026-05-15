import { ManageGymAthletesTable, type ManageGymAthleteParentContact, type ManageGymAthleteRow, type ManageGymAthleteTeamHistory, type ManageGymAthleteTryout } from "@/components/gym/manage-gym-athletes-table";
import { requireAuthSession } from "@/lib/auth/session";
import { getActiveAgeCategoryGrid, resolveEligibleAgeCategoriesFromGrid } from "@/lib/services/age-category-eligibility";
import { canManageGymAdministration, resolveGymAccessContext } from "@/lib/services/gym-access";
import { loadActiveGymTeamSeasonState } from "@/lib/services/gym-team-seasons";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/types/database";

export const dynamic = "force-dynamic";

type WorkspaceRootRow = {
  id: string;
  scope_type: "coach" | "gym";
  gym_id: string | null;
  owner_profile_id: string | null;
};
type AthleteRow = Pick<Database["public"]["Tables"]["athletes"]["Row"], "id" | "first_name" | "last_name" | "birth_date" | "registration_number" | "notes" | "parent_contacts" | "metadata" | "created_at">;
type TeamRow = Pick<Database["public"]["Tables"]["teams"]["Row"], "id" | "name">;
type GymSeasonRow = Pick<Database["public"]["Tables"]["gym_seasons"]["Row"], "id" | "label" | "season_number">;
type GymTeamSeasonRosterRow = Pick<Database["public"]["Tables"]["gym_team_season_roster"]["Row"], "id" | "athlete_id" | "gym_season_id" | "team_id">;
type GymTeamSeasonProfileRow = Pick<Database["public"]["Tables"]["gym_team_season_profiles"]["Row"], "gym_season_id" | "team_id" | "name_snapshot" | "level_label" | "category">;
type PlannerTryoutRecordRow = Pick<Database["public"]["Tables"]["planner_tryout_records"]["Row"], "id" | "athlete_id" | "created_at" | "occurred_at" | "record">;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseParentContacts(value: unknown): ManageGymAthleteParentContact[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item, index) => {
    const row = asRecord(item);
    const name = asString(row.name);
    const email = asString(row.email);
    const phone = asString(row.phone);

    return name || email || phone
      ? [{
        id: asString(row.id) || `parent-${index + 1}`,
        name,
        email,
        phone
      }]
      : [];
  });
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(parsed);
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function getTryoutPayload(record: unknown) {
  const root = asRecord(record);
  const nestedRecord = asRecord(root.record);
  return Object.keys(nestedRecord).length ? nestedRecord : root;
}

function buildTryoutSummary(row: PlannerTryoutRecordRow): ManageGymAthleteTryout {
  const payload = getTryoutPayload(row.record);
  const rawData = asRecord(payload.rawData);
  const summary = asRecord(payload.resultSummary);
  const totalBaseScore = asNumber(summary.totalBaseScore) ?? 0;
  const totalExtraScore = asNumber(summary.totalExtraScore) ?? 0;
  const sport = asString(payload.sport) || asString(rawData.sport) || "Tryout";
  const seasonLabel = asString(payload.gymSeasonLabel) || asString(payload.seasonLabel) || "No season";
  const occurredAt = row.occurred_at ?? row.created_at;

  return {
    id: row.id,
    label: sport,
    sport: sport.charAt(0).toUpperCase() + sport.slice(1),
    occurredAt: formatDate(occurredAt) || "No date",
    seasonLabel,
    scoreLabel: totalBaseScore + totalExtraScore > 0 ? formatNumber(totalBaseScore + totalExtraScore) : "No score"
  };
}

async function resolveRelatedWorkspaceRootIds(
  admin: ReturnType<typeof createAdminClient>,
  gymId: string,
  ownerProfileId: string | null
) {
  const { data: workspaceRoots } = ownerProfileId
    ? await admin
      .from("workspace_roots" as never)
      .select("id, scope_type, gym_id, owner_profile_id" as never)
      .or(`gym_id.eq.${gymId},owner_profile_id.eq.${ownerProfileId}` as never)
    : { data: [] as unknown[] };

  return ((workspaceRoots ?? []) as WorkspaceRootRow[])
    .filter((root) => (
      (root.scope_type === "gym" && root.gym_id === gymId)
      || (root.scope_type === "coach" && root.owner_profile_id === ownerProfileId)
    ))
    .map((root) => root.id);
}

async function loadPermanentAthletes(
  admin: ReturnType<typeof createAdminClient>,
  gymId: string,
  relatedWorkspaceRootIds: string[]
) {
  const [gymAthletesResult, rootAthletesResult] = await Promise.all([
    admin
      .from("athletes" as never)
      .select("id, first_name, last_name, birth_date, registration_number, notes, parent_contacts, metadata, created_at" as never)
      .eq("gym_id", gymId as never)
      .is("deleted_at", null),
    relatedWorkspaceRootIds.length
      ? admin
        .from("athletes" as never)
        .select("id, first_name, last_name, birth_date, registration_number, notes, parent_contacts, metadata, created_at" as never)
        .in("workspace_root_id", relatedWorkspaceRootIds as never)
        .is("deleted_at", null)
      : Promise.resolve({ data: [] })
  ]);
  const byId = new Map<string, AthleteRow>();

  for (const athlete of [
    ...((gymAthletesResult.data ?? []) as AthleteRow[]),
    ...((rootAthletesResult.data ?? []) as AthleteRow[])
  ]) {
    byId.set(athlete.id, athlete);
  }

  return [...byId.values()];
}

async function loadTeamHistory(
  admin: ReturnType<typeof createAdminClient>,
  gymId: string,
  athleteIds: string[]
) {
  if (!athleteIds.length) {
    return new Map<string, ManageGymAthleteTeamHistory[]>();
  }

  const { data: rosterRows } = await admin
    .from("gym_team_season_roster" as never)
    .select("id, athlete_id, gym_season_id, team_id" as never)
    .eq("gym_id", gymId as never)
    .in("athlete_id", athleteIds as never);
  const roster = (rosterRows ?? []) as GymTeamSeasonRosterRow[];

  if (!roster.length) {
    return new Map<string, ManageGymAthleteTeamHistory[]>();
  }

  const seasonIds = Array.from(new Set(roster.map((row) => row.gym_season_id)));
  const teamIds = Array.from(new Set(roster.map((row) => row.team_id)));
  const [seasonsResult, profilesResult, teamsResult] = await Promise.all([
    admin
      .from("gym_seasons" as never)
      .select("id, label, season_number" as never)
      .in("id", seasonIds as never),
    admin
      .from("gym_team_season_profiles" as never)
      .select("gym_season_id, team_id, name_snapshot, level_label, category" as never)
      .eq("gym_id", gymId as never)
      .in("gym_season_id", seasonIds as never),
    admin
      .from("teams" as never)
      .select("id, name" as never)
      .in("id", teamIds as never)
  ]);
  const seasonById = new Map(((seasonsResult.data ?? []) as GymSeasonRow[]).map((season) => [season.id, season]));
  const profileByKey = new Map(((profilesResult.data ?? []) as GymTeamSeasonProfileRow[]).map((profile) => [`${profile.gym_season_id}:${profile.team_id}`, profile]));
  const teamById = new Map(((teamsResult.data ?? []) as TeamRow[]).map((team) => [team.id, team]));
  const historyByAthleteId = new Map<string, ManageGymAthleteTeamHistory[]>();

  for (const row of roster) {
    const season = seasonById.get(row.gym_season_id);
    const profile = profileByKey.get(`${row.gym_season_id}:${row.team_id}`);
    const team = teamById.get(row.team_id);
    const history = historyByAthleteId.get(row.athlete_id) ?? [];

    history.push({
      id: row.id,
      seasonLabel: season?.label || (season?.season_number ? `Season ${season.season_number}` : "Unknown season"),
      teamName: profile?.name_snapshot || team?.name || "Unknown team",
      level: profile?.level_label || "Not set",
      category: profile?.category || "Not set"
    });
    historyByAthleteId.set(row.athlete_id, history);
  }

  return historyByAthleteId;
}

async function loadTryoutsByAthlete(
  admin: ReturnType<typeof createAdminClient>,
  athleteIds: string[]
) {
  if (!athleteIds.length) {
    return new Map<string, ManageGymAthleteTryout[]>();
  }

  const { data } = await admin
    .from("planner_tryout_records" as never)
    .select("id, athlete_id, created_at, occurred_at, record" as never)
    .in("athlete_id", athleteIds as never)
    .is("deleted_at", null)
    .order("occurred_at", { ascending: false });
  const tryoutsByAthleteId = new Map<string, ManageGymAthleteTryout[]>();

  for (const row of (data ?? []) as PlannerTryoutRecordRow[]) {
    const current = tryoutsByAthleteId.get(row.athlete_id) ?? [];
    current.push(buildTryoutSummary(row));
    tryoutsByAthleteId.set(row.athlete_id, current);
  }

  return tryoutsByAthleteId;
}

export default async function ManageGymAthletesPage() {
  const session = await requireAuthSession("gym");
  const access = await resolveGymAccessContext(session, { ensureOwnerSeat: true });

  if (!access) {
    return (
      <main className="workspace-shell page-stack">
        <section className="surface-card panel-pad settings-hero">
          <div className="metric-label">Manage my gym</div>
          <h1 className="page-title settings-title">Athletes</h1>
          <p className="page-copy">No Gym organization is linked to this account yet.</p>
        </section>
      </main>
    );
  }

  const admin = createAdminClient();
  const canEditAthletes = canManageGymAdministration(access);
  const relatedWorkspaceRootIds = await resolveRelatedWorkspaceRootIds(admin, access.gym.id, access.gym.owner_profile_id);
  const activeSeasonState = await loadActiveGymTeamSeasonState(admin, access.gym.id, session.userId);
  let athleteRows = await loadPermanentAthletes(admin, access.gym.id, relatedWorkspaceRootIds);

  if (!canEditAthletes) {
    const assignedTeamIds = new Set(
      (activeSeasonState?.coaches ?? [])
        .filter((coach) => coach.coach_profile_id === session.userId)
        .map((coach) => coach.team_id)
    );
    const visibleAthleteIds = new Set(
      (activeSeasonState?.roster ?? [])
        .filter((row) => assignedTeamIds.has(row.team_id))
        .map((row) => row.athlete_id)
    );

    athleteRows = athleteRows.filter((athlete) => visibleAthleteIds.has(athlete.id));
  }

  const athleteIds = athleteRows.map((athlete) => athlete.id);
  const activeSeasonLabel = activeSeasonState?.season.label ?? null;
  const [historyByAthleteId, tryoutsByAthleteId, activeAgeGrid] = await Promise.all([
    loadTeamHistory(admin, access.gym.id, athleteIds),
    loadTryoutsByAthlete(admin, athleteIds),
    getActiveAgeCategoryGrid(activeSeasonLabel, admin)
  ]);
  const athletes: ManageGymAthleteRow[] = athleteRows.map((athlete) => {
    const metadata = asRecord(athlete.metadata);
    const parentContacts = parseParentContacts(athlete.parent_contacts);
    const fallbackParentContacts = parseParentContacts(metadata.parentContacts);
    const firstName = athlete.first_name?.trim() ?? "";
    const lastName = athlete.last_name?.trim() ?? "";

    return {
      id: athlete.id,
      firstName,
      lastName,
      name: [firstName, lastName].filter(Boolean).join(" ").trim() || "Unnamed athlete",
      dateOfBirth: athlete.birth_date ?? "",
      registrationNumber: athlete.registration_number ?? asString(metadata.registrationNumber),
      notes: athlete.notes ?? asString(metadata.notes),
      parentContacts: parentContacts.length ? parentContacts : fallbackParentContacts,
      eligibility: resolveEligibleAgeCategoriesFromGrid(athlete.birth_date ?? "", activeSeasonLabel, activeAgeGrid),
      tryouts: tryoutsByAthleteId.get(athlete.id) ?? [],
      teamHistory: historyByAthleteId.get(athlete.id) ?? []
    };
  }).sort((left, right) => left.name.localeCompare(right.name));

  return (
    <main className="workspace-shell page-stack">
      <section className="surface-card panel-pad settings-hero">
        <div className="metric-label">Manage my gym</div>
        <h1 className="page-title settings-title">Athletes</h1>
        <p className="page-copy">
          Athlete profiles remain permanent across seasons. Team assignments, tryout results, and roster movement are tracked as seasonal history.
        </p>
      </section>

      <section className="surface-card panel-pad settings-section">
        <ManageGymAthletesTable initialAthletes={athletes} canEditAthletes={canEditAthletes} />
      </section>
    </main>
  );
}
