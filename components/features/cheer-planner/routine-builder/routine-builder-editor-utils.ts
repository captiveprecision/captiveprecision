import { ROUTINE_BUILDER_COLUMN_COUNT, ROUTINE_BUILDER_DEFAULT_ROW_COUNT, ROUTINE_BUILDER_MAX_ROW_COUNT, ROUTINE_BUILDER_MIN_ROW_COUNT, type TeamRoutinePlacement } from "@/lib/domain/routine-plan";

export type RoutineEditorOccupiedCell = {
  row: number;
  col: number;
  isOrigin: boolean;
};

export type RoutineEditorDragSkillPayload = {
  type: "skill";
  skillId: string;
};

export type RoutineEditorDragPlacementPayload = {
  type: "placement";
  placementId: string;
};

export type RoutineEditorDragResizePayload = {
  type: "resize";
  placementId: string;
  edge: "start" | "end";
};

export function clampRoutineRowCount(value: number) {
  if (!Number.isFinite(value)) {
    return ROUTINE_BUILDER_DEFAULT_ROW_COUNT;
  }

  return Math.max(ROUTINE_BUILDER_MIN_ROW_COUNT, Math.min(ROUTINE_BUILDER_MAX_ROW_COUNT, Math.floor(value)));
}

export function getLinearIndex(row: number, col: number) {
  return row * ROUTINE_BUILDER_COLUMN_COUNT + col;
}

export function getCellFromLinearIndex(index: number) {
  return {
    row: Math.floor(index / ROUTINE_BUILDER_COLUMN_COUNT),
    col: index % ROUTINE_BUILDER_COLUMN_COUNT
  };
}

export function getOccupiedCells(
  placement: Pick<TeamRoutinePlacement, "startRow" | "startCol" | "duration">,
  rowCount: number
) {
  const startIndex = getLinearIndex(placement.startRow, placement.startCol);
  const occupied: RoutineEditorOccupiedCell[] = [];

  for (let offset = 0; offset < placement.duration; offset += 1) {
    const cell = getCellFromLinearIndex(startIndex + offset);
    if (cell.row >= rowCount) {
      break;
    }

    occupied.push({
      row: cell.row,
      col: cell.col,
      isOrigin: offset === 0
    });
  }

  return occupied;
}

export function getPlacementDurationFromCell(
  placement: Pick<TeamRoutinePlacement, "startRow" | "startCol">,
  targetRow: number,
  targetCol: number
) {
  const startIndex = getLinearIndex(placement.startRow, placement.startCol);
  const targetIndex = getLinearIndex(targetRow, targetCol);
  return Math.max(1, targetIndex - startIndex + 1);
}

export function getPlacementFromStartResize(
  placement: Pick<TeamRoutinePlacement, "id" | "skillSelectionId" | "athleteId" | "kind" | "title" | "category" | "color" | "startRow" | "startCol" | "duration" | "sortOrder" | "status" | "notes">,
  targetRow: number,
  targetCol: number
): TeamRoutinePlacement {
  const currentStartIndex = getLinearIndex(placement.startRow, placement.startCol);
  const currentEndIndex = currentStartIndex + placement.duration - 1;
  const targetIndex = Math.min(getLinearIndex(targetRow, targetCol), currentEndIndex);
  const nextStart = getCellFromLinearIndex(targetIndex);

  return {
    ...placement,
    startRow: nextStart.row,
    startCol: nextStart.col,
    duration: currentEndIndex - targetIndex + 1
  };
}

export function placementFits(
  placement: Pick<TeamRoutinePlacement, "startRow" | "startCol" | "duration">,
  rowCount: number
) {
  const endIndex = getLinearIndex(placement.startRow, placement.startCol) + placement.duration - 1;
  return endIndex < rowCount * ROUTINE_BUILDER_COLUMN_COUNT;
}

export function placementWithinOverlapLimit(
  candidate: Pick<TeamRoutinePlacement, "id" | "startRow" | "startCol" | "duration">,
  placements: TeamRoutinePlacement[],
  rowCount: number,
  maxOverlap: number
) {
  const counts = new Map<string, number>();

  placements
    .filter((placement) => placement.id !== candidate.id)
    .forEach((placement) => {
      getOccupiedCells(placement, rowCount).forEach((cell) => {
        const key = `${cell.row}-${cell.col}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      });
    });

  return getOccupiedCells(candidate, rowCount).every((cell) => {
    const key = `${cell.row}-${cell.col}`;
    return (counts.get(key) ?? 0) + 1 <= maxOverlap;
  });
}

export function createRoutinePlacementId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `routine-placement-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createCueNoteId(placementId: string, row: number, col: number) {
  return `${placementId}:${row}:${col}`;
}

export function parseCellId(id: string) {
  const [prefix, row, col] = id.split(":");
  if (prefix !== "cell" || row === undefined || col === undefined) {
    return null;
  }

  return {
    row: Number(row),
    col: Number(col)
  };
}
