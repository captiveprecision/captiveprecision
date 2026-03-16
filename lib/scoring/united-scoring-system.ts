export type ScoringSection = {
  id: string;
  name: string;
  maxPoints: number;
};

export type ScoresheetDefinition = {
  id: string;
  label: string;
  calculatorLabel: string;
  calculatorShortLabel: string;
  status: string;
  season: string;
  comments: string;
  sections: ScoringSection[];
};

export type UnitedScoringSystemConfig = {
  systemName: string;
  systemSlug: string;
  activeScoresheetId: string;
  scoresheets: ScoresheetDefinition[];
};

export const UNITED_SCORING_SYSTEM_STORAGE_KEY = "cp-united-scoring-system";

export const defaultUnitedScoringSystemConfig: UnitedScoringSystemConfig = {
  systemName: "United Scoring System",
  systemSlug: "united-scoring-system",
  activeScoresheetId: "uss-elite-level-1",
  scoresheets: [
    {
      id: "uss-elite-level-1",
      label: "United Scoring System / Elite Level 1",
      calculatorLabel: "Elite Lvl 1",
      calculatorShortLabel: "L1",
      status: "Active",
      season: "2025",
      comments: "Current baseline used by the Cheer Score Calculator for elite level 1 routines.",
      sections: [
        { id: "stunt", name: "Stunt", maxPoints: 8.5 },
        { id: "stunt-dod", name: "Stunt Degree of Difficulty Driver", maxPoints: 0.8 },
        { id: "stunt-participation", name: "Stunt Max Participation Driver", maxPoints: 0.7 },
        { id: "pyramid", name: "Pyramid", maxPoints: 8 },
        { id: "standing-tumbling", name: "Standing Tumbling", maxPoints: 7 },
        { id: "standing-tumbling-dod", name: "Standing Tumbling Degree of Difficulty", maxPoints: 1 },
        { id: "running-tumbling", name: "Running Tumbling", maxPoints: 7 },
        { id: "running-tumbling-dod", name: "Running Tumbling Degree of Difficulty", maxPoints: 0.5 },
        { id: "running-tumbling-participation", name: "Running Tumbling Max Participation", maxPoints: 0.5 },
        { id: "jumps", name: "Jumps", maxPoints: 4 },
        { id: "routine-creativity", name: "Routine Creativity", maxPoints: 2 },
        { id: "formations-transitions", name: "Formations & Transitions", maxPoints: 2 },
        { id: "dance", name: "Dance", maxPoints: 2 },
        { id: "showmanship", name: "Showmanship", maxPoints: 2 }
      ]
    },
    {
      id: "uss-elite-level-2-7",
      label: "United Scoring System / Elite Level 2 - 7",
      calculatorLabel: "Elite Lvl 2-7",
      calculatorShortLabel: "L2-7",
      status: "Active",
      season: "2025",
      comments: "Current baseline used by the Cheer Score Calculator for elite levels 2 through 7.",
      sections: [
        { id: "stunt", name: "Stunt", maxPoints: 8.5 },
        { id: "stunt-dod", name: "Stunt Degree of Difficulty Driver", maxPoints: 0.8 },
        { id: "stunt-participation", name: "Stunt Max Participation Driver", maxPoints: 0.7 },
        { id: "pyramid", name: "Pyramid", maxPoints: 8 },
        { id: "standing-tumbling", name: "Standing Tumbling", maxPoints: 7 },
        { id: "standing-tumbling-dod", name: "Standing Tumbling Degree of Difficulty", maxPoints: 1 },
        { id: "running-tumbling", name: "Running Tumbling", maxPoints: 7 },
        { id: "running-tumbling-dod", name: "Running Tumbling Degree of Difficulty", maxPoints: 0.5 },
        { id: "running-tumbling-participation", name: "Running Tumbling Max Participation", maxPoints: 0.5 },
        { id: "jumps", name: "Jumps", maxPoints: 4 },
        { id: "tosses", name: "Tosses", maxPoints: 4 },
        { id: "routine-creativity", name: "Routine Creativity", maxPoints: 2 },
        { id: "formations-transitions", name: "Formations & Transitions", maxPoints: 2 },
        { id: "dance", name: "Dance", maxPoints: 2 },
        { id: "showmanship", name: "Showmanship", maxPoints: 2 }
      ]
    }
  ]
};

export function cloneScoringConfig(config: UnitedScoringSystemConfig) {
  return {
    ...config,
    scoresheets: config.scoresheets.map((scoresheet) => ({
      ...scoresheet,
      sections: scoresheet.sections.map((section) => ({ ...section }))
    }))
  };
}

export function getScoresheetById(config: UnitedScoringSystemConfig, scoresheetId: string) {
  return config.scoresheets.find((scoresheet) => scoresheet.id === scoresheetId) ?? config.scoresheets[0];
}
