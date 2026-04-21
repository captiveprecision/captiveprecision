import type { AthleteParentContact, AthleteRecord } from "@/lib/domain/athlete";
import type { AuthSession } from "@/lib/auth/session";
import type { EvaluationRecord } from "@/lib/domain/evaluation-record";
import type { PlannerLevelLabel } from "@/lib/domain/planner-levels";
import type { PlannerProject } from "@/lib/domain/planner-project";
import type { TeamRoutinePlan } from "@/lib/domain/routine-plan";
import type { TeamSeasonPlan } from "@/lib/domain/season-plan";
import type { TeamSkillPlan } from "@/lib/domain/skill-plan";
import type { TeamRecord } from "@/lib/domain/team";
import type { SyncMetadata, WorkspaceRoot } from "@/lib/domain/planner-versioning";
import {
  normalizePlannerEvaluation,
  normalizePlannerProject,
  normalizeTeamRoutinePlan,
  normalizeTeamSeasonPlan,
  normalizeTeamSkillPlan
} from "@/lib/services/planner-domain-mappers";
import { deriveRoutineItemsFromDocument, normalizeRoutineDocument } from "@/lib/services/planner-routine-builder";
import {
  buildDefaultPlannerProject,
  isUuidString,
  parsePlannerWorkspaceScope,
  type PlannerScopeContext,
  type PlannerWorkspaceScope
} from "@/lib/services/planner-workspace";
import { getPlannerSyncMetadata, resolveWorkspaceRoot } from "@/lib/services/planner-command-service";
import { createAdminClient } from "@/lib/supabase/admin";
import { defaultQualificationRules, defaultTryoutTemplate } from "@/lib/tools/cheer-planner-tryouts";
import type { Database, Json } from "@/lib/types/database";

type TeamRow = Database["public"]["Tables"]["teams"]["Row"];
type TeamCoachRow = Database["public"]["Tables"]["team_coaches"]["Row"];
type AthleteRow = Database["public"]["Tables"]["athletes"]["Row"];
type AthleteAssignmentRow = Database["public"]["Tables"]["athlete_team_assignments"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type TeamRoutinePlanRow = Database["public"]["Tables"]["team_routine_plans"]["Row"];
type PlannerProjectRow = Database["public"]["Tables"]["planner_projects"]["Row"];
type PlannerEvaluationRow = Database["public"]["Tables"]["planner_evaluations"]["Row"];
type TeamSkillPlanRow = Database["public"]["Tables"]["team_skill_plans"]["Row"];
type TeamSeasonPlanRow = Database["public"]["Tables"]["team_season_plans"]["Row"];

type TeamMetadata = {
  teamLevel?: string;
  ageCategory?: string;
  trainingDays?: string;
  trainingHours?: string;
  assignedCoachNames?: string[];
  linkedCoachIds?: string[];
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
  assignments: Array<{ id: string; athleteId: string; teamId: string; createdAt: string; updatedAt: string; lockVersion?: number }>;
  athletes: AthleteRecord[];
  evaluations: EvaluationRecord[];
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

  return {
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
    status: "draft",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lockVersion: getLockVersion(versionedRow),
    lastChangeSetId: getLastChangeSetId(versionedRow),
    archivedAt: getArchivedAt(versionedRow),
    deletedAt: getDeletedAt(versionedRow),
    restoredFromVersionId: getRestoredFromVersionId(versionedRow)
  };
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
  }, defaultTryoutTemplate, defaultQualificationRules);
}

export function buildPlannerEvaluationFromRow(row: PlannerEvaluationRow, workspaceId: string): EvaluationRecord {
  const record = asObject(row.record) as Parameters<typeof normalizePlannerEvaluation>[0];
  const versionedRow = row as PlannerEvaluationRow & VersionedRow;

  return normalizePlannerEvaluation({
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

function mergeProjectConfig(localProject: PlannerProject, remoteProject: PlannerProject, merged: Omit<PlannerProject, "name" | "status" | "pipelineStage" | "template" | "qualificationRules" | "workspaceId" | "id" | "createdAt" | "updatedAt">) {
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
    qualificationRules: configSource.qualificationRules,
    athletes: merged.athletes,
    evaluations: merged.evaluations,
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
  }, remoteProject.template, remoteProject.qualificationRules);
}

export function mergeRemoteFoundationIntoProject(
  project: PlannerProject,
  snapshot: PlannerRemoteFoundationSnapshot
): PlannerProject {
  const teams = mergeRemoteTeams(project, snapshot.teams);
  const athletes = mergeRemoteAthletes(project, snapshot.athletes);
  const merged = {
    athletes,
    evaluations: mergeEntityList(project.evaluations, snapshot.evaluations),
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

export async function listRemotePlannerFoundation(
  session: Pick<AuthSession, "role" | "userId" | "primaryGymId">,
  scopeInput: PlannerWorkspaceScope | string
): Promise<PlannerRemoteFoundationSnapshot> {
  const scope = parsePlannerWorkspaceScope(scopeInput);
  const workspaceRoot = await resolveWorkspaceRoot(session as AuthSession, scope);
  const workspaceId = buildWorkspaceId(workspaceRoot);
  const plannerProjectRow = await ensurePlannerProjectRow(workspaceRoot);
  const plannerProject = plannerProjectRow
    ? buildPlannerProjectFromRow(plannerProjectRow, workspaceId)
    : buildDefaultPlannerProject(buildFallbackScopeContext(workspaceRoot));

  const [teamRows, assignmentRows, athleteRows, evaluationRows, skillPlanRows, routinePlanRows, seasonPlanRows, syncMetadata] = await Promise.all([
    listWorkspaceRows<TeamRow>("teams", workspaceRoot.id),
    listWorkspaceRows<AthleteAssignmentRow>("athlete_team_assignments", workspaceRoot.id),
    listWorkspaceRows<AthleteRow>("athletes", workspaceRoot.id),
    listWorkspaceRows<PlannerEvaluationRow>("planner_evaluations", workspaceRoot.id, "occurred_at"),
    listWorkspaceRows<TeamSkillPlanRow>("team_skill_plans", workspaceRoot.id, "updated_at"),
    listWorkspaceRows<TeamRoutinePlanRow>("team_routine_plans", workspaceRoot.id, "updated_at"),
    listWorkspaceRows<TeamSeasonPlanRow>("team_season_plans", workspaceRoot.id, "updated_at"),
    getPlannerSyncMetadata(workspaceRoot.id)
  ]);

  const teamIds = teamRows.map((team) => team.id);
  const admin = createAdminClient();
  const { data: teamCoachData } = teamIds.length
    ? await admin.from("team_coaches" as never).select("*" as never).in("team_id", teamIds as never)
    : { data: [] as unknown[] };
  const teamCoachRows = (teamCoachData ?? []) as TeamCoachRow[];

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
    evaluations: evaluationRows.map((row) => buildPlannerEvaluationFromRow(row, workspaceId)),
    teams,
    skillPlans: skillPlanRows.map((row) => buildTeamSkillPlanFromRow(row, workspaceId)),
    routinePlans: routinePlanRows.map((row) => buildRoutinePlanFromRow(row, workspaceId)),
    seasonPlans: seasonPlanRows.map((row) => buildTeamSeasonPlanFromRow(row, workspaceId)),
    syncMetadata
  };
}
