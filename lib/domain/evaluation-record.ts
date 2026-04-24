import type { DomainEntityStatus, TimestampedEntity } from "@/lib/domain/base";
import type { AthleteSnapshot } from "@/lib/domain/athlete";
import type { PlannerLevelKey, PlannerLevelLabel, PlannerPipelineStage, PlannerSportKey } from "@/lib/domain/planner-levels";

export type PlannerTryoutOption = {
  id: string;
  label: string;
  value: number;
};

export type PlannerTemplateSkill = {
  id: string;
  name: string;
};

export type PlannerTryoutTemplateMode = "levels" | "groups" | "items";
export type PlannerTryoutBucketKind = "level" | "group" | "item";

export type PlannerTryoutTemplateBucket = {
  id: string;
  key: string;
  label: string;
  kind: PlannerTryoutBucketKind;
  skills: PlannerTemplateSkill[];
  allowsExtra: boolean;
  levelKey?: PlannerLevelKey | null;
  levelLabel?: PlannerLevelLabel | null;
};

export type PlannerTryoutTemplate = {
  id: string;
  name: string;
  stage: "tryouts";
  sport: PlannerSportKey;
  mode: PlannerTryoutTemplateMode;
  options: PlannerTryoutOption[];
  buckets: PlannerTryoutTemplateBucket[];
  updatedAt: string;
  // Legacy compatibility for old snapshots that only stored tumbling metadata.
  activeSport?: PlannerSportKey;
  defaultSkillCounts?: Partial<Record<PlannerLevelKey, number>>;
  skillLibrary?: Partial<Record<PlannerLevelKey, PlannerTemplateSkill[]>>;
};

export type PlannerSkillEvaluation = {
  id: string;
  name: string;
  optionId: string | null;
  isExtra: boolean;
};

export type PlannerTryoutBucketEvaluation = {
  bucketKey: string;
  bucketLabel: string;
  bucketKind: PlannerTryoutBucketKind;
  skills: PlannerSkillEvaluation[];
  allowsExtra: boolean;
  levelKey?: PlannerLevelKey | null;
  levelLabel?: PlannerLevelLabel | null;
};

// Legacy tumbling/stunts compatibility alias.
export type PlannerLevelEvaluation = {
  levelKey: PlannerLevelKey;
  skills: PlannerSkillEvaluation[];
};

export type PlannerTopLevel = {
  levelKey: PlannerLevelKey;
  levelLabel: PlannerLevelLabel;
  baseScore: number;
  extraScore: number;
};

export type PlannerTryoutSummaryBucket = {
  bucketKey: string;
  bucketLabel: string;
  bucketKind: PlannerTryoutBucketKind;
  baseScore: number;
  extraScore: number;
  levelKey?: PlannerLevelKey | null;
  levelLabel?: PlannerLevelLabel | null;
};

export type PlannerTryoutSummary = {
  totalBaseScore: number;
  totalExtraScore: number;
  bucketScores: PlannerTryoutSummaryBucket[];
  highlights: PlannerTryoutSummaryBucket[];
};

export type PlannerTryoutRawData = {
  sport: PlannerSportKey;
  mode: PlannerTryoutTemplateMode;
  template: {
    id: string;
    name: string;
    updatedAt: string;
  };
  buckets: PlannerTryoutBucketEvaluation[];
};

export type TryoutRecordStatus = Extract<DomainEntityStatus, "active" | "archived">;
export type TryoutRecordType = "planner-tryout";

export type TryoutRecord = TimestampedEntity & {
  workspaceId: string;
  recordType: TryoutRecordType;
  status: TryoutRecordStatus;
  athleteId: string;
  athleteRegistrationNumber: string | null;
  plannerProjectId: string | null;
  plannerStage: PlannerPipelineStage | null;
  athleteSnapshot: AthleteSnapshot | null;
  scoringSystemId: string | null;
  scoringSystemVersionId: string | null;
  season?: string | null;
  seasonLabel?: string | null;
  occurredAt: string | null;
  rawData: PlannerTryoutRawData;
  resultSummary: PlannerTryoutSummary;
  createdById: string | null;
};
