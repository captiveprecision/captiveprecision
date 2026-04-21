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

export type PlannerTryoutTemplate = {
  id: string;
  name: string;
  stage: "tryouts";
  activeSport: PlannerSportKey;
  options: PlannerTryoutOption[];
  defaultSkillCounts: Record<PlannerLevelKey, number>;
  skillLibrary: Record<PlannerLevelKey, PlannerTemplateSkill[]>;
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

export type PlannerTopLevel = {
  levelKey: PlannerLevelKey;
  levelLabel: PlannerLevelLabel;
  baseScore: number;
  extraScore: number;
};

export type PlannerTryoutSummary = {
  // Stable summarized outputs derived from rawData.

  totalBaseScore: number;
  totalExtraScore: number;
  levelScores: PlannerTopLevel[];
  topLevels: PlannerTopLevel[];
};

export type PlannerTryoutRawData = {
  // Reproducible tryout input payload, safe for later ranking/qualification consumers.

  sport: PlannerSportKey;
  template: {
    id: string;
    name: string;
    updatedAt: string;
  };
  levels: PlannerLevelEvaluation[];
};

export type EvaluationRecordStatus = Extract<DomainEntityStatus, "active" | "archived">;
export type EvaluationRecordType = "planner-tryout";

export type EvaluationRecord = TimestampedEntity & {
  // Shared evaluation wrapper entity. Planner-specific references stay optional context, not base identity.
  workspaceId: string;
  recordType: EvaluationRecordType;
  status: EvaluationRecordStatus;
  athleteId: string;
  athleteRegistrationNumber: string | null;
  plannerProjectId: string | null;
  plannerStage: PlannerPipelineStage | null;
  athleteSnapshot: AthleteSnapshot | null;
  scoringSystemId: string | null;
  scoringSystemVersionId: string | null;
  occurredAt: string | null;
  rawData: PlannerTryoutRawData;
  resultSummary: PlannerTryoutSummary;
  createdById: string | null;
};




