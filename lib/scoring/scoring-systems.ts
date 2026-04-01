import type { ScoringSystemSection as ScoringSection, ScoringSystem, ScoringSystemsConfig, ScoringSystemVersion } from "@/lib/domain/scoring-system";

export type { ScoringSection, ScoringSystem, ScoringSystemsConfig, ScoringSystemVersion };

export const SCORING_SYSTEMS_STORAGE_KEY = "cp-scoring-systems";

const DEFAULT_TIMESTAMP = new Date("2026-03-17T00:00:00.000Z").toISOString();

const unitedSections: ScoringSection[] = [
  { id: "stunt", key: "stunt", name: "Stunt", maxPoints: 8.5, guidance: null, sortOrder: 1, createdAt: DEFAULT_TIMESTAMP, updatedAt: DEFAULT_TIMESTAMP },
  { id: "stunt-dod", key: "stunt-dod", name: "Stunt Degree of Difficulty Driver", maxPoints: 0.8, guidance: null, sortOrder: 2, createdAt: DEFAULT_TIMESTAMP, updatedAt: DEFAULT_TIMESTAMP },
  { id: "stunt-participation", key: "stunt-participation", name: "Stunt Max Participation Driver", maxPoints: 0.7, guidance: null, sortOrder: 3, createdAt: DEFAULT_TIMESTAMP, updatedAt: DEFAULT_TIMESTAMP },
  { id: "pyramid", key: "pyramid", name: "Pyramid", maxPoints: 8, guidance: null, sortOrder: 4, createdAt: DEFAULT_TIMESTAMP, updatedAt: DEFAULT_TIMESTAMP },
  { id: "standing-tumbling", key: "standing-tumbling", name: "Standing Tumbling", maxPoints: 7, guidance: null, sortOrder: 5, createdAt: DEFAULT_TIMESTAMP, updatedAt: DEFAULT_TIMESTAMP },
  { id: "standing-tumbling-dod", key: "standing-tumbling-dod", name: "Standing Tumbling Degree of Difficulty", maxPoints: 1, guidance: null, sortOrder: 6, createdAt: DEFAULT_TIMESTAMP, updatedAt: DEFAULT_TIMESTAMP },
  { id: "running-tumbling", key: "running-tumbling", name: "Running Tumbling", maxPoints: 7, guidance: null, sortOrder: 7, createdAt: DEFAULT_TIMESTAMP, updatedAt: DEFAULT_TIMESTAMP },
  { id: "running-tumbling-dod", key: "running-tumbling-dod", name: "Running Tumbling Degree of Difficulty", maxPoints: 0.5, guidance: null, sortOrder: 8, createdAt: DEFAULT_TIMESTAMP, updatedAt: DEFAULT_TIMESTAMP },
  { id: "running-tumbling-participation", key: "running-tumbling-participation", name: "Running Tumbling Max Participation", maxPoints: 0.5, guidance: null, sortOrder: 9, createdAt: DEFAULT_TIMESTAMP, updatedAt: DEFAULT_TIMESTAMP },
  { id: "jumps", key: "jumps", name: "Jumps", maxPoints: 4, guidance: null, sortOrder: 10, createdAt: DEFAULT_TIMESTAMP, updatedAt: DEFAULT_TIMESTAMP },
  { id: "tosses", key: "tosses", name: "Tosses", maxPoints: 4, guidance: null, sortOrder: 11, createdAt: DEFAULT_TIMESTAMP, updatedAt: DEFAULT_TIMESTAMP },
  { id: "routine-creativity", key: "routine-creativity", name: "Routine Creativity", maxPoints: 2, guidance: null, sortOrder: 12, createdAt: DEFAULT_TIMESTAMP, updatedAt: DEFAULT_TIMESTAMP },
  { id: "formations-transitions", key: "formations-transitions", name: "Formations & Transitions", maxPoints: 2, guidance: null, sortOrder: 13, createdAt: DEFAULT_TIMESTAMP, updatedAt: DEFAULT_TIMESTAMP },
  { id: "dance", key: "dance", name: "Dance", maxPoints: 2, guidance: null, sortOrder: 14, createdAt: DEFAULT_TIMESTAMP, updatedAt: DEFAULT_TIMESTAMP },
  { id: "showmanship", key: "showmanship", name: "Showmanship", maxPoints: 2, guidance: null, sortOrder: 15, createdAt: DEFAULT_TIMESTAMP, updatedAt: DEFAULT_TIMESTAMP }
];

const iasfSections: ScoringSection[] = [
  { id: "building", key: "building", name: "Building", maxPoints: 16, guidance: null, sortOrder: 1, createdAt: DEFAULT_TIMESTAMP, updatedAt: DEFAULT_TIMESTAMP },
  { id: "tumbling", key: "tumbling", name: "Tumbling", maxPoints: 16, guidance: null, sortOrder: 2, createdAt: DEFAULT_TIMESTAMP, updatedAt: DEFAULT_TIMESTAMP },
  { id: "overall", key: "overall", name: "Overall", maxPoints: 10, guidance: null, sortOrder: 3, createdAt: DEFAULT_TIMESTAMP, updatedAt: DEFAULT_TIMESTAMP },
  { id: "execution", key: "execution", name: "Execution", maxPoints: 8, guidance: null, sortOrder: 4, createdAt: DEFAULT_TIMESTAMP, updatedAt: DEFAULT_TIMESTAMP }
];

function normalizeStatus(status: string | undefined | null) {
  switch ((status ?? "").toLowerCase()) {
    case "active":
      return "active" as const;
    case "archived":
      return "archived" as const;
    default:
      return "draft" as const;
  }
}

function cloneSections(sections: ScoringSection[]) {
  return sections.map((section, index) => ({
    ...section,
    key: section.key ?? section.id,
    guidance: section.guidance ?? null,
    sortOrder: section.sortOrder ?? index + 1,
    createdAt: section.createdAt ?? DEFAULT_TIMESTAMP,
    updatedAt: section.updatedAt ?? section.createdAt ?? DEFAULT_TIMESTAMP
  }));
}

function normalizeVersion(version: ScoringSystemVersion, activeVersionId: string): ScoringSystemVersion {
  const createdAt = version.createdAt ?? DEFAULT_TIMESTAMP;
  const season = version.season ?? version.seasonLabel ?? version.label;

  return {
    ...version,
    season,
    seasonLabel: version.seasonLabel ?? season,
    status: normalizeStatus(version.status),
    comments: version.comments ?? "",
    isActive: version.isActive ?? version.id === activeVersionId,
    createdAt,
    updatedAt: version.updatedAt ?? createdAt,
    sections: cloneSections(version.sections)
  };
}

function normalizeSystem(system: ScoringSystem): ScoringSystem {
  const createdAt = system.createdAt ?? DEFAULT_TIMESTAMP;
  const versions = system.versions.map((version) => normalizeVersion(version, system.activeVersionId));

  return {
    ...system,
    slug: system.slug ?? system.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
    status: normalizeStatus(system.status),
    createdAt,
    updatedAt: system.updatedAt ?? createdAt,
    versions
  };
}

export const defaultScoringSystemsConfig: ScoringSystemsConfig = {
  activeSystemId: "united-scoring-system",
  systems: [
    {
      id: "united-scoring-system",
      name: "United Scoring System",
      slug: "united-scoring-system",
      status: "active",
      activeVersionId: "uss-2025-2026",
      createdAt: DEFAULT_TIMESTAMP,
      updatedAt: DEFAULT_TIMESTAMP,
      versions: [
        {
          id: "uss-2024-2025",
          label: "2024-2025",
          season: "2024-2025",
          seasonLabel: "2024-2025",
          status: "archived",
          comments: "Archived United scoring version kept as reference.",
          isActive: false,
          createdAt: DEFAULT_TIMESTAMP,
          updatedAt: DEFAULT_TIMESTAMP,
          sections: cloneSections(unitedSections)
        },
        {
          id: "uss-2025-2026",
          label: "2025-2026",
          season: "2025-2026",
          seasonLabel: "2025-2026",
          status: "active",
          comments: "Current active United scoring version used by the Cheer Score Calculator.",
          isActive: true,
          createdAt: DEFAULT_TIMESTAMP,
          updatedAt: DEFAULT_TIMESTAMP,
          sections: cloneSections(unitedSections)
        },
        {
          id: "uss-2026-2027",
          label: "2026-2027",
          season: "2026-2027",
          seasonLabel: "2026-2027",
          status: "draft",
          comments: "Next United scoring version being prepared for release.",
          isActive: false,
          createdAt: DEFAULT_TIMESTAMP,
          updatedAt: DEFAULT_TIMESTAMP,
          sections: cloneSections(unitedSections)
        }
      ]
    },
    {
      id: "iasf",
      name: "IASF",
      slug: "iasf",
      status: "draft",
      activeVersionId: "iasf-2025-2026",
      createdAt: DEFAULT_TIMESTAMP,
      updatedAt: DEFAULT_TIMESTAMP,
      versions: [
        {
          id: "iasf-2025-2026",
          label: "2025-2026",
          season: "2025-2026",
          seasonLabel: "2025-2026",
          status: "draft",
          comments: "Initial local placeholder for future IASF-based evaluations.",
          isActive: true,
          createdAt: DEFAULT_TIMESTAMP,
          updatedAt: DEFAULT_TIMESTAMP,
          sections: cloneSections(iasfSections)
        }
      ]
    }
  ]
};

export function cloneScoringSystemsConfig(config: ScoringSystemsConfig) {
  const systems = config.systems.map((system) => normalizeSystem(system));
  const activeSystemId = systems.some((system) => system.id === config.activeSystemId)
    ? config.activeSystemId
    : systems[0]?.id ?? "";

  return {
    activeSystemId,
    systems
  };
}

export function getSystemById(config: ScoringSystemsConfig, systemId: string) {
  return config.systems.find((system) => system.id === systemId) ?? config.systems[0];
}

export function getVersionById(system: ScoringSystem, versionId: string) {
  return system.versions.find((version) => version.id === versionId) ?? system.versions[0];
}
