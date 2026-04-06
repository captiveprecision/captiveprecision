import type { TimestampedEntity } from "@/lib/domain/base";
import type { PlannerLevelKey } from "@/lib/domain/planner-levels";

export type TeamSkillPlanStatus = "draft" | "approved" | "archived";
export type TeamSkillSelectionStatus = "selected" | "approved";
export type TeamSkillCategory = "stunts" | "running-tumbling" | "standing-tumbling" | "jumps" | "pyramid";

export type TeamSkillSelection = {
  id: string;
  athleteId: string | null;
  category: TeamSkillCategory;
  groupIndex: number | null;
  sortOrder: number;
  sourceEvaluationId: string | null;
  levelKey: PlannerLevelKey | null;
  levelLabel: string;
  skillName: string;
  sourceOptionId: string | null;
  isExtra: boolean;
  status: TeamSkillSelectionStatus;
  notes: string;
};

export type TeamSkillPlan = TimestampedEntity & {
  workspaceId: string;
  plannerProjectId: string;
  teamId: string;
  status: TeamSkillPlanStatus;
  notes: string;
  selections: TeamSkillSelection[];
};
