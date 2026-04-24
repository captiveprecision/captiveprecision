import { LEVEL_KEYS, LEVEL_LABELS, type PlannerLevelKey, type PlannerLevelLabel, type PlannerPipelineStage, type PlannerSportKey } from "@/lib/domain/planner-levels";
import type { AthleteParentContact, AthleteRecord, AthleteSnapshot, AthleteStatus } from "@/lib/domain/athlete";
import type {
  PlannerLevelEvaluation,
  PlannerSkillEvaluation,
  PlannerTopLevel,
  PlannerTryoutOption,
  PlannerTryoutSummary,
  PlannerTryoutSummaryBucket,
  PlannerTryoutTemplate,
  PlannerTryoutTemplateBucket,
  TryoutRecord,
  TryoutRecordStatus
} from "@/lib/domain/evaluation-record";
import type { PlannerProject, PlannerProjectStatus, PlannerQualificationRules } from "@/lib/domain/planner-project";
import type { RoutineDocument, TeamRoutineItem, TeamRoutineItemStatus, TeamRoutinePlacement, TeamRoutinePlacementKind, TeamRoutinePlan, TeamRoutinePlanStatus } from "@/lib/domain/routine-plan";
import type { TeamSeasonCheckpoint, TeamSeasonCheckpointStatus, TeamSeasonPlan, TeamSeasonPlanStatus } from "@/lib/domain/season-plan";
import type { TeamSkillPlan, TeamSkillPlanStatus, TeamSkillSelection, TeamSkillSelectionStatus } from "@/lib/domain/skill-plan";
import type { ScoringSystem, ScoringSystemSection, ScoringSystemStatus, ScoringSystemVersion, ScoringSystemVersionStatus } from "@/lib/domain/scoring-system";
import type { TeamRecord, TeamSelectionProfile, TeamStatus } from "@/lib/domain/team";

function isIsoDateString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && !Number.isNaN(Date.parse(value));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isPlannerLevelKey(value: unknown): value is PlannerLevelKey {
  return typeof value === "string" && LEVEL_KEYS.includes(value as PlannerLevelKey);
}

export function isPlannerLevelLabel(value: unknown): value is PlannerLevelLabel {
  return typeof value === "string" && LEVEL_LABELS.includes(value as PlannerLevelLabel);
}

export function isPlannerSportKey(value: unknown): value is PlannerSportKey {
  return value === "tumbling" || value === "dance" || value === "jumps" || value === "stunts";
}

export function isPlannerPipelineStage(value: unknown): value is PlannerPipelineStage {
  return value === "tryouts" || value === "team-builder" || value === "skill-planner" || value === "routine-builder" || value === "season-planner" || value === "my-teams";
}

export function isAthleteStatus(value: unknown): value is AthleteStatus {
  return value === "active" || value === "archived";
}

export function isTeamStatus(value: unknown): value is TeamStatus {
  return value === "draft" || value === "active" || value === "archived";
}

export function isTryoutRecordStatus(value: unknown): value is TryoutRecordStatus {
  return value === "active" || value === "archived";
}

export function isPlannerProjectStatus(value: unknown): value is PlannerProjectStatus {
  return value === "draft" || value === "active" || value === "archived";
}

export function isTeamSkillPlanStatus(value: unknown): value is TeamSkillPlanStatus {
  return value === "draft" || value === "approved" || value === "archived";
}

export function isTeamSkillSelectionStatus(value: unknown): value is TeamSkillSelectionStatus {
  return value === "selected" || value === "approved";
}

export function isTeamRoutinePlanStatus(value: unknown): value is TeamRoutinePlanStatus {
  return value === "draft" || value === "approved" || value === "archived";
}

export function isTeamRoutineItemStatus(value: unknown): value is TeamRoutineItemStatus {
  return value === "planned" || value === "approved";
}

export function isTeamRoutinePlacementKind(value: unknown): value is TeamRoutinePlacementKind {
  return value === "skill" || value === "transition" || value === "recovered";
}

export function isTeamSeasonPlanStatus(value: unknown): value is TeamSeasonPlanStatus {
  return value === "draft" || value === "approved" || value === "archived";
}

export function isTeamSeasonCheckpointStatus(value: unknown): value is TeamSeasonCheckpointStatus {
  return value === "planned" || value === "confirmed" || value === "completed";
}

export function isScoringSystemStatus(value: unknown): value is ScoringSystemStatus {
  return value === "draft" || value === "active" || value === "archived" || value === "Draft" || value === "Active" || value === "Archived";
}

export function isScoringSystemVersionStatus(value: unknown): value is ScoringSystemVersionStatus {
  return value === "draft" || value === "active" || value === "archived" || value === "Draft" || value === "Active" || value === "Archived";
}

export function isPlannerTryoutOption(value: unknown): value is PlannerTryoutOption {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return isNonEmptyString(record.id) && isNonEmptyString(record.label) && typeof record.value === "number";
}

export function isPlannerSkillEvaluation(value: unknown): value is PlannerSkillEvaluation {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return isNonEmptyString(record.id) && typeof record.name === "string" && (record.optionId === null || typeof record.optionId === "string") && typeof record.isExtra === "boolean";
}

export function isPlannerLevelEvaluation(value: unknown): value is PlannerLevelEvaluation {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return isPlannerLevelKey(record.levelKey) && Array.isArray(record.skills) && record.skills.every(isPlannerSkillEvaluation);
}

export function isPlannerTopLevel(value: unknown): value is PlannerTopLevel {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return isPlannerLevelKey(record.levelKey) && isPlannerLevelLabel(record.levelLabel) && typeof record.baseScore === "number" && typeof record.extraScore === "number";
}

export function isPlannerTryoutTemplateBucket(value: unknown): value is PlannerTryoutTemplateBucket {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return isNonEmptyString(record.id)
    && isNonEmptyString(record.key)
    && isNonEmptyString(record.label)
    && (record.kind === "level" || record.kind === "group" || record.kind === "item")
    && Array.isArray(record.skills)
    && record.skills.every((skill) => {
      const skillRecord = skill as Record<string, unknown>;
      return isNonEmptyString(skillRecord.id) && typeof skillRecord.name === "string";
    })
    && typeof record.allowsExtra === "boolean"
    && (record.levelKey === undefined || record.levelKey === null || isPlannerLevelKey(record.levelKey))
    && (record.levelLabel === undefined || record.levelLabel === null || isPlannerLevelLabel(record.levelLabel));
}

export function isPlannerTryoutSummaryBucket(value: unknown): value is PlannerTryoutSummaryBucket {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return isNonEmptyString(record.bucketKey)
    && isNonEmptyString(record.bucketLabel)
    && (record.bucketKind === "level" || record.bucketKind === "group" || record.bucketKind === "item")
    && typeof record.baseScore === "number"
    && typeof record.extraScore === "number"
    && (record.levelKey === undefined || record.levelKey === null || isPlannerLevelKey(record.levelKey))
    && (record.levelLabel === undefined || record.levelLabel === null || isPlannerLevelLabel(record.levelLabel));
}

export function isPlannerTryoutSummary(value: unknown): value is PlannerTryoutSummary {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return typeof record.totalBaseScore === "number"
    && typeof record.totalExtraScore === "number"
    && Array.isArray(record.bucketScores)
    && record.bucketScores.every(isPlannerTryoutSummaryBucket)
    && Array.isArray(record.highlights)
    && record.highlights.every(isPlannerTryoutSummaryBucket);
}

export function isPlannerTryoutTemplate(value: unknown): value is PlannerTryoutTemplate {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return isNonEmptyString(record.id)
    && isNonEmptyString(record.name)
    && record.stage === "tryouts"
    && isPlannerSportKey(record.sport ?? record.activeSport)
    && (record.mode === "levels" || record.mode === "groups" || record.mode === "items")
    && Array.isArray(record.options)
    && record.options.every(isPlannerTryoutOption)
    && Array.isArray(record.buckets)
    && record.buckets.every(isPlannerTryoutTemplateBucket)
    && isIsoDateString(record.updatedAt);
}

export function isAthleteParentContact(value: unknown): value is AthleteParentContact {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return isNonEmptyString(record.id)
    && typeof record.name === "string"
    && typeof record.email === "string"
    && typeof record.phone === "string";
}
export function isAthleteRecord(value: unknown): value is AthleteRecord {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return isNonEmptyString(record.id)
    && isNonEmptyString(record.workspaceId)
    && isNonEmptyString(record.registrationNumber)
    && typeof record.firstName === "string"
    && typeof record.lastName === "string"
    && typeof record.name === "string"
    && typeof record.dateOfBirth === "string"
    && typeof record.notes === "string"
    && Array.isArray(record.parentContacts)
    && record.parentContacts.every(isAthleteParentContact)
    && isAthleteStatus(record.status)
    && isIsoDateString(record.createdAt)
    && isIsoDateString(record.updatedAt);
}

export function isAthleteSnapshot(value: unknown): value is AthleteSnapshot {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return isNonEmptyString(record.athleteId)
    && isNonEmptyString(record.registrationNumber)
    && typeof record.firstName === "string"
    && typeof record.lastName === "string"
    && typeof record.name === "string"
    && typeof record.dateOfBirth === "string"
    && typeof record.notes === "string"
    && Array.isArray(record.parentContacts)
    && record.parentContacts.every(isAthleteParentContact)
    && isIsoDateString(record.capturedAt);
}

export function isTeamRecord(value: unknown): value is TeamRecord {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return isNonEmptyString(record.id)
    && isNonEmptyString(record.workspaceId)
    && (record.remoteTeamId === undefined || typeof record.remoteTeamId === "string")
    && isNonEmptyString(record.name)
    && isPlannerLevelLabel(record.teamLevel)
    && typeof record.teamType === "string"
    && (record.teamDivision === undefined || typeof record.teamDivision === "string")
    && (record.trainingDays === undefined || typeof record.trainingDays === "string")
    && (record.trainingHours === undefined || typeof record.trainingHours === "string")
    && (record.trainingSchedule === undefined || typeof record.trainingSchedule === "string")
    && (record.assignedCoachNames === undefined || (Array.isArray(record.assignedCoachNames) && record.assignedCoachNames.every(isNonEmptyString)))
    && (record.linkedCoachIds === undefined || (Array.isArray(record.linkedCoachIds) && record.linkedCoachIds.every(isNonEmptyString)))
    && Array.isArray(record.memberAthleteIds)
    && record.memberAthleteIds.every(isNonEmptyString)
    && (record.memberRegistrationNumbers === undefined || (Array.isArray(record.memberRegistrationNumbers) && record.memberRegistrationNumbers.every(isNonEmptyString)))
    && isTeamSelectionProfile(record.selectionProfile)
    && isTeamStatus(record.status)
    && isIsoDateString(record.createdAt)
    && isIsoDateString(record.updatedAt);
}

function isPlannerTryoutRawData(value: unknown): value is TryoutRecord["rawData"] {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return isPlannerSportKey(record.sport)
    && (record.mode === "levels" || record.mode === "groups" || record.mode === "items")
    && !!record.template
    && typeof record.template === "object"
    && isNonEmptyString((record.template as Record<string, unknown>).id)
    && isNonEmptyString((record.template as Record<string, unknown>).name)
    && isIsoDateString((record.template as Record<string, unknown>).updatedAt)
    && Array.isArray(record.buckets)
    && record.buckets.every((bucket) => {
      const bucketRecord = bucket as Record<string, unknown>;
      return isNonEmptyString(bucketRecord.bucketKey)
        && isNonEmptyString(bucketRecord.bucketLabel)
        && (bucketRecord.bucketKind === "level" || bucketRecord.bucketKind === "group" || bucketRecord.bucketKind === "item")
        && Array.isArray(bucketRecord.skills)
        && bucketRecord.skills.every(isPlannerSkillEvaluation);
    });
}

export function isTryoutRecord(value: unknown): value is TryoutRecord {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return isNonEmptyString(record.id)
    && isNonEmptyString(record.workspaceId)
    && record.recordType === "planner-tryout"
    && isTryoutRecordStatus(record.status)
    && (record.athleteId === null || isNonEmptyString(record.athleteId))
    && (record.athleteRegistrationNumber === null || typeof record.athleteRegistrationNumber === "string")
    && (record.plannerProjectId === null || typeof record.plannerProjectId === "string")
    && (record.plannerStage === null || isPlannerPipelineStage(record.plannerStage))
    && (record.athleteSnapshot === null || isAthleteSnapshot(record.athleteSnapshot))
    && (record.scoringSystemId === null || typeof record.scoringSystemId === "string")
    && (record.scoringSystemVersionId === null || typeof record.scoringSystemVersionId === "string")
    && (record.season === undefined || record.season === null || typeof record.season === "string")
    && (record.seasonLabel === undefined || record.seasonLabel === null || typeof record.seasonLabel === "string")
    && (record.occurredAt === null || isIsoDateString(record.occurredAt))
    && isPlannerTryoutRawData(record.rawData)
    && isPlannerTryoutSummary(record.resultSummary)
    && (record.createdById === null || typeof record.createdById === "string")
    && isIsoDateString(record.createdAt)
    && isIsoDateString(record.updatedAt);
}

function isTeamSelectionProfile(value: unknown): value is TeamSelectionProfile {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  const sports = record.sports as Record<string, unknown> | undefined;

  if (record.mode !== "warn-only" || !sports || typeof sports !== "object") {
    return false;
  }

  const tumbling = sports.tumbling as Record<string, unknown> | undefined;
  const stunts = sports.stunts as Record<string, unknown> | undefined;
  const jumps = sports.jumps as Record<string, unknown> | undefined;
  const dance = sports.dance as Record<string, unknown> | undefined;

  return !!tumbling
    && typeof tumbling.enabled === "boolean"
    && isPlannerLevelLabel(tumbling.minLevel)
    && typeof tumbling.minScore === "number"
    && !!stunts
    && typeof stunts.enabled === "boolean"
    && isPlannerLevelLabel(stunts.minLevel)
    && typeof stunts.minScore === "number"
    && !!jumps
    && typeof jumps.enabled === "boolean"
    && (jumps.group === "basic" || jumps.group === "advanced")
    && typeof jumps.minScore === "number"
    && !!dance
    && typeof dance.enabled === "boolean"
    && typeof dance.minTotalScore === "number";
}

export function isPlannerTryoutTemplates(value: unknown): value is Record<PlannerSportKey, PlannerTryoutTemplate> {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return isPlannerTryoutTemplate(record.tumbling)
    && isPlannerTryoutTemplate(record.stunts)
    && isPlannerTryoutTemplate(record.jumps)
    && isPlannerTryoutTemplate(record.dance);
}

export function isTeamSkillSelection(value: unknown): value is TeamSkillSelection {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return isNonEmptyString(record.id)
    && (record.athleteId === null || typeof record.athleteId === "string")
    && (record.category === "stunts" || record.category === "running-tumbling" || record.category === "standing-tumbling" || record.category === "jumps" || record.category === "pyramid")
    && (record.groupIndex === null || typeof record.groupIndex === "number")
    && typeof record.sortOrder === "number"
    && (record.sourceEvaluationId === null || typeof record.sourceEvaluationId === "string")
    && (record.levelKey === null || isPlannerLevelKey(record.levelKey))
    && typeof record.levelLabel === "string"
    && typeof record.skillName === "string"
    && (record.sourceOptionId === null || typeof record.sourceOptionId === "string")
    && typeof record.isExtra === "boolean"
    && isTeamSkillSelectionStatus(record.status)
    && typeof record.notes === "string";
}

export function isTeamSkillPlan(value: unknown): value is TeamSkillPlan {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return isNonEmptyString(record.id)
    && isNonEmptyString(record.workspaceId)
    && isNonEmptyString(record.plannerProjectId)
    && isNonEmptyString(record.teamId)
    && isTeamSkillPlanStatus(record.status)
    && typeof record.notes === "string"
    && Array.isArray(record.selections)
    && record.selections.every(isTeamSkillSelection)
    && isIsoDateString(record.createdAt)
    && isIsoDateString(record.updatedAt);
}

export function isTeamRoutineItem(value: unknown): value is TeamRoutineItem {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return isNonEmptyString(record.id)
    && (record.skillSelectionId === null || isNonEmptyString(record.skillSelectionId))
    && (record.athleteId === null || isNonEmptyString(record.athleteId))
    && typeof record.sortOrder === "number"
    && isTeamRoutineItemStatus(record.status)
    && typeof record.notes === "string";
}

export function isTeamRoutinePlacement(value: unknown): value is TeamRoutinePlacement {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return isNonEmptyString(record.id)
    && (record.skillSelectionId === null || isNonEmptyString(record.skillSelectionId))
    && (record.athleteId === null || isNonEmptyString(record.athleteId))
    && isTeamRoutinePlacementKind(record.kind)
    && typeof record.title === "string"
    && typeof record.category === "string"
    && typeof record.color === "string"
    && typeof record.startRow === "number"
    && typeof record.startCol === "number"
    && typeof record.duration === "number"
    && typeof record.sortOrder === "number"
    && isTeamRoutineItemStatus(record.status)
    && typeof record.notes === "string";
}

function isRoutineDocument(value: unknown): value is RoutineDocument {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return !!record.config
    && typeof record.config === "object"
    && typeof (record.config as Record<string, unknown>).name === "string"
    && typeof (record.config as Record<string, unknown>).rowCount === "number"
    && (record.config as Record<string, unknown>).columnCount === 8
    && Array.isArray(record.placements)
    && record.placements.every(isTeamRoutinePlacement)
    && !!record.cueNotes
    && typeof record.cueNotes === "object"
    && !Array.isArray(record.cueNotes)
    && Object.values(record.cueNotes as Record<string, unknown>).every((note) => typeof note === "string");
}
export function isTeamRoutinePlan(value: unknown): value is TeamRoutinePlan {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return isNonEmptyString(record.id)
    && isNonEmptyString(record.workspaceId)
    && isNonEmptyString(record.plannerProjectId)
    && isNonEmptyString(record.teamId)
    && isTeamRoutinePlanStatus(record.status)
    && typeof record.notes === "string"
    && Array.isArray(record.items)
    && record.items.every(isTeamRoutineItem)
    && isIsoDateString(record.createdAt)
    && isIsoDateString(record.updatedAt);
}

export function isTeamSeasonCheckpoint(value: unknown): value is TeamSeasonCheckpoint {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return isNonEmptyString(record.id)
    && typeof record.name === "string"
    && (record.targetDate === null || isIsoDateString(record.targetDate))
    && (record.sourceRoutinePlanId === null || typeof record.sourceRoutinePlanId === "string")
    && typeof record.sortOrder === "number"
    && isTeamSeasonCheckpointStatus(record.status)
    && typeof record.notes === "string";
}

export function isTeamSeasonPlan(value: unknown): value is TeamSeasonPlan {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return isNonEmptyString(record.id)
    && isNonEmptyString(record.workspaceId)
    && isNonEmptyString(record.plannerProjectId)
    && isNonEmptyString(record.teamId)
    && isTeamSeasonPlanStatus(record.status)
    && typeof record.notes === "string"
    && Array.isArray(record.checkpoints)
    && record.checkpoints.every(isTeamSeasonCheckpoint)
    && isIsoDateString(record.createdAt)
    && isIsoDateString(record.updatedAt);
}

export function isPlannerQualificationRules(value: unknown): value is PlannerQualificationRules {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return LEVEL_LABELS.every((label) => typeof record[label] === "number");
}

export function isPlannerProject(value: unknown): value is PlannerProject {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return isNonEmptyString(record.id)
    && isNonEmptyString(record.workspaceId)
    && (record.remoteTeamId === undefined || typeof record.remoteTeamId === "string")
    && isNonEmptyString(record.name)
    && isPlannerProjectStatus(record.status)
    && isPlannerPipelineStage(record.pipelineStage)
    && isPlannerTryoutTemplate(record.template)
    && isPlannerTryoutTemplates(record.tryoutTemplates)
    && Array.isArray(record.athletes)
    && record.athletes.every(isAthleteRecord)
    && Array.isArray(record.tryoutRecords)
    && record.tryoutRecords.every(isTryoutRecord)
    && Array.isArray(record.teams)
    && record.teams.every(isTeamRecord)
    && Array.isArray(record.skillPlans)
    && record.skillPlans.every(isTeamSkillPlan)
    && Array.isArray(record.routinePlans)
    && record.routinePlans.every(isTeamRoutinePlan)
    && Array.isArray(record.seasonPlans)
    && record.seasonPlans.every(isTeamSeasonPlan)
    && isPlannerQualificationRules(record.qualificationRules)
    && isIsoDateString(record.createdAt)
    && isIsoDateString(record.updatedAt);
}

export function isScoringSystemSection(value: unknown): value is ScoringSystemSection {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return isNonEmptyString(record.id)
    && isNonEmptyString(record.name)
    && typeof record.maxPoints === "number"
    && (record.key === undefined || typeof record.key === "string")
    && (record.guidance === undefined || record.guidance === null || typeof record.guidance === "string")
    && (record.sortOrder === undefined || typeof record.sortOrder === "number")
    && (record.createdAt === undefined || isIsoDateString(record.createdAt))
    && (record.updatedAt === undefined || isIsoDateString(record.updatedAt));
}

export function isScoringSystemVersion(value: unknown): value is ScoringSystemVersion {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return isNonEmptyString(record.id)
    && isNonEmptyString(record.label)
    && (isNonEmptyString(record.season) || isNonEmptyString(record.seasonLabel))
    && isScoringSystemVersionStatus(record.status)
    && typeof record.comments === "string"
    && (record.isActive === undefined || typeof record.isActive === "boolean")
    && Array.isArray(record.sections)
    && record.sections.every(isScoringSystemSection)
    && (record.createdAt === undefined || isIsoDateString(record.createdAt))
    && (record.updatedAt === undefined || isIsoDateString(record.updatedAt));
}

export function isScoringSystem(value: unknown): value is ScoringSystem {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return isNonEmptyString(record.id)
    && isNonEmptyString(record.name)
    && isNonEmptyString(record.slug)
    && isScoringSystemStatus(record.status)
    && isNonEmptyString(record.activeVersionId)
    && Array.isArray(record.versions)
    && record.versions.every(isScoringSystemVersion)
    && (record.createdAt === undefined || isIsoDateString(record.createdAt))
    && (record.updatedAt === undefined || isIsoDateString(record.updatedAt));
}









