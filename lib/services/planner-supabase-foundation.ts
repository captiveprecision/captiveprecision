import type { AthleteParentContact, AthleteRecord } from "@/lib/domain/athlete";
import type { AuthSession } from "@/lib/auth/session";
import type { EvaluationRecord } from "@/lib/domain/evaluation-record";
import type { PlannerLevelLabel } from "@/lib/domain/planner-levels";
import type { PlannerProject } from "@/lib/domain/planner-project";
import type { TeamRoutinePlan } from "@/lib/domain/routine-plan";
import type { TeamSeasonPlan } from "@/lib/domain/season-plan";
import type { TeamSkillPlan } from "@/lib/domain/skill-plan";
import type { TeamRecord } from "@/lib/domain/team";
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
  parsePlannerWorkspaceScope,
  resolvePlannerScopeContext,
  type PlannerScopeContext,
  type PlannerWorkspaceScope
} from "@/lib/services/planner-workspace";
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

export type PlannerRemoteFoundationSnapshot = {
  plannerProject: PlannerProject;
  athletes: AthleteRecord[];
  evaluations: EvaluationRecord[];
  teams: TeamRecord[];
  skillPlans: TeamSkillPlan[];
  routinePlans: TeamRoutinePlan[];
  seasonPlans: TeamSeasonPlan[];
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

export function buildPlannerAthleteFromRow(row: AthleteRow, workspaceId: string): AthleteRecord {
  const metadata = asObject(row.metadata) as AthleteMetadata;
  const firstName = row.first_name.trim();
  const lastName = row.last_name.trim();
  const registrationNumber = asString(row.registration_number) || asString(metadata.registrationNumber) || row.id.slice(0, 8).toUpperCase();
  const notes = asString(row.notes) || asString(metadata.notes);
  const parentContacts = parseParentContacts(row.parent_contacts);
  const fallbackParentContacts = parseParentContacts(metadata.parentContacts);

  return {
    id: row.id,
    workspaceId,
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
  const linkedCoachIds = asStringArray(metadata.linkedCoachIds);
  const memberAthleteIds = athleteAssignments
    .filter((assignment) => assignment.team_id === row.id)
    .map((assignment) => assignment.athlete_id);

  return {
    id: row.id,
    workspaceId,
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
    updatedAt: row.updated_at
  };
}

export function buildPlannerProjectFromRow(row: PlannerProjectRow, scope: PlannerScopeContext): PlannerProject {
  return normalizePlannerProject({
    id: row.id,
    workspaceId: scope.workspaceId,
    name: row.name,
    status: row.status as PlannerProject["status"],
    pipelineStage: row.pipeline_stage as PlannerProject["pipelineStage"],
    template: asObject(row.template) as PlannerProject["template"],
    qualificationRules: asObject(row.qualification_rules) as PlannerProject["qualificationRules"],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }, defaultTryoutTemplate, defaultQualificationRules);
}

export function buildPlannerEvaluationFromRow(row: PlannerEvaluationRow, workspaceId: string): EvaluationRecord {
  const record = asObject(row.record) as Parameters<typeof normalizePlannerEvaluation>[0];

  return normalizePlannerEvaluation({
    ...record,
    id: row.id,
    workspaceId,
    athleteId: row.athlete_id,
    plannerProjectId: row.planner_project_id,
    occurredAt: row.occurred_at ?? record.occurredAt ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  });
}

export function buildTeamSkillPlanFromRow(row: TeamSkillPlanRow, workspaceId: string): TeamSkillPlan {
  return normalizeTeamSkillPlan({
    id: row.id,
    workspaceId,
    plannerProjectId: row.planner_project_id,
    teamId: row.team_id,
    status: row.status as TeamSkillPlan["status"],
    notes: row.notes,
    selections: Array.isArray(row.selections) ? row.selections as TeamSkillPlan["selections"] : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  });
}

export function buildTeamSeasonPlanFromRow(row: TeamSeasonPlanRow, workspaceId: string): TeamSeasonPlan {
  return normalizeTeamSeasonPlan({
    id: row.id,
    workspaceId,
    plannerProjectId: row.planner_project_id,
    teamId: row.team_id,
    status: row.status as TeamSeasonPlan["status"],
    notes: row.notes,
    checkpoints: Array.isArray(row.checkpoints) ? row.checkpoints as TeamSeasonPlan["checkpoints"] : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  });
}

export function buildRoutinePlanFromRow(row: TeamRoutinePlanRow, workspaceId: string): TeamRoutinePlan {
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
    updatedAt: row.updated_at
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
    return !mergedRemoteIds.has(lookupId);
  });

  return [...mergedRemoteTeams, ...localOnlyTeams];
}

function mergeRemoteAthletes(project: PlannerProject, remoteAthletes: AthleteRecord[]) {
  const remoteIds = new Set(remoteAthletes.map((athlete) => athlete.id));
  const remoteRegistrations = new Set(remoteAthletes.map((athlete) => athlete.registrationNumber));
  const localOnlyAthletes = project.athletes.filter((athlete) => (
    !remoteIds.has(athlete.id) && !remoteRegistrations.has(athlete.registrationNumber)
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
  const localOnlyPlans = localPlans.filter((plan) => !remoteTeamIds.has(plan.teamId));

  return [...mappedRemotePlans, ...localOnlyPlans];
}

function mergeEntityList<T extends { id: string }>(localItems: T[], remoteItems: T[]) {
  const remoteIds = new Set(remoteItems.map((item) => item.id));
  const localOnlyItems = localItems.filter((item) => !remoteIds.has(item.id));
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
    updatedAt: Math.max(localUpdatedAt || 0, remoteUpdatedAt || 0) === localUpdatedAt ? localProject.updatedAt : remoteProject.updatedAt
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

async function listAccessibleTeamRows(
  session: Pick<AuthSession, "role" | "userId" | "primaryGymId">,
  scope: PlannerScopeContext
) {
  const admin = createAdminClient();
  const teamMap = new Map<string, TeamRow>();

  if (session.role === "admin") {
    const { data } = await admin
      .from("teams" as never)
      .select("*" as never)
      .order("created_at", { ascending: false });

    ((data ?? []) as TeamRow[]).forEach((team) => teamMap.set(team.id, team));
    return [...teamMap.values()];
  }

  if (scope.scopeType === "gym") {
    if (scope.gymId) {
      const { data } = await admin
        .from("teams" as never)
        .select("*" as never)
        .eq("gym_id", scope.gymId as never)
        .order("created_at", { ascending: false });

      ((data ?? []) as TeamRow[]).forEach((team) => teamMap.set(team.id, team));
    }

    return [...teamMap.values()];
  }

  const { data: ownedTeams } = await admin
    .from("teams" as never)
    .select("*" as never)
    .eq("primary_coach_profile_id", session.userId as never)
    .order("created_at", { ascending: false });

  ((ownedTeams ?? []) as TeamRow[]).forEach((team) => teamMap.set(team.id, team));

  const { data: linkedRows } = await admin
    .from("team_coaches" as never)
    .select("team_id" as never)
    .eq("coach_profile_id", session.userId as never);

  const linkedTeamIds = Array.from(new Set(((linkedRows ?? []) as Array<Pick<TeamCoachRow, "team_id">>).map((row) => row.team_id)));

  if (linkedTeamIds.length) {
    const { data: linkedTeams } = await admin
      .from("teams" as never)
      .select("*" as never)
      .in("id", linkedTeamIds as never);

    ((linkedTeams ?? []) as TeamRow[]).forEach((team) => teamMap.set(team.id, team));
  }

  return [...teamMap.values()];
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

export async function ensurePlannerProjectRow(scope: PlannerScopeContext) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("planner_projects" as never)
    .select("*" as never)
    .eq("id", scope.projectId as never)
    .maybeSingle();

  if (error) {
    if (error.code === "42P01") {
      return null;
    }

    throw error;
  }

  if (data) {
    return data as PlannerProjectRow;
  }

  const defaultProject = buildDefaultPlannerProject(scope);
  const { data: inserted, error: insertError } = await admin
    .from("planner_projects" as never)
    .insert({
      id: scope.projectId,
      scope_type: scope.scopeType,
      owner_profile_id: scope.ownerProfileId,
      gym_id: scope.gymId,
      name: defaultProject.name,
      status: defaultProject.status,
      pipeline_stage: defaultProject.pipelineStage,
      template: defaultProject.template,
      qualification_rules: defaultProject.qualificationRules
    } as never)
    .select("*" as never)
    .single();

  if (insertError) {
    throw insertError;
  }

  return inserted as PlannerProjectRow;
}

async function listRoutinePlanRows(projectId: string, teamIds: string[]) {
  if (!teamIds.length) {
    return [] as TeamRoutinePlanRow[];
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("team_routine_plans" as never)
    .select("*" as never)
    .eq("planner_project_id", projectId as never)
    .in("team_id", teamIds as never)
    .order("updated_at", { ascending: false });

  if (error) {
    if (error.code === "42P01") {
      return [] as TeamRoutinePlanRow[];
    }

    throw error;
  }

  return (data ?? []) as TeamRoutinePlanRow[];
}

async function listPlannerEvaluationRows(projectId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("planner_evaluations" as never)
    .select("*" as never)
    .eq("planner_project_id", projectId as never)
    .order("occurred_at", { ascending: false });

  if (error) {
    if (error.code === "42P01") {
      return [] as PlannerEvaluationRow[];
    }

    throw error;
  }

  return (data ?? []) as PlannerEvaluationRow[];
}

async function listTeamSkillPlanRows(projectId: string, teamIds: string[]) {
  if (!teamIds.length) {
    return [] as TeamSkillPlanRow[];
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("team_skill_plans" as never)
    .select("*" as never)
    .eq("planner_project_id", projectId as never)
    .in("team_id", teamIds as never)
    .order("updated_at", { ascending: false });

  if (error) {
    if (error.code === "42P01") {
      return [] as TeamSkillPlanRow[];
    }

    throw error;
  }

  return (data ?? []) as TeamSkillPlanRow[];
}

async function listTeamSeasonPlanRows(projectId: string, teamIds: string[]) {
  if (!teamIds.length) {
    return [] as TeamSeasonPlanRow[];
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("team_season_plans" as never)
    .select("*" as never)
    .eq("planner_project_id", projectId as never)
    .in("team_id", teamIds as never)
    .order("updated_at", { ascending: false });

  if (error) {
    if (error.code === "42P01") {
      return [] as TeamSeasonPlanRow[];
    }

    throw error;
  }

  return (data ?? []) as TeamSeasonPlanRow[];
}

async function listAccessibleAthleteRows(
  session: Pick<AuthSession, "role" | "userId" | "primaryGymId">,
  scope: PlannerScopeContext,
  assignmentRows: AthleteAssignmentRow[]
) {
  const admin = createAdminClient();
  const athleteIdSet = new Set<string>(assignmentRows.map((assignment) => assignment.athlete_id));

  if (session.role === "admin") {
    const { data } = await admin
      .from("athletes" as never)
      .select("*" as never)
      .order("created_at", { ascending: false });

    return (data ?? []) as AthleteRow[];
  }

  if (scope.scopeType === "gym" && scope.gymId) {
    const { data } = await admin
      .from("athletes" as never)
      .select("*" as never)
      .eq("gym_id", scope.gymId as never)
      .order("created_at", { ascending: false });

    return (data ?? []) as AthleteRow[];
  }

  const { data: ownedAthletes } = await admin
    .from("athletes" as never)
    .select("*" as never)
    .eq("created_by_profile_id", session.userId as never)
    .order("created_at", { ascending: false });

  ((ownedAthletes ?? []) as AthleteRow[]).forEach((athlete) => athleteIdSet.add(athlete.id));

  if (!athleteIdSet.size) {
    return (ownedAthletes ?? []) as AthleteRow[];
  }

  const { data } = await admin
    .from("athletes" as never)
    .select("*" as never)
    .in("id", [...athleteIdSet] as never)
    .order("created_at", { ascending: false });

  return (data ?? []) as AthleteRow[];
}

export async function listRemotePlannerFoundation(
  session: Pick<AuthSession, "role" | "userId" | "primaryGymId">,
  scopeInput: PlannerWorkspaceScope | string
): Promise<PlannerRemoteFoundationSnapshot> {
  const scope = resolvePlannerScopeContext(session, parsePlannerWorkspaceScope(scopeInput));
  const plannerProjectRow = await ensurePlannerProjectRow(scope);
  const plannerProject = plannerProjectRow
    ? buildPlannerProjectFromRow(plannerProjectRow, scope)
    : buildDefaultPlannerProject(scope);

  const admin = createAdminClient();
  const teamRows = await listAccessibleTeamRows(session, scope);
  const teamIds = teamRows.map((team) => team.id);

  const { data: teamCoachData } = teamIds.length
    ? await admin.from("team_coaches" as never).select("*" as never).in("team_id", teamIds as never)
    : { data: [] as unknown[] };
  const teamCoachRows = (teamCoachData ?? []) as TeamCoachRow[];

  const { data: assignmentData } = teamIds.length
    ? await admin.from("athlete_team_assignments" as never).select("*" as never).in("team_id", teamIds as never)
    : { data: [] as unknown[] };
  const assignmentRows = (assignmentData ?? []) as AthleteAssignmentRow[];

  const athleteRows = await listAccessibleAthleteRows(session, scope, assignmentRows);
  const athleteMap = new Map(athleteRows.map((row) => {
    const athlete = buildPlannerAthleteFromRow(row, plannerProject.workspaceId);
    return [athlete.id, athlete] as const;
  }));
  const coachDisplayNameMap = await listCoachDisplayNames(teamCoachRows);
  const routinePlanRows = await listRoutinePlanRows(plannerProject.id, teamIds);
  const evaluationRows = plannerProjectRow ? await listPlannerEvaluationRows(plannerProject.id) : [];
  const skillPlanRows = await listTeamSkillPlanRows(plannerProject.id, teamIds);
  const seasonPlanRows = await listTeamSeasonPlanRows(plannerProject.id, teamIds);

  const teams = teamRows.map((row) => {
    const team = buildTeamRecord(row, teamCoachRows, assignmentRows, athleteMap, plannerProject.workspaceId);
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
    plannerProject,
    athletes: [...athleteMap.values()].sort((left, right) => left.name.localeCompare(right.name)),
    evaluations: evaluationRows.map((row) => buildPlannerEvaluationFromRow(row, plannerProject.workspaceId)),
    teams,
    skillPlans: skillPlanRows.map((row) => buildTeamSkillPlanFromRow(row, plannerProject.workspaceId)),
    routinePlans: routinePlanRows.map((row) => buildRoutinePlanFromRow(row, plannerProject.workspaceId)),
    seasonPlans: seasonPlanRows.map((row) => buildTeamSeasonPlanFromRow(row, plannerProject.workspaceId))
  };
}
