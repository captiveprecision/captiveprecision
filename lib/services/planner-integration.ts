import { useEffect, useMemo, useState } from "react";
import type { AthleteParentContact, AthleteRecord } from "@/lib/domain/athlete";
import type { RoutineDocument, TeamRoutinePlan } from "@/lib/domain/routine-plan";
import type { TeamSeasonPlan } from "@/lib/domain/season-plan";
import type { TeamSkillCategory, TeamSkillPlan, TeamSkillSelection } from "@/lib/domain/skill-plan";

import { getSystemById, getVersionById } from "@/lib/scoring/scoring-systems";
import { useScoringSystems } from "@/lib/scoring/use-scoring-systems";
import { buildMyTeamsTeamSummaries } from "@/lib/services/planner-my-teams";
import { mergeRemoteFoundationIntoProject, type PlannerRemoteFoundationSnapshot } from "@/lib/services/planner-supabase-foundation";
import {
  fetchPlannerFoundation,
  isPremiumRequiredError,
  PlannerApiError,
  savePlannerAthlete,
  savePlannerEvaluation,
  savePlannerProjectConfig,
  savePlannerRoutinePlan,
  savePlannerSeasonPlan,
  savePlannerSkillPlan
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
  createPlannerTeamRecord,
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
  defaultCheerPlannerState,
  defaultSkillLibrary,
  defaultTryoutTemplate,
  readCheerPlannerStateFromStorage,
  levelLabels,
  type CheerPlannerState,
  type PlannerLevelEvaluation,
  type PlannerLevelKey,
  type PlannerLevelLabel,
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

const PREMIUM_REQUIRED_MESSAGE = "Esta es una funcion premium. Actualiza tu plan hoy para seguir editando, guardar registros por equipo y desbloquear Cheer Planner completo.";

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
  return buildTryoutLevelEvaluations(template, LEVEL_KEYS, defaultSkillLibrary);
}

function buildAthleteName(firstName: string, lastName: string) {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(" ").trim();
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
    registrationNumber: "",
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    notes: "",
    parentContacts: [buildEmptyParentContact()]
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

async function syncRemoteRoster(scope: PlannerWorkspaceScope, action: "assign" | "remove" | "clear", teamId: string, athleteId?: string) {
  const response = await fetch("/api/coach/teams/roster", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    credentials: "include",
    body: JSON.stringify({ scope, action, teamId, athleteId })
  });
  const result = await response.json().catch(() => null) as { error?: string; code?: string } | null;

  if (!response.ok) {
    throw new PlannerApiError(result?.error ?? "Unable to update Supabase roster.", result?.code);
  }
}

async function createRemoteTeamRecord(scope: PlannerWorkspaceScope, draft: TeamBuilderTeamDraftInput): Promise<{
  teamId: string;
  assignedCoachNames: string[];
  linkedCoachIds: string[];
}> {
  const response = await fetch("/api/coach/teams", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    credentials: "include",
    body: JSON.stringify({
      name: draft.name,
      teamLevel: draft.teamLevel,
      teamType: draft.teamType,
      teamDivision: draft.teamDivision || "Elite",
      trainingDays: draft.trainingDays || "",
      trainingHours: draft.trainingHours || "",
      scope,
      coachAssignments: (draft.linkedCoachIds ?? []).map((coachId) => ({ selectedCoachId: coachId }))
    })
  });
  const result = await response.json().catch(() => null) as {
    teamId?: string;
    assignedCoachNames?: string[];
    linkedCoachIds?: string[];
    error?: string;
    code?: string;
  } | null;

  if (!response.ok || !result?.teamId) {
    throw new PlannerApiError(result?.error ?? "Unable to create the team in Supabase.", result?.code);
  }

  return {
    teamId: result.teamId,
    assignedCoachNames: result.assignedCoachNames ?? [],
    linkedCoachIds: result.linkedCoachIds ?? []
  };
}

async function deleteRemoteTeamRecord(scope: PlannerWorkspaceScope, teamId: string) {
  const response = await fetch("/api/coach/teams", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json"
    },
    credentials: "include",
    body: JSON.stringify({ scope, teamId })
  });
  const result = await response.json().catch(() => null) as { error?: string; code?: string } | null;

  if (!response.ok) {
    throw new PlannerApiError(result?.error ?? "Unable to delete Supabase team.", result?.code);
  }
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

    const createdTeam = await createRemoteTeamRecord(scope, {
      name: team.name,
      teamLevel: team.teamLevel,
      teamType: team.teamType,
      teamDivision: team.teamDivision,
      trainingDays: team.trainingDays,
      trainingHours: team.trainingHours,
      assignedCoachNames: team.assignedCoachNames,
      linkedCoachIds: team.linkedCoachIds
    });

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

    for (const athleteId of team.memberAthleteIds) {
      const remoteAthleteId = athleteIdMap.get(athleteId) || (isUuidString(athleteId) ? athleteId : null);
      if (remoteAthleteId) {
        await syncRemoteRoster(scope, "assign", remoteTeamId, remoteAthleteId);
      }
    }
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
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [premiumPromptOpen, setPremiumPromptOpen] = useState(false);
  const [premiumAccess, setPremiumAccess] = useState<PremiumAccessState>({
    tier: "loading",
    scope: "none",
    status: "loading",
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false
  });
  const { config: scoringConfig, isReady: isScoringReady } = useScoringSystems();

  useEffect(() => {
    const state = readPlannerProject(scope);
    setPlannerState(state);
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
        setLevelsDraft(buildLevelEvaluations(nextState.template));
        writePlannerProject(nextState, scope);
      } catch {
        // Keep scoped cache when Supabase data is temporarily unavailable.
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

  const requestPremiumAccess = () => {
    setPremiumPromptOpen(true);
    setSaveMessage(PREMIUM_REQUIRED_MESSAGE);
  };

  const canUsePremiumAction = () => {
    if (premiumAccess.tier === "free") {
      requestPremiumAccess();
      return false;
    }

    return true;
  };

  const handlePremiumWriteError = (error: unknown, fallback: string) => {
    if (isPremiumRequiredError(error)) {
      requestPremiumAccess();
      return;
    }

    setSaveMessage(error instanceof Error ? error.message : fallback);
  };

  useEffect(() => {
    if (!saveMessage) {
      return;
    }

    const timeout = window.setTimeout(() => setSaveMessage(null), 2600);
    return () => window.clearTimeout(timeout);
  }, [saveMessage]);

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

  const persistState = (updater: (current: CheerPlannerState) => CheerPlannerState) => {
    setPlannerState((current) => {
      const next = {
        ...updater(current),
        updatedAt: new Date().toISOString()
      };
      writePlannerProject(next, scope);
      return next;
    });
  };

  const refreshRemoteFoundation = async () => {
    const snapshot = await fetchRemoteFoundation(scope);

    setPlannerState((current) => {
      const next = mergeRemoteFoundationIntoProject(current, snapshot);
      writePlannerProject(next, scope);
      return next;
    });

    return snapshot;
  };

  const persistProjectConfigState = (updater: (current: CheerPlannerState) => CheerPlannerState) => {
    const nextState = {
      ...updater(plannerState),
      updatedAt: new Date().toISOString()
    };

    setPlannerState(nextState);
    writePlannerProject(nextState, scope);
    return nextState;
  };

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

  const loadRegisteredAthlete = (athleteId: string) => {
    const athlete = plannerState.athletes.find((item) => item.id === athleteId) ?? null;

    if (!athlete) {
      setSaveMessage("Selected athlete could not be loaded.");
      return;
    }

    setActiveSport("tumbling");
    setAthleteDraft({
      athleteId: athlete.id,
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
    setPlannerState((current) => {
      const next = {
        ...current,
        template: {
          ...current.template,
          options: current.template.options.map((option, optionIndex) => {
            if (optionIndex !== index) {
              return option;
            }

            return {
              ...option,
              [field]: field === "value" ? Number(value) || 0 : value
            };
          })
        }
      };
      writePlannerProject(next, scope);
      return next;
    });
  };

  const updateSkillCount = (levelKey: PlannerLevelKey, value: string) => {
    const nextCount = Math.max(1, Math.min(20, Number(value) || 1));
    setPlannerState((current) => {
      const next = {
        ...current,
        template: {
          ...current.template,
          defaultSkillCounts: {
            ...current.template.defaultSkillCounts,
            [levelKey]: nextCount
          }
        }
      };
      writePlannerProject(next, scope);
      return next;
    });
  };

  const saveTemplate = async () => {
    if (!canUsePremiumAction()) {
      return;
    }

    const nextTemplate = {
      ...plannerState.template,
      updatedAt: new Date().toISOString()
    };
    const nextState = persistProjectConfigState((current) => ({
      ...current,
      template: nextTemplate
    }));

    setLevelsDraft(buildLevelEvaluations(nextTemplate));
    setOpenLevels([]);

    try {
      await syncRemotePlannerConfig(scope, nextState);
      await refreshRemoteFoundation();
      setSaveMessage("Template saved.");
    } catch (error) {
      handlePremiumWriteError(error, "Unable to save the template to Supabase.");
    }
  };

  const resetTemplate = async () => {
    if (!canUsePremiumAction()) {
      return;
    }

    const nextTemplate = cloneCheerPlannerState(defaultCheerPlannerState).template;
    const nextState = persistProjectConfigState((current) => ({
      ...current,
      template: nextTemplate
    }));

    setLevelsDraft(buildLevelEvaluations(nextTemplate));
    setOpenLevels([]);

    try {
      await syncRemotePlannerConfig(scope, nextState);
      await refreshRemoteFoundation();
      setSaveMessage("Template reset.");
    } catch (error) {
      handlePremiumWriteError(error, "Unable to reset the template in Supabase.");
    }
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

    try {
      const remoteAthlete = await savePlannerAthlete(scope, {
        athleteId: athleteDraft.athleteId,
        firstName: athleteDraft.firstName.trim(),
        lastName: athleteDraft.lastName.trim(),
        dateOfBirth: athleteDraft.dateOfBirth,
        registrationNumber: athleteDraft.registrationNumber,
        notes: athleteDraft.notes.trim(),
        parentContacts: athleteDraft.parentContacts
      });
      await refreshRemoteFoundation();
      setAthleteDraft((current) => ({
        ...current,
        athleteId: remoteAthlete.id,
        registrationNumber: remoteAthlete.registrationNumber
      }));
      setSaveMessage(`Saved athlete ${remoteAthlete.name}. Registration ${remoteAthlete.registrationNumber}.`);
      return true;
    } catch (error) {
      handlePremiumWriteError(error, "Unable to save athlete to Supabase.");
      return false;
    }
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

    const occurredAt = new Date().toISOString();

    try {
      const remoteAthlete = await savePlannerAthlete(scope, {
        athleteId: athleteDraft.athleteId,
        firstName: athleteDraft.firstName.trim(),
        lastName: athleteDraft.lastName.trim(),
        dateOfBirth: athleteDraft.dateOfBirth,
        registrationNumber: athleteDraft.registrationNumber,
        notes: athleteDraft.notes.trim(),
        parentContacts: athleteDraft.parentContacts
      });
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

      await syncRemoteEvaluationRecord(scope, nextEvaluation);
      await refreshRemoteFoundation();
      setAthleteDraft((current) => ({
        ...current,
        athleteId: remoteAthlete.id,
        registrationNumber: remoteAthlete.registrationNumber
      }));
      setSaveMessage(`Saved evaluation for ${remoteAthlete.name}. Registration ${remoteAthlete.registrationNumber}.`);
    } catch (error) {
      handlePremiumWriteError(error, "Unable to save the evaluation to Supabase.");
    }
  };

  const loadEvaluation = (evaluation: PlannerTryoutEvaluation) => {
    setActiveSport("tumbling");
    setAthleteDraft({
      athleteId: evaluation.athleteId,
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
    setOpenLevels(evaluation.rawData.levels.map((level) => level.levelKey));
    setSaveMessage(`Loaded ${getRecentAthleteLabel(evaluation)}.`);
  };

  const updateQualificationRule = (levelLabel: PlannerLevelLabel, value: string) => {
    const nextValue = Math.max(0, Math.min(6, Number(value) || 0));
    setPlannerState((current) => {
      const next = {
        ...current,
        qualificationRules: {
          ...current.qualificationRules,
          [levelLabel]: nextValue
        }
      };
      writePlannerProject(next, scope);
      return next;
    });
  };

  const saveQualificationRules = async () => {
    if (!canUsePremiumAction()) {
      return;
    }

    const nextState = persistProjectConfigState((current) => current);

    try {
      await syncRemotePlannerConfig(scope, nextState);
      await refreshRemoteFoundation();
      setQualificationOpen(false);
      setSaveMessage("Qualification rules saved.");
    } catch (error) {
      handlePremiumWriteError(error, "Unable to save qualification rules to Supabase.");
    }
  };

  const setPipelineStage = async (pipelineStage: CheerPlannerState["pipelineStage"]) => {
    if (plannerState.pipelineStage === pipelineStage) {
      return;
    }

    const nextState = persistProjectConfigState((current) => ({
      ...current,
      pipelineStage
    }));

    try {
      await syncRemotePlannerConfig(scope, nextState);
      await refreshRemoteFoundation();
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : "Unable to sync the planner stage to Supabase.");
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

    try {
      const response = await fetch("/api/coach/teams", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({
          name: teamDraft.name,
          teamLevel: teamDraft.teamLevel,
          teamType: normalizedTeamType,
          teamDivision: "Elite",
          trainingDays: "",
          trainingHours: "",
          scope,
          coachAssignments: []
        })
      });
      const result = await response.json().catch(() => null) as { teamId?: string; assignedCoachNames?: string[]; linkedCoachIds?: string[]; error?: string } | null;

      if (!response.ok || !result?.teamId) {
        setSaveMessage(result?.error ?? "Unable to create the team in Supabase.");
        return;
      }

      const now = new Date().toISOString();
      const nextTeam = createPlannerTeamRecord(plannerState, {
        name: teamDraft.name,
        teamLevel: teamDraft.teamLevel,
        teamType: normalizedTeamType,
        teamDivision: "Elite",
        assignedCoachNames: result.assignedCoachNames ?? [],
        linkedCoachIds: result.linkedCoachIds ?? [],
        remoteTeamId: result.teamId
      }, now);

      persistState((current) => ({
        ...current,
        teams: [...current.teams, nextTeam]
      }));
      await refreshRemoteFoundation();
      setCreateTeamOpen(false);
      setTeamDraft({ name: "", teamLevel: "Beginner", teamType: "Youth", trainingSchedule: "", assignedCoachNames: [""] });
      setSaveMessage(`Created ${nextTeam.name}.`);
    } catch (error) {
      handlePremiumWriteError(error, "Unable to create the team in Supabase.");
    }
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
      teams: [...current.teams, nextTeam]
    }));
    void refreshRemoteFoundation().catch(() => undefined);
    setSaveMessage(`Created ${nextTeam.name}.`);
    return nextTeam.id;
  };

  const updateMyTeamsTeamProfile = (teamId: string, draft: TeamBuilderTeamDraftInput) => {
    persistState((current) => updateMyTeamsTeamProfileState(current, {
      teamId,
      ...draft
    }, new Date().toISOString()));
    void refreshRemoteFoundation().catch(() => undefined);
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
      await syncRemoteRoster(scope, "assign", team.remoteTeamId || team.id, remoteAthlete.id);
      await refreshRemoteFoundation();
      setSaveMessage(`Assigned ${remoteAthlete.name} to ${team.name}.`);
    } catch (error) {
      handlePremiumWriteError(error, "Unable to save the roster assignment to Supabase.");
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
      await syncRemoteRoster(scope, "remove", team.remoteTeamId || team.id, athlete.id);
      await refreshRemoteFoundation();
      setSaveMessage(`Removed ${athlete.name} from ${team.name}.`);
    } catch (error) {
      handlePremiumWriteError(error, "Unable to update the roster in Supabase.");
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
      await syncRemoteRoster(scope, "clear", team.remoteTeamId || team.id);
      await refreshRemoteFoundation();
      setSaveMessage(`Cleared ${team.name} roster.`);
    } catch (error) {
      handlePremiumWriteError(error, "Unable to clear the roster in Supabase.");
    }
  };

  const deleteTeam = async (teamId: string) => {
    if (!canUsePremiumAction()) {
      return;
    }

    const team = teamMap.get(teamId);

    if (!team) {
      setSaveMessage("Team record was not found.");
      return;
    }

    try {
      if (team.remoteTeamId || isUuidString(team.id)) {
        await deleteRemoteTeamRecord(scope, team.remoteTeamId || team.id);
      }
      await refreshRemoteFoundation();
      setSaveMessage(`Deleted ${team.name}.`);
    } catch (error) {
      handlePremiumWriteError(error, "Unable to delete the team in Supabase.");
    }
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

    try {
      if (currentTeam.remoteTeamId || isUuidString(currentTeam.id)) {
        const response = await fetch("/api/coach/teams", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          credentials: "include",
          body: JSON.stringify({
            teamId: currentTeam.remoteTeamId || currentTeam.id,
            name: teamEdit.name,
            teamLevel: teamEdit.teamLevel,
            teamType: teamEdit.teamType,
            teamDivision: currentTeam.teamDivision || "Elite",
            trainingDays: currentTeam.trainingDays || "",
            trainingHours: currentTeam.trainingHours || "",
            scope,
            coachAssignments: (currentTeam.linkedCoachIds ?? []).map((coachId) => ({ selectedCoachId: coachId }))
          })
        });
        const result = await response.json().catch(() => null) as { error?: string; code?: string } | null;

        if (!response.ok) {
          throw new Error(result?.error ?? "Unable to update the team in Supabase.");
        }
      }

      await refreshRemoteFoundation();
      setSaveMessage(`Updated ${teamEdit.name.trim() || currentTeam.name}.`);
      setTeamEdit(null);
    } catch (error) {
      handlePremiumWriteError(error, "Unable to update the team in Supabase.");
    }
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

    try {
      const remoteTeamId = teamMap.get(skillPlannerEditingTeam.teamId)?.remoteTeamId || (isUuidString(skillPlannerEditingTeam.teamId) ? skillPlannerEditingTeam.teamId : undefined);

      if (!remoteTeamId) {
        throw new Error("This team does not have a linked Supabase id yet, so the skill plan cannot be saved remotely.");
      }

      await syncRemoteSkillPlan(scope, nextPlan, remoteTeamId);
      await refreshRemoteFoundation();
      setSkillPlannerDraft(null);
      setSaveMessage(`Saved Skill Planner selections for ${skillPlannerEditingTeam.teamName}.`);
    } catch (error) {
      handlePremiumWriteError(error, "Unable to save the Skill Planner selections to Supabase.");
    }
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
      await syncRemoteRoutinePlan(scope, nextPlan, remoteTeamId);
      await refreshRemoteFoundation();
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

    try {
      if (!remoteTeamId) {
        throw new Error("This team does not have a linked Supabase id yet, so the routine plan cannot be saved remotely.");
      }

      await syncRemoteRoutinePlan(scope, draftPlan, remoteTeamId);
      await refreshRemoteFoundation();
      setRoutineBuilderDraft(null);
      setSaveMessage(`Saved Routine Builder plan for ${routineBuilderEditingTeam.teamName}.`);
    } catch (error) {
      handlePremiumWriteError(error, "Unable to save the routine plan to Supabase.");
    }
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

    try {
      const remoteTeamId = teamMap.get(seasonPlannerEditingTeam.teamId)?.remoteTeamId || (isUuidString(seasonPlannerEditingTeam.teamId) ? seasonPlannerEditingTeam.teamId : undefined);

      if (!remoteTeamId) {
        throw new Error("This team does not have a linked Supabase id yet, so the season plan cannot be saved remotely.");
      }

      await syncRemoteSeasonPlan(scope, nextPlan, remoteTeamId);
      await refreshRemoteFoundation();
      setSeasonPlannerDraft(null);
      setSaveMessage(`Saved Season Planner checkpoints for ${seasonPlannerEditingTeam.teamName}.`);
    } catch (error) {
      handlePremiumWriteError(error, "Unable to save the season plan to Supabase.");
    }
  };

  return {
    plannerState,
    athletePool,
    saveMessage,
    premiumAccess,
    premiumPromptOpen,
    setPremiumPromptOpen,
    activeSport,
    setActiveSport,
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
    startNewMyTeamsTeamDraft,
    updateAssignedCoachName,
    addAssignedCoachName,
    removeAssignedCoachName,
    saveMyTeamsTeamProfile,
    updateMyTeamsTeamProfile,
    saveEvaluation,
    loadEvaluation,
    updateTemplateOption,
    updateSkillCount,
    saveTemplate,
    resetTemplate,
    setPipelineStage,
    updateSkillName,
    updateSkillOption,
    removeSkill,
    addExtraSkill,
    qualificationOpen,
    setQualificationOpen,
    updateQualificationRule,
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

















































































