import type { AthleteRecord, AthleteSnapshot } from "@/lib/domain/athlete";
import type {
  TryoutRecord as PlannerTryoutRecord,
  PlannerLevelEvaluation,
  PlannerSkillEvaluation,
  PlannerTemplateSkill,
  PlannerTopLevel,
  PlannerTryoutBucketEvaluation,
  PlannerTryoutOption,
  PlannerTryoutSummary,
  PlannerTryoutTemplate,
  PlannerTryoutTemplateBucket
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
  normalizePlannerTryoutRecord,
  normalizePlannerProject,
  normalizePlannerTeam
} from "@/lib/services/planner-domain-mappers";

export const CHEER_PLANNER_TRYOUTS_STORAGE_KEY = "cp-cheer-planner-tryouts";
export const CHEER_PLANNER_REMOTE_MIGRATION_VERSION = "v1";

function buildTemplateSkillId(prefix: string, index: number) {
  return `${prefix}-${index + 1}`;
}

function buildTemplateBucket(
  key: string,
  label: string,
  kind: PlannerTryoutTemplateBucket["kind"],
  skillNames: string[],
  options?: {
    allowsExtra?: boolean;
    levelKey?: PlannerLevelKey | null;
    levelLabel?: PlannerLevelLabel | null;
  }
): PlannerTryoutTemplateBucket {
  return {
    id: `${kind}-${key}`,
    key,
    label,
    kind,
    skills: skillNames.map((name, index) => ({
      id: buildTemplateSkillId(`${kind}-${key}-skill`, index),
      name
    })),
    allowsExtra: options?.allowsExtra ?? false,
    levelKey: options?.levelKey ?? null,
    levelLabel: options?.levelLabel ?? null
  };
}

function cloneTemplateBucket(bucket: PlannerTryoutTemplateBucket): PlannerTryoutTemplateBucket {
  return {
    ...bucket,
    skills: bucket.skills.map((skill) => ({ ...skill }))
  };
}

const defaultTryoutOptions: PlannerTryoutOption[] = [
  { id: "does-it", label: "Attempted", value: 1 },
  { id: "needs-work", label: "Needs some work", value: 1.7 },
  { id: "ready-to-compete", label: "Ready to compete", value: 2 }
];

export const defaultTumblingTemplate: PlannerTryoutTemplate = {
  id: "default-tryouts-template:tumbling",
  name: "Default tumbling template",
  stage: "tryouts",
  sport: "tumbling",
  mode: "levels",
  options: defaultTryoutOptions.map((option) => ({ ...option })),
  buckets: [
    buildTemplateBucket("beginner", "Beginner", "level", ["Forward Roll", "Handstand", "Bridge"], { allowsExtra: true, levelKey: "beginner", levelLabel: "Beginner" }),
    buildTemplateBucket("1", "Level 1", "level", ["Forward Roll", "Cartwheel", "Back Walkover"], { allowsExtra: true, levelKey: "1", levelLabel: "Level 1" }),
    buildTemplateBucket("2", "Level 2", "level", ["Round Off", "Back Handspring", "Front Walkover"], { allowsExtra: true, levelKey: "2", levelLabel: "Level 2" }),
    buildTemplateBucket("3", "Level 3", "level", ["Round Off Back Handspring", "Standing Back Handspring", "Front Handspring"], { allowsExtra: true, levelKey: "3", levelLabel: "Level 3" }),
    buildTemplateBucket("4", "Level 4", "level", ["Tuck", "Round Off Back Handspring Tuck", "Standing Tuck"], { allowsExtra: true, levelKey: "4", levelLabel: "Level 4" }),
    buildTemplateBucket("5", "Level 5", "level", ["Layouts", "Full Twisting Layout", "Jump to Back Handspring"], { allowsExtra: true, levelKey: "5", levelLabel: "Level 5" }),
    buildTemplateBucket("6", "Level 6", "level", ["Double Full", "Arabian", "Specialty Pass"], { allowsExtra: true, levelKey: "6", levelLabel: "Level 6" }),
    buildTemplateBucket("7", "Level 7", "level", ["Double Full to Double", "Whip to Double", "Elite Specialty Pass"], { allowsExtra: true, levelKey: "7", levelLabel: "Level 7" })
  ],
  updatedAt: new Date("2026-03-17T00:00:00.000Z").toISOString(),
  activeSport: "tumbling"
};

export const defaultStuntsTemplate: PlannerTryoutTemplate = {
  id: "default-tryouts-template:stunts",
  name: "Default stunts template",
  stage: "tryouts",
  sport: "stunts",
  mode: "levels",
  options: defaultTryoutOptions.map((option) => ({ ...option })),
  buckets: [
    buildTemplateBucket("1", "Level 1", "level", ["Prep", "Thigh Stand", "Lib Prep"], { allowsExtra: true, levelKey: "1", levelLabel: "Level 1" }),
    buildTemplateBucket("2", "Level 2", "level", ["Extension Prep", "Single Leg Prep", "Cradle"], { allowsExtra: true, levelKey: "2", levelLabel: "Level 2" }),
    buildTemplateBucket("3", "Level 3", "level", ["Extension", "Liberty", "Tick Tock Prep"], { allowsExtra: true, levelKey: "3", levelLabel: "Level 3" }),
    buildTemplateBucket("4", "Level 4", "level", ["Full Up", "Inversion", "Double Down"], { allowsExtra: true, levelKey: "4", levelLabel: "Level 4" }),
    buildTemplateBucket("5", "Level 5", "level", ["Rewind", "Release to Cradle", "1.5 Twist Dismount"], { allowsExtra: true, levelKey: "5", levelLabel: "Level 5" }),
    buildTemplateBucket("6", "Level 6", "level", ["Tick Tock", "Release to Extended Position", "Upside Down to Hand in Hand"], { allowsExtra: true, levelKey: "6", levelLabel: "Level 6" }),
    buildTemplateBucket("7", "Level 7", "level", ["Elite Inversion", "Release Transition", "Specialty Dismount"], { allowsExtra: true, levelKey: "7", levelLabel: "Level 7" })
  ],
  updatedAt: new Date("2026-03-17T00:00:00.000Z").toISOString(),
  activeSport: "stunts"
};

export const defaultJumpsTemplate: PlannerTryoutTemplate = {
  id: "default-tryouts-template:jumps",
  name: "Default jumps template",
  stage: "tryouts",
  sport: "jumps",
  mode: "groups",
  options: defaultTryoutOptions.map((option) => ({ ...option })),
  buckets: [
    buildTemplateBucket("basic", "Basic", "group", ["T Jump", "Toe Touch", "Pike"]),
    buildTemplateBucket("advanced", "Advanced", "group", ["Herkie", "Triple Jump Sequence", "Specialty Jump"])
  ],
  updatedAt: new Date("2026-03-17T00:00:00.000Z").toISOString(),
  activeSport: "jumps"
};

export const defaultDanceTemplate: PlannerTryoutTemplate = {
  id: "default-tryouts-template:dance",
  name: "Default dance template",
  stage: "tryouts",
  sport: "dance",
  mode: "items",
  options: defaultTryoutOptions.map((option) => ({ ...option })),
  buckets: [
    buildTemplateBucket("motions", "Motions", "item", ["Motions"]),
    buildTemplateBucket("showmanship", "Showmanship", "item", ["Showmanship"]),
    buildTemplateBucket("timing", "Timing", "item", ["Timing"]),
    buildTemplateBucket("coordination", "Coordination", "item", ["Coordination"])
  ],
  updatedAt: new Date("2026-03-17T00:00:00.000Z").toISOString(),
  activeSport: "dance"
};

export const defaultTryoutTemplates: Record<PlannerSportKey, PlannerTryoutTemplate> = {
  tumbling: defaultTumblingTemplate,
  stunts: defaultStuntsTemplate,
  jumps: defaultJumpsTemplate,
  dance: defaultDanceTemplate
};

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
  PlannerTryoutBucketEvaluation,
  PlannerTryoutRecord,
  PlannerTryoutOption,
  PlannerTemplateSkill,
  PlannerTryoutSummary,
  PlannerTryoutTemplate
};

export const defaultTryoutTemplate: PlannerTryoutTemplate = defaultTumblingTemplate;

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
  tryoutTemplates: Object.fromEntries(
    Object.entries(defaultTryoutTemplates).map(([sport, template]) => [sport, cloneTemplate(template)])
  ) as Record<PlannerSportKey, PlannerTryoutTemplate>,
  athletes: [],
  tryoutRecords: [],
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
    buckets: template.buckets.map(cloneTemplateBucket)
  };
}

export function cloneTryoutTemplates(templates: Record<PlannerSportKey, PlannerTryoutTemplate>) {
  return Object.fromEntries(
    Object.entries(templates).map(([sport, template]) => [sport, cloneTemplate(template)])
  ) as Record<PlannerSportKey, PlannerTryoutTemplate>;
}

export function cloneAthlete(athlete: AthleteRecord): AthleteRecord {
  return normalizePlannerAthlete(athlete);
}

export function cloneTryoutRecord(tryoutRecord: PlannerTryoutRecord): PlannerTryoutRecord {
  return normalizePlannerTryoutRecord(tryoutRecord);
}

export function cloneTeam(team: PlannerTeamRecord): PlannerTeamRecord {
  return normalizePlannerTeam(team);
}

export function cloneCheerPlannerState(state: CheerPlannerState): CheerPlannerState {
  return normalizePlannerProject(state, defaultTryoutTemplate, defaultQualificationRules, defaultTryoutTemplates);
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
    return normalizePlannerProject(parsed, defaultTryoutTemplate, defaultQualificationRules, defaultTryoutTemplates);
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
