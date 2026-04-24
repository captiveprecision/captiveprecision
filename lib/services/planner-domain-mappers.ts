import type { AthleteRecord, AthleteSnapshot, AthleteParentContact } from "@/lib/domain/athlete";
import type {
  PlannerTryoutRawData,
  PlannerTryoutSummary,
  PlannerTryoutSummaryBucket,
  PlannerTopLevel,
  PlannerTryoutTemplate,
  PlannerTryoutTemplateBucket,
  TryoutRecord
} from "@/lib/domain/evaluation-record";
import { LEVEL_KEYS, type PlannerLevelKey, type PlannerLevelLabel, type PlannerQualifiedLevel } from "@/lib/domain/planner-levels";
import type { PlannerProject, PlannerQualificationRules } from "@/lib/domain/planner-project";
import { ROUTINE_BUILDER_COLUMN_COUNT, ROUTINE_BUILDER_DEFAULT_ROW_COUNT, type RoutineDocument, type TeamRoutineItem, type TeamRoutinePlacement, type TeamRoutinePlan } from "@/lib/domain/routine-plan";
import type { TeamSeasonCheckpoint, TeamSeasonPlan } from "@/lib/domain/season-plan";
import type { TeamSkillPlan, TeamSkillSelection } from "@/lib/domain/skill-plan";
import { buildDefaultTeamSelectionProfile, type TeamRecord, type TeamSelectionProfile } from "@/lib/domain/team";
import { cloneTemplate, cloneTryoutTemplates, defaultTryoutTemplates } from "@/lib/tools/cheer-planner-tryouts";
import {
  isAthleteRecord,
  isPlannerPipelineStage,
  isPlannerProject,
  isPlannerProjectStatus,
  isPlannerQualificationRules,
  isPlannerTryoutTemplate,
  isPlannerTryoutTemplates,
  isTeamRecord,
  isTeamRoutinePlan,
  isTeamSeasonPlan,
  isTeamSkillPlan,
  isTryoutRecord
} from "@/lib/validation/planner-domain";

const PROJECT_ID = "default-cheer-planner-project";
const PROJECT_NAME = "Cheer Planner";
const DEFAULT_WORKSPACE_ID = "local-workspace";
const DEFAULT_QUALIFICATION_RULES: PlannerQualificationRules = {
  "Beginner": 5,
  "Level 1": 5,
  "Level 2": 5,
  "Level 3": 5,
  "Level 4": 5,
  "Level 5": 5,
  "Level 6": 5,
  "Level 7": 5
};

function normalizeTemplateOptionLabel(option: PlannerTryoutTemplate["options"][number]) {
  return option.id === "does-it" ? { ...option, label: "Attempted" } : option;
}

function isValidIsoDateString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && !Number.isNaN(Date.parse(value));
}

function normalizeLegacyTemplateBuckets(
  template: Partial<PlannerTryoutTemplate> & Record<string, unknown>,
  fallbackTemplate: PlannerTryoutTemplate
) {
  const fallbackBucketByLevel = new Map(
    fallbackTemplate.buckets
      .filter((bucket) => bucket.levelKey)
      .map((bucket) => [bucket.levelKey as PlannerLevelKey, bucket] as const)
  );

  return LEVEL_KEYS.map((levelKey) => {
    const fallbackBucket = fallbackBucketByLevel.get(levelKey);
    const sourceSkills = Array.isArray(template.skillLibrary?.[levelKey])
      ? template.skillLibrary?.[levelKey]
      : fallbackBucket?.skills ?? [];

    return {
      id: fallbackBucket?.id ?? `level-${levelKey}`,
      key: levelKey,
      label: fallbackBucket?.label ?? levelKey,
      kind: "level" as const,
      skills: sourceSkills.map((skill, index) => ({
        id: skill.id ?? `${levelKey}-skill-${index + 1}`,
        name: skill.name ?? ""
      })),
      allowsExtra: true,
      levelKey,
      levelLabel: fallbackBucket?.levelLabel ?? null
    } satisfies PlannerTryoutTemplateBucket;
  });
}

function normalizeTemplateBuckets(
  buckets: unknown,
  fallbackTemplate: PlannerTryoutTemplate
) {
  if (!Array.isArray(buckets)) {
    return fallbackTemplate.buckets.map((bucket) => ({
      ...bucket,
      skills: bucket.skills.map((skill) => ({ ...skill }))
    }));
  }

  const fallbackBucketsByKey = new Map(fallbackTemplate.buckets.map((bucket) => [bucket.key, bucket] as const));

  return buckets.map((bucket, index) => {
    const raw = (bucket ?? {}) as Partial<PlannerTryoutTemplateBucket>;
    const fallbackBucket = (typeof raw.key === "string" ? fallbackBucketsByKey.get(raw.key) : null) ?? fallbackTemplate.buckets[index] ?? null;
    const sourceSkills = Array.isArray(raw.skills) ? raw.skills : fallbackBucket?.skills ?? [];

    return {
      id: raw.id ?? fallbackBucket?.id ?? `bucket-${index + 1}`,
      key: raw.key ?? fallbackBucket?.key ?? `bucket-${index + 1}`,
      label: raw.label ?? fallbackBucket?.label ?? `Bucket ${index + 1}`,
      kind: raw.kind ?? fallbackBucket?.kind ?? "group",
      skills: sourceSkills.map((skill, skillIndex) => ({
        id: skill.id ?? `${raw.key ?? fallbackBucket?.key ?? "bucket"}-skill-${skillIndex + 1}`,
        name: skill.name ?? ""
      })),
      allowsExtra: typeof raw.allowsExtra === "boolean" ? raw.allowsExtra : fallbackBucket?.allowsExtra ?? false,
      levelKey: raw.levelKey ?? fallbackBucket?.levelKey ?? null,
      levelLabel: raw.levelLabel ?? fallbackBucket?.levelLabel ?? null
    } satisfies PlannerTryoutTemplateBucket;
  });
}

function normalizePlannerTryoutTemplate(
  raw: Partial<PlannerTryoutTemplate> | undefined,
  fallbackTemplate: PlannerTryoutTemplate
): PlannerTryoutTemplate {
  const source = raw ?? {};

  return {
    id: source.id ?? fallbackTemplate.id,
    name: source.name ?? fallbackTemplate.name,
    stage: "tryouts",
    sport: source.sport ?? source.activeSport ?? fallbackTemplate.sport,
    mode: source.mode ?? fallbackTemplate.mode,
    options: (Array.isArray(source.options) ? source.options : fallbackTemplate.options).map((option) => normalizeTemplateOptionLabel({ ...option })),
    buckets: Array.isArray(source.buckets)
      ? normalizeTemplateBuckets(source.buckets, fallbackTemplate)
      : normalizeLegacyTemplateBuckets(source as Partial<PlannerTryoutTemplate> & Record<string, unknown>, fallbackTemplate),
    updatedAt: source.updatedAt ?? fallbackTemplate.updatedAt,
    activeSport: source.sport ?? source.activeSport ?? fallbackTemplate.sport
  };
}

function normalizePlannerTryoutTemplates(raw: unknown, fallbackTemplates: Record<PlannerTryoutTemplate["sport"], PlannerTryoutTemplate>) {
  const source = raw && typeof raw === "object" ? raw as Partial<Record<PlannerTryoutTemplate["sport"], Partial<PlannerTryoutTemplate>>> : {};

  return {
    tumbling: normalizePlannerTryoutTemplate(source.tumbling, fallbackTemplates.tumbling),
    stunts: normalizePlannerTryoutTemplate(source.stunts, fallbackTemplates.stunts),
    jumps: normalizePlannerTryoutTemplate(source.jumps, fallbackTemplates.jumps),
    dance: normalizePlannerTryoutTemplate(source.dance, fallbackTemplates.dance)
  } satisfies Record<PlannerTryoutTemplate["sport"], PlannerTryoutTemplate>;
}

function buildAthleteName(firstName: string, lastName: string) {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(" ").trim();
}

function splitLegacyAthleteName(name: string) {
  const trimmed = name.trim();

  if (!trimmed) {
    return { firstName: "", lastName: "" };
  }

  const [firstName, ...rest] = trimmed.split(/\s+/);
  return {
    firstName,
    lastName: rest.join(" ")
  };
}

function normalizeParentContact(raw: Partial<AthleteParentContact>, index: number): AthleteParentContact {
  return {
    id: raw.id ?? `parent-contact-${index + 1}`,
    name: raw.name ?? "",
    email: raw.email ?? "",
    phone: raw.phone ?? ""
  };
}

function normalizeParentContacts(raw: unknown): AthleteParentContact[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.map((item, index) => normalizeParentContact((item ?? {}) as Partial<AthleteParentContact>, index));
}

function normalizeEntityList<TInput, TOutput>(items: unknown, normalize: (item: TInput) => TOutput): TOutput[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.flatMap((item) => {
    try {
      return [normalize(item as TInput)];
    } catch {
      return [];
    }
  });
}

// Legacy local records sometimes only stored registration numbers. This fallback keeps them readable until real persistence owns ids.
function buildLegacyAthleteId(registrationNumber: string) {
  return `athlete-${registrationNumber.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "unknown"}`;
}

export function normalizePlannerAthlete(raw: Partial<AthleteRecord> & { registrationNumber: string }): AthleteRecord {
  const now = raw.updatedAt ?? raw.createdAt ?? new Date().toISOString();
  const legacyNames = splitLegacyAthleteName(raw.name ?? "");
  const firstName = raw.firstName ?? legacyNames.firstName;
  const lastName = raw.lastName ?? legacyNames.lastName;
  const name = raw.name ?? buildAthleteName(firstName, lastName);
  const notes = raw.notes ?? raw.athleteNotes ?? "";

  return {
    id: raw.id ?? buildLegacyAthleteId(raw.registrationNumber),
    workspaceId: raw.workspaceId ?? DEFAULT_WORKSPACE_ID,
    registrationNumber: raw.registrationNumber,
    firstName,
    lastName,
    name,
    dateOfBirth: raw.dateOfBirth ?? "",
    notes,
    parentContacts: normalizeParentContacts(raw.parentContacts),
    status: raw.status ?? "active",
    createdAt: raw.createdAt ?? now,
    updatedAt: raw.updatedAt ?? now,
    workspaceRootId: raw.workspaceRootId,
    lockVersion: raw.lockVersion,
    lastChangeSetId: raw.lastChangeSetId ?? null,
    archivedAt: raw.archivedAt ?? null,
    deletedAt: raw.deletedAt ?? null,
    restoredFromVersionId: raw.restoredFromVersionId ?? null,
    sourceTeamName: raw.sourceTeamName,
    athleteNotes: raw.athleteNotes ?? notes
  };
}

export function normalizeAthleteSnapshot(raw: Partial<AthleteSnapshot> & { registrationNumber: string; name?: string }): AthleteSnapshot {
  const capturedAt = raw.capturedAt ?? new Date().toISOString();
  const legacyNames = splitLegacyAthleteName(raw.name ?? "");
  const firstName = raw.firstName ?? legacyNames.firstName;
  const lastName = raw.lastName ?? legacyNames.lastName;
  const name = raw.name ?? buildAthleteName(firstName, lastName);
  const notes = raw.notes ?? raw.athleteNotes ?? "";

  return {
    athleteId: raw.athleteId ?? buildLegacyAthleteId(raw.registrationNumber),
    registrationNumber: raw.registrationNumber,
    firstName,
    lastName,
    name,
    dateOfBirth: raw.dateOfBirth ?? "",
    notes,
    parentContacts: normalizeParentContacts(raw.parentContacts),
    capturedAt,
    sourceTeamName: raw.sourceTeamName,
    evaluationTeamName: raw.evaluationTeamName ?? raw.sourceTeamName,
    athleteNotes: raw.athleteNotes ?? notes
  };
}

export function normalizePlannerTeam(raw: Partial<TeamRecord> & { id: string; name: string; teamLevel: PlannerLevelLabel; teamType: string }): TeamRecord {
  const now = raw.updatedAt ?? raw.createdAt ?? new Date().toISOString();
  const trainingDays = raw.trainingDays ?? "";
  const trainingHours = raw.trainingHours ?? "";
  const trainingSchedule = raw.trainingSchedule ?? [trainingDays, trainingHours].filter(Boolean).join(" / ");

  return {
    id: raw.id,
    workspaceId: raw.workspaceId ?? DEFAULT_WORKSPACE_ID,
    remoteTeamId: raw.remoteTeamId ?? "",
    name: raw.name,
    teamLevel: raw.teamLevel,
    teamType: raw.teamType,
    teamDivision: raw.teamDivision ?? "",
    trainingDays,
    trainingHours,
    trainingSchedule,
    assignedCoachNames: Array.isArray(raw.assignedCoachNames) ? raw.assignedCoachNames.filter((value): value is string => typeof value === "string") : [],
    linkedCoachIds: Array.isArray(raw.linkedCoachIds) ? raw.linkedCoachIds.filter((value): value is string => typeof value === "string") : [],
    memberAthleteIds: Array.isArray(raw.memberAthleteIds) ? [...raw.memberAthleteIds] : [],
    memberRegistrationNumbers: Array.isArray(raw.memberRegistrationNumbers) ? [...raw.memberRegistrationNumbers] : [],
    selectionProfile: normalizeTeamSelectionProfile(raw.selectionProfile),
    status: raw.status ?? "draft",
    createdAt: raw.createdAt ?? now,
    updatedAt: raw.updatedAt ?? now,
    workspaceRootId: raw.workspaceRootId,
    lockVersion: raw.lockVersion,
    lastChangeSetId: raw.lastChangeSetId ?? null,
    archivedAt: raw.archivedAt ?? null,
    deletedAt: raw.deletedAt ?? null,
    restoredFromVersionId: raw.restoredFromVersionId ?? null
  };
}

export function normalizePlannerTryoutRecord(
  raw: Omit<Partial<TryoutRecord>, "athleteSnapshot" | "rawData" | "resultSummary"> & {
    id: string;
    athleteRegistrationNumber: string | null;
    athleteSnapshot?: (Partial<AthleteSnapshot> & { registrationNumber: string; name?: string }) | null;
    rawData?: TryoutRecord["rawData"];
    resultSummary?: TryoutRecord["resultSummary"];
    templateId?: string;
    templateName?: string;
    templateUpdatedAt?: string;
    evaluations?: Array<{ levelKey: PlannerLevelKey; skills: TryoutRecord["rawData"]["buckets"][number]["skills"] }>;
    summary?: TryoutRecord["resultSummary"];
    sport?: TryoutRecord["rawData"]["sport"];
    savedAt?: string;
  }
): TryoutRecord {
  const rawDataRecord = raw.rawData && typeof raw.rawData === "object"
    ? raw.rawData as Record<string, unknown> & { levels?: Array<{ levelKey: PlannerLevelKey; skills: TryoutRecord["rawData"]["buckets"][number]["skills"] }> }
    : null;
  const rawResultSummary = raw.resultSummary && typeof raw.resultSummary === "object"
    ? raw.resultSummary as Record<string, unknown>
    : null;
  const occurredAt = raw.occurredAt ?? raw.savedAt ?? raw.createdAt ?? new Date().toISOString();
  const athleteRegistrationNumber = raw.athleteRegistrationNumber ?? raw.athleteSnapshot?.registrationNumber ?? null;
  const athleteId = raw.athleteId ?? raw.athleteSnapshot?.athleteId ?? (athleteRegistrationNumber ? buildLegacyAthleteId(athleteRegistrationNumber) : `athlete-${raw.id}`);
  const fallbackTemplateUpdatedAt = raw.templateUpdatedAt ?? raw.savedAt ?? raw.updatedAt ?? occurredAt;
  const legacySport = raw.sport ?? raw.rawData?.sport ?? "tumbling";
  const legacyLevelEntries = Array.isArray(raw.evaluations)
    ? raw.evaluations
    : Array.isArray(rawDataRecord?.levels)
      ? rawDataRecord.levels
      : [];
  const legacyBuckets = legacyLevelEntries.map((level) => ({
      bucketKey: level.levelKey,
      bucketLabel: level.levelKey === "beginner" ? "Beginner" : `Level ${level.levelKey}`,
      bucketKind: "level" as const,
      allowsExtra: true,
      levelKey: level.levelKey,
      levelLabel: level.levelKey === "beginner" ? "Beginner" : (`Level ${level.levelKey}` as PlannerLevelLabel),
      skills: Array.isArray(level.skills) ? level.skills.map((skill) => ({ ...skill })) : []
    }));
  const rawData: PlannerTryoutRawData = raw.rawData
    ? {
      ...raw.rawData,
      buckets: Array.isArray(raw.rawData.buckets)
        ? raw.rawData.buckets.map((bucket) => ({
          ...bucket,
          skills: Array.isArray(bucket.skills) ? bucket.skills.map((skill) => ({ ...skill })) : []
        }))
        : legacyBuckets
    }
    : {
      sport: legacySport,
      mode: legacySport === "dance" ? "items" : legacySport === "jumps" ? "groups" : "levels",
      template: {
        id: raw.templateId ?? "default-tryouts-template",
        name: raw.templateName ?? "Default tryout template",
        updatedAt: fallbackTemplateUpdatedAt
      },
      buckets: legacyBuckets
    };
  const hasModernResultSummary = Array.isArray(rawResultSummary?.bucketScores) && Array.isArray(rawResultSummary?.highlights);
  const modernResultSummary = hasModernResultSummary
    ? raw.resultSummary as TryoutRecord["resultSummary"]
    : null;
  const legacySummary = (
    hasModernResultSummary
      ? raw.summary
      : raw.resultSummary ?? raw.summary
  ) as Record<string, unknown> | undefined;
  const legacyLevelScores = Array.isArray(legacySummary?.levelScores) ? legacySummary.levelScores as PlannerTopLevel[] : [];
  const resultSummary: PlannerTryoutSummary = hasModernResultSummary
    ? {
      ...modernResultSummary,
      totalBaseScore: typeof modernResultSummary?.totalBaseScore === "number" ? modernResultSummary.totalBaseScore : 0,
      totalExtraScore: typeof modernResultSummary?.totalExtraScore === "number" ? modernResultSummary.totalExtraScore : 0,
      bucketScores: modernResultSummary?.bucketScores.map((bucket) => ({ ...bucket })) ?? [],
      highlights: modernResultSummary?.highlights.map((bucket) => ({ ...bucket })) ?? []
    }
    : {
      totalBaseScore: typeof legacySummary?.totalBaseScore === "number" ? legacySummary.totalBaseScore : 0,
      totalExtraScore: typeof legacySummary?.totalExtraScore === "number" ? legacySummary.totalExtraScore : 0,
      bucketScores: legacyLevelScores.map((item) => ({
        bucketKey: item.levelKey,
        bucketLabel: item.levelLabel,
        bucketKind: "level",
        baseScore: item.baseScore,
        extraScore: item.extraScore,
        levelKey: item.levelKey,
        levelLabel: item.levelLabel
      })),
      highlights: Array.isArray(legacySummary?.topLevels)
        ? (legacySummary.topLevels as PlannerTopLevel[]).map((item) => ({
          bucketKey: item.levelKey,
          bucketLabel: item.levelLabel,
          bucketKind: "level",
          baseScore: item.baseScore,
          extraScore: item.extraScore,
          levelKey: item.levelKey,
          levelLabel: item.levelLabel
        }))
        : []
    };

  return {
    id: raw.id,
    workspaceId: raw.workspaceId ?? DEFAULT_WORKSPACE_ID,
    recordType: raw.recordType ?? "planner-tryout",
    status: raw.status ?? "active",
    athleteId,
    athleteRegistrationNumber,
    plannerProjectId: raw.plannerProjectId ?? PROJECT_ID,
    plannerStage: raw.plannerStage ?? "tryouts",
    athleteSnapshot: raw.athleteSnapshot
      ? normalizeAthleteSnapshot({
          ...raw.athleteSnapshot,
          athleteId,
          capturedAt: raw.athleteSnapshot.capturedAt ?? occurredAt
        })
      : null,
    scoringSystemId: raw.scoringSystemId ?? null,
    scoringSystemVersionId: raw.scoringSystemVersionId ?? null,
    season: raw.season ?? null,
    seasonLabel: raw.seasonLabel ?? null,
    occurredAt,
    rawData: {
      ...rawData,
      template: {
        ...rawData.template
      },
      buckets: rawData.buckets.map((bucket) => ({
        ...bucket,
        skills: bucket.skills.map((skill) => ({ ...skill }))
      }))
    },
    resultSummary: {
      ...resultSummary,
      bucketScores: resultSummary.bucketScores.map((item) => ({ ...item })),
      highlights: resultSummary.highlights.map((item) => ({ ...item }))
    },
    createdById: raw.createdById ?? null,
    createdAt: raw.createdAt ?? occurredAt,
    updatedAt: raw.updatedAt ?? occurredAt,
    workspaceRootId: raw.workspaceRootId,
    lockVersion: raw.lockVersion,
    lastChangeSetId: raw.lastChangeSetId ?? null,
    archivedAt: raw.archivedAt ?? null,
    deletedAt: raw.deletedAt ?? null,
    restoredFromVersionId: raw.restoredFromVersionId ?? null
  };
}

function normalizeTeamSkillSelections(selections: TeamSkillSelection[] = []): TeamSkillSelection[] {
  return selections.map((selection, index) => ({
    ...selection,
    athleteId: selection.athleteId ?? null,
    category: selection.category ?? "stunts",
    groupIndex: selection.groupIndex ?? null,
    sortOrder: typeof selection.sortOrder === "number" ? selection.sortOrder : index,
    sourceEvaluationId: selection.sourceEvaluationId ?? null,
    levelKey: selection.levelKey ?? null,
    levelLabel: selection.levelLabel ?? "",
    skillName: selection.skillName ?? "",
    sourceOptionId: selection.sourceOptionId ?? null,
    isExtra: Boolean(selection.isExtra),
    status: selection.status ?? "selected",
    notes: selection.notes ?? ""
  }));
}

export function normalizeTeamSkillPlan(raw: Partial<TeamSkillPlan> & { id: string; teamId: string; plannerProjectId: string }): TeamSkillPlan {
  const now = raw.updatedAt ?? raw.createdAt ?? new Date().toISOString();
  return {
    id: raw.id,
    workspaceId: raw.workspaceId ?? DEFAULT_WORKSPACE_ID,
    plannerProjectId: raw.plannerProjectId,
    teamId: raw.teamId,
    status: raw.status ?? "draft",
    notes: raw.notes ?? "",
    selections: normalizeTeamSkillSelections(Array.isArray(raw.selections) ? raw.selections : []),
    createdAt: raw.createdAt ?? now,
    updatedAt: raw.updatedAt ?? now,
    workspaceRootId: raw.workspaceRootId,
    lockVersion: raw.lockVersion,
    lastChangeSetId: raw.lastChangeSetId ?? null,
    archivedAt: raw.archivedAt ?? null,
    deletedAt: raw.deletedAt ?? null,
    restoredFromVersionId: raw.restoredFromVersionId ?? null
  };
}

function normalizeTeamRoutineItems(items: TeamRoutineItem[] = []): TeamRoutineItem[] {
  return items.map((item, index) => ({
    ...item,
    skillSelectionId: item.skillSelectionId ?? null,
    athleteId: item.athleteId ?? null,
    sortOrder: Number.isFinite(item.sortOrder) ? item.sortOrder : index,
    notes: item.notes ?? ""
  }));
}

function normalizeTeamRoutinePlacements(placements: TeamRoutinePlacement[] = []): TeamRoutinePlacement[] {
  return placements.map((placement, index) => ({
    ...placement,
    skillSelectionId: placement.skillSelectionId ?? null,
    athleteId: placement.athleteId ?? null,
    startRow: Number.isFinite(placement.startRow) ? placement.startRow : 0,
    startCol: Number.isFinite(placement.startCol) ? placement.startCol : 0,
    duration: Number.isFinite(placement.duration) ? placement.duration : ROUTINE_BUILDER_COLUMN_COUNT,
    sortOrder: Number.isFinite(placement.sortOrder) ? placement.sortOrder : index,
    notes: placement.notes ?? ""
  }));
}

export function normalizeRoutineDocument(raw: Partial<RoutineDocument> | null | undefined): RoutineDocument | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const config = (raw.config ?? {}) as Partial<RoutineDocument["config"]>;
  return {
    config: {
      name: typeof config.name === "string" ? config.name : "Routine Builder",
      rowCount: Number.isFinite(config.rowCount) ? Number(config.rowCount) : ROUTINE_BUILDER_DEFAULT_ROW_COUNT,
      columnCount: ROUTINE_BUILDER_COLUMN_COUNT
    },
    placements: normalizeTeamRoutinePlacements(Array.isArray(raw.placements) ? raw.placements : []),
    cueNotes: raw.cueNotes && typeof raw.cueNotes === "object" && !Array.isArray(raw.cueNotes)
      ? Object.fromEntries(
        Object.entries(raw.cueNotes as Record<string, unknown>).map(([key, value]) => [key, typeof value === "string" ? value : ""])
      )
      : {}
  };
}

export function normalizeTeamRoutinePlan(raw: Partial<TeamRoutinePlan> & { id: string; teamId: string; plannerProjectId: string }): TeamRoutinePlan {
  const now = raw.updatedAt ?? raw.createdAt ?? new Date().toISOString();
  return {
    id: raw.id,
    workspaceId: raw.workspaceId ?? DEFAULT_WORKSPACE_ID,
    plannerProjectId: raw.plannerProjectId,
    teamId: raw.teamId,
    status: raw.status ?? "draft",
    notes: raw.notes ?? "",
    document: normalizeRoutineDocument(raw.document),
    items: normalizeTeamRoutineItems(Array.isArray(raw.items) ? raw.items : []),
    createdAt: raw.createdAt ?? now,
    updatedAt: raw.updatedAt ?? now,
    workspaceRootId: raw.workspaceRootId,
    lockVersion: raw.lockVersion,
    lastChangeSetId: raw.lastChangeSetId ?? null,
    archivedAt: raw.archivedAt ?? null,
    deletedAt: raw.deletedAt ?? null,
    restoredFromVersionId: raw.restoredFromVersionId ?? null
  };
}

function normalizeTeamSeasonCheckpoints(checkpoints: TeamSeasonCheckpoint[] = []): TeamSeasonCheckpoint[] {
  return checkpoints.map((checkpoint) => ({
    ...checkpoint,
    targetDate: checkpoint.targetDate ?? null,
    sourceRoutinePlanId: checkpoint.sourceRoutinePlanId ?? null,
    notes: checkpoint.notes ?? ""
  }));
}

export function normalizeTeamSeasonPlan(raw: Partial<TeamSeasonPlan> & { id: string; teamId: string; plannerProjectId: string }): TeamSeasonPlan {
  const now = raw.updatedAt ?? raw.createdAt ?? new Date().toISOString();
  return {
    id: raw.id,
    workspaceId: raw.workspaceId ?? DEFAULT_WORKSPACE_ID,
    plannerProjectId: raw.plannerProjectId,
    teamId: raw.teamId,
    status: raw.status ?? "draft",
    notes: raw.notes ?? "",
    checkpoints: normalizeTeamSeasonCheckpoints(Array.isArray(raw.checkpoints) ? raw.checkpoints : []),
    createdAt: raw.createdAt ?? now,
    updatedAt: raw.updatedAt ?? now,
    workspaceRootId: raw.workspaceRootId,
    lockVersion: raw.lockVersion,
    lastChangeSetId: raw.lastChangeSetId ?? null,
    archivedAt: raw.archivedAt ?? null,
    deletedAt: raw.deletedAt ?? null,
    restoredFromVersionId: raw.restoredFromVersionId ?? null
  };
}

export function normalizePlannerProject(
  raw: Partial<PlannerProject> & { template?: unknown; tryoutTemplates?: unknown },
  fallbackTemplate: PlannerTryoutTemplate,
  fallbackQualificationRules: PlannerQualificationRules,
  fallbackTryoutTemplates = defaultTryoutTemplates
): PlannerProject {
  const now = raw.updatedAt ?? raw.createdAt ?? new Date().toISOString();
  const templateConfig = raw.template && typeof raw.template === "object"
    ? raw.template as Record<string, unknown>
    : null;
  const normalizedTryoutTemplates = raw.tryoutTemplates
    ? normalizePlannerTryoutTemplates(raw.tryoutTemplates, fallbackTryoutTemplates)
    : templateConfig?.tryoutTemplates
      ? normalizePlannerTryoutTemplates(templateConfig.tryoutTemplates, fallbackTryoutTemplates)
      : normalizePlannerTryoutTemplates({
        ...cloneTryoutTemplates(fallbackTryoutTemplates),
        tumbling: normalizePlannerTryoutTemplate(
          raw.template && typeof raw.template === "object" && !("tryoutTemplates" in (raw.template as Record<string, unknown>))
            ? raw.template as Partial<PlannerTryoutTemplate>
            : undefined,
          fallbackTryoutTemplates.tumbling
        )
      }, fallbackTryoutTemplates);
  const normalizedTryoutRecords = Array.isArray(raw.tryoutRecords)
    ? normalizeEntityList(raw.tryoutRecords, (tryoutRecord: Parameters<typeof normalizePlannerTryoutRecord>[0]) => (
      normalizePlannerTryoutRecord(tryoutRecord)
    ))
    : Array.isArray((raw as Partial<PlannerProject> & { evaluations?: unknown[] }).evaluations)
      ? normalizeEntityList(
        (raw as Partial<PlannerProject> & { evaluations?: unknown[] }).evaluations,
        (tryoutRecord: Parameters<typeof normalizePlannerTryoutRecord>[0]) => normalizePlannerTryoutRecord(tryoutRecord)
      )
      : [];

  const candidate = {
    id: raw.id ?? PROJECT_ID,
    workspaceId: raw.workspaceId ?? DEFAULT_WORKSPACE_ID,
    workspaceRootId: raw.workspaceRootId,
    name: raw.name ?? PROJECT_NAME,
    status: raw.status ?? "active",
    pipelineStage: raw.pipelineStage ?? "tryouts",
    template: normalizedTryoutTemplates.tumbling,
    tryoutTemplates: normalizedTryoutTemplates,
    athletes: normalizeEntityList(raw.athletes, (athlete: Parameters<typeof normalizePlannerAthlete>[0]) => normalizePlannerAthlete(athlete)),
    tryoutRecords: normalizedTryoutRecords,
    teams: normalizeEntityList(raw.teams, (team: Parameters<typeof normalizePlannerTeam>[0]) => normalizePlannerTeam(team)),
    skillPlans: normalizeEntityList(raw.skillPlans, (skillPlan: Parameters<typeof normalizeTeamSkillPlan>[0]) => normalizeTeamSkillPlan(skillPlan)),
    routinePlans: normalizeEntityList(raw.routinePlans, (routinePlan: Parameters<typeof normalizeTeamRoutinePlan>[0]) => normalizeTeamRoutinePlan(routinePlan)),
    seasonPlans: normalizeEntityList(raw.seasonPlans, (seasonPlan: Parameters<typeof normalizeTeamSeasonPlan>[0]) => normalizeTeamSeasonPlan(seasonPlan)),
    qualificationRules: raw.qualificationRules ? { ...fallbackQualificationRules, ...raw.qualificationRules } : { ...fallbackQualificationRules },
    createdAt: raw.createdAt ?? now,
    updatedAt: raw.updatedAt ?? now,
    lockVersion: raw.lockVersion,
    lastChangeSetId: raw.lastChangeSetId ?? null,
    archivedAt: raw.archivedAt ?? null,
    deletedAt: raw.deletedAt ?? null,
    restoredFromVersionId: raw.restoredFromVersionId ?? null
  } satisfies PlannerProject;

  if (isPlannerProject(candidate)) {
    return candidate;
  }

  const fallbackCandidate = candidate as Partial<PlannerProject>;

  return {
    id: fallbackCandidate.id || PROJECT_ID,
    workspaceId: fallbackCandidate.workspaceId || DEFAULT_WORKSPACE_ID,
    workspaceRootId: fallbackCandidate.workspaceRootId,
    name: fallbackCandidate.name || PROJECT_NAME,
    status: isPlannerProjectStatus(fallbackCandidate.status) ? fallbackCandidate.status : "active",
    pipelineStage: isPlannerPipelineStage(fallbackCandidate.pipelineStage) ? fallbackCandidate.pipelineStage : "tryouts",
    template: isPlannerTryoutTemplate(fallbackCandidate.template) ? fallbackCandidate.template : cloneTemplate(fallbackTemplate),
    tryoutTemplates: isPlannerTryoutTemplates(fallbackCandidate.tryoutTemplates)
      ? fallbackCandidate.tryoutTemplates
      : cloneTryoutTemplates(fallbackTryoutTemplates),
    athletes: Array.isArray(fallbackCandidate.athletes)
      ? fallbackCandidate.athletes.filter((athlete): athlete is AthleteRecord => isAthleteRecord(athlete))
      : [],
    tryoutRecords: Array.isArray(fallbackCandidate.tryoutRecords)
      ? fallbackCandidate.tryoutRecords.filter((tryoutRecord): tryoutRecord is TryoutRecord => isTryoutRecord(tryoutRecord))
      : [],
    teams: Array.isArray(fallbackCandidate.teams)
      ? fallbackCandidate.teams.filter((team): team is TeamRecord => isTeamRecord(team))
      : [],
    skillPlans: Array.isArray(fallbackCandidate.skillPlans)
      ? fallbackCandidate.skillPlans.filter((skillPlan): skillPlan is TeamSkillPlan => isTeamSkillPlan(skillPlan))
      : [],
    routinePlans: Array.isArray(fallbackCandidate.routinePlans)
      ? fallbackCandidate.routinePlans.filter((routinePlan): routinePlan is TeamRoutinePlan => isTeamRoutinePlan(routinePlan))
      : [],
    seasonPlans: Array.isArray(fallbackCandidate.seasonPlans)
      ? fallbackCandidate.seasonPlans.filter((seasonPlan): seasonPlan is TeamSeasonPlan => isTeamSeasonPlan(seasonPlan))
      : [],
    qualificationRules: isPlannerQualificationRules(fallbackCandidate.qualificationRules)
      ? fallbackCandidate.qualificationRules
      : { ...fallbackQualificationRules },
    createdAt: isValidIsoDateString(fallbackCandidate.createdAt) ? fallbackCandidate.createdAt : now,
    updatedAt: isValidIsoDateString(fallbackCandidate.updatedAt) ? fallbackCandidate.updatedAt : now,
    lockVersion: fallbackCandidate.lockVersion,
    lastChangeSetId: fallbackCandidate.lastChangeSetId ?? null,
    archivedAt: fallbackCandidate.archivedAt ?? null,
    deletedAt: fallbackCandidate.deletedAt ?? null,
    restoredFromVersionId: fallbackCandidate.restoredFromVersionId ?? null
  };
}

export function getNextRegistrationNumber(athletes: AthleteRecord[]) {
  const maxValue = athletes.reduce((currentMax, athlete) => {
    const parsed = Number(athlete.registrationNumber.replace(/[^\d]/g, ""));
    return Number.isFinite(parsed) ? Math.max(currentMax, parsed) : currentMax;
  }, 1000);

  return `CP-${String(maxValue + 1).padStart(4, "0")}`;
}

export function getPlannerLevelRank(level: PlannerLevelLabel) {
  const ranks: Record<PlannerLevelLabel, number> = {
    "Beginner": 0,
    "Level 1": 1,
    "Level 2": 2,
    "Level 3": 3,
    "Level 4": 4,
    "Level 5": 5,
    "Level 6": 6,
    "Level 7": 7
  };

  return ranks[level];
}

export function getHighestQualifiedLevelFromEvaluation(
  tryoutRecord: TryoutRecord | null,
  qualificationRules: PlannerQualificationRules
): PlannerQualifiedLevel {
  if (!tryoutRecord) {
    return "Unqualified";
  }

  const effectiveQualificationRules = qualificationRules && typeof qualificationRules === "object"
    ? qualificationRules
    : DEFAULT_QUALIFICATION_RULES;
  const levelScores = Array.isArray(tryoutRecord.resultSummary?.bucketScores)
    ? tryoutRecord.resultSummary.bucketScores.filter((item) => item.bucketKind === "level" && item.levelLabel)
    : [];

  const qualified = Object.keys(effectiveQualificationRules)
    .filter((levelLabel): levelLabel is PlannerLevelLabel => levelLabel in effectiveQualificationRules)
    .filter((levelLabel) => {
      const levelScore = levelScores.find((item) => item.levelLabel === levelLabel);
      return levelScore ? levelScore.baseScore >= effectiveQualificationRules[levelLabel] : false;
    });

  return qualified.length ? qualified[qualified.length - 1] : "Unqualified";
}

function normalizeLevelCriteria(
  value: unknown,
  fallbackMinLevel: PlannerLevelLabel
): TeamSelectionProfile["sports"]["tumbling"] {
  const base = buildDefaultTeamSelectionProfile().sports.tumbling;

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      ...base,
      minLevel: fallbackMinLevel
    };
  }

  const record = value as Record<string, unknown>;

  return {
    enabled: typeof record.enabled === "boolean" ? record.enabled : base.enabled,
    minLevel: typeof record.minLevel === "string" && (
      record.minLevel === "Beginner"
      || record.minLevel === "Level 1"
      || record.minLevel === "Level 2"
      || record.minLevel === "Level 3"
      || record.minLevel === "Level 4"
      || record.minLevel === "Level 5"
      || record.minLevel === "Level 6"
      || record.minLevel === "Level 7"
    ) ? record.minLevel : fallbackMinLevel,
    minScore: typeof record.minScore === "number" && Number.isFinite(record.minScore) ? Math.max(0, record.minScore) : base.minScore
  };
}

function normalizeTeamSelectionProfile(value: unknown): TeamSelectionProfile {
  const defaults = buildDefaultTeamSelectionProfile();

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaults;
  }

  const record = value as Record<string, unknown>;
  const sports = record.sports && typeof record.sports === "object" && !Array.isArray(record.sports)
    ? record.sports as Record<string, unknown>
    : {};

  const jumps = sports.jumps && typeof sports.jumps === "object" && !Array.isArray(sports.jumps)
    ? sports.jumps as Record<string, unknown>
    : {};
  const dance = sports.dance && typeof sports.dance === "object" && !Array.isArray(sports.dance)
    ? sports.dance as Record<string, unknown>
    : {};

  return {
    mode: record.mode === "warn-only" ? "warn-only" : defaults.mode,
    sports: {
      tumbling: normalizeLevelCriteria(sports.tumbling, "Beginner"),
      stunts: normalizeLevelCriteria(sports.stunts, "Level 1"),
      jumps: {
        enabled: typeof jumps.enabled === "boolean" ? jumps.enabled : defaults.sports.jumps.enabled,
        group: jumps.group === "advanced" ? "advanced" : "basic",
        minScore: typeof jumps.minScore === "number" && Number.isFinite(jumps.minScore) ? Math.max(0, jumps.minScore) : defaults.sports.jumps.minScore
      },
      dance: {
        enabled: typeof dance.enabled === "boolean" ? dance.enabled : defaults.sports.dance.enabled,
        minTotalScore: typeof dance.minTotalScore === "number" && Number.isFinite(dance.minTotalScore) ? Math.max(0, dance.minTotalScore) : defaults.sports.dance.minTotalScore
      }
    }
  };
}

export function canAssignQualifiedLevelToTeam(qualifiedLevel: PlannerQualifiedLevel, teamLevel: PlannerLevelLabel) {
  if (qualifiedLevel === "Unqualified") {
    return false;
  }

  return getPlannerLevelRank(qualifiedLevel) >= getPlannerLevelRank(teamLevel);
}




