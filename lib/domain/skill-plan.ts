import type { TimestampedEntity } from "@/lib/domain/base";
import type { PlannerLevelKey } from "@/lib/domain/planner-levels";

export type TeamSkillPlanStatus = "draft" | "approved" | "archived";
export type TeamSkillSelectionStatus = "selected" | "approved";

export type TeamSkillSelection = {
  id: string;
  athleteId: string;
  sourceEvaluationId: string | null;
  levelKey: PlannerLevelKey;
  // Selected skill identity for planner phases. This is the persisted planning choice, not just a tryout projection.
  skillName: string;
  // Preserves which scored tryout option produced the selected skill as source provenance only.
  sourceOptionId: string | null;
  isExtra: boolean;
  status: TeamSkillSelectionStatus;
  notes: string;
};

export type TeamSkillPlan = TimestampedEntity & {
  // Planner-scoped skill-planning aggregate for one team. Team and athlete identity stay canonical via ids.
  workspaceId: string;
  plannerProjectId: string;
  teamId: string;
  status: TeamSkillPlanStatus;
  notes: string;
  selections: TeamSkillSelection[];
};
