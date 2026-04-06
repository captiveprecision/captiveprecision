"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useMemo, useState } from "react";

import { Button, Card, CardContent, Input, Tabs } from "@/components/ui";
import { ROUTINE_BUILDER_COLUMN_COUNT, type RoutineDocument, type TeamRoutinePlacement } from "@/lib/domain/routine-plan";
import {
  createCueNoteId,
  getCellFromLinearIndex,
  getLinearIndex,
  getOccupiedCells,
  type RoutineEditorDragPlacementPayload,
  type RoutineEditorDragResizePayload,
  type RoutineEditorOccupiedCell
} from "@/components/features/cheer-planner/routine-builder/routine-builder-editor-utils";

const OVERVIEW_MODE = "overview" as const;
const DETAIL_MODE = "detail" as const;
const SUMMARY_MODE = "summary" as const;
const GRID_ROW_HEIGHT = 54;
const GRID_LANE_VERTICAL_PADDING = 6;
const GRID_LANE_GAP = 3;
const GRID_LANE_MAX_HEIGHT = 12;
const GRID_LANE_MIN_HEIGHT = 6;

const VIEW_MODE_ITEMS = [
  { value: OVERVIEW_MODE, label: "Overview" },
  { value: DETAIL_MODE, label: "Detail" },
  { value: SUMMARY_MODE, label: "Summary" }
] as const;

type ViewMode = typeof VIEW_MODE_ITEMS[number]["value"];

type SummaryEntry = {
  placementId: string;
  title: string;
  rowLabel: string;
  cues: Array<{ note: string; count: number }>;
};

type RowChunk = {
  placement: TeamRoutinePlacement;
  row: number;
  startCol: number;
  span: number;
};

function getLaneGeometry(laneIndex: number, laneCount: number) {
  const availableHeight = GRID_ROW_HEIGHT - GRID_LANE_VERTICAL_PADDING * 2;
  const totalGap = Math.max(0, laneCount - 1) * GRID_LANE_GAP;
  const laneHeight = Math.max(
    GRID_LANE_MIN_HEIGHT,
    Math.min(GRID_LANE_MAX_HEIGHT, (availableHeight - totalGap) / Math.max(1, laneCount))
  );
  const totalHeight = laneHeight * laneCount + totalGap;
  const top = Math.max(
    GRID_LANE_VERTICAL_PADDING,
    (GRID_ROW_HEIGHT - totalHeight) / 2 + laneIndex * (laneHeight + GRID_LANE_GAP)
  );

  return {
    top: `${top}px`,
    height: `${laneHeight}px`
  };
}

function getPlacementRowChunks(placement: TeamRoutinePlacement, rowCount: number) {
  const cells = getOccupiedCells(placement, rowCount);
  const chunks: RowChunk[] = [];

  cells.forEach((cell) => {
    const currentChunk = chunks[chunks.length - 1];
    if (!currentChunk || currentChunk.row !== cell.row || currentChunk.startCol + currentChunk.span !== cell.col) {
      chunks.push({ row: cell.row, startCol: cell.col, span: 1, placement });
      return;
    }

    currentChunk.span += 1;
  });

  return chunks;
}

function buildLaneMap(placements: TeamRoutinePlacement[], rowCount: number) {
  const chunksByRow = new Map<number, RowChunk[]>();

  placements.forEach((placement) => {
    getPlacementRowChunks(placement, rowCount).forEach((chunk) => {
      const rowChunks = chunksByRow.get(chunk.row) ?? [];
      rowChunks.push(chunk);
      chunksByRow.set(chunk.row, rowChunks);
    });
  });

  const laneByChunkKey = new Map<string, number>();
  const laneCountByRow = new Map<number, number>();

  chunksByRow.forEach((rowChunks, row) => {
    const sortedChunks = [...rowChunks].sort((left, right) => {
      if (left.startCol !== right.startCol) {
        return left.startCol - right.startCol;
      }

      if (left.span !== right.span) {
        return right.span - left.span;
      }

      return getLinearIndex(left.placement.startRow, left.placement.startCol) - getLinearIndex(right.placement.startRow, right.placement.startCol);
    });

    const laneEndByIndex = [-1, -1, -1];
    let maxLane = 0;

    sortedChunks.forEach((chunk) => {
      const endCol = chunk.startCol + chunk.span - 1;
      let assignedLane = laneEndByIndex.findIndex((laneEnd) => laneEnd < chunk.startCol);
      if (assignedLane === -1) {
        assignedLane = laneEndByIndex.length - 1;
      }

      laneEndByIndex[assignedLane] = endCol;
      maxLane = Math.max(maxLane, assignedLane + 1);
      laneByChunkKey.set(`${chunk.placement.id}:${row}`, assignedLane);
    });

    laneCountByRow.set(row, maxLane || 1);
  });

  return { laneByChunkKey, laneCountByRow };
}

function RoutineSetupCard({
  document,
  readOnly,
  onUpdateConfig
}: {
  document: RoutineDocument;
  readOnly: boolean;
  onUpdateConfig: (name: string, rowCount: number) => void;
}) {
  const [name, setName] = useState(document.config.name);
  const [rowCount, setRowCount] = useState(document.config.rowCount);

  useEffect(() => {
    setName(document.config.name);
    setRowCount(document.config.rowCount);
  }, [document.config.name, document.config.rowCount]);

  return (
    <Card variant="subtle" className="planner-routine-setup-card">
      <CardContent className="planner-panel-stack">
        <div className="planner-routine-card-head">
          <div>
            <strong>Routine setup</strong>
            <p>Configure team name and total eights before editing the grid.</p>
          </div>
        </div>
        <div className="planner-routine-setup-grid">
          <Input label="Routine name" value={name} disabled={readOnly} onChange={(event) => setName(event.target.value)} />
          <Input
            label="Number of eights"
            type="number"
            min={8}
            max={80}
            value={String(rowCount)}
            disabled={readOnly}
            onChange={(event) => setRowCount(Number(event.target.value))}
          />
        </div>
        <div className="planner-routine-inline-actions">
          <Button size="sm" disabled={readOnly} onClick={() => onUpdateConfig(name, rowCount)}>Update setup</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ResizeHotspot({
  placementId,
  edge,
  disabled
}: {
  placementId: string;
  edge: "start" | "end";
  disabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `resize:${placementId}:${edge}`,
    data: {
      type: "resize",
      placementId,
      edge
    } satisfies RoutineEditorDragResizePayload,
    disabled
  });

  return (
    <div
      ref={setNodeRef}
      className={`planner-routine-resize ${edge}`}
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.6 : 1
      }}
      {...listeners}
      {...attributes}
      aria-hidden="true"
    />
  );
}

function PlacementChunkBlock({
  chunk,
  laneIndex,
  laneCount,
  isSelected,
  isOrigin,
  isLastChunk,
  isFirstChunk,
  readOnly,
  viewMode,
  onSelect
}: {
  chunk: RowChunk;
  laneIndex: number;
  laneCount: number;
  isSelected: boolean;
  isOrigin: boolean;
  isLastChunk: boolean;
  isFirstChunk: boolean;
  readOnly: boolean;
  viewMode: ViewMode;
  onSelect: (placementId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `placement:${chunk.placement.id}`,
    data: {
      type: "placement",
      placementId: chunk.placement.id
    } satisfies RoutineEditorDragPlacementPayload,
    disabled: readOnly || !isOrigin
  });
  const showTitle = viewMode === OVERVIEW_MODE && isOrigin;
  const showCount = viewMode === OVERVIEW_MODE && isLastChunk;
  const isLightBlock = chunk.placement.color.toLowerCase() === "#ffffff";

  return (
    <div
      className="planner-routine-placement-overlay"
      style={{
        gridColumn: `${chunk.startCol + 1} / span ${chunk.span}`,
        gridRow: `${chunk.row + 2}`
      }}
    >
      <div
        className={isSelected ? "planner-routine-placement selected" : "planner-routine-placement"}
        style={{
          ...getLaneGeometry(laneIndex, laneCount),
          background: chunk.placement.color,
          color: isLightBlock ? "#111111" : "#ffffff",
          border: isLightBlock ? "1px solid rgba(17, 17, 17, 0.18)" : undefined,
          transform: isOrigin ? CSS.Translate.toString(transform) : undefined,
          opacity: isOrigin && isDragging ? 0.35 : 1
        }}
        onClick={() => onSelect(chunk.placement.id)}
      >
        <div
          ref={isOrigin ? setNodeRef : undefined}
          className={isOrigin && !readOnly ? "planner-routine-placement-copy planner-routine-drag-handle" : "planner-routine-placement-copy"}
          {...(isOrigin && !readOnly ? listeners : {})}
          {...(isOrigin && !readOnly ? attributes : {})}
        >
          {showTitle ? <strong className="planner-routine-placement-title">{chunk.placement.title}</strong> : <span className="planner-routine-placement-placeholder" />}
          {showCount ? <span className="planner-routine-placement-count">{chunk.placement.duration} counts</span> : null}
        </div>
        {isFirstChunk ? <ResizeHotspot placementId={chunk.placement.id} edge="start" disabled={readOnly} /> : null}
        {isLastChunk ? <ResizeHotspot placementId={chunk.placement.id} edge="end" disabled={readOnly} /> : null}
      </div>
    </div>
  );
}

function CueNoteEditor({
  placement,
  row,
  col,
  laneIndex,
  laneCount,
  value,
  readOnly,
  onChange
}: {
  placement: TeamRoutinePlacement;
  row: number;
  col: number;
  laneIndex: number;
  laneCount: number;
  value: string;
  readOnly: boolean;
  onChange: (noteId: string, value: string) => void;
}) {
  const noteId = createCueNoteId(placement.id, row, col);

  return (
    <div
      className="planner-routine-cue-overlay"
      style={{
        gridColumn: `${col + 1}`,
        gridRow: `${row + 2}`
      }}
    >
      <div className="planner-routine-cue-slot" style={getLaneGeometry(laneIndex, laneCount)}>
        <input
          className="planner-routine-cue-input"
          value={value}
          disabled={readOnly}
          onChange={(event) => onChange(noteId, event.target.value.slice(0, 18))}
          placeholder="cue"
        />
      </div>
    </div>
  );
}

function GridCell({
  row,
  col,
  previewState,
  rowCount
}: {
  row: number;
  col: number;
  previewState: "none" | "valid" | "invalid";
  rowCount: number;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `cell:${row}:${col}`
  });

  return (
    <div ref={setNodeRef} className={["planner-routine-grid-cell", previewState !== "none" ? previewState : "", isOver ? "over" : ""].filter(Boolean).join(" ")}>
      {previewState !== "none" ? <div className={`planner-routine-grid-preview ${previewState}`} /> : null}
      <span>{col + 1}</span>
      {col === 0 && row < rowCount ? <em className="planner-routine-row-badge">#{row + 1}</em> : null}
    </div>
  );
}

export function RoutineBuilderGrid({
  document,
  readOnly,
  previewCells,
  previewValid,
  selectedPlacementId,
  cueNotes,
  onUpdateConfig,
  onSelectPlacement,
  onCueNoteChange
}: {
  document: RoutineDocument;
  readOnly: boolean;
  previewCells: RoutineEditorOccupiedCell[];
  previewValid: boolean;
  selectedPlacementId: string | null;
  cueNotes: Record<string, string>;
  onUpdateConfig: (name: string, rowCount: number) => void;
  onSelectPlacement: (placementId: string) => void;
  onCueNoteChange: (noteId: string, value: string) => void;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>(OVERVIEW_MODE);

  const previewKeys = useMemo(() => new Set(previewCells.map((cell) => `${cell.row}-${cell.col}`)), [previewCells]);
  const rowChunksByPlacement = useMemo(() => {
    return new Map(document.placements.map((placement) => [placement.id, getPlacementRowChunks(placement, document.config.rowCount)] as const));
  }, [document.config.rowCount, document.placements]);
  const laneLayout = useMemo(() => buildLaneMap(document.placements, document.config.rowCount), [document.config.rowCount, document.placements]);
  const cueNoteCells = useMemo(() => {
    if (viewMode !== DETAIL_MODE) {
      return [] as Array<{ placement: TeamRoutinePlacement; row: number; col: number; laneIndex: number; laneCount: number }>;
    }

    return document.placements.flatMap((placement) =>
      getOccupiedCells(placement, document.config.rowCount).map((cell) => ({
        placement,
        row: cell.row,
        col: cell.col,
        laneIndex: laneLayout.laneByChunkKey.get(`${placement.id}:${cell.row}`) ?? 0,
        laneCount: laneLayout.laneCountByRow.get(cell.row) ?? 1
      }))
    );
  }, [document.config.rowCount, document.placements, laneLayout.laneByChunkKey, laneLayout.laneCountByRow, viewMode]);

  const summaryEntries = useMemo<SummaryEntry[]>(() => {
    if (viewMode !== SUMMARY_MODE) {
      return [];
    }

    const sortedPlacements = [...document.placements].sort((left, right) => {
      if (left.startRow !== right.startRow) {
        return left.startRow - right.startRow;
      }

      const leftLane = laneLayout.laneByChunkKey.get(`${left.id}:${left.startRow}`) ?? 0;
      const rightLane = laneLayout.laneByChunkKey.get(`${right.id}:${right.startRow}`) ?? 0;
      if (leftLane !== rightLane) {
        return leftLane - rightLane;
      }

      if (left.startCol !== right.startCol) {
        return left.startCol - right.startCol;
      }

      return left.id.localeCompare(right.id);
    });

    return sortedPlacements.map((placement) => ({
      placementId: placement.id,
      title: placement.title || "Untitled section",
      rowLabel: `Row ${placement.startRow + 1}`,
      cues: getOccupiedCells(placement, document.config.rowCount)
        .map((cell) => ({
          note: cueNotes[createCueNoteId(placement.id, cell.row, cell.col)]?.trim() ?? "",
          count: cell.col + 1
        }))
        .filter((item) => item.note.length > 0)
    }));
  }, [cueNotes, document.config.rowCount, document.placements, laneLayout.laneByChunkKey, viewMode]);

  return (
    <div className="planner-routine-grid-stack">
      <RoutineSetupCard document={document} readOnly={readOnly} onUpdateConfig={onUpdateConfig} />

      <Card className="planner-routine-editor-card planner-routine-grid-card">
        <CardContent className="planner-panel-stack">
          <div className="planner-routine-grid-head">
            <div>
              <strong>{document.config.name}</strong>
              <p>Drag sections onto the count map. Durations move horizontally and wrap into the next row.</p>
            </div>
            <Tabs
              className="planner-routine-view-tabs"
              items={VIEW_MODE_ITEMS.map((item) => ({ value: item.value, label: item.label }))}
              value={viewMode}
              onValueChange={(value) => setViewMode(value as ViewMode)}
              ariaLabel="Routine builder view mode"
            />
          </div>

          {viewMode === SUMMARY_MODE ? (
            <div className="planner-routine-summary-list">
              {summaryEntries.length ? summaryEntries.map((entry) => (
                <article key={entry.placementId} className="planner-routine-summary-card">
                  <div className="planner-routine-summary-head">
                    <strong>{entry.title}</strong>
                    <span>{entry.rowLabel}</span>
                  </div>
                  {entry.cues.length ? (
                    <div className="planner-routine-summary-cues">
                      {entry.cues.map((cue, index) => (
                        <p key={`${entry.placementId}-${cue.note}-${cue.count}-${index}`}>
                          <strong>{cue.note}</strong>
                          <span>- {cue.count}</span>
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="planner-routine-empty-copy">No key annotations yet.</p>
                  )}
                </article>
              )) : <p className="planner-routine-empty-copy">No placed sections yet.</p>}
            </div>
          ) : (
            <div className="planner-routine-grid-scroll">
              <div className="planner-routine-grid-board">
                {Array.from({ length: ROUTINE_BUILDER_COLUMN_COUNT }).map((_, col) => (
                  <div className="planner-routine-column-head" key={`head-${col}`} style={{ gridColumn: col + 1 }}>
                    Count {col + 1}
                  </div>
                ))}

                {Array.from({ length: document.config.rowCount }).flatMap((_, row) =>
                  Array.from({ length: ROUTINE_BUILDER_COLUMN_COUNT }).map((__, col) => {
                    const previewState = previewKeys.has(`${row}-${col}`)
                      ? (previewValid ? "valid" : "invalid")
                      : "none";

                    return (
                      <div key={`cell-${row}-${col}`} className="planner-routine-grid-slot" style={{ gridColumn: col + 1, gridRow: row + 2 }}>
                        <GridCell row={row} col={col} previewState={previewState} rowCount={document.config.rowCount} />
                      </div>
                    );
                  })
                )}

                {cueNoteCells.map((item) => (
                  <CueNoteEditor
                    key={`cue-${item.placement.id}-${item.row}-${item.col}`}
                    placement={item.placement}
                    row={item.row}
                    col={item.col}
                    laneIndex={item.laneIndex}
                    laneCount={item.laneCount}
                    value={cueNotes[createCueNoteId(item.placement.id, item.row, item.col)] ?? ""}
                    readOnly={readOnly}
                    onChange={onCueNoteChange}
                  />
                ))}

                {document.placements.flatMap((placement) => {
                  const chunks = rowChunksByPlacement.get(placement.id) ?? [];

                  return chunks.map((chunk, index) => {
                    const laneIndex = laneLayout.laneByChunkKey.get(`${placement.id}:${chunk.row}`) ?? 0;
                    const laneCount = laneLayout.laneCountByRow.get(chunk.row) ?? 1;
                    const isOrigin = chunk.row === placement.startRow && chunk.startCol === placement.startCol;
                    const isFirstChunk = index === 0;
                    const isLastChunk = index === chunks.length - 1;

                    return (
                      <PlacementChunkBlock
                        key={`chunk-${placement.id}-${chunk.row}-${chunk.startCol}`}
                        chunk={chunk}
                        laneIndex={laneIndex}
                        laneCount={laneCount}
                        isSelected={placement.id === selectedPlacementId}
                        isOrigin={isOrigin}
                        isLastChunk={isLastChunk}
                        isFirstChunk={isFirstChunk}
                        readOnly={readOnly}
                        viewMode={viewMode}
                        onSelect={onSelectPlacement}
                      />
                    );
                  });
                })}

                <div className="planner-routine-grid-divider" style={{ gridColumn: `1 / span ${ROUTINE_BUILDER_COLUMN_COUNT}`, gridRow: `2 / span ${document.config.rowCount}` }} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
