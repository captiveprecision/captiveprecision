export const CHEER_PLANNER_TRYOUTS_STORAGE_KEY = "cp-cheer-planner-tryouts";

export const LEVEL_KEYS = ["beginner", "1", "2", "3", "4", "5", "6", "7"] as const;
export type PlannerLevelKey = (typeof LEVEL_KEYS)[number];
export type PlannerSportKey = "tumbling" | "dance" | "jumps" | "stunts";
export type PlannerLevelLabel = "Beginner" | "Level 1" | "Level 2" | "Level 3" | "Level 4" | "Level 5" | "Level 6" | "Level 7";

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

export type PlannerAthleteRecord = {
  registrationNumber: string;
  name: string;
  dateOfBirth: string;
  sourceTeamName: string;
  athleteNotes: string;
  createdAt: string;
  updatedAt: string;
};

export type PlannerAthleteSnapshot = {
  registrationNumber: string;
  name: string;
  dateOfBirth: string;
  evaluationTeamName: string;
  athleteNotes: string;
};

export type PlannerQualifiedLevel = PlannerLevelLabel | "Unqualified";

export type PlannerTopLevel = {
  levelKey: PlannerLevelKey;
  levelLabel: PlannerLevelLabel;
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
  athleteRegistrationNumber: string;
  athleteSnapshot: PlannerAthleteSnapshot;
  templateId: string;
  templateName: string;
  templateUpdatedAt: string;
  evaluations: PlannerLevelEvaluation[];
  summary: PlannerTryoutSummary;
  savedAt: string;
};

export type PlannerQualificationRules = Record<PlannerLevelLabel, number>;

export type PlannerTeamRecord = {
  id: string;
  name: string;
  teamLevel: PlannerLevelLabel;
  teamType: string;
  memberRegistrationNumbers: string[];
  createdAt: string;
  updatedAt: string;
};

export type CheerPlannerState = {
  template: PlannerTryoutTemplate;
  athletes: PlannerAthleteRecord[];
  evaluations: PlannerTryoutEvaluation[];
  teams: PlannerTeamRecord[];
  qualificationRules: PlannerQualificationRules;
};

export const levelLabels: Record<PlannerLevelKey, PlannerLevelLabel> = {
  beginner: "Beginner",
  "1": "Level 1",
  "2": "Level 2",
  "3": "Level 3",
  "4": "Level 4",
  "5": "Level 5",
  "6": "Level 6",
  "7": "Level 7"
};

export const LEVEL_LABELS = LEVEL_KEYS.map((levelKey) => levelLabels[levelKey]);

export const LEVEL_RANKS: Record<PlannerLevelLabel, number> = {
  "Beginner": 0,
  "Level 1": 1,
  "Level 2": 2,
  "Level 3": 3,
  "Level 4": 4,
  "Level 5": 5,
  "Level 6": 6,
  "Level 7": 7
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

export const defaultCheerPlannerState: CheerPlannerState = {
  template: defaultTryoutTemplate,
  athletes: [],
  evaluations: [],
  teams: [],
  qualificationRules: defaultQualificationRules
};

export function cloneTemplate(template: PlannerTryoutTemplate): PlannerTryoutTemplate {
  return {
    ...template,
    options: template.options.map((option) => ({ ...option })),
    defaultSkillCounts: { ...template.defaultSkillCounts }
  };
}

export function cloneAthlete(athlete: PlannerAthleteRecord): PlannerAthleteRecord {
  return { ...athlete };
}

export function normalizeAthleteSnapshot(snapshot: PlannerAthleteSnapshot & { teamName?: string }): PlannerAthleteSnapshot {
  return {
    registrationNumber: snapshot.registrationNumber,
    name: snapshot.name,
    dateOfBirth: snapshot.dateOfBirth,
    evaluationTeamName: snapshot.evaluationTeamName ?? snapshot.teamName ?? "",
    athleteNotes: snapshot.athleteNotes
  };
}

export function cloneEvaluation(evaluation: PlannerTryoutEvaluation): PlannerTryoutEvaluation {
  return {
    ...evaluation,
    athleteSnapshot: normalizeAthleteSnapshot(evaluation.athleteSnapshot as PlannerAthleteSnapshot & { teamName?: string }),
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

export function cloneTeam(team: PlannerTeamRecord): PlannerTeamRecord {
  return {
    ...team,
    memberRegistrationNumbers: [...team.memberRegistrationNumbers]
  };
}

export function cloneCheerPlannerState(state: CheerPlannerState): CheerPlannerState {
  return {
    template: cloneTemplate(state.template),
    athletes: state.athletes.map(cloneAthlete),
    evaluations: state.evaluations.map(cloneEvaluation),
    teams: state.teams.map(cloneTeam),
    qualificationRules: { ...state.qualificationRules }
  };
}

export function getPlannerLevelRank(level: PlannerLevelLabel) {
  return LEVEL_RANKS[level];
}

export function getHighestQualifiedLevelFromEvaluation(
  evaluation: PlannerTryoutEvaluation | null,
  qualificationRules: PlannerQualificationRules
): PlannerQualifiedLevel {
  if (!evaluation) {
    return "Unqualified";
  }

  const qualified = LEVEL_LABELS.filter((levelLabel) => {
    const levelScore = evaluation.summary.levelScores.find((item) => item.levelLabel === levelLabel);
    return levelScore ? levelScore.baseScore >= qualificationRules[levelLabel] : false;
  });

  return qualified.length ? qualified[qualified.length - 1] : "Unqualified";
}

export function canAssignQualifiedLevelToTeam(
  qualifiedLevel: PlannerQualifiedLevel,
  teamLevel: PlannerLevelLabel
) {
  if (qualifiedLevel === "Unqualified") {
    return false;
  }

  return getPlannerLevelRank(qualifiedLevel) >= getPlannerLevelRank(teamLevel);
}

export function getNextRegistrationNumber(athletes: PlannerAthleteRecord[]) {
  const maxValue = athletes.reduce((currentMax, athlete) => {
    const parsed = Number(athlete.registrationNumber.replace(/[^\d]/g, ""));
    return Number.isFinite(parsed) ? Math.max(currentMax, parsed) : currentMax;
  }, 1000);

  return `CP-${String(maxValue + 1).padStart(4, "0")}`;
}

export function readCheerPlannerState(): CheerPlannerState {
  if (typeof window === "undefined") {
    return cloneCheerPlannerState(defaultCheerPlannerState);
  }

  try {
    const raw = window.localStorage.getItem(CHEER_PLANNER_TRYOUTS_STORAGE_KEY);

    if (!raw) {
      return cloneCheerPlannerState(defaultCheerPlannerState);
    }

    const parsed = JSON.parse(raw) as Partial<CheerPlannerState>;

    return {
      template: parsed.template ? cloneTemplate({ ...defaultTryoutTemplate, ...parsed.template }) : cloneTemplate(defaultTryoutTemplate),
      athletes: Array.isArray(parsed.athletes) ? parsed.athletes.map(cloneAthlete) : [],
      evaluations: Array.isArray(parsed.evaluations) ? parsed.evaluations.map(cloneEvaluation) : [],
      teams: Array.isArray(parsed.teams) ? parsed.teams.map(cloneTeam) : [],
      qualificationRules: parsed.qualificationRules ? { ...defaultQualificationRules, ...parsed.qualificationRules } : { ...defaultQualificationRules }
    };
  } catch {
    return cloneCheerPlannerState(defaultCheerPlannerState);
  }
}

export function writeCheerPlannerState(state: CheerPlannerState) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(CHEER_PLANNER_TRYOUTS_STORAGE_KEY, JSON.stringify(state));
}
