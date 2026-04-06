import type { TimestampedEntity } from "@/lib/domain/base";

export type TeamRoutinePlanStatus = "draft" | "approved" | "archived";
export type TeamRoutineItemStatus = "planned" | "approved";
export type TeamRoutinePlacementKind = "skill" | "transition" | "recovered";

export const ROUTINE_BUILDER_COLUMN_COUNT = 8;
export const ROUTINE_BUILDER_DEFAULT_ROW_COUNT = 40;
export const ROUTINE_BUILDER_MIN_ROW_COUNT = 8;
export const ROUTINE_BUILDER_MAX_ROW_COUNT = 80;

export type RoutineDocument = {
  config: {
    name: string;
    rowCount: number;
    columnCount: typeof ROUTINE_BUILDER_COLUMN_COUNT;
  };
  placements: TeamRoutinePlacement[];
  cueNotes: Record<string, string>;
};

export type TeamRoutinePlacement = {
  id: string;
  skillSelectionId: string | null;
  athleteId: string | null;
  kind: TeamRoutinePlacementKind;
  title: string;
  category: string;
  color: string;
  startRow: number;
  startCol: number;
  duration: number;
  sortOrder: number;
  status: TeamRoutineItemStatus;
  notes: string;
};

export type TeamRoutineItem = {
  id: string;
  // Reference to the selected skill source inside TeamSkillPlan. This is provenance/linkage, not the routine item's own identity.
  skillSelectionId: string | null;
  // Athlete linkage stays canonical when known. Manual team-level routine decisions may persist null here,
  // but the item must never substitute another entity id such as teamId.
  athleteId: string | null;
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
  // Legacy local routine plans may still hydrate without a document until they are migrated on open.
  document: RoutineDocument | null;
  // Compatibility projection for downstream summary surfaces. This is derived from document.placements once the plan is migrated.
  items: TeamRoutineItem[];
};
