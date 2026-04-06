import { COLUMN_COUNT, OccupiedCell, RoutinePlacement } from "@/lib/types";

export function clampRowCount(value: number) {
  if (!Number.isFinite(value)) {
    return 40;
  }

  return Math.max(8, Math.min(80, Math.floor(value)));
}

export function getLinearIndex(row: number, col: number) {
  return row * COLUMN_COUNT + col;
}

export function getCellFromLinearIndex(index: number) {
  return {
    row: Math.floor(index / COLUMN_COUNT),
    col: index % COLUMN_COUNT,
  };
}

export function getOccupiedCells(
  placement: Pick<RoutinePlacement, "startRow" | "startCol" | "duration">,
  rowCount: number,
) {
  const startIndex = getLinearIndex(placement.startRow, placement.startCol);
  const occupied: OccupiedCell[] = [];

  for (let offset = 0; offset < placement.duration; offset += 1) {
    const cell = getCellFromLinearIndex(startIndex + offset);
    if (cell.row >= rowCount) {
      break;
    }

    occupied.push({
      row: cell.row,
      col: cell.col,
      isOrigin: offset === 0,
    });
  }

  return occupied;
}

export function getPlacementDurationFromCell(
  placement: Pick<RoutinePlacement, "startRow" | "startCol">,
  targetRow: number,
  targetCol: number,
) {
  const startIndex = getLinearIndex(placement.startRow, placement.startCol);
  const targetIndex = getLinearIndex(targetRow, targetCol);
  return Math.max(1, targetIndex - startIndex + 1);
}

export function getPlacementFromStartResize(
  placement: Pick<RoutinePlacement, "id" | "skillId" | "startRow" | "startCol" | "duration">,
  targetRow: number,
  targetCol: number,
): RoutinePlacement {
  const currentStartIndex = getLinearIndex(placement.startRow, placement.startCol);
  const currentEndIndex = currentStartIndex + placement.duration - 1;
  const targetIndex = Math.min(getLinearIndex(targetRow, targetCol), currentEndIndex);
  const nextStart = getCellFromLinearIndex(targetIndex);

  return {
    ...placement,
    startRow: nextStart.row,
    startCol: nextStart.col,
    duration: currentEndIndex - targetIndex + 1,
  };
}

export function placementFits(
  placement: Pick<RoutinePlacement, "startRow" | "startCol" | "duration">,
  rowCount: number,
) {
  const endIndex =
    getLinearIndex(placement.startRow, placement.startCol) + placement.duration - 1;

  return endIndex < rowCount * COLUMN_COUNT;
}

export function placementWithinOverlapLimit(
  candidate: Pick<RoutinePlacement, "id" | "startRow" | "startCol" | "duration">,
  placements: RoutinePlacement[],
  rowCount: number,
  maxOverlap: number,
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
