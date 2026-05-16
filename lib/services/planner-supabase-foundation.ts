import type { AthleteParentContact, AthleteRecord } from "@/lib/domain/athlete";
import type { AuthSession } from "@/lib/auth/session";
import type { TryoutRecord } from "@/lib/domain/evaluation-record";
import type { PlannerLevelLabel } from "@/lib/domain/planner-levels";
import type { PlannerProject } from "@/lib/domain/planner-project";
import type { TeamRoutinePlan } from "@/lib/domain/routine-plan";
import type { TeamSeasonPlan } from "@/lib/domain/season-plan";
import type { TeamSkillPlan } from "@/lib/domain/skill-plan";
import type { TeamRecord } from "@/lib/domain/team";
import type { SyncMetadata, WorkspaceRoot } from "@/lib/domain/planner-versioning";
import type { PlannerAccessContext } from "@/lib/services/planner-capabilities";
import {
  normalizePlannerTryoutRecord,
  normalizePlannerTeam,
  normalizePlannerProject,
  normalizeTeamRoutinePlan,
  normalizeTeamSeasonPlan,
  normalizeTeamSkillPlan
} from "@/lib/services/planner-domain-mappers";
import { deriveRoutineItemsFromDocument, normalizeRoutineDocument } from "@/lib/services/planner-routine-builder";
import {
  loadActiveGymTeamSeasonState,
  type GymActiveTeamSeasonState
} from "@/lib/services/gym-team-seasons";
import {
  buildDefaultPlannerProject,
  isUuidString,
  parsePlannerWorkspaceScope,
  type PlannerScopeContext,
  type PlannerWorkspaceScope
} from "@/lib/services/planner-workspace";
import { getPlannerSyncMetadata, resolveWorkspaceRoot } from "@/lib/services/planner-command-service";
import { createAdminClient } from "@/lib/supabase/admin";
import { defaultQualificationRules, defaultTryoutTemplate, defaultTryoutTemplates } from "@/lib/tools/cheer-planner-tryouts";
import type { Database, Json } from "@/lib/types/database";

type TeamRow = Database["public"]["Tables"]["teams"]["Row"];
type TeamCoachRow = Database["public"]["Tables"]["team_coaches"]["Row"];
type AthleteRow = Database["public"]["Tables"]["athletes"]["Row"];
type AthleteAssignmentRow = Database["public"]["Tables"]["athlete_team_assignments"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type TeamRoutinePlanRow = Database["public"]["Tables"]["team_routine_plans"]["Row"];
type PlannerProjectRow = Database["public"]["Tables"]["planner_projects"]["Row"];
type PlannerTryoutRecordRow = Database["public"]["Tables"]["planner_tryout_records"]["Row"];
type TeamSkillPlanRow = Database["public"]["Tables"]["team_skill_plans"]["Row"];
type TeamSeasonPlanRow = Database["public"]["Tables"]["team_season_plans"]["Row"];
type GymOwnerRow = Pick<Database["public"]["Tables"]["gyms"]["Row"], "owner_profile_id">;
type WorkspaceRootLookupRow = {
  id: string;
  scope_type: "coach" | "gym";
  gym_id: string | null;
  owner_profile_id: string | null;
};

type TeamMetadata = {
  teamLevel?: string;
  ageCategory?: string;
  trainingDays?: string;
  trainingHours?: string;
  assignedCoachNames?: string[];
  linkedCoachIds?: string[];
  selectionProfile?: unknown;
};

type AthleteMetadata = {
  registrationNumber?: string;
  notes?: string;
  parentContacts?: AthleteParentContact[];
  createdByProfileId?: string;
};

type VersionedRow = {
  workspace_root_id?: string | null;
  lock_version?: number;
  archived_at?: string | null;
  deleted_at?: string | null;
  restored_from_version_id?: string | null;
  last_change_set_id?: string | null;
};

export type PlannerRemoteFoundationSnapshot = {
  workspaceRoot: WorkspaceRoot;
  plannerProject: PlannerProject;
  permissions: PlannerAccessContext;
  assignments: Array<{ id: string; athleteId: string; teamId: string; createdAt: string; updatedAt: string; lockVersion?: number }>;
  athletes: AthleteRecord[];
  tryoutRecords: TryoutRecord[];
  teams: TeamRecord[];
  skillPlans: TeamSkillPlan[];
  routinePlans: TeamRoutinePlan[];
  seasonPlans: TeamSeasonPlan[];
  syncMetadata: SyncMetadata;
};

const AGE_CATEGORY_FALLBACK = "Youth";
const TEAM_LEVEL_FALLBACK: PlannerLevelLabel = "Beginner";

function asObject(value: Json | unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => asString(item)).filter(Boolean)
    : [];
}

function parseParentContacts(value: unknown): AthleteParentContact[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((contact, index) => {
    if (!contact || typeof contact !== "object" || Array.isArray(contact)) {
      return [];
    }

    const row = contact as Record<string, unknown>;

    return [{
      id: asString(row.id) || `parent-contact-${index + 1}`,
      name: asString(row.name),
      email: asString(row.email),
      phone: asString(row.phone)
    }];
  });
}

function parseTeamLevel(value: unknown): PlannerLevelLabel {
  return (
    value === "Beginner"
    || value === "Level 1"
    || value === "Level 2"
    || value === "Level 3"
    || value === "Level 4"
    || value === "Level 5"
    || value === "Level 6"
    || value === "Level 7"
  ) ? value : TEAM_LEVEL_FALLBACK;
}

function buildWorkspaceId(workspaceRoot: WorkspaceRoot) {
  return `workspace:${workspaceRoot.scopeType}:${workspaceRoot.id}`;
}

function buildFallbackScopeContext(workspaceRoot: WorkspaceRoot): PlannerScopeContext {
  return {
    scope: workspaceRoot.scopeType,
    scopeType: workspaceRoot.scopeType,
    projectId: `planner-project:${workspaceRoot.id}`,
    workspaceId: buildWorkspaceId(workspaceRoot),
    ownerProfileId: workspaceRoot.ownerProfileId,
    gymId: workspaceRoot.gymId
  };
}

function getWorkspaceRootId(row: VersionedRow) {
  return row.workspace_root_id ?? undefined;
}

function getLockVersion(row: VersionedRow) {
  return row.lock_version ?? 1;
}

function getLastChangeSetId(row: VersionedRow) {
  return row.last_change_set_id ?? null;
}

function getArchivedAt(row: VersionedRow) {
  return row.archived_at ?? null;
}

function getDeletedAt(row: VersionedRow) {
  return row.deleted_at ?? null;
}

function getRestoredFromVersionId(row: VersionedRow) {
  return row.restored_from_version_id ?? null;
}

export function buildPlannerAthleteFromRow(row: AthleteRow, workspaceId: string): AthleteRecord {
  const metadata = asObject(row.metadata) as AthleteMetadata;
  const firstName = row.first_name.trim();
  const lastName = row.last_name.trim();
  const versionedRow = row as AthleteRow & VersionedRow;
  const registrationNumber = asString(row.registration_number) || asString(metadata.registrationNumber) || row.id.slice(0, 8).toUpperCase();
  const notes = asString(row.notes) || asString(metadata.notes);
  const parentContacts = parseParentContacts(row.parent_contacts);
  const fallbackParentContacts = parseParentContacts(metadata.parentContacts);

  return {
    id: row.id,
    workspaceId,
    workspaceRootId: getWorkspaceRootId(versionedRow),
    registrationNumber,
    firstName,
    lastName,
    name: [firstName, lastName].filter(Boolean).join(" ").trim(),
    dateOfBirth: row.birth_date ?? "",
    notes,
    parentContacts: parentContacts.length ? parentContacts : fallbackParentContacts,
    status: "active",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lockVersion: getLockVersion(versionedRow),
    lastChangeSetId: getLastChangeSetId(versionedRow),
    archivedAt: getArchivedAt(versionedRow),
    deletedAt: getDeletedAt(versionedRow),
    restoredFromVersionId: getRestoredFromVersionId(versionedRow),
    athleteNotes: notes
  };
}

function buildTeamRecord(
  row: TeamRow,
  coachRows: TeamCoachRow[],
  athleteAssignments: AthleteAssignmentRow[],
  athleteMap: Map<string, AthleteRecord>,
  workspaceId: string
): TeamRecord {
  const metadata = asObject(row.metadata) as TeamMetadata;
  const versionedRow = row as TeamRow & VersionedRow;
  const linkedCoachIds = asStringArray(metadata.linkedCoachIds);
  const memberAthleteIds = athleteAssignments
    .filter((assignment) => assignment.team_id === row.id)
    .map((assignment) => assignment.athlete_id);

  return normalizePlannerTeam({
    id: row.id,
    workspaceId,
    workspaceRootId: getWorkspaceRootId(versionedRow),
    remoteTeamId: row.id,
    name: row.name.trim(),
    teamLevel: parseTeamLevel(metadata.teamLevel),
    teamType: asString(metadata.ageCategory) || AGE_CATEGORY_FALLBACK,
    teamDivision: asString(row.division),
    trainingDays: asString(metadata.trainingDays),
    trainingHours: asString(metadata.trainingHours),
    trainingSchedule: [asString(metadata.trainingDays), asString(metadata.trainingHours)].filter(Boolean).join(" / "),
    assignedCoachNames: asStringArray(metadata.assignedCoachNames),
    linkedCoachIds: linkedCoachIds.length ? linkedCoachIds : coachRows.filter((coach) => coach.team_id === row.id).map((coach) => coach.coach_profile_id),
    memberAthleteIds,
    memberRegistrationNumbers: memberAthleteIds
      .map((athleteId) => athleteMap.get(athleteId)?.registrationNumber ?? "")
      .filter(Boolean),
    selectionProfile: metadata.selectionProfile as TeamRecord["selectionProfile"] | undefined,
    status: "draft",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lockVersion: getLockVersion(versionedRow),
    lastChangeSetId: getLastChangeSetId(versionedRow),
    archivedAt: getArchivedAt(versionedRow),
    deletedAt: getDeletedAt(versionedRow),
    restoredFromVersionId: getRestoredFromVersionId(versionedRow)
  });
}

export function buildPlannerProjectFromRow(row: PlannerProjectRow, workspaceId: string): PlannerProject {
  const versionedRow = row as PlannerProjectRow & VersionedRow;

  return normalizePlannerProject({
    id: row.id,
    workspaceId,
    workspaceRootId: getWorkspaceRootId(versionedRow),
    name: row.name,
    status: row.status as PlannerProject["status"],
    pipelineStage: row.pipeline_stage as PlannerProject["pipelineStage"],
    template: asObject(row.template) as PlannerProject["template"],
    qualificationRules: asObject(row.qualification_rules) as PlannerProject["qualificationRules"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lockVersion: getLockVersion(versionedRow),
    lastChangeSetId: getLastChangeSetId(versionedRow),
    archivedAt: getArchivedAt(versionedRow),
    deletedAt: getDeletedAt(versionedRow),
    restoredFromVersionId: getRestoredFromVersionId(versionedRow)
  }, defaultTryoutTemplate, defaultQualificationRules, defaultTryoutTemplates);
}

export function buildPlannerTryoutRecordFromRow(row: PlannerTryoutRecordRow, workspaceId: string): TryoutRecord {
  const record = asObject(row.record) as Parameters<typeof normalizePlannerTryoutRecord>[0];
  const versionedRow = row as PlannerTryoutRecordRow & VersionedRow;

  return normalizePlannerTryoutRecord({
    ...record,
    id: row.id,
    workspaceId,
    athleteId: row.athlete_id,
    plannerProjectId: row.planner_project_id,
    occurredAt: row.occurred_at ?? record.occurredAt ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    workspaceRootId: getWorkspaceRootId(versionedRow),
    lockVersion: getLockVersion(versionedRow),
    lastChangeSetId: getLastChangeSetId(versionedRow),
    archivedAt: getArchivedAt(versionedRow),
    deletedAt: getDeletedAt(versionedRow),
    restoredFromVersionId: getRestoredFromVersionId(versionedRow)
  });
}

export function buildTeamSkillPlanFromRow(row: TeamSkillPlanRow, workspaceId: string): TeamSkillPlan {
  const versionedRow = row as TeamSkillPlanRow & VersionedRow;

  return normalizeTeamSkillPlan({
    id: row.id,
    workspaceId,
    plannerProjectId: row.planner_project_id,
    teamId: row.team_id,
    status: row.status as TeamSkillPlan["status"],
    notes: row.notes,
    selections: Array.isArray(row.selections) ? row.selections as TeamSkillPlan["selections"] : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    workspaceRootId: getWorkspaceRootId(versionedRow),
    lockVersion: getLockVersion(versionedRow),
    lastChangeSetId: getLastChangeSetId(versionedRow),
    archivedAt: getArchivedAt(versionedRow),
    deletedAt: getDeletedAt(versionedRow),
    restoredFromVersionId: getRestoredFromVersionId(versionedRow)
  });
}

export function buildTeamSeasonPlanFromRow(row: TeamSeasonPlanRow, workspaceId: string): TeamSeasonPlan {
  const versionedRow = row as TeamSeasonPlanRow & VersionedRow;

  return normalizeTeamSeasonPlan({
    id: row.id,
    workspaceId,
    plannerProjectId: row.planner_project_id,
    teamId: row.team_id,
    status: row.status as TeamSeasonPlan["status"],
    notes: row.notes,
    checkpoints: Array.isArray(row.checkpoints) ? row.checkpoints as TeamSeasonPlan["checkpoints"] : [],
    manualEntries: Array.isArray((row as TeamSeasonPlanRow & { manual_entries?: unknown }).manual_entries)
      ? (row as TeamSeasonPlanRow & { manual_entries?: TeamSeasonPlan["manualEntries"] }).manual_entries ?? []
      : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    workspaceRootId: getWorkspaceRootId(versionedRow),
    lockVersion: getLockVersion(versionedRow),
    lastChangeSetId: getLastChangeSetId(versionedRow),
    archivedAt: getArchivedAt(versionedRow),
    deletedAt: getDeletedAt(versionedRow),
    restoredFromVersionId: getRestoredFromVersionId(versionedRow)
  });
}

export function buildRoutinePlanFromRow(row: TeamRoutinePlanRow, workspaceId: string): TeamRoutinePlan {
  const versionedRow = row as TeamRoutinePlanRow & VersionedRow;
  const document = normalizeRoutineDocument(asObject(row.document) as TeamRoutinePlan["document"], "Routine Builder");

  return normalizeTeamRoutinePlan({
    id: row.id,
    workspaceId,
    plannerProjectId: row.planner_project_id,
    teamId: row.team_id,
    status: row.status as TeamRoutinePlan["status"],
    notes: row.notes,
    document,
    items: deriveRoutineItemsFromDocument(document),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    workspaceRootId: getWorkspaceRootId(versionedRow),
    lockVersion: getLockVersion(versionedRow),
    lastChangeSetId: getLastChangeSetId(versionedRow),
    archivedAt: getArchivedAt(versionedRow),
    deletedAt: getDeletedAt(versionedRow),
    restoredFromVersionId: getRestoredFromVersionId(versionedRow)
  });
}

function findExistingTeam(project: PlannerProject, remoteTeam: TeamRecord) {
  return project.teams.find((team) => (
    team.remoteTeamId === remoteTeam.remoteTeamId
    || team.id === remoteTeam.remoteTeamId
  )) ?? null;
}

function mergeRemoteTeams(project: PlannerProject, remoteTeams: TeamRecord[]) {
  const mergedRemoteTeams = remoteTeams.map((remoteTeam) => {
    const existingTeam = findExistingTeam(project, remoteTeam);

    if (!existingTeam) {
      return remoteTeam;
    }

    return {
      ...remoteTeam,
      id: existingTeam.id,
      remoteTeamId: remoteTeam.remoteTeamId ?? existingTeam.remoteTeamId ?? remoteTeam.id
    };
  });

  const mergedRemoteIds = new Set(mergedRemoteTeams.map((team) => team.remoteTeamId || team.id));
  const localOnlyTeams = project.teams.filter((team) => {
    const lookupId = team.remoteTeamId || team.id;
    return (
      !mergedRemoteIds.has(lookupId)
      && !team.remoteTeamId
      && !isUuidString(team.id)
    );
  });

  return [...mergedRemoteTeams, ...localOnlyTeams];
}

function mergeRemoteAthletes(project: PlannerProject, remoteAthletes: AthleteRecord[]) {
  const remoteIds = new Set(remoteAthletes.map((athlete) => athlete.id));
  const remoteRegistrations = new Set(remoteAthletes.map((athlete) => athlete.registrationNumber));
  const localOnlyAthletes = project.athletes.filter((athlete) => (
    !remoteIds.has(athlete.id)
    && !remoteRegistrations.has(athlete.registrationNumber)
    && !isUuidString(athlete.id)
  ));

  return [...remoteAthletes, ...localOnlyAthletes];
}

function buildTeamIdMap(teams: TeamRecord[]) {
  const teamIdMap = new Map<string, string>();

  teams.forEach((team) => {
    teamIdMap.set(team.id, team.id);
    if (team.remoteTeamId) {
      teamIdMap.set(team.remoteTeamId, team.id);
    }
  });

  return teamIdMap;
}

function mergeTeamScopedPlans<T extends { teamId: string }>(
  localPlans: T[],
  mergedTeams: TeamRecord[],
  remotePlans: T[]
) {
  const teamIdMap = buildTeamIdMap(mergedTeams);
  const mappedRemotePlans = remotePlans.map((plan) => ({
    ...plan,
    teamId: teamIdMap.get(plan.teamId) ?? plan.teamId
  }));
  const remoteTeamIds = new Set(mappedRemotePlans.map((plan) => plan.teamId));
  const validMergedTeamIds = new Set(mergedTeams.map((team) => team.id));
  const localOnlyPlans = localPlans.filter((plan) => (
    !remoteTeamIds.has(plan.teamId) && validMergedTeamIds.has(plan.teamId)
  ));

  return [...mappedRemotePlans, ...localOnlyPlans];
}

function mergeEntityList<T extends { id: string }>(localItems: T[], remoteItems: T[]) {
  const remoteIds = new Set(remoteItems.map((item) => item.id));
  const localOnlyItems = localItems.filter((item) => !remoteIds.has(item.id) && !isUuidString(item.id));
  return [...remoteItems, ...localOnlyItems];
}

function mergeProjectConfig(localProject: PlannerProject, remoteProject: PlannerProject, merged: Omit<PlannerProject, "name" | "status" | "pipelineStage" | "template" | "tryoutTemplates" | "qualificationRules" | "workspaceId" | "id" | "createdAt" | "updatedAt">) {
  const localUpdatedAt = Date.parse(localProject.updatedAt);
  const remoteUpdatedAt = Date.parse(remoteProject.updatedAt);
  const configSource = Number.isFinite(localUpdatedAt) && localUpdatedAt > remoteUpdatedAt
    ? localProject
    : remoteProject;

  return normalizePlannerProject({
    id: remoteProject.id,
    workspaceId: remoteProject.workspaceId,
    workspaceRootId: remoteProject.workspaceRootId,
    name: configSource.name,
    status: configSource.status,
    pipelineStage: configSource.pipelineStage,
    template: configSource.template,
    tryoutTemplates: configSource.tryoutTemplates,
    qualificationRules: configSource.qualificationRules,
    athletes: merged.athletes,
    tryoutRecords: merged.tryoutRecords,
    teams: merged.teams,
    skillPlans: merged.skillPlans,
    routinePlans: merged.routinePlans,
    seasonPlans: merged.seasonPlans,
    createdAt: remoteProject.createdAt,
    updatedAt: Math.max(localUpdatedAt || 0, remoteUpdatedAt || 0) === localUpdatedAt ? localProject.updatedAt : remoteProject.updatedAt,
    lockVersion: remoteProject.lockVersion,
    lastChangeSetId: remoteProject.lastChangeSetId,
    archivedAt: remoteProject.archivedAt,
    deletedAt: remoteProject.deletedAt,
    restoredFromVersionId: remoteProject.restoredFromVersionId
  }, remoteProject.template, remoteProject.qualificationRules, defaultTryoutTemplates);
}

export function mergeRemoteFoundationIntoProject(
  project: PlannerProject,
  snapshot: PlannerRemoteFoundationSnapshot
): PlannerProject {
  const teams = mergeRemoteTeams(project, snapshot.teams);
  const athletes = mergeRemoteAthletes(project, snapshot.athletes);
  const merged = {
    athletes,
    tryoutRecords: mergeEntityList(project.tryoutRecords, snapshot.tryoutRecords),
    teams,
    skillPlans: mergeTeamScopedPlans(project.skillPlans, teams, snapshot.skillPlans),
    routinePlans: mergeTeamScopedPlans(project.routinePlans, teams, snapshot.routinePlans),
    seasonPlans: mergeTeamScopedPlans(project.seasonPlans, teams, snapshot.seasonPlans)
  };

  return mergeProjectConfig(project, snapshot.plannerProject, merged);
}

async function listCoachDisplayNames(teamCoachRows: TeamCoachRow[]) {
  const coachIds = Array.from(new Set(teamCoachRows.map((row) => row.coach_profile_id)));

  if (!coachIds.length) {
    return new Map<string, string>();
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles" as never)
    .select("id, display_name, email" as never)
    .in("id", coachIds as never);

  return new Map(
    ((data ?? []) as Array<Pick<ProfileRow, "id" | "display_name" | "email">>).map((profile) => [
      profile.id,
      profile.display_name?.trim() || profile.email?.trim() || "Coach"
    ] as const)
  );
}

export async function ensurePlannerProjectRow(workspaceRoot: WorkspaceRoot) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("planner_ensure_project_row" as never, {
    p_workspace_root_id: workspaceRoot.id
  } as never);

  if (error) {
    throw error;
  }

  return (data ?? null) as PlannerProjectRow | null;
}

async function listWorkspaceRows<T extends Record<string, unknown>>(
  table: string,
  workspaceRootId: string,
  orderColumn = "created_at"
) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from(table as never)
    .select("*" as never)
    .eq("workspace_root_id", workspaceRootId as never)
    .is("deleted_at" as never, null)
    .order(orderColumn as never, { ascending: false });

  if (error) {
    if (error.code === "42P01" || error.code === "42703") {
      return [] as T[];
    }

    throw error;
  }

  return (data ?? []) as T[];
}

async function listRowsByIds<T extends Record<string, unknown>>(table: string, ids: string[]) {
  if (!ids.length) {
    return [] as T[];
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from(table as never)
    .select("*" as never)
    .in("id", ids as never);

  if (error) {
    if (error.code === "42P01" || error.code === "42703") {
      return [] as T[];
    }

    throw error;
  }

  return (data ?? []) as T[];
}

function mergeRowsById<T extends { id: string }>(rows: T[], extraRows: T[]) {
  const byId = new Map<string, T>();

  for (const row of [...rows, ...extraRows]) {
    byId.set(row.id, row);
  }

  return [...byId.values()];
}

async function listGymRelatedWorkspaceRootIds(
  admin: ReturnType<typeof createAdminClient>,
  workspaceRoot: WorkspaceRoot
) {
  if (!workspaceRoot.gymId) {
    return [workspaceRoot.id];
  }

  const { data: gymRow } = await admin
    .from("gyms" as never)
    .select("owner_profile_id" as never)
    .eq("id", workspaceRoot.gymId as never)
    .maybeSingle();
  const ownerProfileIds = Array.from(new Set([
    workspaceRoot.ownerProfileId,
    (gymRow as GymOwnerRow | null)?.owner_profile_id ?? null
  ].filter((value): value is string => Boolean(value))));
  const { data: gymRootRows } = await admin
    .from("workspace_roots" as never)
    .select("id, scope_type, gym_id, owner_profile_id" as never)
    .eq("gym_id", workspaceRoot.gymId as never);
  const { data: ownerRootRows } = ownerProfileIds.length
    ? await admin
      .from("workspace_roots" as never)
      .select("id, scope_type, gym_id, owner_profile_id" as never)
      .in("owner_profile_id", ownerProfileIds as never)
    : { data: [] as unknown[] };
  const relatedRootIds = ([...(gymRootRows ?? []), ...(ownerRootRows ?? [])] as WorkspaceRootLookupRow[])
    .filter((root) => (
      (root.scope_type === "gym" && root.gym_id === workspaceRoot.gymId)
      || (root.scope_type === "coach" && typeof root.owner_profile_id === "string" && ownerProfileIds.includes(root.owner_profile_id))
    ))
    .map((root) => root.id);

  return Array.from(new Set([workspaceRoot.id, ...relatedRootIds]));
}

async function listGymPermanentAthleteRows(
  admin: ReturnType<typeof createAdminClient>,
  workspaceRoot: WorkspaceRoot,
  seedRows: AthleteRow[]
) {
  if (!workspaceRoot.gymId) {
    return seedRows;
  }

  const relatedRootIds = await listGymRelatedWorkspaceRootIds(admin, workspaceRoot);
  const [gymAthletesResult, rootAthletesResult] = await Promise.all([
    admin
      .from("athletes" as never)
      .select("*" as never)
      .eq("gym_id", workspaceRoot.gymId as never)
      .is("deleted_at" as never, null),
    relatedRootIds.length
      ? admin
        .from("athletes" as never)
        .select("*" as never)
        .in("workspace_root_id", relatedRootIds as never)
        .is("deleted_at" as never, null)
      : Promise.resolve({ data: [] as unknown[] })
  ]);

  return mergeRowsById(
    seedRows,
    [
      ...((gymAthletesResult.data ?? []) as AthleteRow[]),
      ...((rootAthletesResult.data ?? []) as AthleteRow[])
    ]
  );
}

async function listTryoutRowsForAthletes(
  admin: ReturnType<typeof createAdminClient>,
  athleteIds: string[],
  seedRows: PlannerTryoutRecordRow[]
) {
  if (!athleteIds.length) {
    return seedRows;
  }

  const { data, error } = await admin
    .from("planner_tryout_records" as never)
    .select("*" as never)
    .in("athlete_id", athleteIds as never)
    .is("deleted_at" as never, null)
    .order("occurred_at" as never, { ascending: false });

  if (error) {
    if (error.code === "42P01" || error.code === "42703") {
      return seedRows;
    }

    throw error;
  }

  return mergeRowsById(seedRows, (data ?? []) as PlannerTryoutRecordRow[]);
}

async function applyActiveGymSeasonStateToFoundation(
  workspaceRoot: WorkspaceRoot,
  rawTeamRows: TeamRow[],
  rawAssignmentRows: AthleteAssignmentRow[],
  rawAthleteRows: AthleteRow[],
  activeSeasonState: GymActiveTeamSeasonState | null
) {
  if (!activeSeasonState?.profiles.length) {
    return {
      teamRows: rawTeamRows,
      assignmentRows: rawAssignmentRows,
      athleteRows: rawAthleteRows,
      teamCoachRows: null as TeamCoachRow[] | null
    };
  }

  const activeProfiles = activeSeasonState.profiles.filter((profile) => profile.status === "active");
  const activeProfileByTeamId = new Map(activeProfiles.map((profile) => [profile.team_id, profile]));
  const seasonalTeamIds = new Set(activeProfiles.map((profile) => profile.team_id));
  const knownTeamIds = new Set(rawTeamRows.map((team) => team.id));
  const missingTeamIds = [...seasonalTeamIds].filter((teamId) => !knownTeamIds.has(teamId));
  const missingTeamRows = await listRowsByIds<TeamRow>("teams", missingTeamIds);
  const mergedTeamRows = mergeRowsById(rawTeamRows, missingTeamRows)
    .filter((team) => seasonalTeamIds.has(team.id))
    .map((team) => {
      const profile = activeProfileByTeamId.get(team.id);

      if (!profile) {
        return team;
      }

      const metadata = asObject(team.metadata) as TeamMetadata;
      const teamCoachIds = activeSeasonState.coaches
        .filter((coach) => coach.team_id === team.id)
        .map((coach) => coach.coach_profile_id);

      return {
        ...team,
        name: profile.name_snapshot || team.name,
        division: profile.division ?? team.division,
        metadata: {
          ...metadata,
          teamLevel: profile.level_label ?? metadata.teamLevel,
          ageCategory: profile.category ?? metadata.ageCategory,
          linkedCoachIds: teamCoachIds,
          seasonalProfileId: profile.id,
          gymSeasonId: profile.gym_season_id
        }
      } as TeamRow;
    });
  const seasonalRoster = activeSeasonState.roster.filter((row) => seasonalTeamIds.has(row.team_id));
  const seasonalAthleteIds = new Set(seasonalRoster.map((row) => row.athlete_id));
  const knownAthleteIds = new Set(rawAthleteRows.map((athlete) => athlete.id));
  const missingAthleteIds = [...seasonalAthleteIds].filter((athleteId) => !knownAthleteIds.has(athleteId));
  const missingAthleteRows = await listRowsByIds<AthleteRow>("athletes", missingAthleteIds);
  const mergedAthleteRows = mergeRowsById(rawAthleteRows, missingAthleteRows);
  const seasonalAssignmentRows = seasonalRoster.map((row) => ({
    id: row.id,
    workspace_root_id: workspaceRoot.id,
    athlete_id: row.athlete_id,
    team_id: row.team_id,
    created_at: row.created_at,
    updated_at: row.created_at,
    lock_version: 1,
    deleted_at: null
  })) as AthleteAssignmentRow[];
  const seasonalTeamCoachRows = activeSeasonState.coaches
    .filter((coach) => seasonalTeamIds.has(coach.team_id))
    .map((coach) => ({
      id: coach.id,
      team_id: coach.team_id,
      coach_profile_id: coach.coach_profile_id,
      role: coach.role,
      created_at: coach.created_at
    })) as TeamCoachRow[];

  return {
    teamRows: mergedTeamRows,
    assignmentRows: seasonalAssignmentRows,
    athleteRows: mergedAthleteRows,
    teamCoachRows: seasonalTeamCoachRows
  };
}

export async function listRemotePlannerFoundation(
  session: Pick<AuthSession, "role" | "userId" | "primaryGymId">,
  scopeInput: PlannerWorkspaceScope | string | (PlannerAccessContext & { scopeContext?: PlannerScopeContext })
): Promise<PlannerRemoteFoundationSnapshot> {
  const accessContext = typeof scopeInput === "object"
    ? scopeInput
    : null;
  const scope = accessContext?.dataScope ?? parsePlannerWorkspaceScope(scopeInput);
  const resolverSession = {
    ...session,
    primaryGymId: scope === "gym"
      ? accessContext?.gymId ?? session.primaryGymId ?? null
      : session.primaryGymId ?? null
  } as AuthSession;
  const workspaceRoot = await resolveWorkspaceRoot(resolverSession, scope);
  const workspaceId = buildWorkspaceId(workspaceRoot);
  const plannerProjectRow = await ensurePlannerProjectRow(workspaceRoot);
  const plannerProject = plannerProjectRow
    ? buildPlannerProjectFromRow(plannerProjectRow, workspaceId)
    : buildDefaultPlannerProject(buildFallbackScopeContext(workspaceRoot));

  const [rawTeamRows, rawAssignmentRows, baseAthleteRows, rawEvaluationRows, rawSkillPlanRows, rawRoutinePlanRows, rawSeasonPlanRows, syncMetadata] = await Promise.all([
    listWorkspaceRows<TeamRow>("teams", workspaceRoot.id),
    listWorkspaceRows<AthleteAssignmentRow>("athlete_team_assignments", workspaceRoot.id),
    listWorkspaceRows<AthleteRow>("athletes", workspaceRoot.id),
    listWorkspaceRows<PlannerTryoutRecordRow>("planner_tryout_records", workspaceRoot.id, "occurred_at"),
    listWorkspaceRows<TeamSkillPlanRow>("team_skill_plans", workspaceRoot.id, "updated_at"),
    listWorkspaceRows<TeamRoutinePlanRow>("team_routine_plans", workspaceRoot.id, "updated_at"),
    listWorkspaceRows<TeamSeasonPlanRow>("team_season_plans", workspaceRoot.id, "updated_at"),
    getPlannerSyncMetadata(workspaceRoot.id)
  ]);

  let teamRows = rawTeamRows;
  let assignmentRows = rawAssignmentRows;
  let rawAthleteRows = baseAthleteRows;
  let rawTryoutRows = rawEvaluationRows;
  let skillPlanRows = rawSkillPlanRows;
  let routinePlanRows = rawRoutinePlanRows;
  let seasonPlanRows = rawSeasonPlanRows;
  const admin = createAdminClient();

  if (scope === "gym") {
    rawAthleteRows = await listGymPermanentAthleteRows(admin, workspaceRoot, rawAthleteRows);
    rawTryoutRows = await listTryoutRowsForAthletes(
      admin,
      rawAthleteRows.map((athlete) => athlete.id),
      rawTryoutRows
    );
  }

  let athleteRows = rawAthleteRows;
  let evaluationRows = rawTryoutRows;
  const activeGymSeasonState = scope === "gym" && workspaceRoot.gymId
    ? await loadActiveGymTeamSeasonState(admin, workspaceRoot.gymId, session.userId)
    : null;
  const seasonalFoundation = await applyActiveGymSeasonStateToFoundation(
    workspaceRoot,
    rawTeamRows,
    rawAssignmentRows,
    rawAthleteRows,
    activeGymSeasonState
  );
  let teamCoachRowsOverride = seasonalFoundation.teamCoachRows;

  teamRows = seasonalFoundation.teamRows;
  assignmentRows = seasonalFoundation.assignmentRows;
  athleteRows = seasonalFoundation.athleteRows;

  if (scope === "gym") {
    evaluationRows = await listTryoutRowsForAthletes(
      admin,
      athleteRows.map((athlete) => athlete.id),
      evaluationRows
    );
  }

  const teamIds = teamRows.map((team) => team.id);
  const { data: teamCoachData } = teamCoachRowsOverride
    ? { data: teamCoachRowsOverride }
    : teamIds.length
      ? await admin.from("team_coaches" as never).select("*" as never).in("team_id", teamIds as never)
      : { data: [] as unknown[] };
  const teamCoachRows = ((teamCoachData ?? []) as TeamCoachRow[]).filter((coach) => teamIds.includes(coach.team_id));

  const athleteMap = new Map(athleteRows.map((row) => {
    const athlete = buildPlannerAthleteFromRow(row, workspaceId);
    return [athlete.id, athlete] as const;
  }));
  const coachDisplayNameMap = await listCoachDisplayNames(teamCoachRows);

  const teams = teamRows.map((row) => {
    const team = buildTeamRecord(row, teamCoachRows, assignmentRows, athleteMap, workspaceId);
    const metadata = asObject(row.metadata) as TeamMetadata;
    const assignedCoachNames = team.linkedCoachIds?.length
      ? team.linkedCoachIds.map((coachId) => coachDisplayNameMap.get(coachId) ?? "").filter(Boolean)
      : asStringArray(metadata.assignedCoachNames);

    return {
      ...team,
      assignedCoachNames
    };
  });

  return {
    workspaceRoot,
    plannerProject,
    permissions: accessContext
      ? {
        uiWorkspace: accessContext.uiWorkspace,
        dataScope: accessContext.dataScope,
        gymId: accessContext.gymId,
        seatRole: accessContext.seatRole,
        accessLevel: accessContext.accessLevel,
        canOpenGymWorkspace: accessContext.canOpenGymWorkspace,
        canReadPlanner: accessContext.canReadPlanner,
        canConfigureTryouts: accessContext.canConfigureTryouts,
        canManageAthletes: accessContext.canManageAthletes,
        canSaveTryoutRecords: accessContext.canSaveTryoutRecords,
        canEditTeamBuilder: accessContext.canEditTeamBuilder,
        canCreateTeams: accessContext.canCreateTeams,
        canEditTeams: accessContext.canEditTeams,
        canAssignRosters: accessContext.canAssignRosters,
        canDeleteTeams: accessContext.canDeleteTeams,
        canRestoreTrash: accessContext.canRestoreTrash,
        canEditSkillPlanner: accessContext.canEditSkillPlanner,
        canEditRoutineBuilder: accessContext.canEditRoutineBuilder,
        canEditSeasonPlanner: accessContext.canEditSeasonPlanner,
        canEditSeasonManualEntries: accessContext.canEditSeasonManualEntries,
        editablePlanningTeamIds: accessContext.editablePlanningTeamIds
      }
      : {
        uiWorkspace: scope,
        dataScope: scope,
        gymId: workspaceRoot.gymId,
        seatRole: null,
        accessLevel: "full",
        canOpenGymWorkspace: scope === "gym",
        canReadPlanner: true,
        canConfigureTryouts: true,
        canManageAthletes: true,
        canSaveTryoutRecords: true,
        canEditTeamBuilder: scope === "gym",
        canCreateTeams: scope === "gym",
        canEditTeams: scope === "gym",
        canAssignRosters: scope === "gym",
        canDeleteTeams: scope === "gym",
        canRestoreTrash: scope === "gym",
        canEditSkillPlanner: true,
        canEditRoutineBuilder: true,
        canEditSeasonPlanner: true,
        canEditSeasonManualEntries: true,
        editablePlanningTeamIds: []
      },
    assignments: assignmentRows.map((row) => {
      const versionedRow = row as AthleteAssignmentRow & VersionedRow & { updated_at?: string };

      return {
        id: row.id,
        athleteId: row.athlete_id,
        teamId: row.team_id,
        createdAt: row.created_at,
        updatedAt: versionedRow.updated_at ?? row.created_at,
        lockVersion: getLockVersion(versionedRow)
      };
    }),
    athletes: [...athleteMap.values()].sort((left, right) => left.name.localeCompare(right.name)),
    tryoutRecords: evaluationRows.flatMap((row) => {
      try {
        return [buildPlannerTryoutRecordFromRow(row, workspaceId)];
      } catch {
        return [];
      }
    }),
    teams,
    skillPlans: skillPlanRows.map((row) => buildTeamSkillPlanFromRow(row, workspaceId)),
    routinePlans: routinePlanRows.map((row) => buildRoutinePlanFromRow(row, workspaceId)),
    seasonPlans: seasonPlanRows.map((row) => buildTeamSeasonPlanFromRow(row, workspaceId)),
    syncMetadata
  };
}
