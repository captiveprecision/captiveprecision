import type { TimestampedEntity } from "@/lib/domain/base";

export type TeamSeasonPlanStatus = "draft" | "approved" | "archived";
export type TeamSeasonCheckpointStatus = "planned" | "confirmed" | "completed";

export type TeamSeasonCheckpoint = {
  id: string;
  // Planner-authored checkpoint meaning for the team's season path. This is not a derived display label.
  name: string;
  targetDate: string | null;
  // Reference to the routine source used for this checkpoint, kept as reproducible provenance only. This is not part of the checkpoint's own identity.
  sourceRoutinePlanId: string | null;
  sortOrder: number;
  status: TeamSeasonCheckpointStatus;
  notes: string;
};

export type TeamSeasonPlan = TimestampedEntity & {
  // Planner-scoped season aggregate for one team. This stores season planning decisions and progression checkpoints, not calendar/editor UI state.
  workspaceId: string;
  plannerProjectId: string;
  teamId: string;
  status: TeamSeasonPlanStatus;
  notes: string;
  checkpoints: TeamSeasonCheckpoint[];
};

