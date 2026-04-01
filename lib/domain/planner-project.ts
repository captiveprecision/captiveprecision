import type { DomainEntityStatus, TimestampedEntity } from "@/lib/domain/base";
import type { AthleteRecord } from "@/lib/domain/athlete";
import type { EvaluationRecord, PlannerTryoutTemplate } from "@/lib/domain/evaluation-record";
import type { PlannerLevelLabel, PlannerPipelineStage } from "@/lib/domain/planner-levels";
import type { TeamRoutinePlan } from "@/lib/domain/routine-plan";
import type { TeamSeasonPlan } from "@/lib/domain/season-plan";
import type { TeamSkillPlan } from "@/lib/domain/skill-plan";
import type { TeamRecord } from "@/lib/domain/team";

export type PlannerQualificationRules = Record<PlannerLevelLabel, number>;
export type PlannerProjectStatus = Extract<DomainEntityStatus, "draft" | "active" | "archived">;

export type PlannerProject = TimestampedEntity & {
  // Planner aggregate root. This is domain state for the planner pipeline, not view-local UI state.
  workspaceId: string;
  name: string;
  status: PlannerProjectStatus;
  pipelineStage: PlannerPipelineStage;
  template: PlannerTryoutTemplate;
  athletes: AthleteRecord[];
  evaluations: EvaluationRecord[];
  teams: TeamRecord[];
  // Planner-scoped per-team skill-planning state for future routine-building phases.
  skillPlans: TeamSkillPlan[];
  // Planner-scoped per-team routine composition state for future season-planning phases.
  routinePlans: TeamRoutinePlan[];
  // Planner-scoped per-team season planning state for future My Teams consumption.
  seasonPlans: TeamSeasonPlan[];
  qualificationRules: PlannerQualificationRules;
};
