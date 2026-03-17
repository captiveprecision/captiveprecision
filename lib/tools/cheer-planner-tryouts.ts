export const CHEER_PLANNER_TRYOUTS_STORAGE_KEY = "cp-cheer-planner-tryouts";

export const LEVEL_KEYS = ["beginner", "1", "2", "3", "4", "5", "6", "7"] as const;
export type PlannerLevelKey = (typeof LEVEL_KEYS)[number];
export type PlannerSportKey = "tumbling" | "dance" | "jumps" | "stunts";

export type PlannerTryoutOption = {
  id: string;
  label: string;
  value: number;
};

export type PlannerTryoutTemplate = {
  id: string;
  name: string;
  stage: "tryouts";
  activeSport: PlannerSportKey;
  options: PlannerTryoutOption[];
  defaultSkillCounts: Record<PlannerLevelKey, number>;
  updatedAt: string;
};

export type PlannerSkillEvaluation = {
  id: string;
  name: string;
  optionId: string | null;
  isExtra: boolean;
};

export type PlannerLevelEvaluation = {
  levelKey: PlannerLevelKey;
  skills: PlannerSkillEvaluation[];
};

export type PlannerAthleteProfile = {
  name: string;
  dateOfBirth: string;
  teamName: string;
  athleteNotes: string;
};

export type PlannerTopLevel = {
  levelKey: PlannerLevelKey;
  levelLabel: string;
  baseScore: number;
  extraScore: number;
};

export type PlannerTryoutSummary = {
  totalBaseScore: number;
  totalExtraScore: number;
  levelScores: PlannerTopLevel[];
  topLevels: PlannerTopLevel[];
};

export type PlannerTryoutEvaluation = {
  id: string;
  plannerStage: "tryouts";
  sport: PlannerSportKey;
  athlete: PlannerAthleteProfile;
  templateId: string;
  templateName: string;
  templateUpdatedAt: string;
  evaluations: PlannerLevelEvaluation[];
  summary: PlannerTryoutSummary;
  savedAt: string;
};

export type CheerPlannerTryoutsState = {
  template: PlannerTryoutTemplate;
  evaluations: PlannerTryoutEvaluation[];
};

export const levelLabels: Record<PlannerLevelKey, string> = {
  beginner: "Beginner",
  "1": "Level 1",
  "2": "Level 2",
  "3": "Level 3",
  "4": "Level 4",
  "5": "Level 5",
  "6": "Level 6",
  "7": "Level 7"
};

export const defaultSkillLibrary: Record<PlannerLevelKey, string[]> = {
  beginner: ["Forward Roll", "Handstand", "Bridge"],
  "1": ["Forward Roll", "Cartwheel", "Back Walkover"],
  "2": ["Round Off", "Back Handspring", "Front Walkover"],
  "3": ["Round Off Back Handspring", "Standing Back Handspring", "Front Handspring"],
  "4": ["Tuck", "Round Off Back Handspring Tuck", "Standing Tuck"],
  "5": ["Layouts", "Full Twisting Layout", "Jump to Back Handspring"],
  "6": ["Double Full", "Arabian", "Specialty Pass"],
  "7": ["Double Full to Double", "Whip to Double", "Elite Specialty Pass"]
};

export const defaultTryoutTemplate: PlannerTryoutTemplate = {
  id: "default-tryouts-template",
  name: "Default tryout template",
  stage: "tryouts",
  activeSport: "tumbling",
  options: [
    { id: "does-it", label: "Does it", value: 1 },
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
  updatedAt: new Date("2026-03-17T00:00:00.000Z").toISOString()
};

export const defaultTryoutState: CheerPlannerTryoutsState = {
  template: defaultTryoutTemplate,
  evaluations: []
};

export function cloneTemplate(template: PlannerTryoutTemplate): PlannerTryoutTemplate {
  return {
    ...template,
    options: template.options.map((option) => ({ ...option })),
    defaultSkillCounts: { ...template.defaultSkillCounts }
  };
}

export function cloneEvaluation(evaluation: PlannerTryoutEvaluation): PlannerTryoutEvaluation {
  return {
    ...evaluation,
    athlete: { ...evaluation.athlete },
    evaluations: evaluation.evaluations.map((level) => ({
      ...level,
      skills: level.skills.map((skill) => ({ ...skill }))
    })),
    summary: {
      ...evaluation.summary,
      levelScores: evaluation.summary.levelScores.map((item) => ({ ...item })),
      topLevels: evaluation.summary.topLevels.map((item) => ({ ...item }))
    }
  };
}

export function cloneTryoutState(state: CheerPlannerTryoutsState): CheerPlannerTryoutsState {
  return {
    template: cloneTemplate(state.template),
    evaluations: state.evaluations.map(cloneEvaluation)
  };
}

export function readCheerPlannerTryoutsState(): CheerPlannerTryoutsState {
  if (typeof window === "undefined") {
    return cloneTryoutState(defaultTryoutState);
  }

  try {
    const raw = window.localStorage.getItem(CHEER_PLANNER_TRYOUTS_STORAGE_KEY);

    if (!raw) {
      return cloneTryoutState(defaultTryoutState);
    }

    const parsed = JSON.parse(raw) as Partial<CheerPlannerTryoutsState>;

    return {
      template: parsed.template ? cloneTemplate({ ...defaultTryoutTemplate, ...parsed.template }) : cloneTemplate(defaultTryoutTemplate),
      evaluations: Array.isArray(parsed.evaluations) ? parsed.evaluations.map(cloneEvaluation) : []
    };
  } catch {
    return cloneTryoutState(defaultTryoutState);
  }
}

export function writeCheerPlannerTryoutsState(state: CheerPlannerTryoutsState) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(CHEER_PLANNER_TRYOUTS_STORAGE_KEY, JSON.stringify(state));
}