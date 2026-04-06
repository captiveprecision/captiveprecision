export const COLUMN_COUNT = 8;
export const MIN_ROW_COUNT = 8;
export const DEFAULT_ROW_COUNT = 40;

export type SkillCategory =
  | "Opening"
  | "Tumbling"
  | "Stunts"
  | "Dance"
  | "Transitions";

export interface RoutineConfig {
  name: string;
  rowCount: number;
  columnCount: typeof COLUMN_COUNT;
}

export interface SkillDefinition {
  id: string;
  name: string;
  category: SkillCategory;
  description: string;
  defaultDuration: number;
  color: string;
  tags: string[];
}

export interface RoutinePlacement {
  id: string;
  skillId: string;
  startRow: number;
  startCol: number;
  duration: number;
}

export interface RoutineDocument {
  config: RoutineConfig;
  placements: RoutinePlacement[];
  cueNotes: Record<string, string>;
}

export interface SkillsSource {
  getSkills(): Promise<SkillDefinition[]>;
}

export interface OccupiedCell {
  row: number;
  col: number;
  isOrigin: boolean;
}

export interface DragSkillPayload {
  type: "skill";
  skillId: string;
}

export interface DragPlacementPayload {
  type: "placement";
  placementId: string;
}

export interface DragResizePayload {
  type: "resize";
  placementId: string;
  edge: "start" | "end";
}
