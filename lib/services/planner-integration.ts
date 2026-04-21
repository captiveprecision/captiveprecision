import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AthleteParentContact, AthleteRecord } from "@/lib/domain/athlete";
import type { PlannerTrashItem } from "@/lib/domain/planner-versioning";
import type { RoutineDocument, TeamRoutinePlan } from "@/lib/domain/routine-plan";
import type { TeamSeasonPlan } from "@/lib/domain/season-plan";
import type { TeamSkillCategory, TeamSkillPlan, TeamSkillSelection } from "@/lib/domain/skill-plan";

import { getSystemById, getVersionById } from "@/lib/scoring/scoring-systems";
import { useScoringSystems } from "@/lib/scoring/use-scoring-systems";
import { buildMyTeamsTeamSummaries } from "@/lib/services/planner-my-teams";
import { mergeRemoteFoundationIntoProject, type PlannerRemoteFoundationSnapshot } from "@/lib/services/planner-supabase-foundation";
import {
  deletePlannerAthlete,
  deletePlannerTeam,
  fetchPlannerRestorePreview,
  fetchPlannerTrash,
  fetchPlannerFoundation,
  isPlannerOfflineError,
  isPremiumRequiredError,
  PlannerApiError,
  restorePlannerEntity,
  savePlannerAthlete,
  savePlannerEvaluation,
  savePlannerProjectConfig,
  savePlannerRoutinePlan,
  savePlannerSeasonPlan,
  savePlannerSkillPlan,
  savePlannerTeam,
  savePlannerTeamAssignments
} from "@/lib/services/planner-remote-client";
import { isUuidString, type PlannerWorkspaceScope } from "@/lib/services/planner-workspace";
import { buildRoutineBuilderTeamInputs, buildTeamRoutinePlanDraft } from "@/lib/services/planner-routine-builder";
import { buildSeasonPlannerTeamInputs, replaceTeamSeasonPlanCheckpoints } from "@/lib/services/planner-season-planner";
import { buildSkillPlannerTeamInputs, replaceTeamSkillPlanSelections } from "@/lib/services/planner-skill-planner";
import {
  buildSeasonPlannerAvailableCheckpoints,
  buildSeasonPlannerDraftCheckpointIds,
  buildSeasonPlannerPersistedCheckpoints,
  buildSkillPlannerDraftSelectionRows,
  buildSkillPlannerPersistedSelections
} from "@/lib/services/planner-integration-adapters";
import {
  applyTryoutSaveToPlannerProject,
  buildTryoutEvaluationRecord,
  buildTryoutEvaluationSummary,
  buildTryoutLevelEvaluations,
  buildTryoutSkillRow,
  getTryoutEvaluationDate,
  hydrateTryoutScoringContext
} from "@/lib/services/planner-tryouts";
import {
  assignAthleteToPlannerTeam,
  buildTeamBuilderCandidates,
  buildTeamBuilderTeamsWithMembers,
  clearPlannerTeamRoster,
  createPlannerTeamRecord,
  deletePlannerTeamRecord,
  removeAthleteFromPlannerTeam,
  updateMyTeamsTeamProfile as updateMyTeamsTeamProfileState,
  updatePlannerTeamDefinition,
  type TeamBuilderTeamDraftInput
} from "@/lib/services/planner-team-builder";
import {
  LEVEL_KEYS,
  LEVEL_LABELS,
  buildCheerPlannerMigrationKey,
  buildCheerPlannerStorageKey,
  CHEER_PLANNER_REMOTE_MIGRATION_VERSION,
  cloneCheerPlannerState,
  cloneTemplate,
  defaultCheerPlannerState,
  defaultTryoutTemplate,
  readCheerPlannerStateFromStorage,
  levelLabels,
  type CheerPlannerState,
  type PlannerLevelEvaluation,
  type PlannerLevelKey,
  type PlannerLevelLabel,
  type PlannerTemplateSkill,
  type PlannerTeamRecord,
  type PlannerTryoutEvaluation,
  type PlannerTryoutTemplate,
  canAssignQualifiedLevelToTeam,
  writeCheerPlannerStateToStorage
} from "@/lib/tools/cheer-planner-tryouts";
export {
  applyTryoutSaveToPlannerProject,
  assignAthleteToPlannerTeam,
  removeAthleteFromPlannerTeam,
  updatePlannerTeamDefinition
};

export type PlannerSportTab = "tumbling" | "dance" | "jumps" | "stunts";

export type AthleteDraftState = {
  athleteId: string | null;
  workspaceRootId?: string;
  lockVersion?: number;
  registrationNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  notes: string;
  parentContacts: AthleteParentContact[];
};

export type TeamDraftState = {
  name: string;
  teamLevel: PlannerLevelLabel;
  teamType: string;
  trainingSchedule: string;
  assignedCoachNames: string[];
};

export type TeamEditState = {
  teamId: string;
  name: string;
  teamLevel: PlannerLevelLabel;
  teamType: string;
} | null;

export type AthleteFilters = {
  search: string;
  level: "all" | PlannerLevelLabel | "Unqualified";
  availability: "all" | "available" | "assigned";
  sort: "score-desc" | "age-asc" | "age-desc" | "name-asc";
};

export type PlannerStatItem = {
  label: string;
  value: number | string;
  note: string;
};

type SkillPlannerDraftState = {
  teamId: string;
  selections: TeamSkillSelection[];
} | null;

type RoutineBuilderDraftState = {
  teamId: string;
  document: RoutineDocument;
  status: TeamRoutinePlan["status"];
  notes: string;
} | null;

type SeasonPlannerDraftState = {
  teamId: string;
  checkpointIds: string[];
} | null;

type PremiumAccessState = {
  tier: "free" | "premium" | "loading";
  scope: "individual" | "gym" | "none";
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};

export type SaveState = "idle" | "saving" | "saved" | "offline_pending" | "error";

export type PendingPlannerWrite = {
  id: string;
  command: "project-save" | "athlete-save" | "evaluation-save" | "team-save" | "team-assignments-set" | "skill-plan-save" | "routine-plan-save" | "season-plan-save";
  scope: "coach" | "gym";
  workspaceRootId: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
  retryCount: number;
};

const PREMIUM_REQUIRED_MESSAGE = "Esta es una funcion premium. Actualiza tu plan hoy para seguir editando, guardar registros por equipo y desbloquear Cheer Planner completo.";
const PENDING_WRITES_STORAGE_KEY = "cp-planner-pending-writes";

type PendingPlannerCommand = PendingPlannerWrite["command"];

type PendingProjectSavePayload = {
  workspaceId: string;
  workspaceRootId: string | null;
  lockVersion: number | null;
  name: string;
  status: CheerPlannerState["status"];
  pipelineStage: CheerPlannerState["pipelineStage"];
  template: PlannerTryoutTemplate;
  qualificationRules: CheerPlannerState["qualificationRules"];
};

type PendingAthleteSavePayload = {
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
};

type PendingEvaluationSavePayload = {
  athlete: PendingAthleteSavePayload;
  evaluation: PlannerTryoutEvaluation;
};

type PendingTeamSavePayload = {
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
  fallbackTeam?: Pick<PlannerTeamRecord, "memberAthleteIds" | "memberRegistrationNumbers" | "status">;
};

type PendingTeamAssignmentsPayload = {
  workspaceId: string;
  workspaceRootId?: string | null;
  teamId: string;
  athleteIds: string[];
  fallbackTeam?: Pick<PlannerTeamRecord, "memberAthleteIds" | "memberRegistrationNumbers" | "status">;
};

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function formatPlannerScore(value: number) {
  return round(value).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

function buildLevelEvaluations(template: PlannerTryoutTemplate): PlannerLevelEvaluation[] {
  return buildTryoutLevelEvaluations(template, LEVEL_KEYS);
}

function clampTemplateSkillCounts(skillLibrary: PlannerTryoutTemplate["skillLibrary"]) {
  return Object.fromEntries(
    LEVEL_KEYS.map((levelKey) => [levelKey, Math.max((skillLibrary[levelKey] ?? []).length, 0)])
  ) as Record<PlannerLevelKey, number>;
}

function buildTemplateSkill(name = ""): PlannerTemplateSkill {
  return {
    id: `template-skill-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name
  };
}

function buildTemplateOption() {
  return {
    id: `template-option-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    label: "",
    value: 0
  };
}

function buildAthleteName(firstName: string, lastName: string) {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(" ").trim();
}

function upsertAthleteRecord(athletes: AthleteRecord[], athlete: AthleteRecord) {
  return [
    ...athletes.filter((currentAthlete) => currentAthlete.id !== athlete.id),
    athlete
  ].sort((left, right) => left.name.localeCompare(right.name));
}

function upsertRecordById<T extends { id: string }>(records: T[], nextRecord: T) {
  const recordIndex = records.findIndex((record) => record.id === nextRecord.id);

  if (recordIndex < 0) {
    return [...records, nextRecord];
  }

  return records.map((record, index) => index === recordIndex ? nextRecord : record);
}

function upsertTeamScopedRecord<T extends { teamId: string }>(records: T[], nextRecord: T) {
  const recordIndex = records.findIndex((record) => record.teamId === nextRecord.teamId);

  if (recordIndex < 0) {
    return [...records, nextRecord];
  }

  return records.map((record, index) => index === recordIndex ? nextRecord : record);
}

function removeTeamScopedRecords<T extends { teamId: string }>(records: T[], teamId: string) {
  return records.filter((record) => record.teamId !== teamId);
}

type PlannerSyncSource = Partial<Pick<
  CheerPlannerState,
  "workspaceRootId" | "lockVersion" | "lastChangeSetId" | "archivedAt" | "deletedAt" | "restoredFromVersionId" | "updatedAt"
>>;

type PlannerProjectSyncState = Pick<
  CheerPlannerState,
  "name" | "status" | "pipelineStage" | "template" | "qualificationRules" | "updatedAt"
> & PlannerSyncSource;

function applyProjectSyncMetadata(
  project: CheerPlannerState,
  syncSource?: PlannerSyncSource | null,
  updatedAtFallback?: string
) {
  const nextProject: CheerPlannerState = {
    ...project,
    updatedAt: updatedAtFallback ?? project.updatedAt
  };

  if (!syncSource) {
    return nextProject;
  }

  if ("workspaceRootId" in syncSource) {
    nextProject.workspaceRootId = syncSource.workspaceRootId;
  }

  if ("lockVersion" in syncSource && typeof syncSource.lockVersion === "number") {
    nextProject.lockVersion = syncSource.lockVersion;
  }

  if ("lastChangeSetId" in syncSource) {
    nextProject.lastChangeSetId = syncSource.lastChangeSetId ?? null;
  }

  if ("archivedAt" in syncSource) {
    nextProject.archivedAt = syncSource.archivedAt ?? null;
  }

  if ("deletedAt" in syncSource) {
    nextProject.deletedAt = syncSource.deletedAt ?? null;
  }

  if ("restoredFromVersionId" in syncSource) {
    nextProject.restoredFromVersionId = syncSource.restoredFromVersionId ?? null;
  }

  if ("updatedAt" in syncSource && syncSource.updatedAt) {
    nextProject.updatedAt = syncSource.updatedAt;
  }

  return nextProject;
}

function buildEmptyParentContact(index = 0): AthleteParentContact {
  return {
    id: `parent-contact-${Date.now()}-${index + 1}-${Math.random().toString(36).slice(2, 8)}`,
    name: "",
    email: "",
    phone: ""
  };
}

function buildEmptyAthleteDraft(): AthleteDraftState {
  return {
    athleteId: null,
    workspaceRootId: undefined,
    lockVersion: undefined,
    registrationNumber: "",
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    notes: "",
    parentContacts: [buildEmptyParentContact()]
  };
}

function buildPendingWritesStorageKey(scope: PlannerWorkspaceScope) {
  return `${PENDING_WRITES_STORAGE_KEY}:${scope}`;
}

function readPendingWritesFromStorage(scope: PlannerWorkspaceScope): PendingPlannerWrite[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(buildPendingWritesStorageKey(scope));

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is PendingPlannerWrite => Boolean(
          item
          && typeof item === "object"
          && typeof (item as PendingPlannerWrite).id === "string"
          && typeof (item as PendingPlannerWrite).command === "string"
        ))
      : [];
  } catch {
    return [];
  }
}

function writePendingWritesToStorage(scope: PlannerWorkspaceScope, pendingWrites: PendingPlannerWrite[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(buildPendingWritesStorageKey(scope), JSON.stringify(pendingWrites));
}

function buildPendingWriteIdentity(command: PendingPlannerWrite["command"], payload: Record<string, unknown>) {
  switch (command) {
    case "project-save":
      return `${command}:${typeof payload.workspaceRootId === "string" ? payload.workspaceRootId : "workspace"}`;
    case "athlete-save":
      return `${command}:${typeof payload.athleteId === "string" && payload.athleteId ? payload.athleteId : typeof payload.registrationNumber === "string" ? payload.registrationNumber : "new-athlete"}`;
    case "team-save":
      return `${command}:${typeof payload.teamId === "string" && payload.teamId ? payload.teamId : typeof payload.name === "string" ? payload.name : "new-team"}`;
    case "skill-plan-save":
    case "routine-plan-save":
    case "season-plan-save":
    case "team-assignments-set":
      return `${command}:${typeof payload.teamId === "string" ? payload.teamId : "team"}`;
    case "evaluation-save":
    default:
      return `${command}:${typeof payload.evaluationId === "string" && payload.evaluationId ? payload.evaluationId : typeof payload.athleteId === "string" && payload.athleteId ? payload.athleteId : typeof payload.registrationNumber === "string" ? payload.registrationNumber : "evaluation"}`;
  }
}

function buildPendingWrite(
  scope: PlannerWorkspaceScope,
  command: PendingPlannerCommand,
  workspaceRootId: string | null,
  payload: Record<string, unknown>,
  retryCount = 0
): PendingPlannerWrite {
  return {
    id: `pending-write-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    command,
    scope,
    workspaceRootId,
    payload,
    createdAt: new Date().toISOString(),
    retryCount
  };
}

function sortAthletePool(items: ReturnType<typeof buildTeamBuilderCandidates>, filters: AthleteFilters) {
  const sorted = [...items];

  switch (filters.sort) {
    case "age-asc":
      sorted.sort((left, right) => (left.age ?? 999) - (right.age ?? 999) || left.name.localeCompare(right.name));
      break;
    case "age-desc":
      sorted.sort((left, right) => (right.age ?? -1) - (left.age ?? -1) || left.name.localeCompare(right.name));
      break;
    case "name-asc":
      sorted.sort((left, right) => left.name.localeCompare(right.name));
      break;
    case "score-desc":
    default:
      sorted.sort((left, right) => right.displayScore - left.displayScore || left.name.localeCompare(right.name));
      break;
  }

  return sorted;
}

export function getRecentAthleteLabel(evaluation: PlannerTryoutEvaluation) {
  return evaluation.athleteSnapshot?.name || "Unnamed athlete";
}

export function buildFilteredAthletePool(
  athletePool: ReturnType<typeof buildTeamBuilderCandidates>,
  filters: AthleteFilters
) {
  let nextItems = athletePool;
  const search = filters.search.trim().toLowerCase();

  if (search) {
    nextItems = nextItems.filter((athlete) => (
      athlete.name.toLowerCase().includes(search)
      || athlete.firstName.toLowerCase().includes(search)
      || athlete.lastName.toLowerCase().includes(search)
      || athlete.registrationNumber.toLowerCase().includes(search)
      || athlete.parentContacts.some((contact) => (
        contact.name.toLowerCase().includes(search)
        || contact.email.toLowerCase().includes(search)
        || contact.phone.toLowerCase().includes(search)
      ))
      || athlete.assignedTeamName.toLowerCase().includes(search)
    ));
  }

  if (filters.level !== "all") {
    nextItems = nextItems.filter((athlete) => athlete.displayLevel === filters.level);
  }

  if (filters.availability === "available") {
    nextItems = nextItems.filter((athlete) => !athlete.assignedTeamId);
  }

  if (filters.availability === "assigned") {
    nextItems = nextItems.filter((athlete) => Boolean(athlete.assignedTeamId));
  }

  return sortAthletePool(nextItems, filters);
}

export function buildPlannerStats(athletePool: ReturnType<typeof buildTeamBuilderCandidates>): PlannerStatItem[] {
  const qualifiedCount = athletePool.filter((athlete) => athlete.displayLevel !== "Unqualified").length;
  const unqualifiedCount = athletePool.filter((athlete) => athlete.displayLevel === "Unqualified").length;
  const available = athletePool.filter((athlete) => !athlete.assignedTeamId).length;
  const averageScore = athletePool.length
    ? athletePool.reduce((sum, athlete) => sum + athlete.displayScore, 0) / athletePool.length
    : 0;

  return [
    { label: "Total athletes", value: athletePool.length, note: "Saved athlete records" },
    { label: "Qualified", value: qualifiedCount, note: "Meets at least one active qualification rule" },
    { label: "Unqualified", value: unqualifiedCount, note: "Below every active qualification threshold" },
    { label: "Available", value: available, note: "Not assigned to a team" },
    { label: "Average score", value: formatPlannerScore(averageScore), note: "Main skill total only" }
  ];
}

export function readPlannerProject(scope: PlannerWorkspaceScope = "coach") {
  return readCheerPlannerStateFromStorage(buildCheerPlannerStorageKey(scope));
}

export function writePlannerProject(state: CheerPlannerState, scope: PlannerWorkspaceScope = "coach") {
  writeCheerPlannerStateToStorage(buildCheerPlannerStorageKey(scope), state);
}

function hasMigrationMarker(scope: PlannerWorkspaceScope) {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(buildCheerPlannerMigrationKey(scope)) === CHEER_PLANNER_REMOTE_MIGRATION_VERSION;
}

function markMigrationComplete(scope: PlannerWorkspaceScope) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(buildCheerPlannerMigrationKey(scope), CHEER_PLANNER_REMOTE_MIGRATION_VERSION);
}

function parseIsoTime(value: string | null | undefined) {
  const parsed = Date.parse(value ?? "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function isLocalNewer(localUpdatedAt: string | null | undefined, remoteUpdatedAt: string | null | undefined) {
  return parseIsoTime(localUpdatedAt) > parseIsoTime(remoteUpdatedAt);
}

function buildTeamMatchKey(team: Pick<PlannerTeamRecord, "name" | "teamLevel" | "teamType">) {
  return `${team.name.trim().toLowerCase()}::${team.teamLevel}::${team.teamType.trim().toLowerCase()}`;
}

export function hydratePlannerProjectScoringContext(
  project: CheerPlannerState,
  scoringContext: { scoringSystemId: string; scoringSystemVersionId: string }
) {
  return hydrateTryoutScoringContext(project, scoringContext);
}

async function fetchRemoteFoundation(scope: PlannerWorkspaceScope) {
  return fetchPlannerFoundation(scope);
}

async function syncRemotePlannerConfig(scope: PlannerWorkspaceScope, project: CheerPlannerState) {
  return savePlannerProjectConfig(scope, {
    workspaceId: project.workspaceId,
    name: project.name,
    status: project.status,
    pipelineStage: project.pipelineStage,
    template: project.template,
    qualificationRules: project.qualificationRules,
    workspaceRootId: project.workspaceRootId,
    lockVersion: project.lockVersion
  });
}

async function syncRemoteAthleteRecord(scope: PlannerWorkspaceScope, athlete: AthleteRecord) {
  return savePlannerAthlete(scope, {
    workspaceId: athlete.workspaceId,
    athleteId: isUuidString(athlete.id) ? athlete.id : null,
    workspaceRootId: athlete.workspaceRootId ?? null,
    expectedLockVersion: athlete.lockVersion ?? null,
    firstName: athlete.firstName,
    lastName: athlete.lastName,
    dateOfBirth: athlete.dateOfBirth,
    registrationNumber: athlete.registrationNumber,
    notes: athlete.notes,
    parentContacts: athlete.parentContacts
  });
}

async function syncRemoteEvaluationRecord(scope: PlannerWorkspaceScope, evaluation: PlannerTryoutEvaluation) {
  return savePlannerEvaluation(scope, evaluation);
}

async function syncRemoteSkillPlan(scope: PlannerWorkspaceScope, plan: TeamSkillPlan, remoteTeamId?: string) {
  return savePlannerSkillPlan(scope, {
    ...plan,
    teamId: remoteTeamId ?? plan.teamId
  });
}

async function syncRemoteRoster(
  scope: PlannerWorkspaceScope,
  workspaceId: string,
  team: Pick<PlannerTeamRecord, "id" | "remoteTeamId" | "memberRegistrationNumbers" | "status">,
  athleteIds: string[],
  workspaceRootId?: string | null
) {
  return savePlannerTeamAssignments(scope, {
    workspaceId,
    workspaceRootId: workspaceRootId ?? null,
    teamId: team.remoteTeamId || team.id,
    athleteIds,
    fallbackTeam: {
      memberAthleteIds: athleteIds,
      memberRegistrationNumbers: team.memberRegistrationNumbers ?? [],
      status: team.status
    }
  });
}

async function createRemoteTeamRecord(
  scope: PlannerWorkspaceScope,
  workspaceId: string,
  workspaceRootId: string | null | undefined,
  draft: TeamBuilderTeamDraftInput
): Promise<{
  teamId: string;
  team: PlannerTeamRecord | null;
  assignedCoachNames: string[];
  linkedCoachIds: string[];
  lockVersion: number | null;
  lastChangeSetId: string | null;
}> {
  const result = await savePlannerTeam(scope, {
    workspaceId,
    workspaceRootId: workspaceRootId ?? null,
    name: draft.name,
    teamLevel: draft.teamLevel,
    teamType: draft.teamType,
    teamDivision: draft.teamDivision || "Elite",
    trainingDays: draft.trainingDays || "",
    trainingHours: draft.trainingHours || "",
    linkedCoachIds: draft.linkedCoachIds ?? [],
    assignedCoachNames: draft.assignedCoachNames ?? [],
    fallbackTeam: {
      memberAthleteIds: [],
      memberRegistrationNumbers: [],
      status: "draft"
    }
  });

  return {
    teamId: result.team.id,
    team: result.team,
    assignedCoachNames: result.team.assignedCoachNames ?? [],
    linkedCoachIds: result.team.linkedCoachIds ?? [],
    lockVersion: typeof result.lockVersion === "number" ? result.lockVersion : null,
    lastChangeSetId: result.changeSetId ?? null
  };
}

async function deleteRemoteAthleteRecord(
  scope: PlannerWorkspaceScope,
  payload: {
    athleteId: string;
    workspaceRootId?: string | null;
    expectedLockVersion?: number | null;
  }
) {
  const result = await deletePlannerAthlete(scope, payload);

  return {
    lockVersion: typeof result.lockVersion === "number" ? result.lockVersion : null,
    lastChangeSetId: result.changeSetId ?? null
  };
}

async function deleteRemoteTeamRecord(
  scope: PlannerWorkspaceScope,
  payload: {
    teamId: string;
    workspaceRootId?: string | null;
    expectedLockVersion?: number | null;
  }
) {
  const result = await deletePlannerTeam(scope, payload);

  return {
    lockVersion: typeof result.lockVersion === "number" ? result.lockVersion : null,
    lastChangeSetId: result.changeSetId ?? null
  };
}

async function syncRemoteRoutinePlan(scope: PlannerWorkspaceScope, plan: TeamRoutinePlan, remoteTeamId: string) {
  return savePlannerRoutinePlan(scope, plan, remoteTeamId);
}

async function syncRemoteSeasonPlan(scope: PlannerWorkspaceScope, plan: TeamSeasonPlan, remoteTeamId?: string) {
  return savePlannerSeasonPlan(scope, {
    ...plan,
    teamId: remoteTeamId ?? plan.teamId
  });
}

async function migratePlannerStateToSupabase(
  scope: PlannerWorkspaceScope,
  localProject: CheerPlannerState,
  remoteSnapshot: PlannerRemoteFoundationSnapshot
) {
  let currentSnapshot = remoteSnapshot;
  const athleteIdMap = new Map<string, string>();
  const teamIdMap = new Map<string, string>();
  const remoteAthletesByRegistration = new Map(currentSnapshot.athletes.map((athlete) => [athlete.registrationNumber, athlete] as const));
  const remoteTeamsByLookup = new Map<string, PlannerTeamRecord>();

  currentSnapshot.teams.forEach((team) => {
    remoteTeamsByLookup.set(team.id, team);
    if (team.remoteTeamId) {
      remoteTeamsByLookup.set(team.remoteTeamId, team);
    }
    remoteTeamsByLookup.set(buildTeamMatchKey(team), team);
  });

  for (const athlete of localProject.athletes) {
    const existingAthlete = (isUuidString(athlete.id) && currentSnapshot.athletes.find((item) => item.id === athlete.id))
      || remoteAthletesByRegistration.get(athlete.registrationNumber)
      || null;

    if (existingAthlete) {
      athleteIdMap.set(athlete.id, existingAthlete.id);
      continue;
    }

    const remoteAthlete = await syncRemoteAthleteRecord(scope, athlete);
    athleteIdMap.set(athlete.id, remoteAthlete.id);
    remoteAthletesByRegistration.set(remoteAthlete.registrationNumber, remoteAthlete);
  }

  for (const team of localProject.teams) {
    const existingRemoteTeam = remoteTeamsByLookup.get(team.remoteTeamId || team.id)
      || remoteTeamsByLookup.get(buildTeamMatchKey(team))
      || null;

    if (existingRemoteTeam) {
      teamIdMap.set(team.id, existingRemoteTeam.remoteTeamId || existingRemoteTeam.id);
      continue;
    }

    const createdTeam = await createRemoteTeamRecord(
      scope,
      currentSnapshot.plannerProject.workspaceId,
      currentSnapshot.plannerProject.workspaceRootId ?? null,
      {
      name: team.name,
      teamLevel: team.teamLevel,
      teamType: team.teamType,
      teamDivision: team.teamDivision,
      trainingDays: team.trainingDays,
      trainingHours: team.trainingHours,
      assignedCoachNames: team.assignedCoachNames,
      linkedCoachIds: team.linkedCoachIds
      }
    );

    teamIdMap.set(team.id, createdTeam.teamId);
  }

  if (isLocalNewer(localProject.updatedAt, currentSnapshot.plannerProject.updatedAt)) {
    await syncRemotePlannerConfig(scope, localProject);
  }

  for (const team of localProject.teams) {
    const remoteTeamId = teamIdMap.get(team.id) || team.remoteTeamId || (isUuidString(team.id) ? team.id : null);

    if (!remoteTeamId) {
      continue;
    }

    const remoteAthleteIds = team.memberAthleteIds
      .map((athleteId) => athleteIdMap.get(athleteId) || (isUuidString(athleteId) ? athleteId : null))
      .filter((athleteId): athleteId is string => Boolean(athleteId));

    await syncRemoteRoster(
      scope,
      currentSnapshot.plannerProject.workspaceId,
      {
        id: team.id,
        remoteTeamId,
        memberRegistrationNumbers: team.memberRegistrationNumbers ?? [],
        status: team.status
      },
      remoteAthleteIds,
      currentSnapshot.plannerProject.workspaceRootId ?? null
    );
  }

  const remoteEvaluationMap = new Map(currentSnapshot.evaluations.map((evaluation) => [evaluation.id, evaluation] as const));
  for (const evaluation of localProject.evaluations) {
    const remoteAthleteId = athleteIdMap.get(evaluation.athleteId) || (isUuidString(evaluation.athleteId) ? evaluation.athleteId : null);
    if (!remoteAthleteId) {
      continue;
    }

    const nextEvaluation: PlannerTryoutEvaluation = {
      ...evaluation,
      workspaceId: currentSnapshot.plannerProject.workspaceId,
      plannerProjectId: currentSnapshot.plannerProject.id,
      athleteId: remoteAthleteId,
      athleteSnapshot: evaluation.athleteSnapshot
        ? { ...evaluation.athleteSnapshot, athleteId: remoteAthleteId }
        : null
    };

    const remoteEvaluation = remoteEvaluationMap.get(evaluation.id);
    if (!remoteEvaluation || isLocalNewer(evaluation.updatedAt, remoteEvaluation.updatedAt)) {
      await syncRemoteEvaluationRecord(scope, nextEvaluation);
    }
  }

  const remoteSkillPlanMap = new Map(currentSnapshot.skillPlans.map((plan) => [plan.teamId, plan] as const));
  for (const plan of localProject.skillPlans) {
    const remoteTeamId = teamIdMap.get(plan.teamId) || (isUuidString(plan.teamId) ? plan.teamId : null);
    if (!remoteTeamId) {
      continue;
    }

    const nextPlan: TeamSkillPlan = {
      ...plan,
      workspaceId: currentSnapshot.plannerProject.workspaceId,
      plannerProjectId: currentSnapshot.plannerProject.id,
      teamId: remoteTeamId,
      selections: plan.selections.map((selection) => ({
        ...selection,
        athleteId: selection.athleteId ? (athleteIdMap.get(selection.athleteId) || (isUuidString(selection.athleteId) ? selection.athleteId : null)) : null
      }))
    };

    const remotePlan = remoteSkillPlanMap.get(remoteTeamId);
    if (!remotePlan || isLocalNewer(plan.updatedAt, remotePlan.updatedAt)) {
      await syncRemoteSkillPlan(scope, nextPlan, remoteTeamId);
    }
  }

  const remoteRoutinePlanMap = new Map(currentSnapshot.routinePlans.map((plan) => [plan.teamId, plan] as const));
  for (const plan of localProject.routinePlans) {
    const remoteTeamId = teamIdMap.get(plan.teamId) || (isUuidString(plan.teamId) ? plan.teamId : null);
    if (!remoteTeamId) {
      continue;
    }

    const nextPlan: TeamRoutinePlan = {
      ...plan,
      workspaceId: currentSnapshot.plannerProject.workspaceId,
      plannerProjectId: currentSnapshot.plannerProject.id,
      teamId: remoteTeamId,
      items: plan.items.map((item) => ({
        ...item,
        athleteId: item.athleteId ? (athleteIdMap.get(item.athleteId) || (isUuidString(item.athleteId) ? item.athleteId : null)) : null
      })),
      document: plan.document ? {
        ...plan.document,
        placements: plan.document.placements.map((placement) => ({
          ...placement,
          athleteId: placement.athleteId ? (athleteIdMap.get(placement.athleteId) || (isUuidString(placement.athleteId) ? placement.athleteId : null)) : null
        }))
      } : null
    };

    const remotePlan = remoteRoutinePlanMap.get(remoteTeamId);
    if (!remotePlan || isLocalNewer(plan.updatedAt, remotePlan.updatedAt)) {
      await syncRemoteRoutinePlan(scope, nextPlan, remoteTeamId);
    }
  }

  const remoteSeasonPlanMap = new Map(currentSnapshot.seasonPlans.map((plan) => [plan.teamId, plan] as const));
  for (const plan of localProject.seasonPlans) {
    const remoteTeamId = teamIdMap.get(plan.teamId) || (isUuidString(plan.teamId) ? plan.teamId : null);
    if (!remoteTeamId) {
      continue;
    }

    const nextPlan: TeamSeasonPlan = {
      ...plan,
      workspaceId: currentSnapshot.plannerProject.workspaceId,
      plannerProjectId: currentSnapshot.plannerProject.id,
      teamId: remoteTeamId
    };

    const remotePlan = remoteSeasonPlanMap.get(remoteTeamId);
    if (!remotePlan || isLocalNewer(plan.updatedAt, remotePlan.updatedAt)) {
      await syncRemoteSeasonPlan(scope, nextPlan, remoteTeamId);
    }
  }

  markMigrationComplete(scope);
  return fetchRemoteFoundation(scope);
}

export function useCheerPlannerIntegration(scope: PlannerWorkspaceScope = "coach") {
  const [plannerState, setPlannerState] = useState<CheerPlannerState>(cloneCheerPlannerState(defaultCheerPlannerState));
  const [templateDraft, setTemplateDraft] = useState<PlannerTryoutTemplate>(() => cloneTemplate(defaultTryoutTemplate));
  const [activeSport, setActiveSport] = useState<PlannerSportTab>("tumbling");
  const [athleteDraft, setAthleteDraft] = useState<AthleteDraftState>(buildEmptyAthleteDraft());
  const [levelsDraft, setLevelsDraft] = useState<PlannerLevelEvaluation[]>(() => buildLevelEvaluations(defaultTryoutTemplate));
  const [openLevels, setOpenLevels] = useState<PlannerLevelKey[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [qualificationOpen, setQualificationOpen] = useState(false);
  const [filters, setFilters] = useState<AthleteFilters>({
    search: "",
    level: "all",
    availability: "all",
    sort: "score-desc"
  });
  const [createTeamOpen, setCreateTeamOpen] = useState(false);
  const [teamDraft, setTeamDraft] = useState<TeamDraftState>({
    name: "",
    teamLevel: "Beginner",
    teamType: "Youth",
    trainingSchedule: "",
    assignedCoachNames: [""]
  });
  const [teamEdit, setTeamEdit] = useState<TeamEditState>(null);
  const [skillPlannerDraft, setSkillPlannerDraft] = useState<SkillPlannerDraftState>(null);
  const [routineBuilderDraft, setRoutineBuilderDraft] = useState<RoutineBuilderDraftState>(null);
  const [seasonPlannerDraft, setSeasonPlannerDraft] = useState<SeasonPlannerDraftState>(null);
  const [qualificationRulesDraft, setQualificationRulesDraft] = useState(() => ({ ...defaultCheerPlannerState.qualificationRules }));
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [trashItems, setTrashItems] = useState<PlannerTrashItem[]>([]);
  const [trashLoading, setTrashLoading] = useState(false);
  const [savingActions, setSavingActions] = useState<Record<string, boolean>>({});
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});
  const [pendingWrites, setPendingWrites] = useState<PendingPlannerWrite[]>(() => readPendingWritesFromStorage(scope));
  const [premiumPromptOpen, setPremiumPromptOpen] = useState(false);
  const [premiumAccess, setPremiumAccess] = useState<PremiumAccessState>({
    tier: "loading",
    scope: "none",
    status: "loading",
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false
  });
  const plannerStateRef = useRef(plannerState);
  const saveStatesRef = useRef(saveStates);
  const pendingWritesRef = useRef(pendingWrites);
  const isFlushingPendingWritesRef = useRef(false);
  const { config: scoringConfig, isReady: isScoringReady } = useScoringSystems();

  useEffect(() => {
    plannerStateRef.current = plannerState;
  }, [plannerState]);

  useEffect(() => {
    saveStatesRef.current = saveStates;
  }, [saveStates]);

  useEffect(() => {
    pendingWritesRef.current = pendingWrites;
    writePendingWritesToStorage(scope, pendingWrites);
  }, [pendingWrites, scope]);

  useEffect(() => {
    if (!settingsOpen) {
      setTemplateDraft(cloneTemplate(plannerState.template));
    }
  }, [plannerState.template, settingsOpen]);

  useEffect(() => {
    if (!qualificationOpen) {
      setQualificationRulesDraft({ ...plannerState.qualificationRules });
    }
  }, [plannerState.qualificationRules, qualificationOpen]);

  useEffect(() => {
    const state = readPlannerProject(scope);
    setPendingWrites(readPendingWritesFromStorage(scope));
    setPlannerState(state);
    setTemplateDraft(cloneTemplate(state.template));
    setLevelsDraft(buildLevelEvaluations(state.template));
    let cancelled = false;

    void (async () => {
      try {
        let snapshot = await fetchRemoteFoundation(scope);

        if (!hasMigrationMarker(scope)) {
          snapshot = await migratePlannerStateToSupabase(scope, state, snapshot);
        }

        const nextState = mergeRemoteFoundationIntoProject(state, snapshot);

        if (cancelled) {
          return;
        }

        setPlannerState(nextState);
        setTemplateDraft(cloneTemplate(nextState.template));
        setLevelsDraft(buildLevelEvaluations(nextState.template));
        writePlannerProject(nextState, scope);
        setSaveState("foundation", "saved");

        try {
          const trashResult = await fetchPlannerTrash(scope, {
            workspaceRootId: snapshot.workspaceRoot.id
          });
          setTrashItems(trashResult.items);
        } catch {
          setTrashItems([]);
        }
      } catch {
        if (!cancelled) {
          setSaveMessage("Working from local session data while sync is unavailable.");
          setSaveState("foundation", "error");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [scope]);


  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch("/api/billing/status", { credentials: "include" });
        const result = await response.json().catch(() => null) as PremiumAccessState | null;

        if (!cancelled && response.ok && result) {
          setPremiumAccess(result);
        }
      } catch {
        if (!cancelled) {
          setPremiumAccess((current) => ({ ...current, tier: "free", status: "unknown" }));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const requestPremiumAccess = useCallback(() => {
    setPremiumPromptOpen(true);
    setSaveMessage(PREMIUM_REQUIRED_MESSAGE);
  }, []);

  const setSaveState = (actionKey: string, state: SaveState) => {
    setSaveStates((current) => ({
      ...current,
      [actionKey]: state
    }));
  };

  const getSaveState = (actionKey: string): SaveState => saveStates[actionKey] ?? "idle";

  const setSavingAction = (actionKey: string, isSaving: boolean) => {
    setSavingActions((current) => ({
      ...current,
      [actionKey]: isSaving
    }));
  };

  const runSavingAction = async <T>(actionKey: string, callback: () => Promise<T>) => {
    setSaveState(actionKey, "saving");
    setSavingAction(actionKey, true);

    try {
      return await callback();
    } finally {
      setSavingAction(actionKey, false);
    }
  };

  const isSavingAction = (actionKey: string) => Boolean(savingActions[actionKey]);

  const enqueuePendingWrite = useCallback((pendingWrite: PendingPlannerWrite) => {
    setPendingWrites((current) => {
      const identity = buildPendingWriteIdentity(pendingWrite.command, pendingWrite.payload);
      const nextWithoutMatch = current.filter((item) => buildPendingWriteIdentity(item.command, item.payload) !== identity);
      return [...nextWithoutMatch, pendingWrite];
    });
  }, []);

  const removePendingWrite = useCallback((writeId: string) => {
    setPendingWrites((current) => current.filter((item) => item.id !== writeId));
  }, []);

  const replacePendingWrite = useCallback((writeId: string, nextWrite: PendingPlannerWrite) => {
    setPendingWrites((current) => current.map((item) => item.id === writeId ? nextWrite : item));
  }, []);

  const queueOfflineWrite = useCallback((actionKey: string, pendingWrite: PendingPlannerWrite) => {
    enqueuePendingWrite(pendingWrite);
    setSaveState(actionKey, "offline_pending");
    setSaveMessage("You are offline. We will retry when connection returns.");
  }, [enqueuePendingWrite]);

  function commitRemoteProject(remoteProject: PlannerProjectSyncState) {
    patchPlannerState((current) => ({
      ...current,
      name: remoteProject.name,
      status: remoteProject.status,
      pipelineStage: remoteProject.pipelineStage,
      template: remoteProject.template,
      qualificationRules: remoteProject.qualificationRules
    }), remoteProject, remoteProject.updatedAt);
  }

  const refreshRemoteFoundation = useCallback(async () => {
    const snapshot = await fetchRemoteFoundation(scope);
    const nextState = applyProjectSyncMetadata(
      mergeRemoteFoundationIntoProject(plannerStateRef.current, snapshot),
      snapshot.plannerProject,
      snapshot.plannerProject.updatedAt
    );

    plannerStateRef.current = nextState;
    setPlannerState(nextState);
    writePlannerProject(nextState, scope);
    setSaveState("foundation", "saved");

    return snapshot;
  }, [scope]);

  const loadTrash = useCallback(async (
    options?: {
      entityType?: "athlete" | "team" | null;
      search?: string | null;
    }
  ) => {
    setTrashLoading(true);

    try {
      const result = await fetchPlannerTrash(scope, {
        workspaceRootId: plannerStateRef.current.workspaceRootId ?? null,
        entityType: options?.entityType ?? null,
        search: options?.search ?? null,
        limit: 200
      });
      setTrashItems(result.items);
      return result.items;
    } finally {
      setTrashLoading(false);
    }
  }, [scope]);

  const canUsePremiumAction = () => {
    if (premiumAccess.tier === "free") {
      requestPremiumAccess();
      return false;
    }

    return true;
  };

  const handlePremiumWriteError = useCallback((error: unknown, fallback: string) => {
    if (isPremiumRequiredError(error)) {
      requestPremiumAccess();
      return;
    }

    if (error instanceof PlannerApiError && error.code === "PLANNER_CONFLICT") {
      void refreshRemoteFoundation().catch(() => undefined);
    }

    setSaveMessage(error instanceof Error ? error.message : fallback);
  }, [requestPremiumAccess, refreshRemoteFoundation]);

  const handleWriteFailure = useCallback((
    actionKey: string,
    error: unknown,
    fallback: string,
    pendingWrite?: PendingPlannerWrite | null
  ) => {
    if (isPlannerOfflineError(error) && pendingWrite) {
      queueOfflineWrite(actionKey, pendingWrite);
      return;
    }

    setSaveState(actionKey, "error");
    handlePremiumWriteError(error, fallback);
  }, [handlePremiumWriteError, queueOfflineWrite]);

  const replayPendingWrite = useCallback(async (pendingWrite: PendingPlannerWrite) => {
    switch (pendingWrite.command) {
      case "project-save": {
        const payload = pendingWrite.payload as PendingProjectSavePayload;
        await savePlannerProjectConfig(scope, {
          ...payload,
          workspaceRootId: payload.workspaceRootId ?? undefined,
          lockVersion: payload.lockVersion ?? undefined
        });
        return;
      }
      case "athlete-save":
        await savePlannerAthlete(scope, pendingWrite.payload as PendingAthleteSavePayload);
        return;
      case "evaluation-save": {
        const payload = pendingWrite.payload as PendingEvaluationSavePayload;
        const remoteAthlete = await savePlannerAthlete(scope, payload.athlete);
        await savePlannerEvaluation(scope, {
          ...payload.evaluation,
          athleteId: remoteAthlete.id,
          athleteSnapshot: payload.evaluation.athleteSnapshot
            ? {
                ...payload.evaluation.athleteSnapshot,
                athleteId: remoteAthlete.id,
                registrationNumber: remoteAthlete.registrationNumber,
                firstName: remoteAthlete.firstName,
                lastName: remoteAthlete.lastName,
                dateOfBirth: remoteAthlete.dateOfBirth,
                notes: remoteAthlete.notes,
                athleteNotes: remoteAthlete.notes,
                parentContacts: remoteAthlete.parentContacts
              }
            : payload.evaluation.athleteSnapshot
        });
        return;
      }
      case "team-save":
        await savePlannerTeam(scope, pendingWrite.payload as PendingTeamSavePayload);
        return;
      case "team-assignments-set": {
        const payload = pendingWrite.payload as PendingTeamAssignmentsPayload;
        await savePlannerTeamAssignments(scope, {
          ...payload,
          workspaceId: payload.workspaceId || plannerStateRef.current.workspaceId
        });
        return;
      }
      case "skill-plan-save":
        await savePlannerSkillPlan(scope, pendingWrite.payload as TeamSkillPlan);
        return;
      case "routine-plan-save": {
        const plan = pendingWrite.payload as TeamRoutinePlan;
        await savePlannerRoutinePlan(scope, plan, plan.teamId);
        return;
      }
      case "season-plan-save":
        await savePlannerSeasonPlan(scope, pendingWrite.payload as TeamSeasonPlan);
        return;
      default:
        return;
    }
  }, [scope]);

  const flushPendingWrites = useCallback(async () => {
    if (isFlushingPendingWritesRef.current || !pendingWritesRef.current.length) {
      return;
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return;
    }

    isFlushingPendingWritesRef.current = true;
    let didReplay = false;

    try {
      for (const pendingWrite of [...pendingWritesRef.current]) {
        try {
          await replayPendingWrite(pendingWrite);
          removePendingWrite(pendingWrite.id);
          didReplay = true;
        } catch (error) {
          if (isPlannerOfflineError(error)) {
            replacePendingWrite(pendingWrite.id, {
              ...pendingWrite,
              retryCount: pendingWrite.retryCount + 1
            });
            break;
          }

          removePendingWrite(pendingWrite.id);
          setSaveState(pendingWrite.command, "error");
          setSaveStates((current) => Object.fromEntries(
            Object.entries(current).map(([key, value]) => [key, value === "offline_pending" ? "error" : value])
          ));
          handlePremiumWriteError(error, "Unable to replay a pending planner change.");
        }
      }

      if (didReplay) {
        await refreshRemoteFoundation();
        setSaveStates((current) => Object.fromEntries(
          Object.entries(current).map(([key, value]) => [key, value === "offline_pending" ? "saved" : value])
        ));
        setSaveMessage("Pending planner changes synced.");
      }
    } finally {
      isFlushingPendingWritesRef.current = false;
    }
  }, [handlePremiumWriteError, refreshRemoteFoundation, removePendingWrite, replacePendingWrite, replayPendingWrite]);

  useEffect(() => {
    if (!saveMessage) {
      return;
    }

    const timeout = window.setTimeout(() => setSaveMessage(null), 2600);
    return () => window.clearTimeout(timeout);
  }, [saveMessage]);

  useEffect(() => {
    void flushPendingWrites();

    const handleOnline = () => {
      void flushPendingWrites();
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [flushPendingWrites]);

  const syncStatusLabel = useMemo(() => {
    if (Object.values(savingActions).some(Boolean)) {
      return "Saving...";
    }

    if (pendingWrites.length || Object.values(saveStates).includes("offline_pending")) {
      return "Offline sync pending";
    }

    if (Object.values(saveStates).includes("error")) {
      return "Sync issue";
    }

    return null;
  }, [pendingWrites.length, saveStates, savingActions]);

  const activeScoringSystem = useMemo(
    () => getSystemById(scoringConfig, scoringConfig.activeSystemId),
    [scoringConfig]
  );
  const activeScoringVersion = useMemo(
    () => getVersionById(activeScoringSystem, activeScoringSystem.activeVersionId),
    [activeScoringSystem]
  );

  useEffect(() => {
    if (!isScoringReady) {
      return;
    }

    setPlannerState((current) => {
      const next = hydratePlannerProjectScoringContext(current, {
        scoringSystemId: activeScoringSystem.id,
        scoringSystemVersionId: activeScoringVersion.id
      });

      if (next === current) {
        return current;
      }

      writePlannerProject(next, scope);
      return next;
    });
  }, [activeScoringSystem.id, activeScoringVersion.id, isScoringReady, scope]);

  const summary = useMemo(
    () => buildTryoutEvaluationSummary(plannerState.template, levelsDraft, levelLabels),
    [plannerState.template, levelsDraft]
  );
  const athletePool = useMemo(() => buildTeamBuilderCandidates(plannerState, LEVEL_LABELS), [plannerState]);
  const filteredAthletePool = useMemo(() => buildFilteredAthletePool(athletePool, filters), [athletePool, filters]);
  const sortedEvaluations = useMemo(
    () => [...plannerState.evaluations].sort((left, right) => new Date(getTryoutEvaluationDate(right)).getTime() - new Date(getTryoutEvaluationDate(left)).getTime()),
    [plannerState.evaluations]
  );
  const recentEvaluations = useMemo(() => sortedEvaluations.slice(0, 8), [sortedEvaluations]);
  const stats = useMemo(() => buildPlannerStats(athletePool), [athletePool]);
  const skillPlannerTeams = useMemo(() => buildSkillPlannerTeamInputs(plannerState, LEVEL_LABELS), [plannerState]);
  const routineBuilderTeams = useMemo(() => buildRoutineBuilderTeamInputs(plannerState), [plannerState]);
  const seasonPlannerTeams = useMemo(
    () => buildSeasonPlannerTeamInputs(plannerState).map((team) => ({
      ...team,
      availableCheckpoints: buildSeasonPlannerAvailableCheckpoints(team)
    })),
    [plannerState]
  );
  const myTeamsSummaries = useMemo(() => buildMyTeamsTeamSummaries(plannerState), [plannerState]);
  const skillPlannerEditingTeam = useMemo(
    () => skillPlannerDraft ? skillPlannerTeams.find((team) => team.teamId === skillPlannerDraft.teamId) ?? null : null,
    [skillPlannerDraft, skillPlannerTeams]
  );
  const routineBuilderEditingTeam = useMemo(
    () => routineBuilderDraft ? routineBuilderTeams.find((team) => team.teamId === routineBuilderDraft.teamId) ?? null : null,
    [routineBuilderDraft, routineBuilderTeams]
  );
  const seasonPlannerEditingTeam = useMemo(
    () => seasonPlannerDraft ? seasonPlannerTeams.find((team) => team.teamId === seasonPlannerDraft.teamId) ?? null : null,
    [seasonPlannerDraft, seasonPlannerTeams]
  );
  const athleteMapById = useMemo(
    () => new Map(athletePool.map((athlete) => [athlete.id, athlete] as const)),
    [athletePool]
  );
  const teamMap = useMemo(
    () => new Map(plannerState.teams.map((team) => [team.id, team] as const)),
    [plannerState.teams]
  );
  const teamsWithMembers = useMemo(
    () => buildTeamBuilderTeamsWithMembers(plannerState, athletePool),
    [athletePool, plannerState]
  );
  const teamWithMembersMap = useMemo(
    () => new Map(teamsWithMembers.map((team) => [team.id, team] as const)),
    [teamsWithMembers]
  );

  function patchPlannerState(
    updater: (current: CheerPlannerState) => CheerPlannerState,
    syncSource?: PlannerSyncSource | null,
    updatedAtFallback?: string
  ) {
    const nextState = applyProjectSyncMetadata(updater(plannerStateRef.current), syncSource, updatedAtFallback);

    plannerStateRef.current = nextState;
    setPlannerState(nextState);
    writePlannerProject(nextState, scope);
    return nextState;
  }

  function persistState(updater: (current: CheerPlannerState) => CheerPlannerState) {
    return patchPlannerState((current) => ({
      ...updater(current),
      updatedAt: new Date().toISOString()
    }));
  }

  function buildProjectConfigSnapshot(updater: (current: CheerPlannerState) => CheerPlannerState) {
    const updatedAt = new Date().toISOString();
    return {
      ...updater(plannerStateRef.current),
      updatedAt
    };
  }

  const updateAthleteDraft = (field: keyof AthleteDraftState, value: string) => {
    setAthleteDraft((current) => ({ ...current, [field]: value }));
  };

  const updateParentContact = (contactId: string, field: keyof Omit<AthleteParentContact, "id">, value: string) => {
    setAthleteDraft((current) => ({
      ...current,
      parentContacts: current.parentContacts.map((contact) => (
        contact.id === contactId ? { ...contact, [field]: value } : contact
      ))
    }));
  };

  const addParentContact = () => {
    setAthleteDraft((current) => ({
      ...current,
      parentContacts: [...current.parentContacts, buildEmptyParentContact(current.parentContacts.length)]
    }));
  };

  const removeParentContact = (contactId: string) => {
    setAthleteDraft((current) => {
      const remainingContacts = current.parentContacts.filter((contact) => contact.id !== contactId);
      return {
        ...current,
        parentContacts: remainingContacts.length ? remainingContacts : [buildEmptyParentContact()]
      };
    });
  };

  const startNewAthlete = () => {
    setAthleteDraft(buildEmptyAthleteDraft());
    setLevelsDraft(buildLevelEvaluations(plannerState.template));
    setOpenLevels([]);
    setSaveMessage("Ready for a new athlete.");
  };

  const resetAthleteDraft = () => {
    setAthleteDraft(buildEmptyAthleteDraft());
    setLevelsDraft(buildLevelEvaluations(plannerState.template));
    setOpenLevels([]);
  };

  const loadRegisteredAthlete = (athleteId: string) => {
    const athlete = plannerState.athletes.find((item) => item.id === athleteId) ?? null;

    if (!athlete) {
      setSaveMessage("Selected athlete could not be loaded.");
      return;
    }

    setActiveSport("tumbling");
    setAthleteDraft({
      athleteId: athlete.id,
      workspaceRootId: athlete.workspaceRootId,
      lockVersion: athlete.lockVersion,
      registrationNumber: athlete.registrationNumber,
      firstName: athlete.firstName,
      lastName: athlete.lastName,
      dateOfBirth: athlete.dateOfBirth,
      notes: athlete.notes,
      parentContacts: athlete.parentContacts.length ? athlete.parentContacts.map((contact) => ({ ...contact })) : [buildEmptyParentContact()]
    });
    setLevelsDraft(buildLevelEvaluations(plannerState.template));
    setOpenLevels([]);
    setSaveMessage(`Loaded ${athlete.name}.`);
  };

  const updateTemplateOption = (index: number, field: "label" | "value", value: string) => {
    setTemplateDraft((current) => ({
      ...current,
      options: current.options.map((option, optionIndex) => {
            if (optionIndex !== index) {
              return option;
            }

            return {
              ...option,
              [field]: field === "value" ? Number(value) || 0 : value
            };
          })
    }));
  };

  const updateSkillCount = (levelKey: PlannerLevelKey, value: string) => {
    const nextCount = Math.max(1, Math.min(20, Number(value) || 1));
    setTemplateDraft((current) => ({
      ...current,
      defaultSkillCounts: {
        ...current.defaultSkillCounts,
        [levelKey]: nextCount
      }
    }));
  };

  const removeTemplateOption = (optionId: string) => {
    setTemplateDraft((current) => ({
      ...current,
      options: current.options.filter((option) => option.id !== optionId)
    }));
  };

  const addTemplateOption = () => {
    setTemplateDraft((current) => ({
      ...current,
      options: [...current.options, buildTemplateOption()]
    }));
  };

  const updateTemplateSkill = (levelKey: PlannerLevelKey, skillId: string, value: string) => {
    setTemplateDraft((current) => {
      const nextSkillLibrary = {
        ...current.skillLibrary,
        [levelKey]: (current.skillLibrary[levelKey] ?? []).map((skill) => (
          skill.id === skillId ? { ...skill, name: value } : skill
        ))
      };

      return {
        ...current,
        skillLibrary: nextSkillLibrary,
        defaultSkillCounts: clampTemplateSkillCounts(nextSkillLibrary)
      };
    });
  };

  const moveTemplateSkill = (levelKey: PlannerLevelKey, skillId: string, nextLevelKey: PlannerLevelKey) => {
    if (levelKey === nextLevelKey) {
      return;
    }

    setTemplateDraft((current) => {
      const currentSkill = (current.skillLibrary[levelKey] ?? []).find((skill) => skill.id === skillId);

      if (!currentSkill) {
        return current;
      }

      const nextSkillLibrary = {
        ...current.skillLibrary,
        [levelKey]: (current.skillLibrary[levelKey] ?? []).filter((skill) => skill.id !== skillId),
        [nextLevelKey]: [...(current.skillLibrary[nextLevelKey] ?? []), currentSkill]
      };

      return {
        ...current,
        skillLibrary: nextSkillLibrary,
        defaultSkillCounts: clampTemplateSkillCounts(nextSkillLibrary)
      };
    });
  };

  const addTemplateSkill = (levelKey: PlannerLevelKey) => {
    setTemplateDraft((current) => {
      const nextSkillLibrary = {
        ...current.skillLibrary,
        [levelKey]: [...(current.skillLibrary[levelKey] ?? []), buildTemplateSkill("")]
      };

      return {
        ...current,
        skillLibrary: nextSkillLibrary,
        defaultSkillCounts: clampTemplateSkillCounts(nextSkillLibrary)
      };
    });
  };

  const removeTemplateSkill = (levelKey: PlannerLevelKey, skillId: string) => {
    setTemplateDraft((current) => {
      const nextSkillLibrary = {
        ...current.skillLibrary,
        [levelKey]: (current.skillLibrary[levelKey] ?? []).filter((skill) => skill.id !== skillId)
      };

      return {
        ...current,
        skillLibrary: nextSkillLibrary,
        defaultSkillCounts: clampTemplateSkillCounts(nextSkillLibrary)
      };
    });
  };

  const cancelTemplateChanges = () => {
    setTemplateDraft(cloneTemplate(plannerStateRef.current.template));
    setSettingsOpen(false);
    setSaveMessage("Template changes discarded.");
  };

  const saveTemplate = async () => {
    if (!canUsePremiumAction()) {
      return;
    }

    await runSavingAction("template", async () => {
      const nextTemplate = cloneTemplate({
        ...templateDraft,
        updatedAt: new Date().toISOString()
      });
      const nextState = buildProjectConfigSnapshot((current) => ({
        ...current,
        template: nextTemplate
      }));

      try {
        const remoteProject = await syncRemotePlannerConfig(scope, nextState);
        commitRemoteProject(remoteProject);
        setTemplateDraft(cloneTemplate(remoteProject.template));
        setLevelsDraft(buildLevelEvaluations(remoteProject.template));
        setOpenLevels([]);
        setSaveState("template", "saved");
        setSaveMessage("Template saved.");
      } catch (error) {
        handleWriteFailure(
          "template",
          error,
          "Unable to save the template to Supabase.",
          buildPendingWrite(scope, "project-save", nextState.workspaceRootId ?? null, {
            workspaceId: nextState.workspaceId,
            workspaceRootId: nextState.workspaceRootId ?? null,
            lockVersion: nextState.lockVersion ?? null,
            name: nextState.name,
            status: nextState.status,
            pipelineStage: nextState.pipelineStage,
            template: nextState.template,
            qualificationRules: nextState.qualificationRules
          })
        );
      }
    });
  };

  const resetTemplate = () => {
    const nextTemplate = cloneTemplate(cloneCheerPlannerState(defaultCheerPlannerState).template);
    setTemplateDraft(nextTemplate);
    setSaveMessage("Template draft reset. Save Template to apply it.");
  };

  const toggleLevel = (levelKey: PlannerLevelKey) => {
    setOpenLevels((current) => (
      current.includes(levelKey) ? current.filter((item) => item !== levelKey) : [...current, levelKey]
    ));
  };

  const updateSkillName = (levelKey: PlannerLevelKey, skillId: string, value: string) => {
    setLevelsDraft((current) => current.map((level) => (
      level.levelKey === levelKey
        ? {
            ...level,
            skills: level.skills.map((skill) => skill.id === skillId ? { ...skill, name: value } : skill)
          }
        : level
    )));
  };

  const updateSkillOption = (levelKey: PlannerLevelKey, skillId: string, optionId: string) => {
    setLevelsDraft((current) => current.map((level) => (
      level.levelKey === levelKey
        ? {
            ...level,
            skills: level.skills.map((skill) => skill.id === skillId ? { ...skill, optionId } : skill)
          }
        : level
    )));
  };

  const removeSkill = (levelKey: PlannerLevelKey, skillId: string) => {
    setLevelsDraft((current) => current.map((level) => (
      level.levelKey === levelKey
        ? {
            ...level,
            skills: level.skills.filter((skill) => skill.id !== skillId)
          }
        : level
    )));
  };

  const addExtraSkill = (levelKey: PlannerLevelKey) => {
    setLevelsDraft((current) => current.map((level) => (
      level.levelKey === levelKey
        ? {
            ...level,
            skills: [...level.skills, buildTryoutSkillRow("", true)]
          }
        : level
    )));
  };

  const saveAthleteProfile = async () => {
    if (!canUsePremiumAction()) {
      return;
    }

    const trimmedName = buildAthleteName(athleteDraft.firstName, athleteDraft.lastName);

    if (!trimmedName) {
      setSaveMessage("Add first and last name before saving.");
      return false;
    }

    const athletePayload: PendingAthleteSavePayload = {
      workspaceId: plannerState.workspaceId,
      athleteId: athleteDraft.athleteId,
      workspaceRootId: athleteDraft.workspaceRootId ?? plannerState.workspaceRootId ?? null,
      expectedLockVersion: athleteDraft.lockVersion ?? null,
      firstName: athleteDraft.firstName.trim(),
      lastName: athleteDraft.lastName.trim(),
      dateOfBirth: athleteDraft.dateOfBirth,
      registrationNumber: athleteDraft.registrationNumber,
      notes: athleteDraft.notes.trim(),
      parentContacts: athleteDraft.parentContacts
    };

    return runSavingAction("athlete-profile", async () => {
      try {
        const remoteAthlete = await savePlannerAthlete(scope, athletePayload);
        patchPlannerState((current) => ({
          ...current,
          athletes: upsertAthleteRecord(current.athletes, remoteAthlete)
        }), remoteAthlete, remoteAthlete.updatedAt);
        setAthleteDraft((current) => ({
          ...current,
          athleteId: remoteAthlete.id,
          workspaceRootId: remoteAthlete.workspaceRootId,
          lockVersion: remoteAthlete.lockVersion,
          registrationNumber: remoteAthlete.registrationNumber
        }));

        setSaveState("athlete-profile", "saved");
        setSaveMessage(`Saved athlete ${remoteAthlete.name}. Registration ${remoteAthlete.registrationNumber}.`);
        return true;
      } catch (error) {
        handleWriteFailure(
          "athlete-profile",
          error,
          "Unable to save athlete to Supabase.",
          buildPendingWrite(
            scope,
            "athlete-save",
            athletePayload.workspaceRootId ?? null,
            athletePayload
          )
        );
        return false;
      }
    });
  };

  const saveEvaluation = async () => {
    if (!canUsePremiumAction()) {
      return;
    }

    if (activeSport !== "tumbling") {
      setSaveMessage("Tumbling is the only active tryout track right now.");
      return;
    }

    const trimmedName = buildAthleteName(athleteDraft.firstName, athleteDraft.lastName);

    if (!trimmedName) {
      setSaveMessage("Add first and last name before saving.");
      return;
    }

    await runSavingAction("evaluation", async () => {
      const occurredAt = new Date().toISOString();
      const athletePayload: PendingAthleteSavePayload = {
        workspaceId: plannerState.workspaceId,
        athleteId: athleteDraft.athleteId,
        workspaceRootId: athleteDraft.workspaceRootId ?? plannerState.workspaceRootId ?? null,
        expectedLockVersion: athleteDraft.lockVersion ?? null,
        firstName: athleteDraft.firstName.trim(),
        lastName: athleteDraft.lastName.trim(),
        dateOfBirth: athleteDraft.dateOfBirth,
        registrationNumber: athleteDraft.registrationNumber,
        notes: athleteDraft.notes.trim(),
        parentContacts: athleteDraft.parentContacts
      };

      try {
        const remoteAthlete = await savePlannerAthlete(scope, athletePayload);
        const nextEvaluation = buildTryoutEvaluationRecord({
          project: plannerState,
          athlete: remoteAthlete,
          sport: "tumbling",
          levels: levelsDraft,
          resultSummary: summary,
          scoringContext: {
            scoringSystemId: activeScoringSystem.id,
            scoringSystemVersionId: activeScoringVersion.id,
            createdById: null
          },
          occurredAt
        });

        const remoteEvaluation = await syncRemoteEvaluationRecord(scope, nextEvaluation);
        patchPlannerState((current) => ({
          ...current,
          athletes: upsertAthleteRecord(current.athletes, remoteAthlete),
          evaluations: upsertRecordById(current.evaluations, remoteEvaluation)
        }), remoteEvaluation, remoteEvaluation.updatedAt);
        setAthleteDraft((current) => ({
          ...current,
          athleteId: remoteAthlete.id,
          workspaceRootId: remoteAthlete.workspaceRootId,
          lockVersion: remoteAthlete.lockVersion,
          registrationNumber: remoteAthlete.registrationNumber
        }));
        setSaveState("evaluation", "saved");
        setSaveMessage(`Saved evaluation for ${remoteAthlete.name}. Registration ${remoteAthlete.registrationNumber}.`);
      } catch (error) {
        const offlineEvaluation = buildTryoutEvaluationRecord({
          project: plannerState,
          athlete: {
            id: athleteDraft.athleteId ?? `offline-athlete-${athleteDraft.registrationNumber || Date.now()}`,
            workspaceId: plannerState.workspaceId,
            workspaceRootId: athleteDraft.workspaceRootId ?? plannerState.workspaceRootId ?? undefined,
            firstName: athletePayload.firstName,
            lastName: athletePayload.lastName,
            name: trimmedName,
            registrationNumber: athletePayload.registrationNumber,
            dateOfBirth: athletePayload.dateOfBirth,
            notes: athletePayload.notes,
            parentContacts: athletePayload.parentContacts,
            status: "active",
            createdAt: occurredAt,
            updatedAt: occurredAt,
            lockVersion: athletePayload.expectedLockVersion ?? 0,
            lastChangeSetId: null,
            archivedAt: null,
            deletedAt: null,
            restoredFromVersionId: null
          },
          sport: "tumbling",
          levels: levelsDraft,
          resultSummary: summary,
          scoringContext: {
            scoringSystemId: activeScoringSystem.id,
            scoringSystemVersionId: activeScoringVersion.id,
            createdById: null
          },
          occurredAt
        });

        handleWriteFailure(
          "evaluation",
          error,
          "Unable to save the evaluation to Supabase.",
          buildPendingWrite(scope, "evaluation-save", athletePayload.workspaceRootId ?? null, {
            athlete: athletePayload,
            evaluation: offlineEvaluation,
            athleteId: athletePayload.athleteId ?? null,
            registrationNumber: athletePayload.registrationNumber,
            evaluationId: offlineEvaluation.id
          })
        );
      }
    });
  };

  const loadEvaluation = (evaluation: PlannerTryoutEvaluation, options?: { expandLevels?: boolean }) => {
    const athlete = plannerState.athletes.find((item) => item.id === evaluation.athleteId) ?? null;
    setActiveSport("tumbling");
    setAthleteDraft({
      athleteId: evaluation.athleteId,
      workspaceRootId: athlete?.workspaceRootId,
      lockVersion: athlete?.lockVersion,
      registrationNumber: evaluation.athleteSnapshot?.registrationNumber ?? "",
      firstName: evaluation.athleteSnapshot?.firstName ?? "",
      lastName: evaluation.athleteSnapshot?.lastName ?? "",
      dateOfBirth: evaluation.athleteSnapshot?.dateOfBirth ?? "",
      notes: evaluation.athleteSnapshot?.notes ?? evaluation.athleteSnapshot?.athleteNotes ?? "",
      parentContacts: evaluation.athleteSnapshot?.parentContacts?.length
        ? evaluation.athleteSnapshot.parentContacts.map((contact) => ({ ...contact }))
        : [buildEmptyParentContact()]
    });
    setLevelsDraft(evaluation.rawData.levels.map((level) => ({
      ...level,
      skills: level.skills.map((skill) => ({ ...skill }))
    })));
    setOpenLevels(options?.expandLevels === false ? [] : evaluation.rawData.levels.map((level) => level.levelKey));
    setSaveMessage(`Loaded ${getRecentAthleteLabel(evaluation)}.`);
  };

  const updateQualificationRule = (levelLabel: PlannerLevelLabel, value: string) => {
    const nextValue = Math.max(0, Math.min(6, Number(value) || 0));
    setQualificationRulesDraft((current) => ({
      ...current,
      [levelLabel]: nextValue
    }));
  };

  const cancelQualificationRules = () => {
    setQualificationRulesDraft({ ...plannerStateRef.current.qualificationRules });
    setQualificationOpen(false);
    setSaveMessage("Qualification changes discarded.");
  };

  const saveQualificationRules = async () => {
    if (!canUsePremiumAction()) {
      return;
    }

    await runSavingAction("qualification-rules", async () => {
      const nextState = buildProjectConfigSnapshot((current) => ({
        ...current,
        qualificationRules: { ...qualificationRulesDraft }
      }));

      try {
        const remoteProject = await syncRemotePlannerConfig(scope, nextState);
        commitRemoteProject(remoteProject);
        setQualificationRulesDraft({ ...remoteProject.qualificationRules });
        setQualificationOpen(false);
        setSaveState("qualification-rules", "saved");
        setSaveMessage("Qualification rules saved.");
      } catch (error) {
        handleWriteFailure(
          "qualification-rules",
          error,
          "Unable to save qualification rules to Supabase.",
          buildPendingWrite(scope, "project-save", nextState.workspaceRootId ?? null, {
            workspaceId: nextState.workspaceId,
            workspaceRootId: nextState.workspaceRootId ?? null,
            lockVersion: nextState.lockVersion ?? null,
            name: nextState.name,
            status: nextState.status,
            pipelineStage: nextState.pipelineStage,
            template: nextState.template,
            qualificationRules: nextState.qualificationRules
          })
        );
      }
    });
  };

  const setPipelineStage = async (pipelineStage: CheerPlannerState["pipelineStage"]) => {
    if (plannerState.pipelineStage === pipelineStage) {
      return;
    }

    const nextState = buildProjectConfigSnapshot((current) => ({
      ...current,
      pipelineStage
    }));

    try {
      const remoteProject = await syncRemotePlannerConfig(scope, nextState);
      commitRemoteProject(remoteProject);
      setSaveState("pipeline-stage", "saved");
    } catch (error) {
      handleWriteFailure(
        "pipeline-stage",
        error,
        "Unable to sync the planner stage to Supabase.",
        buildPendingWrite(scope, "project-save", nextState.workspaceRootId ?? null, {
          workspaceId: nextState.workspaceId,
          workspaceRootId: nextState.workspaceRootId ?? null,
          lockVersion: nextState.lockVersion ?? null,
          name: nextState.name,
          status: nextState.status,
          pipelineStage: nextState.pipelineStage,
          template: nextState.template,
          qualificationRules: nextState.qualificationRules
        })
      );
    }
  };

  const createTeam = async () => {
    if (!canUsePremiumAction()) {
      return;
    }

    const normalizedTeamType = teamDraft.teamType.trim();

    if (!["Tiny", "Mini", "Youth", "Junior", "Senior", "Open"].includes(normalizedTeamType)) {
      setSaveMessage("Team Builder creates Supabase teams with a valid age category: Tiny, Mini, Youth, Junior, Senior, or Open.");
      return;
    }

    await runSavingAction("create-team", async () => {
      const teamPayload: PendingTeamSavePayload = {
        workspaceId: plannerState.workspaceId,
        workspaceRootId: plannerState.workspaceRootId ?? null,
        name: teamDraft.name,
        teamLevel: teamDraft.teamLevel,
        teamType: normalizedTeamType,
        teamDivision: "Elite",
        trainingDays: "",
        trainingHours: "",
        linkedCoachIds: [],
        assignedCoachNames: [],
        fallbackTeam: {
          memberAthleteIds: [],
          memberRegistrationNumbers: [],
          status: "draft"
        }
      };

      try {
        const result = await createRemoteTeamRecord(
          scope,
          plannerState.workspaceId,
          plannerState.workspaceRootId ?? null,
          {
            name: teamDraft.name,
            teamLevel: teamDraft.teamLevel,
            teamType: normalizedTeamType,
            teamDivision: "Elite",
            assignedCoachNames: [],
            linkedCoachIds: []
          }
        );
        const now = new Date().toISOString();
        const nextTeam = result.team ?? createPlannerTeamRecord(plannerState, {
          name: teamDraft.name,
          teamLevel: teamDraft.teamLevel,
          teamType: normalizedTeamType,
          teamDivision: "Elite",
          assignedCoachNames: result.assignedCoachNames,
          linkedCoachIds: result.linkedCoachIds,
          remoteTeamId: result.teamId
        }, now);

        patchPlannerState((current) => ({
          ...current,
          teams: upsertRecordById(current.teams, nextTeam)
        }), {
          workspaceRootId: nextTeam.workspaceRootId ?? plannerState.workspaceRootId,
          lockVersion: result.lockVersion ?? nextTeam.lockVersion,
          lastChangeSetId: result.lastChangeSetId ?? nextTeam.lastChangeSetId ?? null,
          updatedAt: nextTeam.updatedAt
        }, nextTeam.updatedAt);
        setCreateTeamOpen(false);
        setTeamDraft({ name: "", teamLevel: "Beginner", teamType: "Youth", trainingSchedule: "", assignedCoachNames: [""] });
        setSaveState("create-team", "saved");
        setSaveMessage(`Created ${nextTeam.name}.`);
      } catch (error) {
        handleWriteFailure(
          "create-team",
          error,
          "Unable to create the team in Supabase.",
          buildPendingWrite(scope, "team-save", teamPayload.workspaceRootId ?? null, teamPayload)
        );
      }
    });
  };

  const startNewMyTeamsTeamDraft = () => {
    setTeamDraft({ name: "", teamLevel: "Beginner", teamType: "Youth", trainingSchedule: "", assignedCoachNames: [""] });
  };

  const updateAssignedCoachName = (index: number, value: string) => {
    setTeamDraft((current) => ({
      ...current,
      assignedCoachNames: current.assignedCoachNames.map((name, currentIndex) => currentIndex === index ? value : name)
    }));
  };

  const addAssignedCoachName = () => {
    setTeamDraft((current) => ({
      ...current,
      assignedCoachNames: [...current.assignedCoachNames, ""]
    }));
  };

  const removeAssignedCoachName = (index: number) => {
    setTeamDraft((current) => {
      const nextCoachNames = current.assignedCoachNames.filter((_, currentIndex) => currentIndex !== index);
      return {
        ...current,
        assignedCoachNames: nextCoachNames.length ? nextCoachNames : [""]
      };
    });
  };

  const saveMyTeamsTeamProfile = (draft: TeamBuilderTeamDraftInput) => {
    const occurredAt = new Date().toISOString();
    const nextTeam = createPlannerTeamRecord(plannerState, draft, occurredAt);

    persistState((current) => ({
      ...current,
      teams: upsertRecordById(current.teams, nextTeam)
    }));
    setSaveMessage(`Created ${nextTeam.name}.`);
    return nextTeam.id;
  };

  const updateMyTeamsTeamProfile = (teamId: string, draft: TeamBuilderTeamDraftInput) => {
    persistState((current) => updateMyTeamsTeamProfileState(current, {
      teamId,
      ...draft
    }, new Date().toISOString()));
    setSaveMessage(`Updated ${draft.name.trim() || "team"}.`);
  };

  const assignToTeam = async (athleteId: string, teamId: string) => {
    if (!canUsePremiumAction()) {
      return;
    }

    const athlete = athleteMapById.get(athleteId);
    const team = teamMap.get(teamId);

    if (!athlete || !team) {
      setSaveMessage("Athlete or team record was not found.");
      return;
    }

    if (!canAssignQualifiedLevelToTeam(athlete.displayLevel, team.teamLevel)) {
      setSaveMessage(
        `${athlete.name} is qualified for ${athlete.displayLevel}, which does not meet ${team.name} (${team.teamLevel}).`
      );
      return;
    }

    try {
      const remoteAthlete = await syncRemoteAthleteRecord(scope, athlete);
      const occurredAt = new Date().toISOString();
      const nextAthleteIds = Array.from(new Set([...(team.memberAthleteIds ?? []), remoteAthlete.id]));
      const rosterSync = await syncRemoteRoster(
        scope,
        plannerState.workspaceId,
        team,
        nextAthleteIds,
        plannerState.workspaceRootId ?? null
      );
      patchPlannerState((current) => assignAthleteToPlannerTeam({
        ...current,
        athletes: upsertAthleteRecord(current.athletes, remoteAthlete)
      }, remoteAthlete, team.id, occurredAt), {
        workspaceRootId: remoteAthlete.workspaceRootId,
        lockVersion: rosterSync.team.lockVersion,
        lastChangeSetId: rosterSync.changeSetId ?? remoteAthlete.lastChangeSetId ?? null,
        updatedAt: occurredAt
      }, occurredAt);
      setSaveMessage(`Assigned ${remoteAthlete.name} to ${team.name}.`);
    } catch (error) {
      handleWriteFailure(
        "team-assignments",
        error,
        "Unable to save the roster assignment to Supabase.",
        buildPendingWrite(scope, "team-assignments-set", plannerState.workspaceRootId ?? null, {
          workspaceId: plannerState.workspaceId,
          workspaceRootId: plannerState.workspaceRootId ?? null,
          teamId: team.remoteTeamId || team.id,
          athleteIds: Array.from(new Set([...(team.memberAthleteIds ?? []), athlete.id])),
          fallbackTeam: {
            memberAthleteIds: Array.from(new Set([...(team.memberAthleteIds ?? []), athlete.id])),
            memberRegistrationNumbers: Array.from(new Set([...(team.memberRegistrationNumbers ?? []), athlete.registrationNumber])),
            status: team.status
          }
        })
      );
    }
  };

  const removeFromTeam = async (athleteId: string, teamId: string) => {
    if (!canUsePremiumAction()) {
      return;
    }

    const athlete = athleteMapById.get(athleteId);
    const team = teamMap.get(teamId);

    if (!athlete || !team) {
      setSaveMessage("Athlete record was not found.");
      return;
    }

    try {
      const occurredAt = new Date().toISOString();
      const nextAthleteIds = (team.memberAthleteIds ?? []).filter((currentAthleteId) => currentAthleteId !== athlete.id);
      const rosterSync = await syncRemoteRoster(
        scope,
        plannerState.workspaceId,
        team,
        nextAthleteIds,
        plannerState.workspaceRootId ?? null
      );
      patchPlannerState((current) => removeAthleteFromPlannerTeam(current, athlete, team.id, occurredAt), {
        lockVersion: rosterSync.team.lockVersion,
        lastChangeSetId: rosterSync.changeSetId ?? null,
        updatedAt: occurredAt
      }, occurredAt);
      setSaveMessage(`Removed ${athlete.name} from ${team.name}.`);
    } catch (error) {
      handleWriteFailure(
        "team-assignments",
        error,
        "Unable to update the roster in Supabase.",
        buildPendingWrite(scope, "team-assignments-set", plannerState.workspaceRootId ?? null, {
          workspaceId: plannerState.workspaceId,
          workspaceRootId: plannerState.workspaceRootId ?? null,
          teamId: team.remoteTeamId || team.id,
          athleteIds: (team.memberAthleteIds ?? []).filter((currentAthleteId) => currentAthleteId !== athlete.id),
          fallbackTeam: {
            memberAthleteIds: (team.memberAthleteIds ?? []).filter((currentAthleteId) => currentAthleteId !== athlete.id),
            memberRegistrationNumbers: (team.memberRegistrationNumbers ?? []).filter((registrationNumber) => registrationNumber !== athlete.registrationNumber),
            status: team.status
          }
        })
      );
    }
  };

  const clearTeam = async (teamId: string) => {
    if (!canUsePremiumAction()) {
      return;
    }

    const team = teamMap.get(teamId);

    if (!team) {
      setSaveMessage("Team record was not found.");
      return;
    }

    try {
      const occurredAt = new Date().toISOString();
      const rosterSync = await syncRemoteRoster(scope, plannerState.workspaceId, team, [], plannerState.workspaceRootId ?? null);
      patchPlannerState((current) => clearPlannerTeamRoster(current, team.id, occurredAt), {
        lockVersion: rosterSync.team.lockVersion,
        lastChangeSetId: rosterSync.changeSetId ?? null,
        updatedAt: occurredAt
      }, occurredAt);
      setSaveMessage(`Cleared ${team.name} roster.`);
    } catch (error) {
      handleWriteFailure(
        "team-assignments",
        error,
        "Unable to clear the roster in Supabase.",
        buildPendingWrite(scope, "team-assignments-set", plannerState.workspaceRootId ?? null, {
          workspaceId: plannerState.workspaceId,
          workspaceRootId: plannerState.workspaceRootId ?? null,
          teamId: team.remoteTeamId || team.id,
          athleteIds: [],
          fallbackTeam: {
            memberAthleteIds: [],
            memberRegistrationNumbers: [],
            status: team.status
          }
        })
      );
    }
  };

  const deleteAthleteProfile = async (athleteId: string) => {
    if (!canUsePremiumAction()) {
      return false;
    }

    const athlete = athleteMapById.get(athleteId);

    if (!athlete) {
      setSaveMessage("Athlete record was not found.");
      return false;
    }

    return runSavingAction("athlete-delete", async () => {
      try {
        const occurredAt = new Date().toISOString();

        if (isUuidString(athlete.id)) {
          await deleteRemoteAthleteRecord(scope, {
            athleteId: athlete.id,
            workspaceRootId: athlete.workspaceRootId ?? plannerState.workspaceRootId ?? null,
            expectedLockVersion: athlete.lockVersion ?? null
          });

          patchPlannerState((current) => ({
            ...current,
            athletes: current.athletes.filter((item) => item.id !== athlete.id),
            evaluations: current.evaluations.filter((item) => item.athleteId !== athlete.id),
            teams: current.teams.map((team) => ({
              ...team,
              memberAthleteIds: team.memberAthleteIds.filter((memberId) => memberId !== athlete.id),
              memberRegistrationNumbers: (team.memberRegistrationNumbers ?? []).filter((registrationNumber) => registrationNumber !== athlete.registrationNumber)
            }))
          }), null, occurredAt);
        } else {
          patchPlannerState((current) => ({
            ...current,
            athletes: current.athletes.filter((item) => item.id !== athlete.id),
            evaluations: current.evaluations.filter((item) => item.athleteId !== athlete.id),
            teams: current.teams.map((team) => ({
              ...team,
              memberAthleteIds: team.memberAthleteIds.filter((memberId) => memberId !== athlete.id),
              memberRegistrationNumbers: (team.memberRegistrationNumbers ?? []).filter((registrationNumber) => registrationNumber !== athlete.registrationNumber)
            }))
          }), null, occurredAt);
        }

        await loadTrash().catch(() => undefined);

        setSaveState("athlete-delete", "saved");
        setSaveMessage(`Deleted ${athlete.name}. You can restore it from Trash for 90 days.`);
        return true;
      } catch (error) {
        handlePremiumWriteError(error, "Unable to delete the athlete in Supabase.");
        return false;
      }
    });
  };

  const deleteTeam = async (teamId: string) => {
    if (!canUsePremiumAction()) {
      return false;
    }

    const team = teamMap.get(teamId);

    if (!team) {
      setSaveMessage("Team record was not found.");
      return false;
    }

    return runSavingAction("team-delete", async () => {
      try {
        const occurredAt = new Date().toISOString();

        if (team.remoteTeamId || isUuidString(team.id)) {
          await deleteRemoteTeamRecord(scope, {
            teamId: team.remoteTeamId || team.id,
            workspaceRootId: team.workspaceRootId ?? plannerState.workspaceRootId ?? null,
            expectedLockVersion: team.lockVersion ?? null
          });

          patchPlannerState((current) => {
            const nextProject = deletePlannerTeamRecord(current, team.id);
            return {
              ...nextProject,
              skillPlans: removeTeamScopedRecords(nextProject.skillPlans, team.id),
              routinePlans: removeTeamScopedRecords(nextProject.routinePlans, team.id),
              seasonPlans: removeTeamScopedRecords(nextProject.seasonPlans, team.id)
            };
          }, null, occurredAt);
        } else {
          patchPlannerState((current) => {
            const nextProject = deletePlannerTeamRecord(current, team.id);
            return {
              ...nextProject,
              skillPlans: removeTeamScopedRecords(nextProject.skillPlans, team.id),
              routinePlans: removeTeamScopedRecords(nextProject.routinePlans, team.id),
              seasonPlans: removeTeamScopedRecords(nextProject.seasonPlans, team.id)
            };
          }, null, occurredAt);
        }

        await loadTrash().catch(() => undefined);

        setSaveState("team-delete", "saved");
        setSaveMessage(`Deleted ${team.name}. You can restore it from Trash for 90 days.`);
        return true;
      } catch (error) {
        handlePremiumWriteError(error, "Unable to delete the team in Supabase.");
        return false;
      }
    });
  };

  const getTrashRestorePreview = async (item: Pick<PlannerTrashItem, "entityType" | "versionId">) => {
    if (!canUsePremiumAction()) {
      return null;
    }

    const result = await fetchPlannerRestorePreview(scope, {
      workspaceRootId: plannerState.workspaceRootId ?? null,
      entityType: item.entityType,
      versionId: item.versionId
    });

    return result.preview;
  };

  const restoreTrashItem = async (item: Pick<PlannerTrashItem, "entityType" | "versionId" | "name">) => {
    if (!canUsePremiumAction()) {
      return false;
    }

    return runSavingAction("trash-restore", async () => {
      try {
        await restorePlannerEntity(scope, {
          workspaceRootId: plannerState.workspaceRootId ?? null,
          entityType: item.entityType,
          versionId: item.versionId
        });
        await refreshRemoteFoundation();
        await loadTrash();
        setSaveState("trash-restore", "saved");
        setSaveMessage(`Restored ${item.name}.`);
        return true;
      } catch (error) {
        handlePremiumWriteError(error, "Unable to restore this item right now.");
        return false;
      }
    });
  };

  const openTeamEdit = (team: PlannerTeamRecord) => {
    setTeamEdit({
      teamId: team.id,
      name: team.name,
      teamLevel: team.teamLevel,
      teamType: team.teamType
    });
  };

  const confirmTeamEdit = async () => {
    if (!canUsePremiumAction()) {
      return;
    }

    if (!teamEdit) {
      return;
    }

    const currentTeam = teamMap.get(teamEdit.teamId);

    if (!currentTeam) {
      setSaveMessage("Team record was not found.");
      setTeamEdit(null);
      return;
    }

    const currentTeamWithMembers = teamWithMembersMap.get(teamEdit.teamId);
    const invalidMembers = (currentTeamWithMembers?.members ?? [])
      .filter((member) => !canAssignQualifiedLevelToTeam(member.displayLevel, teamEdit.teamLevel));

    if (invalidMembers.length) {
      const preview = invalidMembers.slice(0, 3).map((member) => member.name).join(", ");
      const suffix = invalidMembers.length > 3 ? ` and ${invalidMembers.length - 3} more` : "";
      setSaveMessage(
        `Cannot change ${currentTeam.name} to ${teamEdit.teamLevel}. ${preview}${suffix} no longer meet that team level.`
      );
      return;
    }

    await runSavingAction("team-edit", async () => {
      const occurredAt = new Date().toISOString();
      const teamPayload: PendingTeamSavePayload = {
        workspaceId: plannerState.workspaceId,
        workspaceRootId: currentTeam.workspaceRootId ?? plannerState.workspaceRootId ?? null,
        expectedLockVersion: currentTeam.lockVersion ?? null,
        teamId: currentTeam.remoteTeamId || currentTeam.id,
        name: teamEdit.name,
        teamLevel: teamEdit.teamLevel,
        teamType: teamEdit.teamType,
        teamDivision: currentTeam.teamDivision || "Elite",
        trainingDays: currentTeam.trainingDays || "",
        trainingHours: currentTeam.trainingHours || "",
        linkedCoachIds: currentTeam.linkedCoachIds ?? [],
        assignedCoachNames: currentTeam.assignedCoachNames ?? [],
        fallbackTeam: {
          memberAthleteIds: currentTeam.memberAthleteIds ?? [],
          memberRegistrationNumbers: currentTeam.memberRegistrationNumbers ?? [],
          status: currentTeam.status
        }
      };

      try {
        if (currentTeam.remoteTeamId || isUuidString(currentTeam.id)) {
          const result = await savePlannerTeam(scope, teamPayload);
          const nextTeam = result.team ?? updatePlannerTeamDefinition({
            ...plannerState,
            teams: [currentTeam]
          }, {
            teamId: currentTeam.id,
            name: teamEdit.name,
            teamLevel: teamEdit.teamLevel,
            teamType: teamEdit.teamType
          }, occurredAt).teams[0];

          patchPlannerState((current) => ({
            ...current,
            teams: upsertRecordById(current.teams, nextTeam)
          }), {
            workspaceRootId: nextTeam.workspaceRootId ?? currentTeam.workspaceRootId,
            lockVersion: typeof result.lockVersion === "number" ? result.lockVersion : nextTeam.lockVersion,
            lastChangeSetId: result.changeSetId ?? nextTeam.lastChangeSetId ?? null,
            updatedAt: nextTeam.updatedAt || occurredAt
          }, nextTeam.updatedAt || occurredAt);
        } else {
          patchPlannerState((current) => updatePlannerTeamDefinition(current, {
            teamId: currentTeam.id,
            name: teamEdit.name,
            teamLevel: teamEdit.teamLevel,
            teamType: teamEdit.teamType
          }, occurredAt), null, occurredAt);
        }

        setSaveState("team-edit", "saved");
        setSaveMessage(`Updated ${teamEdit.name.trim() || currentTeam.name}.`);
        setTeamEdit(null);
      } catch (error) {
        handleWriteFailure(
          "team-edit",
          error,
          "Unable to update the team in Supabase.",
          buildPendingWrite(scope, "team-save", teamPayload.workspaceRootId ?? null, teamPayload)
        );
      }
    });
  };

  const openSkillPlannerTeam = (teamId: string) => {
    const team = skillPlannerTeams.find((item) => item.teamId === teamId) ?? null;

    if (!team) {
      setSaveMessage("Skill Planner team input was not found.");
      return;
    }

    setSkillPlannerDraft({
      teamId,
      selections: buildSkillPlannerDraftSelectionRows(team)
    });
  };

  const cancelSkillPlannerEdit = () => {
    setSkillPlannerDraft(null);
  };

  const updateSkillPlannerSelection = (selectionId: string, field: "skillName" | "levelLabel", value: string) => {
    setSkillPlannerDraft((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        selections: current.selections.map((selection) => (
          selection.id === selectionId ? { ...selection, [field]: value } : selection
        ))
      };
    });
  };

  const addSkillPlannerSelection = (category: TeamSkillCategory, groupIndex: number | null = null) => {
    setSkillPlannerDraft((current) => {
      if (!current) {
        return current;
      }

      const categorySelections = current.selections.filter((selection) => (
        selection.category === category && selection.groupIndex === groupIndex
      ));
      const nextSortOrder = categorySelections.length
        ? Math.max(...categorySelections.map((selection) => selection.sortOrder)) + 1
        : 0;
      const nextSelection: TeamSkillSelection = {
        id: `team-skill-selection-${current.teamId}-${category}-${groupIndex ?? "base"}-${Date.now()}-${nextSortOrder}`,
        athleteId: null,
        category,
        groupIndex,
        sortOrder: nextSortOrder,
        sourceEvaluationId: null,
        levelKey: null,
        levelLabel: "",
        skillName: "",
        sourceOptionId: null,
        isExtra: true,
        status: "selected",
        notes: ""
      };

      return {
        ...current,
        selections: [...current.selections, nextSelection]
      };
    });
  };

  const removeSkillPlannerSelection = (selectionId: string) => {
    setSkillPlannerDraft((current) => {
      if (!current) {
        return current;
      }

      const selectionToRemove = current.selections.find((selection) => selection.id === selectionId);

      if (!selectionToRemove) {
        return current;
      }

      const groupSelections = current.selections.filter((selection) => (
        selection.category === selectionToRemove.category && selection.groupIndex === selectionToRemove.groupIndex
      ));

      if (groupSelections.length <= 1) {
        return current;
      }

      return {
        ...current,
        selections: current.selections.filter((selection) => selection.id !== selectionId)
      };
    });
  };

  const saveSkillPlannerEdit = async () => {
    if (!canUsePremiumAction()) {
      return;
    }

    if (!skillPlannerDraft || !skillPlannerEditingTeam) {
      setSaveMessage("No Skill Planner draft is open.");
      return;
    }

    const occurredAt = new Date().toISOString();
    const selections = buildSkillPlannerPersistedSelections(skillPlannerEditingTeam, skillPlannerDraft.selections);
    const draftProject = replaceTeamSkillPlanSelections(plannerState, {
      teamId: skillPlannerEditingTeam.teamId,
      selections,
      occurredAt
    });
    const nextPlan = draftProject.skillPlans.find((plan) => plan.teamId === skillPlannerEditingTeam.teamId) ?? null;

    if (!nextPlan) {
      setSaveMessage("Unable to build the skill plan payload.");
      return;
    }

    await runSavingAction("skill-plan", async () => {
      try {
        const remoteTeamId = teamMap.get(skillPlannerEditingTeam.teamId)?.remoteTeamId || (isUuidString(skillPlannerEditingTeam.teamId) ? skillPlannerEditingTeam.teamId : undefined);

        if (!remoteTeamId) {
          throw new Error("This team does not have a linked Supabase id yet, so the skill plan cannot be saved remotely.");
        }

        const remotePlan = await syncRemoteSkillPlan(scope, nextPlan, remoteTeamId);
        patchPlannerState((current) => ({
          ...current,
          skillPlans: upsertTeamScopedRecord(current.skillPlans, remotePlan)
        }), remotePlan, remotePlan.updatedAt);
        setSkillPlannerDraft(null);
        setSaveState("skill-plan", "saved");
        setSaveMessage(`Saved Skill Planner selections for ${skillPlannerEditingTeam.teamName}.`);
      } catch (error) {
        handleWriteFailure(
          "skill-plan",
          error,
          "Unable to save the Skill Planner selections to Supabase.",
          buildPendingWrite(scope, "skill-plan-save", nextPlan.workspaceRootId ?? null, {
            ...nextPlan,
            teamId: teamMap.get(skillPlannerEditingTeam.teamId)?.remoteTeamId || nextPlan.teamId
          })
        );
      }
    });
  };

  const openRoutineBuilderTeam = async (teamId: string) => {
    const team = routineBuilderTeams.find((item) => item.teamId === teamId) ?? null;

    if (!team) {
      setSaveMessage("Routine Builder team input was not found.");
      return;
    }

    const occurredAt = new Date().toISOString();
    const nextPlan = buildTeamRoutinePlanDraft(plannerState, team, occurredAt);
    const needsMigration = !team.routinePlan?.document;

    setRoutineBuilderDraft({
      teamId,
      document: nextPlan.document ?? { config: { name: `${team.teamName} Routine`, rowCount: 40, columnCount: 8 }, placements: [], cueNotes: {} },
      status: nextPlan.status,
      notes: nextPlan.notes
    });

    if (!needsMigration || !nextPlan.document) {
      return;
    }

    const remoteTeamId = team.remoteTeamId || (isUuidString(team.teamId) ? team.teamId : null);

    if (!remoteTeamId) {
      setSaveMessage(`Opened ${team.teamName}. This plan was migrated in cache and will sync once the team has a linked Supabase id.`);
      return;
    }

    try {
      const remotePlan = await syncRemoteRoutinePlan(scope, nextPlan, remoteTeamId);
      patchPlannerState((current) => ({
        ...current,
        routinePlans: upsertTeamScopedRecord(current.routinePlans, remotePlan)
      }), remotePlan, remotePlan.updatedAt);
      setSaveMessage(`Migrated ${team.teamName} routine plan.`);
    } catch (error) {
      handlePremiumWriteError(error, "Unable to migrate the routine plan to Supabase.");
    }
  };

  const cancelRoutineBuilderEdit = () => {
    setRoutineBuilderDraft(null);
  };

  const updateRoutineBuilderDocument = (document: RoutineDocument) => {
    setRoutineBuilderDraft((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        document
      };
    });
  };

  const saveRoutineBuilderEdit = async () => {
    if (!canUsePremiumAction()) {
      return;
    }

    if (!routineBuilderDraft || !routineBuilderEditingTeam) {
      setSaveMessage("No Routine Builder draft is open.");
      return;
    }

    const occurredAt = new Date().toISOString();
    const nextPlan = buildTeamRoutinePlanDraft(plannerState, routineBuilderEditingTeam, occurredAt);
    const draftPlan: TeamRoutinePlan = {
      ...nextPlan,
      status: routineBuilderDraft.status,
      notes: routineBuilderDraft.notes,
      document: routineBuilderDraft.document,
      updatedAt: occurredAt
    };

    const remoteTeamId = routineBuilderEditingTeam.remoteTeamId || (isUuidString(routineBuilderEditingTeam.teamId) ? routineBuilderEditingTeam.teamId : null);

    await runSavingAction("routine-plan", async () => {
      try {
        if (!remoteTeamId) {
          throw new Error("This team does not have a linked Supabase id yet, so the routine plan cannot be saved remotely.");
        }

        const remotePlan = await syncRemoteRoutinePlan(scope, draftPlan, remoteTeamId);
        patchPlannerState((current) => ({
          ...current,
          routinePlans: upsertTeamScopedRecord(current.routinePlans, remotePlan)
        }), remotePlan, remotePlan.updatedAt);
        setRoutineBuilderDraft(null);
        setSaveState("routine-plan", "saved");
        setSaveMessage(`Saved Routine Builder plan for ${routineBuilderEditingTeam.teamName}.`);
      } catch (error) {
        handleWriteFailure(
          "routine-plan",
          error,
          "Unable to save the routine plan to Supabase.",
          buildPendingWrite(scope, "routine-plan-save", draftPlan.workspaceRootId ?? null, {
            ...draftPlan,
            teamId: remoteTeamId ?? draftPlan.teamId
          })
        );
      }
    });
  };

  const openSeasonPlannerTeam = (teamId: string) => {
    const team = seasonPlannerTeams.find((item) => item.teamId === teamId) ?? null;

    if (!team) {
      setSaveMessage("Season Planner team input was not found.");
      return;
    }

    setSeasonPlannerDraft({
      teamId,
      checkpointIds: buildSeasonPlannerDraftCheckpointIds(team)
    });
  };

  const cancelSeasonPlannerEdit = () => {
    setSeasonPlannerDraft(null);
  };

  const toggleSeasonPlannerCheckpoint = (checkpointId: string) => {
    setSeasonPlannerDraft((current) => {
      if (!current) {
        return current;
      }

      const checkpointIds = current.checkpointIds.includes(checkpointId)
        ? current.checkpointIds.filter((currentCheckpointId) => currentCheckpointId !== checkpointId)
        : [...current.checkpointIds, checkpointId];

      return {
        ...current,
        checkpointIds
      };
    });
  };

  const saveSeasonPlannerEdit = async () => {
    if (!canUsePremiumAction()) {
      return;
    }

    if (!seasonPlannerDraft || !seasonPlannerEditingTeam) {
      setSaveMessage("No Season Planner draft is open.");
      return;
    }

    const occurredAt = new Date().toISOString();
    const checkpoints = buildSeasonPlannerPersistedCheckpoints(seasonPlannerEditingTeam, seasonPlannerDraft.checkpointIds);
    const draftProject = replaceTeamSeasonPlanCheckpoints(plannerState, {
      teamId: seasonPlannerEditingTeam.teamId,
      checkpoints,
      occurredAt
    });
    const nextPlan = draftProject.seasonPlans.find((plan) => plan.teamId === seasonPlannerEditingTeam.teamId) ?? null;

    if (!nextPlan) {
      setSaveMessage("Unable to build the season plan payload.");
      return;
    }

    await runSavingAction("season-plan", async () => {
      try {
        const remoteTeamId = teamMap.get(seasonPlannerEditingTeam.teamId)?.remoteTeamId || (isUuidString(seasonPlannerEditingTeam.teamId) ? seasonPlannerEditingTeam.teamId : undefined);

        if (!remoteTeamId) {
          throw new Error("This team does not have a linked Supabase id yet, so the season plan cannot be saved remotely.");
        }

        const remotePlan = await syncRemoteSeasonPlan(scope, nextPlan, remoteTeamId);
        patchPlannerState((current) => ({
          ...current,
          seasonPlans: upsertTeamScopedRecord(current.seasonPlans, remotePlan)
        }), remotePlan, remotePlan.updatedAt);
        setSeasonPlannerDraft(null);
        setSaveState("season-plan", "saved");
        setSaveMessage(`Saved Season Planner checkpoints for ${seasonPlannerEditingTeam.teamName}.`);
      } catch (error) {
        handleWriteFailure(
          "season-plan",
          error,
          "Unable to save the season plan to Supabase.",
          buildPendingWrite(scope, "season-plan-save", nextPlan.workspaceRootId ?? null, {
            ...nextPlan,
            teamId: teamMap.get(seasonPlannerEditingTeam.teamId)?.remoteTeamId || nextPlan.teamId
          })
        );
      }
    });
  };

  return {
    plannerState,
    athletePool,
    trashItems,
    trashLoading,
    saveMessage,
    syncStatusLabel,
    isSavingAction,
    getSaveState,
    premiumAccess,
    premiumPromptOpen,
    setPremiumPromptOpen,
    activeSport,
    setActiveSport,
    templateDraft,
    athleteDraft,
    updateAthleteDraft,
    updateParentContact,
    addParentContact,
    removeParentContact,
    startNewAthlete,
    loadRegisteredAthlete,
    levelsDraft,
    openLevels,
    toggleLevel,
    settingsOpen,
    setSettingsOpen,
    summary,
    recentEvaluations,
    saveAthleteProfile,
    deleteAthleteProfile,
    resetAthleteDraft,
    startNewMyTeamsTeamDraft,
    updateAssignedCoachName,
    addAssignedCoachName,
    removeAssignedCoachName,
    saveMyTeamsTeamProfile,
    updateMyTeamsTeamProfile,
    saveEvaluation,
    loadEvaluation,
    updateTemplateOption,
    removeTemplateOption,
    addTemplateOption,
    updateTemplateSkill,
    moveTemplateSkill,
    addTemplateSkill,
    removeTemplateSkill,
    updateSkillCount,
    saveTemplate,
    resetTemplate,
    cancelTemplateChanges,
    setPipelineStage,
    updateSkillName,
    updateSkillOption,
    removeSkill,
    addExtraSkill,
    qualificationOpen,
    setQualificationOpen,
    qualificationRulesDraft,
    updateQualificationRule,
    cancelQualificationRules,
    saveQualificationRules,
    filters,
    setFilters,
    createTeamOpen,
    setCreateTeamOpen,
    teamDraft,
    setTeamDraft,
    createTeam,
    filteredAthletePool,
    teamsWithMembers,
    skillPlannerDraft,
    skillPlannerEditingTeam,
    openSkillPlannerTeam,
    cancelSkillPlannerEdit,
    updateSkillPlannerSelection,
    addSkillPlannerSelection,
    removeSkillPlannerSelection,
    saveSkillPlannerEdit,
    skillPlannerTeams,
    routineBuilderDraft,
    routineBuilderEditingTeam,
    openRoutineBuilderTeam,
    cancelRoutineBuilderEdit,
    updateRoutineBuilderDocument,
    saveRoutineBuilderEdit,
    routineBuilderTeams,
    seasonPlannerDraft,
    seasonPlannerEditingTeam,
    openSeasonPlannerTeam,
    cancelSeasonPlannerEdit,
    toggleSeasonPlannerCheckpoint,
    saveSeasonPlannerEdit,
    seasonPlannerTeams,
    myTeamsSummaries,
    assignToTeam,
    removeFromTeam,
    clearTeam,
    deleteTeam,
    loadTrash,
    getTrashRestorePreview,
    restoreTrashItem,
    teamEdit,
    setTeamEdit,
    openTeamEdit,
    confirmTeamEdit,
    stats,
    levelLabels,
    levelKeys: LEVEL_KEYS,
    levelLabelsList: LEVEL_LABELS,
    canAssignQualifiedLevelToTeam,
    formatScore: formatPlannerScore,
    getEvaluationDate: getTryoutEvaluationDate,
    getRecentAthleteLabel
  };
}

export type CheerPlannerIntegration = ReturnType<typeof useCheerPlannerIntegration>;

















































































