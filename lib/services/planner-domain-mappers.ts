import type { AthleteRecord, AthleteSnapshot, AthleteParentContact } from "@/lib/domain/athlete";
import type { EvaluationRecord, PlannerTryoutTemplate } from "@/lib/domain/evaluation-record";
import { LEVEL_KEYS, type PlannerLevelKey, type PlannerLevelLabel, type PlannerQualifiedLevel } from "@/lib/domain/planner-levels";
import type { PlannerProject, PlannerQualificationRules } from "@/lib/domain/planner-project";
import { ROUTINE_BUILDER_COLUMN_COUNT, ROUTINE_BUILDER_DEFAULT_ROW_COUNT, type RoutineDocument, type TeamRoutineItem, type TeamRoutinePlacement, type TeamRoutinePlan } from "@/lib/domain/routine-plan";
import type { TeamSeasonCheckpoint, TeamSeasonPlan } from "@/lib/domain/season-plan";
import type { TeamSkillPlan, TeamSkillSelection } from "@/lib/domain/skill-plan";
import type { TeamRecord } from "@/lib/domain/team";
import { isPlannerProject } from "@/lib/validation/planner-domain";

const PROJECT_ID = "default-cheer-planner-project";
const PROJECT_NAME = "Cheer Planner";
const DEFAULT_WORKSPACE_ID = "local-workspace";

function normalizeSkillCounts(defaultSkillCounts: PlannerTryoutTemplate["defaultSkillCounts"]) {
  return Object.fromEntries(LEVEL_KEYS.map((levelKey) => [levelKey, Number(defaultSkillCounts[levelKey] ?? 0)])) as Record<PlannerLevelKey, number>;
}

function normalizeTemplateOptionLabel(option: PlannerTryoutTemplate["options"][number]) {
  return option.id === "does-it" ? { ...option, label: "Attempted" } : option;
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
    status: raw.status ?? "draft",
    createdAt: raw.createdAt ?? now,
    updatedAt: raw.updatedAt ?? now
  };
}

export function normalizePlannerEvaluation(
  raw: Omit<Partial<EvaluationRecord>, "athleteSnapshot" | "rawData" | "resultSummary"> & {
    id: string;
    athleteRegistrationNumber: string | null;
    athleteSnapshot?: (Partial<AthleteSnapshot> & { registrationNumber: string; name?: string }) | null;
    rawData?: EvaluationRecord["rawData"];
    resultSummary?: EvaluationRecord["resultSummary"];
    templateId?: string;
    templateName?: string;
    templateUpdatedAt?: string;
    evaluations?: EvaluationRecord["rawData"]["levels"];
    summary?: EvaluationRecord["resultSummary"];
    sport?: EvaluationRecord["rawData"]["sport"];
    savedAt?: string;
  }
): EvaluationRecord {
  const occurredAt = raw.occurredAt ?? raw.savedAt ?? raw.createdAt ?? new Date().toISOString();
  const athleteRegistrationNumber = raw.athleteRegistrationNumber ?? raw.athleteSnapshot?.registrationNumber ?? null;
  const athleteId = raw.athleteId ?? raw.athleteSnapshot?.athleteId ?? (athleteRegistrationNumber ? buildLegacyAthleteId(athleteRegistrationNumber) : `athlete-${raw.id}`);
  const fallbackTemplateUpdatedAt = raw.templateUpdatedAt ?? raw.savedAt ?? raw.updatedAt ?? occurredAt;
  const rawData = raw.rawData ?? {
    sport: raw.sport ?? "tumbling",
    template: {
      id: raw.templateId ?? "default-tryouts-template",
      name: raw.templateName ?? "Default tryout template",
      updatedAt: fallbackTemplateUpdatedAt
    },
    levels: (raw.evaluations ?? []).map((level) => ({
      ...level,
      skills: level.skills.map((skill) => ({ ...skill }))
    }))
  };
  const resultSummary = raw.resultSummary ?? raw.summary ?? {
    totalBaseScore: 0,
    totalExtraScore: 0,
    levelScores: [],
    topLevels: []
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
    occurredAt,
    rawData: {
      ...rawData,
      template: {
        ...rawData.template
      },
      levels: rawData.levels.map((level) => ({
        ...level,
        skills: level.skills.map((skill) => ({ ...skill }))
      }))
    },
    resultSummary: {
      ...resultSummary,
      levelScores: resultSummary.levelScores.map((item) => ({ ...item })),
      topLevels: resultSummary.topLevels.map((item) => ({ ...item }))
    },
    createdById: raw.createdById ?? null,
    createdAt: raw.createdAt ?? occurredAt,
    updatedAt: raw.updatedAt ?? occurredAt
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
    updatedAt: raw.updatedAt ?? now
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
    updatedAt: raw.updatedAt ?? now
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
    updatedAt: raw.updatedAt ?? now
  };
}

export function normalizePlannerProject(raw: Partial<PlannerProject>, fallbackTemplate: PlannerTryoutTemplate, fallbackQualificationRules: PlannerQualificationRules): PlannerProject {
  const now = raw.updatedAt ?? raw.createdAt ?? new Date().toISOString();
  const candidate = {
    id: raw.id ?? PROJECT_ID,
    workspaceId: raw.workspaceId ?? DEFAULT_WORKSPACE_ID,
    name: raw.name ?? PROJECT_NAME,
    status: raw.status ?? "active",
    pipelineStage: raw.pipelineStage ?? "tryouts",
    template: raw.template
      ? {
          ...fallbackTemplate,
          ...raw.template,
          options: (Array.isArray(raw.template.options) ? raw.template.options : fallbackTemplate.options).map((option) => normalizeTemplateOptionLabel({ ...option })),
          defaultSkillCounts: normalizeSkillCounts({ ...fallbackTemplate.defaultSkillCounts, ...raw.template.defaultSkillCounts })
        }
      : {
          ...fallbackTemplate,
          options: fallbackTemplate.options.map((option) => normalizeTemplateOptionLabel({ ...option }))
        },
    athletes: Array.isArray(raw.athletes) ? raw.athletes.map((athlete) => normalizePlannerAthlete(athlete)) : [],
    evaluations: Array.isArray(raw.evaluations)
      ? raw.evaluations.map((evaluation) => normalizePlannerEvaluation(evaluation as Parameters<typeof normalizePlannerEvaluation>[0]))
      : [],
    teams: Array.isArray(raw.teams)
      ? raw.teams.map((team) => normalizePlannerTeam(team as Parameters<typeof normalizePlannerTeam>[0]))
      : [],
    skillPlans: Array.isArray(raw.skillPlans)
      ? raw.skillPlans.map((skillPlan) => normalizeTeamSkillPlan(skillPlan as Parameters<typeof normalizeTeamSkillPlan>[0]))
      : [],
    routinePlans: Array.isArray(raw.routinePlans)
      ? raw.routinePlans.map((routinePlan) => normalizeTeamRoutinePlan(routinePlan as Parameters<typeof normalizeTeamRoutinePlan>[0]))
      : [],
    seasonPlans: Array.isArray(raw.seasonPlans)
      ? raw.seasonPlans.map((seasonPlan) => normalizeTeamSeasonPlan(seasonPlan as Parameters<typeof normalizeTeamSeasonPlan>[0]))
      : [],
    qualificationRules: raw.qualificationRules ? { ...fallbackQualificationRules, ...raw.qualificationRules } : { ...fallbackQualificationRules },
    createdAt: raw.createdAt ?? now,
    updatedAt: raw.updatedAt ?? now
  } satisfies PlannerProject;

  return isPlannerProject(candidate) ? candidate : {
    id: PROJECT_ID,
    workspaceId: DEFAULT_WORKSPACE_ID,
    name: PROJECT_NAME,
    status: "active",
    pipelineStage: "tryouts",
    template: {
      ...fallbackTemplate,
      defaultSkillCounts: normalizeSkillCounts(fallbackTemplate.defaultSkillCounts)
    },
    athletes: [],
    evaluations: [],
    teams: [],
    skillPlans: [],
    routinePlans: [],
    seasonPlans: [],
    qualificationRules: { ...fallbackQualificationRules },
    createdAt: now,
    updatedAt: now
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
  evaluation: EvaluationRecord | null,
  qualificationRules: PlannerQualificationRules
): PlannerQualifiedLevel {
  if (!evaluation) {
    return "Unqualified";
  }

  const qualified = Object.keys(qualificationRules)
    .filter((levelLabel): levelLabel is PlannerLevelLabel => levelLabel in qualificationRules)
    .filter((levelLabel) => {
      const levelScore = evaluation.resultSummary.levelScores.find((item) => item.levelLabel === levelLabel);
      return levelScore ? levelScore.baseScore >= qualificationRules[levelLabel] : false;
    });

  return qualified.length ? qualified[qualified.length - 1] : "Unqualified";
}

export function canAssignQualifiedLevelToTeam(qualifiedLevel: PlannerQualifiedLevel, teamLevel: PlannerLevelLabel) {
  if (qualifiedLevel === "Unqualified") {
    return false;
  }

  return getPlannerLevelRank(qualifiedLevel) >= getPlannerLevelRank(teamLevel);
}




