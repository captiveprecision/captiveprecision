import type { AthleteRecord } from "@/lib/domain/athlete";
import type { TryoutRecord } from "@/lib/domain/evaluation-record";
import type { PlannerProject } from "@/lib/domain/planner-project";
import type { TeamRoutinePlan } from "@/lib/domain/routine-plan";
import type { TeamSeasonPlan } from "@/lib/domain/season-plan";
import type { TeamSkillPlan } from "@/lib/domain/skill-plan";
import type { TeamRecord } from "@/lib/domain/team";
import type { ChangeSet, EntityVersion, PlannerTrashItem, RestorePreview, SyncMetadata, VersionedEntityType, WorkspaceBackup, WorkspaceRoot } from "@/lib/domain/planner-versioning";
import type { AuthSession } from "@/lib/auth/session";
import type { PlannerWorkspaceScope } from "@/lib/services/planner-workspace";
import { createAdminClient } from "@/lib/supabase/admin";

type PlannerCommandEntity = AthleteRecord | TryoutRecord | PlannerProject | TeamRecord | TeamSkillPlan | TeamRoutinePlan | TeamSeasonPlan | Record<string, unknown>;
type PlannerAccessLevel = "read" | "write" | "restore";

type CommandEnvelope<T extends PlannerCommandEntity = PlannerCommandEntity> = {
  entity: T;
  lockVersion: number;
  changeSetId: string;
  latestVersionNumber: number;
  versionId?: string;
  restoredRelations?: Record<string, number>;
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

type RestoreVersionRow = {
  id: string;
  entity_type: string;
  entity_id: string;
  version_number: number;
  change_type: string;
  snapshot: Record<string, unknown>;
  change_set_id: string | null;
  created_at: string;
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

async function assertWorkspaceAccess(
  actorProfileId: string,
  workspaceRootId: string,
  requiredAccess: PlannerAccessLevel
) {
  const admin = createAdminClient();
  const { data: accessData, error: accessError } = await admin.rpc("planner_workspace_root_can_access" as never, {
    p_actor_profile_id: actorProfileId,
    p_workspace_root_id: workspaceRootId,
    p_access: requiredAccess
  } as never);

  if (accessError || !accessData) {
    throw new Error("WORKSPACE_ACCESS_DENIED");
  }
}

async function resolveWorkspaceRoot(
  session: AuthSession,
  scope: PlannerWorkspaceScope,
  workspaceRootId?: string | null,
  requiredAccess: PlannerAccessLevel = "read"
) {
  const admin = createAdminClient();

  if (workspaceRootId) {
    const { data, error } = await admin
      .from("workspace_roots" as never)
      .select("*" as never)
      .eq("id", workspaceRootId as never)
      .maybeSingle();

    if (error || !data) {
      throw new Error("WORKSPACE_ROOT_NOT_FOUND");
    }

    await assertWorkspaceAccess(session.userId, workspaceRootId, requiredAccess);
    return mapWorkspaceRoot(data as WorkspaceRootRow);
  }

  const { data, error } = await admin.rpc("planner_resolve_workspace_root" as never, {
    p_actor_profile_id: session.userId,
    p_scope_type: scope,
    p_gym_id: session.primaryGymId ?? null
  } as never);

  if (error || !data) {
    throw new Error(error?.message ?? "WORKSPACE_ROOT_NOT_FOUND");
  }

  const workspaceRoot = mapWorkspaceRoot(data as WorkspaceRootRow);
  await assertWorkspaceAccess(session.userId, workspaceRoot.id, requiredAccess);
  return workspaceRoot;
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
    versionId: typeof record.versionId === "string" ? record.versionId : undefined,
    restoredRelations: record.restoredRelations && typeof record.restoredRelations === "object" && !Array.isArray(record.restoredRelations)
      ? Object.fromEntries(
          Object.entries(record.restoredRelations as Record<string, unknown>).flatMap(([key, item]) => {
            const count = typeof item === "number" ? item : Number(item ?? 0);
            return Number.isFinite(count) ? [[key, count]] as const : [];
          })
        )
      : undefined
  };
}

function buildRestoreWindow(deletedAt: string | null) {
  if (!deletedAt) {
    return null;
  }

  const base = new Date(deletedAt);

  if (Number.isNaN(base.getTime())) {
    return null;
  }

  return new Date(base.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();
}

function isRestoreWindowExpired(expiresAt: string | null) {
  if (!expiresAt) {
    return false;
  }

  const expiresAtMs = Date.parse(expiresAt);
  return Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now();
}

function buildRestoreDisplay(entityType: string, snapshot: Record<string, unknown>, fallbackCreatedAt?: string | null) {
  const firstName = typeof snapshot.first_name === "string" ? snapshot.first_name.trim() : "";
  const lastName = typeof snapshot.last_name === "string" ? snapshot.last_name.trim() : "";
  const metadata = snapshot.metadata && typeof snapshot.metadata === "object" && !Array.isArray(snapshot.metadata)
    ? snapshot.metadata as Record<string, unknown>
    : {};
  const deletedAt = typeof snapshot.deleted_at === "string" ? snapshot.deleted_at : fallbackCreatedAt ?? null;

  if (entityType === "athlete") {
    return {
      displayName: [firstName, lastName].filter(Boolean).join(" ").trim() || "Untitled athlete",
      secondaryLabel: (
        (typeof snapshot.registration_number === "string" && snapshot.registration_number.trim())
        || (typeof metadata.registrationNumber === "string" && metadata.registrationNumber.trim())
        || null
      ),
      deletedAt,
      expiresAt: buildRestoreWindow(deletedAt)
    };
  }

  const division = typeof snapshot.division === "string" ? snapshot.division.trim() : "";
  const teamLevel = typeof metadata.teamLevel === "string" ? metadata.teamLevel.trim() : "";
  const ageCategory = typeof metadata.ageCategory === "string" ? metadata.ageCategory.trim() : "";

  return {
    displayName: (typeof snapshot.name === "string" ? snapshot.name.trim() : "") || "Untitled team",
    secondaryLabel: [division, teamLevel, ageCategory].filter(Boolean).join(" / ") || null,
    deletedAt,
    expiresAt: buildRestoreWindow(deletedAt)
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

  if (message.includes("WORKSPACE_ROOT_NOT_FOUND")) {
    return { message: "The requested Planner workspace could not be found.", code: "WORKSPACE_ROOT_NOT_FOUND" };
  }

  if (message.includes("GYM_WORKSPACE_REQUIRED")) {
    return { message: "A gym workspace is required for this action.", code: "GYM_WORKSPACE_REQUIRED" };
  }

  if (message.includes("VERSION_NOT_FOUND")) {
    return { message: "The selected Trash version could not be found.", code: "VERSION_NOT_FOUND" };
  }

  if (message.includes("RESTORE_NOT_AVAILABLE")) {
    return { message: "This Trash item is no longer available to restore.", code: "RESTORE_NOT_AVAILABLE" };
  }

  if (message.includes("RESTORE_EXPIRED")) {
    return { message: "This Trash item is past the 90-day restore window.", code: "RESTORE_EXPIRED" };
  }

  if (message.includes("ATHLETE_NOT_FOUND")) {
    return { message: "The athlete could not be found in this workspace. Reload the athlete record and try again.", code: "ATHLETE_NOT_FOUND" };
  }

  if (
    message.includes("planner_project_versions_entity_id_version_number_key")
    || message.includes("duplicate key value violates unique constraint")
  ) {
    return { message: "Planner history is out of sync. Reload and try again.", code: "PLANNER_INTEGRITY_ERROR" };
  }

  return { message, code: null };
}

export function getPlannerCommandError(error: unknown) {
  return normalizeRpcError(error);
}

async function loadRestorableTrashVersion(
  workspaceRootId: string,
  entityType: string,
  versionId: string
) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("workspace_entity_versions" as never)
    .select("id, entity_type, entity_id, version_number, change_type, snapshot, change_set_id, created_at" as never)
    .eq("id", versionId as never)
    .eq("entity_type", entityType as never)
    .eq("workspace_root_id", workspaceRootId as never)
    .maybeSingle();

  if (error || !data) {
    throw new Error("VERSION_NOT_FOUND");
  }

  const row = data as RestoreVersionRow;

  if ((row.entity_type !== "athlete" && row.entity_type !== "team") || row.change_type !== "delete") {
    throw new Error("RESTORE_NOT_AVAILABLE");
  }

  const [
    { data: latestDelete, error: latestDeleteError },
    { count: laterRestoreCount, error: laterRestoreError }
  ] = await Promise.all([
    admin
      .from("workspace_entity_versions" as never)
      .select("id, version_number, created_at" as never)
      .eq("workspace_root_id", workspaceRootId as never)
      .eq("entity_type", row.entity_type as never)
      .eq("entity_id", row.entity_id as never)
      .eq("change_type", "delete" as never)
      .order("version_number" as never, { ascending: false })
      .order("created_at" as never, { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("workspace_entity_versions" as never)
      .select("id" as never, { count: "exact", head: true })
      .eq("workspace_root_id", workspaceRootId as never)
      .eq("entity_type", row.entity_type as never)
      .eq("entity_id", row.entity_id as never)
      .eq("change_type", "restore" as never)
      .gt("version_number" as never, row.version_number as never)
  ]);

  if (latestDeleteError || laterRestoreError) {
    throw latestDeleteError ?? laterRestoreError;
  }

  const latestDeleteRow = latestDelete as { id: string } | null;

  if (!latestDeleteRow || latestDeleteRow.id !== row.id || (laterRestoreCount ?? 0) > 0) {
    throw new Error("RESTORE_NOT_AVAILABLE");
  }

  const deletedAt = typeof row.snapshot.deleted_at === "string" ? row.snapshot.deleted_at : row.created_at;
  const expiresAt = buildRestoreWindow(deletedAt);

  if (isRestoreWindowExpired(expiresAt)) {
    throw new Error("RESTORE_EXPIRED");
  }

  return { row, deletedAt, expiresAt };
}

async function countDeletedRowsWithChangeSet(
  table: string,
  workspaceRootId: string,
  deleteChangeSetId: string | null,
  filters: Record<string, string>
) {
  if (!deleteChangeSetId) {
    return 0;
  }

  const admin = createAdminClient();
  let query = admin
    .from(table as never)
    .select("id" as never, { count: "exact", head: true })
    .eq("workspace_root_id", workspaceRootId as never)
    .eq("last_change_set_id", deleteChangeSetId as never)
    .not("deleted_at" as never, "is" as never, null as never);

  for (const [column, value] of Object.entries(filters)) {
    query = query.eq(column as never, value as never);
  }

  const { count, error } = await query;

  if (error) {
    throw error;
  }

  return count ?? 0;
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
  const workspaceRoot = await resolveWorkspaceRoot(session, scope, payload.workspaceRootId, "write");

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
  const workspaceRoot = await resolveWorkspaceRoot(session, scope, payload.workspaceRootId, "write");

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

export async function savePlannerTryoutRecordCommand(
  session: AuthSession,
  scope: PlannerWorkspaceScope,
  payload: {
    workspaceRootId?: string | null;
    expectedLockVersion?: number | null;
    tryoutRecordId: string;
    athleteId: string;
    occurredAt?: string | null;
    record: Record<string, unknown>;
  }
) {
  const workspaceRoot = await resolveWorkspaceRoot(session, scope, payload.workspaceRootId, "write");

  return executePlannerCommand<TryoutRecord>("planner_command_tryout_save", {
    p_actor_profile_id: session.userId,
    p_workspace_root_id: workspaceRoot.id,
    p_expected_lock_version: payload.expectedLockVersion ?? null,
    p_tryout_record_id: payload.tryoutRecordId,
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
    selectionProfile?: Record<string, unknown> | null;
  }
) {
  const workspaceRoot = await resolveWorkspaceRoot(session, scope, payload.workspaceRootId, "write");

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
    p_assigned_coach_names: payload.assignedCoachNames,
    p_selection_profile: payload.selectionProfile ?? null
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
  const workspaceRoot = await resolveWorkspaceRoot(session, scope, payload.workspaceRootId, "write");

  return executePlannerCommand<TeamRecord>("planner_command_team_assignments_set", {
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
  const workspaceRoot = await resolveWorkspaceRoot(session, scope, payload.workspaceRootId, "write");

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
  const workspaceRoot = await resolveWorkspaceRoot(session, scope, payload.workspaceRootId, "write");

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
  const workspaceRoot = await resolveWorkspaceRoot(session, scope, payload.workspaceRootId, "write");

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
  const workspaceRoot = await resolveWorkspaceRoot(session, scope, payload.workspaceRootId, "restore");

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
  const workspaceRoot = await resolveWorkspaceRoot(session, scope, payload.workspaceRootId, "restore");

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
  const workspaceRoot = await resolveWorkspaceRoot(session, scope, payload.workspaceRootId, "write");

  return executePlannerCommand<TeamRecord>("planner_soft_delete_team", {
    p_actor_profile_id: session.userId,
    p_workspace_root_id: workspaceRoot.id,
    p_team_id: payload.teamId,
    p_expected_lock_version: payload.expectedLockVersion ?? null
  });
}

export async function softDeletePlannerAthleteCommand(
  session: AuthSession,
  scope: PlannerWorkspaceScope,
  payload: {
    workspaceRootId?: string | null;
    athleteId: string;
    expectedLockVersion?: number | null;
  }
) {
  const workspaceRoot = await resolveWorkspaceRoot(session, scope, payload.workspaceRootId, "write");

  return executePlannerCommand<AthleteRecord>("planner_soft_delete_athlete", {
    p_actor_profile_id: session.userId,
    p_workspace_root_id: workspaceRoot.id,
    p_athlete_id: payload.athleteId,
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
  const workspaceRoot = await resolveWorkspaceRoot(session, scope, payload.workspaceRootId, "read");
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
  const workspaceRoot = await resolveWorkspaceRoot(session, scope, payload.workspaceRootId, "read");
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

export async function listPlannerTrash(
  session: AuthSession,
  scope: PlannerWorkspaceScope,
  payload: {
    workspaceRootId?: string | null;
    entityType?: "athlete" | "team" | null;
    search?: string | null;
    limit?: number;
  }
) {
  const workspaceRoot = await resolveWorkspaceRoot(session, scope, payload.workspaceRootId);
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("planner_list_workspace_trash" as never, {
    p_workspace_root_id: workspaceRoot.id,
    p_search: payload.search ?? null,
    p_entity_type: payload.entityType ?? null,
    p_limit: payload.limit ?? 100
  } as never);

  if (error) {
    throw error;
  }

  return {
    workspaceRoot,
    items: ((data ?? []) as Array<{
      entity_type: "athlete" | "team";
      entity_id: string;
      version_id: string;
      name: string;
      secondary_label: string | null;
      deleted_at: string;
      deleted_by_profile_id: string | null;
      deleted_by_name: string | null;
      expires_at: string | null;
      restore_available: boolean;
      snapshot: Record<string, unknown>;
    }>).map((row) => ({
      entityType: row.entity_type,
      entityId: row.entity_id,
      versionId: row.version_id,
      name: row.name,
      secondaryLabel: row.secondary_label ?? "",
      deletedAt: row.deleted_at,
      deletedByProfileId: row.deleted_by_profile_id,
      deletedByName: row.deleted_by_name,
      expiresAt: row.expires_at,
      restoreAvailable: row.restore_available,
      snapshot: row.snapshot
    })) as PlannerTrashItem[]
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
  const workspaceRoot = await resolveWorkspaceRoot(session, scope, payload.workspaceRootId, "read");
  const admin = createAdminClient();
  const { row, deletedAt, expiresAt } = await loadRestorableTrashVersion(workspaceRoot.id, payload.entityType, payload.versionId);

  const currentTableMap = {
    athlete: "athletes",
    team: "teams",
    assignment: "athlete_team_assignments",
    "planner-project": "planner_projects",
    "tryout-record": "planner_tryout_records",
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

  const relatedRestores: RestorePreview["relatedRestores"] = [];
  const entityId = row.entity_id;
  const deleteChangeSetId = row.change_set_id;

  if (payload.entityType === "athlete") {
    const [assignmentResult, evaluationResult, backupResult] = await Promise.all([
      countDeletedRowsWithChangeSet("athlete_team_assignments", workspaceRoot.id, deleteChangeSetId, { athlete_id: entityId }),
      countDeletedRowsWithChangeSet("planner_tryout_records", workspaceRoot.id, deleteChangeSetId, { athlete_id: entityId }),
      admin
        .from("workspace_backups" as never)
        .select("id" as never, { count: "exact", head: true })
        .eq("workspace_root_id", workspaceRoot.id as never)
        .eq("backup_type" as never, "pre-destructive" as never)
        .contains("metadata" as never, { entityType: "athlete", entityId } as never)
    ]);

    if (assignmentResult > 0) {
      relatedRestores.push({ key: "assignments", label: "Roster links", count: assignmentResult });
    }

    if (evaluationResult > 0) {
      relatedRestores.push({ key: "tryoutRecords", label: "Tryouts", count: evaluationResult });
    }

    const display = buildRestoreDisplay(payload.entityType, row.snapshot, row.created_at);

    return {
      workspaceRoot,
      preview: {
        entityType: row.entity_type as VersionedEntityType,
        entityId: row.entity_id,
        versionId: row.id,
        versionNumber: row.version_number,
        currentLockVersion,
        displayName: display.displayName,
        secondaryLabel: display.secondaryLabel,
        deletedAt,
        expiresAt,
        backupAvailable: (backupResult.count ?? 0) > 0,
        relatedRestores,
        notes: [
          relatedRestores.length ? "Restoring this athlete will also bring back related records deleted in the same action." : "This restore will bring back the athlete record only.",
          (backupResult.count ?? 0) > 0 ? "A pre-destructive backup is available if you need deeper recovery support." : null
        ].filter((note): note is string => Boolean(note)),
        restoreSnapshot: row.snapshot
      } satisfies RestorePreview
    };
  }

  if (payload.entityType === "team") {
    const [assignmentResult, skillPlanResult, routinePlanResult, seasonPlanResult, backupResult] = await Promise.all([
      countDeletedRowsWithChangeSet("athlete_team_assignments", workspaceRoot.id, deleteChangeSetId, { team_id: entityId }),
      countDeletedRowsWithChangeSet("team_skill_plans", workspaceRoot.id, deleteChangeSetId, { team_id: entityId }),
      countDeletedRowsWithChangeSet("team_routine_plans", workspaceRoot.id, deleteChangeSetId, { team_id: entityId }),
      countDeletedRowsWithChangeSet("team_season_plans", workspaceRoot.id, deleteChangeSetId, { team_id: entityId }),
      admin
        .from("workspace_backups" as never)
        .select("id" as never, { count: "exact", head: true })
        .eq("workspace_root_id", workspaceRoot.id as never)
        .eq("backup_type" as never, "pre-destructive" as never)
        .contains("metadata" as never, { entityType: "team", entityId } as never)
    ]);

    if (assignmentResult > 0) {
      relatedRestores.push({ key: "assignments", label: "Roster links", count: assignmentResult });
    }

    if (skillPlanResult > 0) {
      relatedRestores.push({ key: "skillPlans", label: "Skill plans", count: skillPlanResult });
    }

    if (routinePlanResult > 0) {
      relatedRestores.push({ key: "routinePlans", label: "Routine plans", count: routinePlanResult });
    }

    if (seasonPlanResult > 0) {
      relatedRestores.push({ key: "seasonPlans", label: "Season plans", count: seasonPlanResult });
    }

    const display = buildRestoreDisplay(payload.entityType, row.snapshot, row.created_at);

    return {
      workspaceRoot,
      preview: {
        entityType: row.entity_type as VersionedEntityType,
        entityId: row.entity_id,
        versionId: row.id,
        versionNumber: row.version_number,
        currentLockVersion,
        displayName: display.displayName,
        secondaryLabel: display.secondaryLabel,
        deletedAt,
        expiresAt,
        backupAvailable: (backupResult.count ?? 0) > 0,
        relatedRestores,
        notes: [
          relatedRestores.length ? "Restoring this team will also bring back planner records deleted in the same action." : "This restore will bring back the team record only.",
          (backupResult.count ?? 0) > 0 ? "A pre-destructive backup is available if you need deeper recovery support." : null
        ].filter((note): note is string => Boolean(note)),
        restoreSnapshot: row.snapshot
      } satisfies RestorePreview
    };
  }

  throw new Error("RESTORE_NOT_AVAILABLE");
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
