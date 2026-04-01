export const LEVEL_KEYS = ["beginner", "1", "2", "3", "4", "5", "6", "7"] as const;
export type PlannerLevelKey = (typeof LEVEL_KEYS)[number];

export type PlannerSportKey = "tumbling" | "dance" | "jumps" | "stunts";
export type PlannerLevelLabel = "Beginner" | "Level 1" | "Level 2" | "Level 3" | "Level 4" | "Level 5" | "Level 6" | "Level 7";
export type PlannerQualifiedLevel = PlannerLevelLabel | "Unqualified";
export type PlannerPipelineStage = "tryouts" | "team-builder" | "skill-planner" | "routine-builder" | "season-planner" | "my-teams";

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
