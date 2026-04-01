import type { TimestampedEntity } from "@/lib/domain/base";

export type TeamRoutinePlanStatus = "draft" | "approved" | "archived";
export type TeamRoutineItemStatus = "planned" | "approved";

export type TeamRoutineItem = {
  id: string;
  // Reference to the selected skill source inside TeamSkillPlan. This is provenance/linkage, not the routine item's own identity.
  skillSelectionId: string;
  athleteId: string;
  sortOrder: number;
  status: TeamRoutineItemStatus;
  notes: string;
};

export type TeamRoutinePlan = TimestampedEntity & {
  // Planner-scoped routine-composition aggregate for one team. This stores composition decisions, not choreography/editor UI state.
  workspaceId: string;
  plannerProjectId: string;
  teamId: string;
  status: TeamRoutinePlanStatus;
  notes: string;
  items: TeamRoutineItem[];
};
