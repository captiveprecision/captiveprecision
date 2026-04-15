import type { AthleteRecord } from "@/lib/domain/athlete";
import type { EvaluationRecord } from "@/lib/domain/evaluation-record";
import type { PlannerProject } from "@/lib/domain/planner-project";
import type { TeamRoutinePlan } from "@/lib/domain/routine-plan";
import type { TeamSeasonPlan } from "@/lib/domain/season-plan";
import type { TeamSkillPlan } from "@/lib/domain/skill-plan";
import type { TeamRecord } from "@/lib/domain/team";
import type { ChangeSet, EntityVersion, RestorePreview, SyncMetadata, VersionedEntityType, WorkspaceBackup, WorkspaceRoot } from "@/lib/domain/planner-versioning";
import type { AuthSession } from "@/lib/auth/session";
import type { PlannerWorkspaceScope } from "@/lib/services/planner-workspace";
import { createAdminClient } from "@/lib/supabase/admin";

type PlannerCommandEntity = AthleteRecord | EvaluationRecord | PlannerProject | TeamRecord | TeamSkillPlan | TeamRoutinePlan | TeamSeasonPlan | Record<string, unknown>;

type CommandEnvelope<T extends PlannerCommandEntity = PlannerCommandEntity> = {
  entity: T;
  lockVersion: number;
  changeSetId: string;
  latestVersionNumber: number;
  versionId?: string;
};

type WorkspaceRootRow = {
  id: string;
  scope_type: "coach" | "gym";
  owner_profile_id: string | null;
  gym_id: string | null;
  status: "active" | "archived";
  created_at: string;
  updated_at: string;
};

function mapWorkspaceRoot(row: WorkspaceRootRow): WorkspaceRoot {
  return {
    id: row.id,
    scopeType: row.scope_type,
    ownerProfileId: row.owner_profile_id,
    gymId: row.gym_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function resolveWorkspaceRoot(
  session: AuthSession,
  scope: PlannerWorkspaceScope,
  workspaceRootId?: string | null
) {
  const admin = createAdminClient();

  if (workspaceRootId) {
    const { data: accessData, error: accessError } = await admin.rpc("planner_workspace_root_can_access" as never, {
      p_actor_profile_id: session.userId,
      p_workspace_root_id: workspaceRootId,
      p_access: "read"
    } as never);

    if (accessError || !accessData) {
      throw new Error(accessError?.message ?? "You do not have access to this Planner workspace.");
    }

    const { data, error } = await admin
      .from("workspace_roots" as never)
      .select("*" as never)
      .eq("id", workspaceRootId as never)
      .maybeSingle();

    if (error || !data) {
      throw new Error("The requested Planner workspace could not be found.");
    }

    return mapWorkspaceRoot(data as WorkspaceRootRow);
  }

  const { data, error } = await admin.rpc("planner_resolve_workspace_root" as never, {
    p_actor_profile_id: session.userId,
    p_scope_type: scope,
    p_gym_id: session.primaryGymId ?? null
  } as never);

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to resolve the Planner workspace.");
  }

  return mapWorkspaceRoot(data as WorkspaceRootRow);
}

function normalizeCommandResult<T extends PlannerCommandEntity>(value: unknown): CommandEnvelope<T> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Planner command did not return a valid payload.");
  }

  const record = value as Record<string, unknown>;

  return {
    entity: (record.entity ?? {}) as T,
    lockVersion: typeof record.lockVersion === "number" ? record.lockVersion : Number(record.lockVersion ?? 0),
    changeSetId: typeof record.changeSetId === "string" ? record.changeSetId : "",
    latestVersionNumber: typeof record.latestVersionNumber === "number" ? record.latestVersionNumber : Number(record.latestVersionNumber ?? 0),
    versionId: typeof record.versionId === "string" ? record.versionId : undefined
  };
}

async function executePlannerCommand<T extends PlannerCommandEntity>(
  functionName: string,
  args: Record<string, unknown>
) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc(functionName as never, args as never);

  if (error) {
    throw error;
  }

  return normalizeCommandResult<T>(data);
}

function normalizeRpcError(error: unknown) {
  if (!error || typeof error !== "object") {
    return { message: "Planner command failed.", code: null as string | null };
  }

  const record = error as Record<string, unknown>;
  const message = typeof record.message === "string" ? record.message : "Planner command failed.";

  if (message.includes("PLANNER_CONFLICT")) {
    return { message: "This record changed somewhere else. Reload before saving again.", code: "PLANNER_CONFLICT" };
  }

  if (message.includes("WORKSPACE_ACCESS_DENIED")) {
    return { message: "You do not have access to this workspace.", code: "WORKSPACE_ACCESS_DENIED" };
  }

  if (message.includes("GYM_WORKSPACE_REQUIRED")) {
    return { message: "A gym workspace is required for this action.", code: "GYM_WORKSPACE_REQUIRED" };
  }

  return { message, code: null };
}

export function getPlannerCommandError(error: unknown) {
  return normalizeRpcError(error);
}

export async function savePlannerProjectCommand(
  session: AuthSession,
  scope: PlannerWorkspaceScope,
  payload: {
    workspaceRootId?: string | null;
    expectedLockVersion?: number | null;
    name?: string;
    status?: string;
    pipelineStage?: string;
    template?: Record<string, unknown>;
    qualificationRules?: Record<string, unknown>;
  }
) {
  const workspaceRoot = await resolveWorkspaceRoot(session, scope, payload.workspaceRootId);

  return executePlannerCommand<PlannerProject>("planner_command_project_save", {
    p_actor_profile_id: session.userId,
    p_workspace_root_id: workspaceRoot.id,
    p_expected_lock_version: payload.expectedLockVersion ?? null,
    p_name: payload.name ?? null,
    p_status: payload.status ?? null,
    p_pipeline_stage: payload.pipelineStage ?? null,
    p_template: payload.template ?? null,
    p_qualification_rules: payload.qualificationRules ?? null
  });
}

export async function savePlannerAthleteCommand(
  session: AuthSession,
  scope: PlannerWorkspaceScope,
  payload: {
    workspaceRootId?: string | null;
    expectedLockVersion?: number | null;
    athleteId?: string | null;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    registrationNumber: string;
    notes: string;
    parentContacts: unknown[];
  }
) {
  const workspaceRoot = await resolveWorkspaceRoot(session, scope, payload.workspaceRootId);

  return executePlannerCommand<AthleteRecord>("planner_command_athlete_save", {
    p_actor_profile_id: session.userId,
    p_workspace_root_id: workspaceRoot.id,
    p_expected_lock_version: payload.expectedLockVersion ?? null,
    p_athlete_id: payload.athleteId ?? null,
    p_first_name: payload.firstName,
    p_last_name: payload.lastName,
    p_birth_date: payload.dateOfBirth || null,
    p_registration_number: payload.registrationNumber || null,
    p_notes: payload.notes,
    p_parent_contacts: payload.parentContacts
  });
}

export async function savePlannerEvaluationCommand(
  session: AuthSession,
  scope: PlannerWorkspaceScope,
  payload: {
    workspaceRootId?: string | null;
    expectedLockVersion?: number | null;
    evaluationId: string;
    athleteId: string;
    occurredAt?: string | null;
    record: Record<string, unknown>;
  }
) {
  const workspaceRoot = await resolveWorkspaceRoot(session, scope, payload.workspaceRootId);

  return executePlannerCommand<EvaluationRecord>("planner_command_evaluation_save", {
    p_actor_profile_id: session.userId,
    p_workspace_root_id: workspaceRoot.id,
    p_expected_lock_version: payload.expectedLockVersion ?? null,
    p_evaluation_id: payload.evaluationId,
    p_athlete_id: payload.athleteId,
    p_occurred_at: payload.occurredAt ?? null,
    p_record: payload.record
  });
}

export async function savePlannerTeamCommand(
  session: AuthSession,
  scope: PlannerWorkspaceScope,
  payload: {
    workspaceRootId?: string | null;
    expectedLockVersion?: number | null;
    teamId?: string | null;
    name: string;
    teamLevel: string;
    teamType: string;
    teamDivision: string;
    trainingDays: string;
    trainingHours: string;
    linkedCoachIds: string[];
    assignedCoachNames: string[];
  }
) {
  const workspaceRoot = await resolveWorkspaceRoot(session, scope, payload.workspaceRootId);

  return executePlannerCommand<TeamRecord>("planner_command_team_save", {
    p_actor_profile_id: session.userId,
    p_workspace_root_id: workspaceRoot.id,
    p_expected_lock_version: payload.expectedLockVersion ?? null,
    p_team_id: payload.teamId ?? null,
    p_name: payload.name,
    p_team_level: payload.teamLevel,
    p_team_type: payload.teamType,
    p_team_division: payload.teamDivision,
    p_training_days: payload.trainingDays,
    p_training_hours: payload.trainingHours,
    p_linked_coach_ids: payload.linkedCoachIds,
    p_assigned_coach_names: payload.assignedCoachNames
  });
}

export async function setPlannerTeamAssignmentsCommand(
  session: AuthSession,
  scope: PlannerWorkspaceScope,
  payload: {
    workspaceRootId?: string | null;
    teamId: string;
    athleteIds: string[];
  }
) {
  const workspaceRoot = await resolveWorkspaceRoot(session, scope, payload.workspaceRootId);

  return executePlannerCommand<Record<string, unknown>>("planner_command_team_assignments_set", {
    p_actor_profile_id: session.userId,
    p_workspace_root_id: workspaceRoot.id,
    p_team_id: payload.teamId,
    p_athlete_ids: payload.athleteIds
  });
}

export async function savePlannerSkillPlanCommand(
  session: AuthSession,
  scope: PlannerWorkspaceScope,
  payload: {
    workspaceRootId?: string | null;
    expectedLockVersion?: number | null;
    teamId: string;
    status: string;
    notes: string;
    selections: unknown[];
  }
) {
  const workspaceRoot = await resolveWorkspaceRoot(session, scope, payload.workspaceRootId);

  return executePlannerCommand<TeamSkillPlan>("planner_command_skill_plan_save", {
    p_actor_profile_id: session.userId,
    p_workspace_root_id: workspaceRoot.id,
    p_expected_lock_version: payload.expectedLockVersion ?? null,
    p_team_id: payload.teamId,
    p_status: payload.status,
    p_notes: payload.notes,
    p_selections: payload.selections
  });
}

export async function savePlannerRoutinePlanCommand(
  session: AuthSession,
  scope: PlannerWorkspaceScope,
  payload: {
    workspaceRootId?: string | null;
    expectedLockVersion?: number | null;
    teamId: string;
    status: string;
    notes: string;
    document: Record<string, unknown> | null;
  }
) {
  const workspaceRoot = await resolveWorkspaceRoot(session, scope, payload.workspaceRootId);

  return executePlannerCommand<TeamRoutinePlan>("planner_command_routine_plan_save", {
    p_actor_profile_id: session.userId,
    p_workspace_root_id: workspaceRoot.id,
    p_expected_lock_version: payload.expectedLockVersion ?? null,
    p_team_id: payload.teamId,
    p_status: payload.status,
    p_notes: payload.notes,
    p_document: payload.document ?? {}
  });
}

export async function savePlannerSeasonPlanCommand(
  session: AuthSession,
  scope: PlannerWorkspaceScope,
  payload: {
    workspaceRootId?: string | null;
    expectedLockVersion?: number | null;
    teamId: string;
    status: string;
    notes: string;
    checkpoints: unknown[];
  }
) {
  const workspaceRoot = await resolveWorkspaceRoot(session, scope, payload.workspaceRootId);

  return executePlannerCommand<TeamSeasonPlan>("planner_command_season_plan_save", {
    p_actor_profile_id: session.userId,
    p_workspace_root_id: workspaceRoot.id,
    p_expected_lock_version: payload.expectedLockVersion ?? null,
    p_team_id: payload.teamId,
    p_status: payload.status,
    p_notes: payload.notes,
    p_checkpoints: payload.checkpoints
  });
}

export async function restorePlannerEntityCommand(
  session: AuthSession,
  scope: PlannerWorkspaceScope,
  payload: {
    workspaceRootId?: string | null;
    entityType: string;
    versionId: string;
    expectedLockVersion?: number | null;
  }
) {
  const workspaceRoot = await resolveWorkspaceRoot(session, scope, payload.workspaceRootId);

  return executePlannerCommand("planner_command_entity_restore", {
    p_actor_profile_id: session.userId,
    p_workspace_root_id: workspaceRoot.id,
    p_entity_type: payload.entityType,
    p_version_id: payload.versionId,
    p_expected_lock_version: payload.expectedLockVersion ?? null
  });
}

export async function restorePlannerWorkspaceCommand(
  session: AuthSession,
  scope: PlannerWorkspaceScope,
  payload: {
    workspaceRootId?: string | null;
    backupId: string;
  }
) {
  const workspaceRoot = await resolveWorkspaceRoot(session, scope, payload.workspaceRootId);

  return executePlannerCommand("planner_command_workspace_restore", {
    p_actor_profile_id: session.userId,
    p_workspace_root_id: workspaceRoot.id,
    p_backup_id: payload.backupId
  });
}

export async function softDeletePlannerTeamCommand(
  session: AuthSession,
  scope: PlannerWorkspaceScope,
  payload: {
    workspaceRootId?: string | null;
    teamId: string;
    expectedLockVersion?: number | null;
  }
) {
  const workspaceRoot = await resolveWorkspaceRoot(session, scope, payload.workspaceRootId);

  return executePlannerCommand<TeamRecord>("planner_soft_delete_team", {
    p_actor_profile_id: session.userId,
    p_workspace_root_id: workspaceRoot.id,
    p_team_id: payload.teamId,
    p_expected_lock_version: payload.expectedLockVersion ?? null
  });
}

export async function listPlannerHistory(
  session: AuthSession,
  scope: PlannerWorkspaceScope,
  payload: {
    workspaceRootId?: string | null;
    entityType?: string | null;
    entityId?: string | null;
    limit?: number;
  }
) {
  const workspaceRoot = await resolveWorkspaceRoot(session, scope, payload.workspaceRootId);
  const admin = createAdminClient();
  let query = admin
    .from("workspace_entity_versions" as never)
    .select("*" as never)
    .eq("workspace_root_id", workspaceRoot.id as never)
    .order("created_at" as never, { ascending: false })
    .limit(payload.limit ?? 50);

  if (payload.entityType) {
    query = query.eq("entity_type", payload.entityType as never);
  }

  if (payload.entityId) {
    query = query.eq("entity_id", payload.entityId as never);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return {
    workspaceRoot,
    versions: ((data ?? []) as Array<{
      id: string;
      entity_type: string;
      entity_id: string;
      workspace_root_id: string;
      version_number: number;
      change_type: string;
      snapshot: Record<string, unknown>;
      changed_by_profile_id: string | null;
      change_set_id: string;
      created_at: string;
    }>).map((row) => ({
      id: row.id,
      entityType: row.entity_type as VersionedEntityType,
      entityId: row.entity_id,
      workspaceRootId: row.workspace_root_id,
      versionNumber: row.version_number,
      changeType: row.change_type,
      snapshot: row.snapshot,
      changedByProfileId: row.changed_by_profile_id,
      changeSetId: row.change_set_id,
      createdAt: row.created_at
    })) as EntityVersion[]
  };
}

export async function listPlannerBackups(
  session: AuthSession,
  scope: PlannerWorkspaceScope,
  payload: {
    workspaceRootId?: string | null;
    limit?: number;
  }
) {
  const workspaceRoot = await resolveWorkspaceRoot(session, scope, payload.workspaceRootId);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("workspace_backups" as never)
    .select("*" as never)
    .eq("workspace_root_id", workspaceRoot.id as never)
    .order("created_at" as never, { ascending: false })
    .limit(payload.limit ?? 20);

  if (error) {
    throw error;
  }

  return {
    workspaceRoot,
    backups: ((data ?? []) as Array<{
      id: string;
      workspace_root_id: string;
      backup_type: string;
      status: string;
      snapshot: Record<string, unknown>;
      metadata: Record<string, unknown>;
      triggered_by_profile_id: string | null;
      created_at: string;
      expires_at: string | null;
    }>).map((row) => ({
      id: row.id,
      workspaceRootId: row.workspace_root_id,
      backupType: row.backup_type,
      status: row.status,
      snapshot: row.snapshot,
      metadata: row.metadata,
      triggeredByProfileId: row.triggered_by_profile_id,
      createdAt: row.created_at,
      expiresAt: row.expires_at
    })) as WorkspaceBackup[]
  };
}

export async function getPlannerRestorePreview(
  session: AuthSession,
  scope: PlannerWorkspaceScope,
  payload: {
    workspaceRootId?: string | null;
    entityType: string;
    versionId: string;
  }
) {
  const workspaceRoot = await resolveWorkspaceRoot(session, scope, payload.workspaceRootId);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("workspace_entity_versions" as never)
    .select("*" as never)
    .eq("id", payload.versionId as never)
    .eq("entity_type", payload.entityType as never)
    .eq("workspace_root_id", workspaceRoot.id as never)
    .maybeSingle();

  if (error || !data) {
    throw new Error("The requested version could not be found.");
  }

  const row = data as {
    id: string;
    entity_type: string;
    entity_id: string;
    version_number: number;
    snapshot: Record<string, unknown>;
  };

  const currentTableMap = {
    athlete: "athletes",
    team: "teams",
    assignment: "athlete_team_assignments",
    "planner-project": "planner_projects",
    evaluation: "planner_evaluations",
    "skill-plan": "team_skill_plans",
    "routine-plan": "team_routine_plans",
    "season-plan": "team_season_plans"
  } as const;
  const currentTable = currentTableMap[payload.entityType as keyof typeof currentTableMap];

  let currentLockVersion: number | null = null;

  if (currentTable) {
    const { data: currentData } = await admin
      .from(currentTable as never)
      .select("lock_version" as never)
      .eq("id", row.entity_id as never)
      .maybeSingle();

    currentLockVersion = (currentData as { lock_version: number } | null)?.lock_version ?? null;
  }

  return {
    workspaceRoot,
    preview: {
      entityType: row.entity_type as VersionedEntityType,
      entityId: row.entity_id,
      versionId: row.id,
      versionNumber: row.version_number,
      currentLockVersion,
      restoreSnapshot: row.snapshot
    } satisfies RestorePreview
  };
}

export async function getPlannerSyncMetadata(workspaceRootId: string) {
  const admin = createAdminClient();
  const [{ data: changeSetData }, { data: backupData }] = await Promise.all([
    admin
      .from("workspace_change_sets" as never)
      .select("id, created_at" as never)
      .eq("workspace_root_id", workspaceRootId as never)
      .order("created_at" as never, { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("workspace_backups" as never)
      .select("created_at" as never)
      .eq("workspace_root_id", workspaceRootId as never)
      .order("created_at" as never, { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  return {
    lastChangeSetId: (changeSetData as { id: string } | null)?.id ?? null,
    lastBackupAt: (backupData as { created_at: string } | null)?.created_at ?? null
  } satisfies SyncMetadata;
}

export { resolveWorkspaceRoot };
