export type ScoringSection = {
  id: string;
  name: string;
  maxPoints: number;
};

export type ScoringSystemVersion = {
  id: string;
  label: string;
  season: string;
  status: string;
  comments: string;
  sections: ScoringSection[];
};

export type ScoringSystem = {
  id: string;
  name: string;
  slug: string;
  activeVersionId: string;
  versions: ScoringSystemVersion[];
};

export type ScoringSystemsConfig = {
  activeSystemId: string;
  systems: ScoringSystem[];
};

export const SCORING_SYSTEMS_STORAGE_KEY = "cp-scoring-systems";

const unitedSections: ScoringSection[] = [
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
];

const iasfSections: ScoringSection[] = [
  { id: "building", name: "Building", maxPoints: 16 },
  { id: "tumbling", name: "Tumbling", maxPoints: 16 },
  { id: "overall", name: "Overall", maxPoints: 10 },
  { id: "execution", name: "Execution", maxPoints: 8 }
];

function cloneSections(sections: ScoringSection[]) {
  return sections.map((section) => ({ ...section }));
}

export const defaultScoringSystemsConfig: ScoringSystemsConfig = {
  activeSystemId: "united-scoring-system",
  systems: [
    {
      id: "united-scoring-system",
      name: "United Scoring System",
      slug: "united-scoring-system",
      activeVersionId: "uss-2025-2026",
      versions: [
        {
          id: "uss-2024-2025",
          label: "2024-2025",
          season: "2024-2025",
          status: "Archived",
          comments: "Archived United scoring version kept as reference.",
          sections: cloneSections(unitedSections)
        },
        {
          id: "uss-2025-2026",
          label: "2025-2026",
          season: "2025-2026",
          status: "Active",
          comments: "Current active United scoring version used by the Cheer Score Calculator.",
          sections: cloneSections(unitedSections)
        },
        {
          id: "uss-2026-2027",
          label: "2026-2027",
          season: "2026-2027",
          status: "Draft",
          comments: "Next United scoring version being prepared for release.",
          sections: cloneSections(unitedSections)
        }
      ]
    },
    {
      id: "iasf",
      name: "IASF",
      slug: "iasf",
      activeVersionId: "iasf-2025-2026",
      versions: [
        {
          id: "iasf-2025-2026",
          label: "2025-2026",
          season: "2025-2026",
          status: "Draft",
          comments: "Initial local placeholder for future IASF-based evaluations.",
          sections: cloneSections(iasfSections)
        }
      ]
    }
  ]
};

export function cloneScoringSystemsConfig(config: ScoringSystemsConfig) {
  return {
    ...config,
    systems: config.systems.map((system) => ({
      ...system,
      versions: system.versions.map((version) => ({
        ...version,
        sections: version.sections.map((section) => ({ ...section }))
      }))
    }))
  };
}

export function getSystemById(config: ScoringSystemsConfig, systemId: string) {
  return config.systems.find((system) => system.id === systemId) ?? config.systems[0];
}

export function getVersionById(system: ScoringSystem, versionId: string) {
  return system.versions.find((version) => version.id === versionId) ?? system.versions[0];
}
