"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useMemo, useState } from "react";
import { getOccupiedCells, getLinearIndex } from "@/lib/routine-utils";
import {
  COLUMN_COUNT,
  DragPlacementPayload,
  DragResizePayload,
  OccupiedCell,
  RoutineDocument,
  RoutinePlacement,
} from "@/lib/types";

const OVERVIEW_MODE = "Overview";
const DETAIL_MODE = "Detail";
const SUMMARY_MODE = "Summary";

interface SummaryEntry {
  placementId: string;
  title: string;
  rowLabel: string;
  cues: Array<{ note: string; count: number }>;
}

interface OccupiedEntry {
  placement: RoutinePlacement;
  isOrigin: boolean;
  color: string;
  skillName: string;
}

interface RowChunk {
  placement: RoutinePlacement;
  row: number;
  startCol: number;
  span: number;
}

const GRID_ROW_HEIGHT = 54;
const GRID_LANE_VERTICAL_PADDING = 6;
const GRID_LANE_GAP = 3;
const GRID_LANE_MAX_HEIGHT = 12;
const GRID_LANE_MIN_HEIGHT = 6;

function getLaneGeometry(laneIndex: number, laneCount: number) {
  const availableHeight = GRID_ROW_HEIGHT - GRID_LANE_VERTICAL_PADDING * 2;
  const totalGap = Math.max(0, laneCount - 1) * GRID_LANE_GAP;
  const laneHeight = Math.max(
    GRID_LANE_MIN_HEIGHT,
    Math.min(GRID_LANE_MAX_HEIGHT, (availableHeight - totalGap) / Math.max(1, laneCount)),
  );
  const totalHeight = laneHeight * laneCount + totalGap;
  const top = Math.max(
    GRID_LANE_VERTICAL_PADDING,
    (GRID_ROW_HEIGHT - totalHeight) / 2 + laneIndex * (laneHeight + GRID_LANE_GAP),
  );

  return {
    top: `${top}px`,
    height: `${laneHeight}px`,
  };
}

function createCueNoteId(placementId: string, row: number, col: number) {
  return `${placementId}:${row}:${col}`;
}

function getPlacementRowChunks(placement: RoutinePlacement, rowCount: number) {
  const cells = getOccupiedCells(placement, rowCount);
  const chunks: RowChunk[] = [];

  cells.forEach((cell) => {
    const currentChunk = chunks[chunks.length - 1];
    if (
      !currentChunk ||
      currentChunk.row !== cell.row ||
      currentChunk.startCol + currentChunk.span !== cell.col
    ) {
      chunks.push({ row: cell.row, startCol: cell.col, span: 1, placement });
      return;
    }

    currentChunk.span += 1;
  });

  return chunks;
}

function buildLaneMap(placements: RoutinePlacement[], rowCount: number) {
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

      return (
        getLinearIndex(left.placement.startRow, left.placement.startCol) -
        getLinearIndex(right.placement.startRow, right.placement.startCol)
      );
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

function SetupCard({
  document,
  onCreateRoutine,
}: {
  document: RoutineDocument;
  onCreateRoutine: (name: string, rowCount: number) => void;
}) {
  const [name, setName] = useState(document.config.name);
  const [rowCount, setRowCount] = useState(document.config.rowCount);

  useEffect(() => {
    setName(document.config.name);
    setRowCount(document.config.rowCount);
  }, [document.config.name, document.config.rowCount]);

  return (
    <div className="setup-card">
      <div className="section-heading">
        <div>
          <p className="section-label">Routine setup</p>
          <h2>{document.config.name}</h2>
        </div>
      </div>

      <label className="field">
        <span>Team Name</span>
        <input value={name} onChange={(event) => setName(event.target.value)} />
      </label>

      <label className="field">
        <span>Number of eights</span>
        <input
          type="number"
          min={8}
          max={80}
          value={rowCount}
          onChange={(event) => setRowCount(Number(event.target.value))}
        />
      </label>

      <button className="primary-button" onClick={() => onCreateRoutine(name, rowCount)} type="button">
        Start from this setup
      </button>
    </div>
  );
}

function ResizeHotspot({
  placementId,
  edge,
}: {
  placementId: string;
  edge: "start" | "end";
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `resize:${placementId}:${edge}`,
    data: {
      type: "resize",
      placementId,
      edge,
    } satisfies DragResizePayload,
  });

  return (
    <div
      ref={setNodeRef}
      className={`placement-resize-hotspot ${edge}`}
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.6 : 1,
      }}
      {...listeners}
      {...attributes}
      aria-label={`Resize section from ${edge}`}
      title={`Resize section from ${edge}`}
      role="presentation"
    />
  );
}

function PlacementChunkBlock({
  chunk,
  skillName,
  duration,
  color,
  laneIndex,
  laneCount,
  isSelected,
  isOrigin,
  isLastChunk,
  isFirstChunk,
  viewMode,
  onSelect,
}: {
  chunk: RowChunk;
  skillName: string;
  duration: number;
  color: string;
  laneIndex: number;
  laneCount: number;
  isSelected: boolean;
  isOrigin: boolean;
  isLastChunk: boolean;
  isFirstChunk: boolean;
  viewMode: string;
  onSelect: (placementId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `placement:${chunk.placement.id}`,
    data: {
      type: "placement",
      placementId: chunk.placement.id,
    } satisfies DragPlacementPayload,
    disabled: !isOrigin,
  });

  const showTitle = viewMode === OVERVIEW_MODE && isOrigin;
  const showCount = viewMode === OVERVIEW_MODE && isLastChunk;
  const isLightBlock = color.toLowerCase() === "#ffffff";

  return (
    <div
      className="placement-block-overlay"
      style={{
        gridColumn: `${chunk.startCol + 1} / span ${chunk.span}`,
        gridRow: `${chunk.row + 2}`,
      }}
    >
      <div
        className={`placement-block${isSelected ? " selected" : ""}`}
        style={{
          ...getLaneGeometry(laneIndex, laneCount),
          background: color,
          color: isLightBlock ? "#111111" : "#ffffff",
          border: isLightBlock ? "1px solid rgba(17, 17, 17, 0.18)" : undefined,
          transform: isOrigin ? CSS.Translate.toString(transform) : undefined,
          opacity: isOrigin && isDragging ? 0.35 : 1,
        }}
        onClick={() => onSelect(chunk.placement.id)}
      >
        <div
          ref={isOrigin ? setNodeRef : undefined}
          className={`placement-block-copy${isOrigin ? " placement-drag-handle" : ""}`}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onSelect(chunk.placement.id);
            }
          }}
          {...(isOrigin ? listeners : {})}
          {...(isOrigin ? attributes : {})}
        >
          {showTitle ? <strong className="placement-block-title">{skillName}</strong> : <span className="placement-block-placeholder" />}
          {showCount ? <span className="placement-block-count">{duration} counts</span> : null}
        </div>
        {isFirstChunk ? <ResizeHotspot placementId={chunk.placement.id} edge="start" /> : null}
        {isLastChunk ? <ResizeHotspot placementId={chunk.placement.id} edge="end" /> : null}
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
  onChange,
}: {
  placement: RoutinePlacement;
  row: number;
  col: number;
  laneIndex: number;
  laneCount: number;
  value: string;
  onChange: (noteId: string, value: string) => void;
}) {
  const noteId = createCueNoteId(placement.id, row, col);

  return (
    <div
      className="cue-note-overlay"
      style={{
        gridColumn: `${col + 1}`,
        gridRow: `${row + 2}`,
      }}
    >
      <div className="cue-note-slot" style={getLaneGeometry(laneIndex, laneCount)}>
        <input
          className="cue-note-input"
          value={value}
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
  rowCount,
}: {
  row: number;
  col: number;
  previewState: "none" | "valid" | "invalid";
  rowCount: number;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `cell:${row}:${col}`,
  });

  return (
    <div
      ref={setNodeRef}
      className={[
        "grid-cell",
        previewState !== "none" ? previewState : "",
        isOver ? "over" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {previewState !== "none" ? <div className={`grid-cell-preview-layer ${previewState}`} /> : null}
      <span>{col + 1}</span>
      {col === 0 && row < rowCount ? <em className="row-badge">#{row + 1}</em> : null}
    </div>
  );
}

export function RoutineGrid({
  document,
  occupiedMap,
  previewCells,
  previewValid,
  onCreateRoutine,
  onSelectPlacement,
  selectedPlacementId,
  cueNotes,
  onCueNoteChange,
}: {
  document: RoutineDocument;
  occupiedMap: Map<string, OccupiedEntry[]>;
  previewCells: OccupiedCell[];
  previewValid: boolean;
  onCreateRoutine: (name: string, rowCount: number) => void;
  onSelectPlacement: (placementId: string) => void;
  selectedPlacementId: string | null;
  cueNotes: Record<string, string>;
  onCueNoteChange: (noteId: string, value: string) => void;
}) {
  const [viewMode, setViewMode] = useState(OVERVIEW_MODE);

  const previewKeys = useMemo(
    () => new Set(previewCells.map((cell) => `${cell.row}-${cell.col}`)),
    [previewCells],
  );

  const rowChunksByPlacement = useMemo(() => {
    return new Map(
      document.placements.map((placement) => [
        placement.id,
        getPlacementRowChunks(placement, document.config.rowCount),
      ]),
    );
  }, [document.config.rowCount, document.placements]);

  const laneLayout = useMemo(
    () => buildLaneMap(document.placements, document.config.rowCount),
    [document.config.rowCount, document.placements],
  );
  const cueNoteCells = useMemo(() => {
    if (viewMode !== DETAIL_MODE) {
      return [];
    }

    return document.placements.flatMap((placement) =>
      getOccupiedCells(placement, document.config.rowCount).map((cell) => ({
        placement,
        row: cell.row,
        col: cell.col,
        laneIndex: laneLayout.laneByChunkKey.get(`${placement.id}:${cell.row}`) ?? 0,
        laneCount: laneLayout.laneCountByRow.get(cell.row) ?? 1,
      })),
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

    return sortedPlacements.map((placement) => {
      const originEntries = occupiedMap.get(`${placement.startRow}-${placement.startCol}`) ?? [];
      const originEntry = originEntries.find((entry) => entry.placement.id === placement.id);
      const cues = getOccupiedCells(placement, document.config.rowCount)
        .map((cell) => ({
          note: cueNotes[createCueNoteId(placement.id, cell.row, cell.col)]?.trim() ?? "",
          count: cell.col + 1,
        }))
        .filter((item) => item.note.length > 0);

      return {
        placementId: placement.id,
        title: originEntry?.skillName ?? "Unnamed section",
        rowLabel: `Row ${placement.startRow + 1}`,
        cues,
      };
    });
  }, [cueNotes, document.config.rowCount, document.placements, laneLayout.laneByChunkKey, occupiedMap, viewMode]);

  return (
    <section className="grid-panel">
      <SetupCard document={document} onCreateRoutine={onCreateRoutine} />

      <div className="grid-panel-header">
        <div>
          <div className="grid-view-row">
            <p className="section-label">Routine map</p>
            <label className="grid-view-select-wrap">
              <span className="sr-only">View mode</span>
              <select value={viewMode} onChange={(event) => setViewMode(event.target.value)}>
                <option>{OVERVIEW_MODE}</option>
                <option>{DETAIL_MODE}</option>
                <option>{SUMMARY_MODE}</option>
              </select>
            </label>
          </div>
          <h2>{document.config.name}</h2>
        </div>
        <p className="grid-note">
          Drag skills onto the count map. Durations move horizontally and wrap into the next row.
        </p>
      </div>

      {viewMode === SUMMARY_MODE ? (
        <div className="summary-panel">
          {summaryEntries.length ? (
            <div className="summary-list">
              {summaryEntries.map((entry) => (
                <article className="summary-card" key={entry.placementId}>
                  <div className="summary-card-header">
                    <h3>{entry.title}</h3>
                    <span>{entry.rowLabel}</span>
                  </div>
                  {entry.cues.length ? (
                    <div className="summary-cues">
                      {entry.cues.map((cue, index) => (
                        <p key={`${entry.placementId}-${cue.note}-${cue.count}-${index}`}>
                          <strong>{cue.note}</strong>
                          <span>- {cue.count}</span>
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="summary-empty">No key annotations yet.</p>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <p className="summary-empty">No placed sections yet.</p>
          )}
        </div>
      ) : (
      <div className="grid-scroll">
        <div className="grid-board">
          {Array.from({ length: COLUMN_COUNT }).map((_, col) => (
            <div className="grid-column-head" key={`head-${col}`} style={{ gridColumn: col + 1 }}>
              Count {col + 1}
            </div>
          ))}

          {Array.from({ length: document.config.rowCount }).flatMap((_, row) =>
            Array.from({ length: COLUMN_COUNT }).map((__, col) => {
              const previewState = previewKeys.has(`${row}-${col}`)
                ? previewValid
                  ? "valid"
                  : "invalid"
                : "none";

              return (
                <div
                  className="grid-cell-slot"
                  key={`cell-${row}-${col}`}
                  style={{
                    gridColumn: col + 1,
                    gridRow: row + 2,
                  }}
                >
                  <GridCell
                    row={row}
                    col={col}
                    previewState={previewState}
                    rowCount={document.config.rowCount}
                  />
                </div>
              );
            }),
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
              onChange={onCueNoteChange}
            />
          ))}

          {document.placements.flatMap((placement) => {
            const originEntries = occupiedMap.get(`${placement.startRow}-${placement.startCol}`) ?? [];
            const originEntry = originEntries.find((entry) => entry.placement.id === placement.id);
            if (!originEntry) {
              return [];
            }

            const chunks = rowChunksByPlacement.get(placement.id) ?? [];

            return chunks.map((chunk, index) => {
              const laneIndex = laneLayout.laneByChunkKey.get(`${placement.id}:${chunk.row}`) ?? 0;
              const laneCount = laneLayout.laneCountByRow.get(chunk.row) ?? 1;
              const isOrigin =
                chunk.row === placement.startRow && chunk.startCol === placement.startCol;
              const isFirstChunk = index === 0;
              const isLastChunk = index === chunks.length - 1;

              return (
                <PlacementChunkBlock
                  key={`chunk-${placement.id}-${chunk.row}-${chunk.startCol}`}
                  chunk={chunk}
                  skillName={originEntry.skillName}
                  duration={placement.duration}
                  color={originEntry.color}
                  laneIndex={laneIndex}
                  laneCount={laneCount}
                  isSelected={placement.id === selectedPlacementId}
                  isOrigin={isOrigin}
                  isLastChunk={isLastChunk}
                  isFirstChunk={isFirstChunk}
                  viewMode={viewMode}
                  onSelect={onSelectPlacement}
                />
              );
            });
          })}

          <div
            className="grid-divider-overlay"
            style={{
              gridColumn: `1 / span ${COLUMN_COUNT}`,
              gridRow: `2 / span ${document.config.rowCount}`,
            }}
          />
        </div>
      </div>
      )}
    </section>
  );
}

