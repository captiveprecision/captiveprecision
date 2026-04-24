import type { AthleteRecord } from "@/lib/domain/athlete";
import type { TryoutRecord } from "@/lib/domain/evaluation-record";
import type { PlannerProject } from "@/lib/domain/planner-project";
import type { TeamRoutinePlan } from "@/lib/domain/routine-plan";
import type { TeamSeasonPlan } from "@/lib/domain/season-plan";
import type { TeamSkillPlan } from "@/lib/domain/skill-plan";
import type { TeamRecord, TeamSelectionProfile } from "@/lib/domain/team";
import type { PlannerTrashItem, RestorePreview, WorkspaceRoot } from "@/lib/domain/planner-versioning";
import {
  buildPlannerAthleteFromRow,
  buildPlannerTryoutRecordFromRow,
  buildPlannerProjectFromRow,
  buildRoutinePlanFromRow,
  buildTeamSeasonPlanFromRow,
  buildTeamSkillPlanFromRow,
  type PlannerRemoteFoundationSnapshot
} from "@/lib/services/planner-supabase-foundation";
import { normalizePlannerTeam } from "@/lib/services/planner-domain-mappers";
import type { PlannerWorkspaceScope } from "@/lib/services/planner-workspace";

type PlannerCommandResult<TEntity> = {
  entity: TEntity;
  lockVersion: number;
  changeSetId: string;
  latestVersionNumber: number;
  versionId?: string;
  restoredRelations?: Record<string, number>;
};

type PlannerRestoreResult = {
  entityType: "athlete" | "team";
  rawEntity: PlannerCommandEntityRow;
  athlete?: AthleteRecord;
  team?: TeamRecord;
  restoredRelations?: Record<string, number>;
};

type PlannerCommandEntityRow = Record<string, unknown>;

export class PlannerApiError extends Error {
  code: string | null;

  constructor(message: string, code?: string | null) {
    super(message);
    this.name = "PlannerApiError";
    this.code = code ?? null;
  }
}

export function isPremiumRequiredError(error: unknown) {
  return error instanceof PlannerApiError && error.code === "PREMIUM_REQUIRED";
}

export function isPlannerOfflineError(error: unknown) {
  return error instanceof PlannerApiError && error.code === "OFFLINE_OR_NETWORK_ERROR";
}

function buildPlannerUrl(path: string, scope: PlannerWorkspaceScope) {
  const url = new URL(path, window.location.origin);
  url.searchParams.set("scope", scope);
  return url.toString();
}

function isOfflineFetchError(error: unknown) {
  return error instanceof TypeError || error instanceof DOMException;
}

function buildOfflinePlannerError() {
  return new PlannerApiError("You are offline. We will retry when connection returns.", "OFFLINE_OR_NETWORK_ERROR");
}

async function parseResponse<T>(response: Response): Promise<T | null> {
  return response.json().catch(() => null) as Promise<T | null>;
}

async function performPlannerRequest<T>(input: string, init?: RequestInit) {
  try {
    return await fetch(input, {
      credentials: "include",
      ...init
    });
  } catch (error) {
    if (isOfflineFetchError(error)) {
      throw buildOfflinePlannerError();
    }

    throw error;
  }
}

async function postPlannerCommand<TResult>(
  scope: PlannerWorkspaceScope,
  path: string,
  body: Record<string, unknown>
) {
  const response = await performPlannerRequest(buildPlannerUrl(path, scope), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scope, ...body })
  });
  const result = await parseResponse<TResult & { error?: string; code?: string }>(response);

  if (!response.ok || !result) {
    throw new PlannerApiError(result?.error ?? "Unable to complete planner command.", result?.code);
  }

  return result;
}

function buildCommandEntityRow(
  entity: PlannerCommandEntityRow,
  result: Pick<PlannerCommandResult<PlannerCommandEntityRow>, "lockVersion" | "changeSetId">
): PlannerCommandEntityRow & { lock_version: number; last_change_set_id: string } {
  return {
    ...entity,
    lock_version: result.lockVersion,
    last_change_set_id: result.changeSetId
  };
}

function parseMetadata(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.flatMap((item) => typeof item === "string" ? [item.trim()] : []).filter(Boolean)
    : [];
}

export function normalizeCommandTeam(
  workspaceId: string,
  entity: PlannerCommandEntityRow,
  result: Pick<PlannerCommandResult<PlannerCommandEntityRow>, "lockVersion" | "changeSetId">,
  fallback?: Pick<TeamRecord, "memberAthleteIds" | "memberRegistrationNumbers" | "status">
) {
  const row = buildCommandEntityRow(entity, result);
  const metadata = parseMetadata(row.metadata);

  return normalizePlannerTeam({
    id: asString(row.id),
    workspaceId,
    workspaceRootId: asString(row.workspace_root_id) || undefined,
    remoteTeamId: asString(row.id),
    name: asString(row.name),
    teamLevel: (asString(metadata.teamLevel) || "Beginner") as TeamRecord["teamLevel"],
    teamType: asString(metadata.ageCategory) || "Youth",
    teamDivision: asString(row.division),
    trainingDays: asString(metadata.trainingDays),
    trainingHours: asString(metadata.trainingHours),
    assignedCoachNames: asStringArray(metadata.assignedCoachNames),
    linkedCoachIds: asStringArray(metadata.linkedCoachIds),
    memberAthleteIds: fallback?.memberAthleteIds ?? [],
    memberRegistrationNumbers: fallback?.memberRegistrationNumbers ?? [],
    selectionProfile: metadata.selectionProfile as TeamSelectionProfile | undefined,
    status: fallback?.status ?? "draft",
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
    lockVersion: result.lockVersion,
    lastChangeSetId: result.changeSetId,
    archivedAt: asString(row.archived_at) || null,
    deletedAt: asString(row.deleted_at) || null,
    restoredFromVersionId: asString(row.restored_from_version_id) || null
  });
}

export async function fetchPlannerFoundation(scope: PlannerWorkspaceScope) {
  const response = await performPlannerRequest(buildPlannerUrl("/api/planner/foundation", scope), {
    cache: "no-store"
  });
  const result = await parseResponse<PlannerRemoteFoundationSnapshot & { error?: string; code?: string }>(response);

  if (!response.ok || !result) {
    throw new PlannerApiError(result?.error ?? "Unable to load Supabase planner data.", result?.code);
  }

  return result;
}

export async function savePlannerProjectConfig(
  scope: PlannerWorkspaceScope,
  payload: Pick<PlannerProject, "workspaceId" | "name" | "status" | "pipelineStage" | "qualificationRules" | "workspaceRootId" | "lockVersion"> & {
    template: Record<string, unknown>;
  }
) {
  const result = await postPlannerCommand<PlannerCommandResult<PlannerCommandEntityRow>>(scope, "/api/planner/commands/project-save", {
    workspaceRootId: payload.workspaceRootId ?? null,
    expectedLockVersion: payload.lockVersion ?? null,
    name: payload.name,
    status: payload.status,
    pipelineStage: payload.pipelineStage,
    template: payload.template,
    qualificationRules: payload.qualificationRules
  });

  return buildPlannerProjectFromRow(buildCommandEntityRow(result.entity, result) as never, payload.workspaceId);
}

export async function savePlannerAthlete(
  scope: PlannerWorkspaceScope,
  payload: {
    workspaceId: string;
    athleteId?: string | null;
    workspaceRootId?: string | null;
    expectedLockVersion?: number | null;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    registrationNumber: string;
    notes: string;
    parentContacts: AthleteRecord["parentContacts"];
  }
) {
  const result = await postPlannerCommand<PlannerCommandResult<PlannerCommandEntityRow>>(scope, "/api/planner/commands/athlete-save", payload);

  return buildPlannerAthleteFromRow(buildCommandEntityRow(result.entity, result) as never, payload.workspaceId);
}

export async function savePlannerTryoutRecord(scope: PlannerWorkspaceScope, tryoutRecord: TryoutRecord) {
  const result = await postPlannerCommand<PlannerCommandResult<PlannerCommandEntityRow>>(scope, "/api/planner/commands/tryout-save", {
    workspaceRootId: tryoutRecord.workspaceRootId ?? null,
    expectedLockVersion: tryoutRecord.lockVersion ?? null,
    tryoutRecordId: tryoutRecord.id,
    athleteId: tryoutRecord.athleteId,
    occurredAt: tryoutRecord.occurredAt,
    record: tryoutRecord
  });

  return buildPlannerTryoutRecordFromRow(buildCommandEntityRow(result.entity, result) as never, tryoutRecord.workspaceId);
}

export async function savePlannerSkillPlan(scope: PlannerWorkspaceScope, plan: TeamSkillPlan) {
  const result = await postPlannerCommand<PlannerCommandResult<PlannerCommandEntityRow>>(scope, "/api/planner/commands/skill-plan-save", {
    workspaceRootId: plan.workspaceRootId ?? null,
    expectedLockVersion: plan.lockVersion ?? null,
    teamId: plan.teamId,
    status: plan.status,
    notes: plan.notes,
    selections: plan.selections
  });

  return buildTeamSkillPlanFromRow(buildCommandEntityRow(result.entity, result) as never, plan.workspaceId);
}

export async function savePlannerRoutinePlan(scope: PlannerWorkspaceScope, plan: TeamRoutinePlan, remoteTeamId: string) {
  const result = await postPlannerCommand<PlannerCommandResult<PlannerCommandEntityRow>>(scope, "/api/planner/commands/routine-plan-save", {
    workspaceRootId: plan.workspaceRootId ?? null,
    expectedLockVersion: plan.lockVersion ?? null,
    teamId: remoteTeamId,
    status: plan.status,
    notes: plan.notes,
    document: plan.document
  });

  return buildRoutinePlanFromRow(buildCommandEntityRow(result.entity, result) as never, plan.workspaceId);
}

export async function savePlannerSeasonPlan(scope: PlannerWorkspaceScope, plan: TeamSeasonPlan) {
  const result = await postPlannerCommand<PlannerCommandResult<PlannerCommandEntityRow>>(scope, "/api/planner/commands/season-plan-save", {
    workspaceRootId: plan.workspaceRootId ?? null,
    expectedLockVersion: plan.lockVersion ?? null,
    teamId: plan.teamId,
    status: plan.status,
    notes: plan.notes,
    checkpoints: plan.checkpoints
  });

  return buildTeamSeasonPlanFromRow(buildCommandEntityRow(result.entity, result) as never, plan.workspaceId);
}

export async function savePlannerTeam(
  scope: PlannerWorkspaceScope,
  payload: {
    workspaceId: string;
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
    selectionProfile: TeamSelectionProfile;
    fallbackTeam?: Pick<TeamRecord, "memberAthleteIds" | "memberRegistrationNumbers" | "status">;
  }
) {
  const result = await postPlannerCommand<PlannerCommandResult<PlannerCommandEntityRow>>(scope, "/api/planner/commands/team-save", {
    workspaceRootId: payload.workspaceRootId ?? null,
    expectedLockVersion: payload.expectedLockVersion ?? null,
    teamId: payload.teamId ?? null,
    name: payload.name,
    teamLevel: payload.teamLevel,
    teamType: payload.teamType,
    teamDivision: payload.teamDivision,
    trainingDays: payload.trainingDays,
    trainingHours: payload.trainingHours,
    linkedCoachIds: payload.linkedCoachIds,
    assignedCoachNames: payload.assignedCoachNames,
    selectionProfile: payload.selectionProfile
  });

  return {
    team: normalizeCommandTeam(payload.workspaceId, result.entity, result, payload.fallbackTeam),
    lockVersion: result.lockVersion,
    changeSetId: result.changeSetId
  };
}

export async function savePlannerTeamAssignments(
  scope: PlannerWorkspaceScope,
  payload: {
    workspaceId: string;
    workspaceRootId?: string | null;
    teamId: string;
    athleteIds: string[];
    fallbackTeam?: Pick<TeamRecord, "memberAthleteIds" | "memberRegistrationNumbers" | "status">;
  }
) {
  const result = await postPlannerCommand<PlannerCommandResult<PlannerCommandEntityRow>>(scope, "/api/planner/commands/team-assignments-set", {
    workspaceRootId: payload.workspaceRootId ?? null,
    teamId: payload.teamId,
    athleteIds: payload.athleteIds
  });

  return {
    team: normalizeCommandTeam(payload.workspaceId, result.entity, result, payload.fallbackTeam),
    lockVersion: result.lockVersion,
    changeSetId: result.changeSetId
  };
}

export async function deletePlannerAthlete(
  scope: PlannerWorkspaceScope,
  payload: {
    workspaceRootId?: string | null;
    athleteId: string;
    expectedLockVersion?: number | null;
  }
) {
  return postPlannerCommand<PlannerCommandResult<PlannerCommandEntityRow>>(scope, "/api/planner/commands/athlete-delete", {
    workspaceRootId: payload.workspaceRootId ?? null,
    athleteId: payload.athleteId,
    expectedLockVersion: payload.expectedLockVersion ?? null
  });
}

export async function deletePlannerTeam(
  scope: PlannerWorkspaceScope,
  payload: {
    workspaceRootId?: string | null;
    teamId: string;
    expectedLockVersion?: number | null;
  }
) {
  return postPlannerCommand<PlannerCommandResult<PlannerCommandEntityRow>>(scope, "/api/planner/commands/team-delete", {
    workspaceRootId: payload.workspaceRootId ?? null,
    teamId: payload.teamId,
    expectedLockVersion: payload.expectedLockVersion ?? null
  });
}

export async function fetchPlannerTrash(
  scope: PlannerWorkspaceScope,
  payload?: {
    workspaceRootId?: string | null;
    entityType?: "athlete" | "team" | null;
    search?: string | null;
    limit?: number;
  }
) {
  const url = new URL(buildPlannerUrl("/api/planner/trash", scope));

  if (payload?.workspaceRootId) {
    url.searchParams.set("workspaceRootId", payload.workspaceRootId);
  }

  if (payload?.entityType) {
    url.searchParams.set("entityType", payload.entityType);
  }

  if (payload?.search) {
    url.searchParams.set("search", payload.search);
  }

  if (typeof payload?.limit === "number") {
    url.searchParams.set("limit", String(payload.limit));
  }

  const response = await performPlannerRequest(url.toString(), {
    cache: "no-store"
  });
  const result = await parseResponse<{ workspaceRoot: WorkspaceRoot; items: PlannerTrashItem[]; error?: string; code?: string }>(response);

  if (!response.ok || !result) {
    throw new PlannerApiError(result?.error ?? "Unable to load planner trash.", result?.code);
  }

  return result;
}

export async function fetchPlannerRestorePreview(
  scope: PlannerWorkspaceScope,
  payload: {
    workspaceRootId?: string | null;
    entityType: string;
    versionId: string;
  }
) {
  const url = new URL(buildPlannerUrl("/api/planner/restore-preview", scope));
  url.searchParams.set("entityType", payload.entityType);
  url.searchParams.set("versionId", payload.versionId);

  if (payload.workspaceRootId) {
    url.searchParams.set("workspaceRootId", payload.workspaceRootId);
  }

  const response = await performPlannerRequest(url.toString(), {
    cache: "no-store"
  });
  const result = await parseResponse<{ workspaceRoot: WorkspaceRoot; preview: RestorePreview; error?: string; code?: string }>(response);

  if (!response.ok || !result) {
    throw new PlannerApiError(result?.error ?? "Unable to load restore preview.", result?.code);
  }

  return result;
}

export async function restorePlannerEntity(
  scope: PlannerWorkspaceScope,
  payload: {
    workspaceId: string;
    workspaceRootId?: string | null;
    entityType: string;
    versionId: string;
    expectedLockVersion?: number | null;
  }
) {
  const result = await postPlannerCommand<PlannerCommandResult<PlannerCommandEntityRow>>(scope, "/api/planner/commands/entity-restore", {
    workspaceRootId: payload.workspaceRootId ?? null,
    entityType: payload.entityType,
    versionId: payload.versionId,
    expectedLockVersion: payload.expectedLockVersion ?? null
  });

  if (payload.entityType === "athlete") {
    return {
      entityType: "athlete" as const,
      rawEntity: result.entity,
      athlete: buildPlannerAthleteFromRow(buildCommandEntityRow(result.entity, result) as never, payload.workspaceId),
      restoredRelations: result.restoredRelations
    } satisfies PlannerRestoreResult;
  }

  if (payload.entityType === "team") {
    return {
      entityType: "team" as const,
      rawEntity: result.entity,
      team: normalizeCommandTeam(payload.workspaceId, result.entity, result),
      restoredRelations: result.restoredRelations
    } satisfies PlannerRestoreResult;
  }

  throw new PlannerApiError("Unable to restore this planner entity.", "RESTORE_NOT_AVAILABLE");
}
