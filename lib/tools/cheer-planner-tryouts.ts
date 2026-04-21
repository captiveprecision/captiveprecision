import type { AthleteRecord, AthleteSnapshot } from "@/lib/domain/athlete";
import type {
  EvaluationRecord as PlannerTryoutEvaluation,
  PlannerLevelEvaluation,
  PlannerSkillEvaluation,
  PlannerTemplateSkill,
  PlannerTopLevel,
  PlannerTryoutOption,
  PlannerTryoutSummary,
  PlannerTryoutTemplate
} from "@/lib/domain/evaluation-record";
import {
  LEVEL_KEYS,
  LEVEL_LABELS,
  LEVEL_RANKS,
  levelLabels,
  type PlannerLevelKey,
  type PlannerLevelLabel,
  type PlannerQualifiedLevel,
  type PlannerSportKey
} from "@/lib/domain/planner-levels";
import type { PlannerProject as CheerPlannerState, PlannerQualificationRules } from "@/lib/domain/planner-project";
import type { TeamRecord as PlannerTeamRecord } from "@/lib/domain/team";
import {
  canAssignQualifiedLevelToTeam,
  getHighestQualifiedLevelFromEvaluation,
  getNextRegistrationNumber,
  normalizeAthleteSnapshot,
  normalizePlannerAthlete,
  normalizePlannerEvaluation,
  normalizePlannerProject,
  normalizePlannerTeam
} from "@/lib/services/planner-domain-mappers";

export const CHEER_PLANNER_TRYOUTS_STORAGE_KEY = "cp-cheer-planner-tryouts";
export const CHEER_PLANNER_REMOTE_MIGRATION_VERSION = "v1";

export function buildCheerPlannerStorageKey(scopeKey?: string) {
  return scopeKey ? `${CHEER_PLANNER_TRYOUTS_STORAGE_KEY}:${scopeKey}` : CHEER_PLANNER_TRYOUTS_STORAGE_KEY;
}

export function buildCheerPlannerMigrationKey(scopeKey?: string) {
  return `${buildCheerPlannerStorageKey(scopeKey)}:remote-migration`;
}

export {
  LEVEL_KEYS,
  LEVEL_LABELS,
  LEVEL_RANKS,
  canAssignQualifiedLevelToTeam,
  getHighestQualifiedLevelFromEvaluation,
  getNextRegistrationNumber,
  levelLabels
};

export type {
  AthleteRecord as PlannerAthleteRecord,
  AthleteSnapshot as PlannerAthleteSnapshot,
  CheerPlannerState,
  PlannerLevelEvaluation,
  PlannerLevelKey,
  PlannerLevelLabel,
  PlannerQualifiedLevel,
  PlannerQualificationRules,
  PlannerSkillEvaluation,
  PlannerSportKey,
  PlannerTeamRecord,
  PlannerTopLevel,
  PlannerTryoutEvaluation,
  PlannerTryoutOption,
  PlannerTemplateSkill,
  PlannerTryoutSummary,
  PlannerTryoutTemplate
};

export const defaultSkillLibrary: Record<PlannerLevelKey, PlannerTemplateSkill[]> = {
  beginner: ["Forward Roll", "Handstand", "Bridge"].map((name, index) => ({ id: `beginner-skill-${index + 1}`, name })),
  "1": ["Forward Roll", "Cartwheel", "Back Walkover"].map((name, index) => ({ id: `1-skill-${index + 1}`, name })),
  "2": ["Round Off", "Back Handspring", "Front Walkover"].map((name, index) => ({ id: `2-skill-${index + 1}`, name })),
  "3": ["Round Off Back Handspring", "Standing Back Handspring", "Front Handspring"].map((name, index) => ({ id: `3-skill-${index + 1}`, name })),
  "4": ["Tuck", "Round Off Back Handspring Tuck", "Standing Tuck"].map((name, index) => ({ id: `4-skill-${index + 1}`, name })),
  "5": ["Layouts", "Full Twisting Layout", "Jump to Back Handspring"].map((name, index) => ({ id: `5-skill-${index + 1}`, name })),
  "6": ["Double Full", "Arabian", "Specialty Pass"].map((name, index) => ({ id: `6-skill-${index + 1}`, name })),
  "7": ["Double Full to Double", "Whip to Double", "Elite Specialty Pass"].map((name, index) => ({ id: `7-skill-${index + 1}`, name }))
};

export const defaultTryoutTemplate: PlannerTryoutTemplate = {
  id: "default-tryouts-template",
  name: "Default tryout template",
  stage: "tryouts",
  activeSport: "tumbling",
  options: [
    { id: "does-it", label: "Attempted", value: 1 },
    { id: "needs-work", label: "Needs some work", value: 1.7 },
    { id: "ready-to-compete", label: "Ready to compete", value: 2 }
  ],
  defaultSkillCounts: {
    beginner: 3,
    "1": 3,
    "2": 3,
    "3": 3,
    "4": 3,
    "5": 3,
    "6": 3,
    "7": 3
  },
  skillLibrary: defaultSkillLibrary,
  updatedAt: new Date("2026-03-17T00:00:00.000Z").toISOString()
};

export const defaultQualificationRules: PlannerQualificationRules = {
  "Beginner": 5,
  "Level 1": 5,
  "Level 2": 5,
  "Level 3": 5,
  "Level 4": 5,
  "Level 5": 5,
  "Level 6": 5,
  "Level 7": 5
};

const DEFAULT_PROJECT_TIMESTAMP = new Date("2026-03-17T00:00:00.000Z").toISOString();

export const defaultCheerPlannerState: CheerPlannerState = {
  id: "default-cheer-planner-project",
  workspaceId: "local-workspace",
  name: "Cheer Planner",
  status: "active",
  pipelineStage: "tryouts",
  template: defaultTryoutTemplate,
  athletes: [],
  evaluations: [],
  teams: [],
  skillPlans: [],
  routinePlans: [],
  seasonPlans: [],
  qualificationRules: defaultQualificationRules,
  createdAt: DEFAULT_PROJECT_TIMESTAMP,
  updatedAt: DEFAULT_PROJECT_TIMESTAMP
};

export function cloneTemplate(template: PlannerTryoutTemplate): PlannerTryoutTemplate {
  return {
    ...template,
    options: template.options.map((option) => ({ ...option })),
    defaultSkillCounts: { ...template.defaultSkillCounts },
    skillLibrary: Object.fromEntries(
      LEVEL_KEYS.map((levelKey) => [levelKey, (template.skillLibrary[levelKey] ?? []).map((skill) => ({ ...skill }))])
    ) as Record<PlannerLevelKey, PlannerTemplateSkill[]>
  };
}

export function cloneAthlete(athlete: AthleteRecord): AthleteRecord {
  return normalizePlannerAthlete(athlete);
}

export function cloneEvaluation(evaluation: PlannerTryoutEvaluation): PlannerTryoutEvaluation {
  return normalizePlannerEvaluation(evaluation);
}

export function cloneTeam(team: PlannerTeamRecord): PlannerTeamRecord {
  return normalizePlannerTeam(team);
}

export function cloneCheerPlannerState(state: CheerPlannerState): CheerPlannerState {
  return normalizePlannerProject(state, defaultTryoutTemplate, defaultQualificationRules);
}

export function getPlannerLevelRank(level: PlannerLevelLabel) {
  return LEVEL_RANKS[level];
}

export function readCheerPlannerStateFromStorage(storageKey: string): CheerPlannerState {
  if (typeof window === "undefined") {
    return cloneCheerPlannerState(defaultCheerPlannerState);
  }

  try {
    const raw = window.localStorage.getItem(storageKey);

    if (!raw) {
      return cloneCheerPlannerState(defaultCheerPlannerState);
    }

    const parsed = JSON.parse(raw) as Partial<CheerPlannerState>;
    return normalizePlannerProject(parsed, defaultTryoutTemplate, defaultQualificationRules);
  } catch {
    return cloneCheerPlannerState(defaultCheerPlannerState);
  }
}

export function writeCheerPlannerStateToStorage(storageKey: string, state: CheerPlannerState) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(state));
}


export function readCheerPlannerState(): CheerPlannerState {
  return readCheerPlannerStateFromStorage(buildCheerPlannerStorageKey());
}

export function writeCheerPlannerState(state: CheerPlannerState) {
  writeCheerPlannerStateToStorage(buildCheerPlannerStorageKey(), state);
}
