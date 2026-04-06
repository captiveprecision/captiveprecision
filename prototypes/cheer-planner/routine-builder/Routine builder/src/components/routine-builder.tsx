"use client";

import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useEffect, useMemo, useState } from "react";
import { RoutineGrid } from "@/components/routine-grid";
import { SkillsPanel } from "@/components/skills-panel";
import { mockSkillsSource } from "@/lib/mock-skills";
import {
  clampRowCount,
  getOccupiedCells,
  getPlacementDurationFromCell,
  getPlacementFromStartResize,
  placementFits,
  placementWithinOverlapLimit,
} from "@/lib/routine-utils";
import {
  COLUMN_COUNT,
  DEFAULT_ROW_COUNT,
  DragPlacementPayload,
  DragResizePayload,
  DragSkillPayload,
  RoutineDocument,
  RoutinePlacement,
  SkillDefinition,
} from "@/lib/types";

const STORAGE_KEY = "routine-builder-document";
const MAX_CELL_OVERLAP = 3;

function isTransitionSkill(skill: SkillDefinition) {
  return skill.tags.includes("__transition__");
}

function createInitialDocument(): RoutineDocument {
  return {
    config: {
      name: "Friday Finals",
      rowCount: DEFAULT_ROW_COUNT,
      columnCount: COLUMN_COUNT,
    },
    placements: [],
    cueNotes: {},
  };
}

function createPlacementId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `placement-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createRecoveredSkill(placement: RoutinePlacement): SkillDefinition {
  const isRecoveredTransition = placement.skillId.startsWith("transition-marker-");

  return {
    id: placement.skillId,
    name: isRecoveredTransition ? "Recovered Transition" : "Recovered Section",
    category: "Transitions",
    description: isRecoveredTransition
      ? "Recovered transition restored from a saved local routine."
      : "Recovered section restored from a saved local routine.",
    defaultDuration: placement.duration,
    color: isRecoveredTransition ? "#ffffff" : "#35524a",
    tags: isRecoveredTransition
      ? ["transition", "movement", "coach", "__transition__", "__recovered__"]
      : ["__recovered__"],
  };
}

function mergeRecoveredSkills(
  currentSkills: SkillDefinition[],
  placements: RoutinePlacement[],
) {
  const knownSkillIds = new Set(currentSkills.map((skill) => skill.id));
  const recoveredSkillsById = new Map<string, SkillDefinition>();

  placements.forEach((placement) => {
    if (knownSkillIds.has(placement.skillId) || recoveredSkillsById.has(placement.skillId)) {
      return;
    }

    recoveredSkillsById.set(placement.skillId, createRecoveredSkill(placement));
  });

  if (!recoveredSkillsById.size) {
    return currentSkills;
  }

  return [...currentSkills, ...recoveredSkillsById.values()];
}

function parseCellId(id: string) {
  const [prefix, row, col] = id.split(":");
  if (prefix !== "cell" || row === undefined || col === undefined) {
    return null;
  }

  return {
    row: Number(row),
    col: Number(col),
  };
}

function DragCard({
  title,
  detail,
  invalid,
  color,
}: {
  title: string;
  detail: string;
  invalid?: boolean;
  color: string;
}) {
  return (
    <div className={`drag-card${invalid ? " invalid" : ""}`} style={invalid ? undefined : { background: color }}>
      <strong>{title}</strong>
      <span>{detail}</span>
    </div>
  );
}

export function RoutineBuilder() {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [skills, setSkills] = useState<SkillDefinition[]>([]);
  const [document, setDocument] = useState<RoutineDocument>(createInitialDocument);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(null);
  const [activeSkillId, setActiveSkillId] = useState<string | null>(null);
  const [activePlacementId, setActivePlacementId] = useState<string | null>(null);
  const [activeResizePlacementId, setActiveResizePlacementId] = useState<string | null>(null);
  const [activeResizeEdge, setActiveResizeEdge] = useState<"start" | "end" | null>(null);
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    async function loadSkills() {
      const loadedSkills = await mockSkillsSource.getSkills();
      setSkills((currentSkills) => {
        const mergedSkills = mergeRecoveredSkills(
          currentSkills.length ? [...loadedSkills, ...currentSkills.filter((skill) => !loadedSkills.some((loadedSkill) => loadedSkill.id === skill.id))] : loadedSkills,
          document.placements,
        );
        setSelectedSkillId((currentSelectedSkillId) => currentSelectedSkillId ?? mergedSkills[0]?.id ?? null);
        return mergedSkills;
      });
    }

    void loadSkills();
  }, [document.placements]);

  useEffect(() => {
    try {
      const rawDocument = window.localStorage.getItem(STORAGE_KEY);
      if (!rawDocument) {
        setIsHydrated(true);
        return;
      }

      const parsedDocument = JSON.parse(rawDocument) as RoutineDocument;
      setDocument({
        config: {
          ...parsedDocument.config,
          rowCount: clampRowCount(parsedDocument.config.rowCount),
          columnCount: COLUMN_COUNT,
        },
        placements: parsedDocument.placements ?? [],
        cueNotes: parsedDocument.cueNotes ?? {},
      });
      setIsHydrated(true);
    } catch {
      setIsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(document));
  }, [document, isHydrated]);

  useEffect(() => {
    setSkills((currentSkills) => mergeRecoveredSkills(currentSkills, document.placements));
  }, [document.placements]);


  const selectedSkill = useMemo(
    () => skills.find((skill) => skill.id === selectedSkillId) ?? null,
    [selectedSkillId, skills],
  );

  const selectedPlacement = useMemo(
    () => document.placements.find((placement) => placement.id === selectedPlacementId) ?? null,
    [document.placements, selectedPlacementId],
  );

  const activeSkill = useMemo(() => {
    if (activeSkillId) {
      return skills.find((skill) => skill.id === activeSkillId) ?? null;
    }

    const drivenPlacementId = activeResizePlacementId ?? activePlacementId;
    if (drivenPlacementId) {
      const placement = document.placements.find((item) => item.id === drivenPlacementId);
      return skills.find((skill) => skill.id === placement?.skillId) ?? null;
    }

    return null;
  }, [activePlacementId, activeResizePlacementId, activeSkillId, document.placements, skills]);

  const previewPlacement = useMemo(() => {
    if (!hoveredCell || !activeSkill) {
      return null;
    }

    if (activeResizePlacementId) {
      const placement = document.placements.find((item) => item.id === activeResizePlacementId);
      if (!placement || !activeResizeEdge) {
        return null;
      }

      if (activeResizeEdge === "start") {
        return getPlacementFromStartResize(placement, hoveredCell.row, hoveredCell.col);
      }

      return {
        ...placement,
        duration: getPlacementDurationFromCell(placement, hoveredCell.row, hoveredCell.col),
      };
    }

    const basePlacement = activePlacementId
      ? document.placements.find((placement) => placement.id === activePlacementId) ?? null
      : null;

    return {
      id: basePlacement?.id ?? "preview",
      skillId: activeSkill.id,
      startRow: hoveredCell.row,
      startCol: hoveredCell.col,
      duration: basePlacement?.duration ?? activeSkill.defaultDuration,
    };
  }, [activePlacementId, activeResizeEdge, activeResizePlacementId, activeSkill, document.placements, hoveredCell]);

  const previewStatus = useMemo(() => {
    if (!previewPlacement) {
      return null;
    }

    const fits = placementFits(previewPlacement, document.config.rowCount);
    const withinOverlapLimit = placementWithinOverlapLimit(
      previewPlacement,
      document.placements,
      document.config.rowCount,
      MAX_CELL_OVERLAP,
    );

    return {
      fits,
      valid: fits && withinOverlapLimit,
      cells: getOccupiedCells(previewPlacement, document.config.rowCount),
    };
  }, [document.config.rowCount, document.placements, previewPlacement]);

  const occupiedMap = useMemo(() => {
    const nextMap = new Map();

    document.placements.forEach((placement) => {
      const skill = skills.find((item) => item.id === placement.skillId);
      const color = skill?.color ?? "#35524a";
      const skillName = skill?.name ?? "Unnamed section";

      getOccupiedCells(placement, document.config.rowCount).forEach((cell) => {
        const key = `${cell.row}-${cell.col}`;
        const entries = nextMap.get(key) ?? [];
        entries.push({ placement, isOrigin: cell.isOrigin, color, skillName });
        nextMap.set(key, entries);
      });
    });

    return nextMap;
  }, [document.config.rowCount, document.placements, skills]);

  function handleCreateRoutine(name: string, rowCount: number) {
    setDocument({
      config: {
        name: name.trim() || "Untitled Routine",
        rowCount: clampRowCount(rowCount),
        columnCount: COLUMN_COUNT,
      },
      placements: [],
      cueNotes: {},
    });
    setSelectedPlacementId(null);
  }

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current as
      | DragSkillPayload
      | DragPlacementPayload
      | DragResizePayload
      | undefined;
    if (!data) {
      return;
    }

    if (data.type === "skill") {
      setActiveSkillId(data.skillId);
      setActivePlacementId(null);
      setActiveResizePlacementId(null);
      setActiveResizeEdge(null);
      setSelectedSkillId(data.skillId);
      return;
    }

    if (data.type === "resize") {
      setActiveResizePlacementId(data.placementId);
      setActiveResizeEdge(data.edge);
      setActivePlacementId(null);
      setActiveSkillId(null);
      setSelectedPlacementId(data.placementId);
      const placement = document.placements.find((item) => item.id === data.placementId);
      if (placement) {
        setSelectedSkillId(placement.skillId);
      }
      return;
    }

    setActivePlacementId(data.placementId);
    setActiveResizePlacementId(null);
    setActiveSkillId(null);
    setSelectedPlacementId(data.placementId);
    const placement = document.placements.find((item) => item.id === data.placementId);
    if (placement) {
      setSelectedSkillId(placement.skillId);
    }
  }

  function handleDragOver(event: DragOverEvent) {
    const overId = event.over?.id;
    if (typeof overId !== "string") {
      setHoveredCell(null);
      return;
    }

    setHoveredCell(parseCellId(overId));
  }

  function handleDragEnd(event: DragEndEvent) {
    const data = event.active.data.current as
      | DragSkillPayload
      | DragPlacementPayload
      | DragResizePayload
      | undefined;
    const overId = event.over?.id;
    setActiveSkillId(null);
    setActivePlacementId(null);
    setActiveResizePlacementId(null);
    setActiveResizeEdge(null);
    setHoveredCell(null);

    if (!data || typeof overId !== "string") {
      return;
    }

    const cell = parseCellId(overId);
    if (!cell) {
      return;
    }

    if (data.type === "skill") {
      const skill = skills.find((item) => item.id === data.skillId);
      if (!skill) {
        return;
      }

      const candidate: RoutinePlacement = {
        id: createPlacementId(),
        skillId: skill.id,
        startRow: cell.row,
        startCol: cell.col,
        duration: skill.defaultDuration,
      };

      if (
        !placementFits(candidate, document.config.rowCount) ||
        !placementWithinOverlapLimit(candidate, document.placements, document.config.rowCount, MAX_CELL_OVERLAP)
      ) {
        return;
      }

      setDocument((currentDocument) => ({
        ...currentDocument,
        placements: [...currentDocument.placements, candidate],
      }));
      setSelectedPlacementId(candidate.id);
      return;
    }

    if (data.type === "resize") {
      const placement = document.placements.find((item) => item.id === data.placementId);
      if (!placement) {
        return;
      }

      const candidate: RoutinePlacement =
        data.edge === "start"
          ? getPlacementFromStartResize(placement, cell.row, cell.col)
          : {
              ...placement,
              duration: getPlacementDurationFromCell(placement, cell.row, cell.col),
            };

      if (
        !placementFits(candidate, document.config.rowCount) ||
        !placementWithinOverlapLimit(candidate, document.placements, document.config.rowCount, MAX_CELL_OVERLAP)
      ) {
        return;
      }

      setDocument((currentDocument) => ({
        ...currentDocument,
        placements: currentDocument.placements.map((item) =>
          item.id === candidate.id ? candidate : item,
        ),
      }));
      setSelectedPlacementId(candidate.id);
      return;
    }

    const placement = document.placements.find((item) => item.id === data.placementId);
    if (!placement) {
      return;
    }

    const candidate: RoutinePlacement = {
      ...placement,
      startRow: cell.row,
      startCol: cell.col,
    };

    if (
      !placementFits(candidate, document.config.rowCount) ||
      !placementWithinOverlapLimit(candidate, document.placements, document.config.rowCount, MAX_CELL_OVERLAP)
    ) {
      return;
    }

    setDocument((currentDocument) => ({
      ...currentDocument,
      placements: currentDocument.placements.map((item) =>
        item.id === candidate.id ? candidate : item,
      ),
    }));
  }

  function handleDragCancel() {
    setActiveSkillId(null);
    setActivePlacementId(null);
    setActiveResizePlacementId(null);
    setActiveResizeEdge(null);
    setHoveredCell(null);
  }

  function handleSelectPlacement(placementId: string) {
    setSelectedPlacementId(placementId);
    const placement = document.placements.find((item) => item.id === placementId);
    if (placement) {
      setSelectedSkillId(placement.skillId);
    }
  }

  function handleRemovePlacement(placementId: string) {
    setDocument((currentDocument) => ({
      ...currentDocument,
      placements: currentDocument.placements.filter((placement) => placement.id !== placementId),
    }));

    if (selectedPlacementId === placementId) {
      setSelectedPlacementId(null);
    }
  }

  function handlePlacementDurationChange(placementId: string, duration: number) {
    if (!Number.isFinite(duration) || duration < 1) {
      return;
    }

    const placement = document.placements.find((item) => item.id === placementId);
    if (!placement) {
      return;
    }

    const candidate = {
      ...placement,
      duration,
    };

    if (
      !placementFits(candidate, document.config.rowCount) ||
      !placementWithinOverlapLimit(candidate, document.placements, document.config.rowCount, MAX_CELL_OVERLAP)
    ) {
      return;
    }

    setDocument((currentDocument) => ({
      ...currentDocument,
      placements: currentDocument.placements.map((item) =>
        item.id === placementId ? candidate : item,
      ),
    }));
  }

  function handleSkillDurationChange(skillId: string, duration: number) {
    if (!Number.isFinite(duration) || duration < 1) {
      return;
    }

    setSkills((currentSkills) =>
      currentSkills.map((skill) =>
        skill.id === skillId ? { ...skill, defaultDuration: duration } : skill,
      ),
    );
  }

  function handleSkillColorChange(skillId: string, color: string) {
    setSkills((currentSkills) =>
      currentSkills.map((skill) => {
        if (skill.id !== skillId) {
          return skill;
        }

        if (isTransitionSkill(skill)) {
          return { ...skill, color: "#ffffff" };
        }

        return { ...skill, color };
      }),
    );
  }

  function handleAddTransition() {
    setSkills((currentSkills) => {
      const transitionCount = currentSkills.filter(isTransitionSkill).length + 1;
      const nextSkill: SkillDefinition = {
        id: `transition-marker-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name: `Transition ${transitionCount}`,
        category: "Transitions",
        description: "Coach marker for athlete movement and floor travel between sections.",
        defaultDuration: 4,
        color: "#ffffff",
        tags: ["transition", "movement", "coach", "__transition__"],
      };

      setSelectedSkillId(nextSkill.id);
      return [...currentSkills, nextSkill];
    });
  }

  function handleCueNoteChange(noteId: string, value: string) {
    setDocument((currentDocument) => ({
      ...currentDocument,
      cueNotes: {
        ...currentDocument.cueNotes,
        [noteId]: value,
      },
    }));
  }

  function handlePlacementColorChange(placementId: string, color: string) {
    const placement = document.placements.find((item) => item.id === placementId);
    if (!placement) {
      return;
    }

    handleSkillColorChange(placement.skillId, color);
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <main className="app-shell">
        <section className="hero-panel">
          <div>
            <p className="eyebrow">Routine Builder</p>
            <h1>Build Your Routine</h1>
            <p className="hero-copy">
              Configure the routine, drag skills into the grid, and shape the full sequence
              locally before integrating it into the larger platform.
            </p>
          </div>
        </section>

        <section className="workspace">
          <RoutineGrid
            document={document}
            occupiedMap={occupiedMap}
            previewCells={previewStatus?.cells ?? []}
            previewValid={previewStatus?.valid ?? false}
            onCreateRoutine={handleCreateRoutine}
            onSelectPlacement={handleSelectPlacement}
            selectedPlacementId={selectedPlacementId}
            cueNotes={document.cueNotes}
            onCueNoteChange={handleCueNoteChange}
          />
          <SkillsPanel
            document={document}
            selectedSkill={selectedSkill}
            selectedPlacement={selectedPlacement}
            skills={skills}
            onPlacementDurationChange={handlePlacementDurationChange}
            onPlacementColorChange={handlePlacementColorChange}
            onRemovePlacement={handleRemovePlacement}
            onSelectPlacement={handleSelectPlacement}
            onSelectSkill={setSelectedSkillId}
            onSkillDurationChange={handleSkillDurationChange}
            onSkillColorChange={handleSkillColorChange}
            onAddTransition={handleAddTransition}
          />
        </section>
      </main>

      <DragOverlay dropAnimation={null}>
        {activeSkill && !activeResizePlacementId ? (
          <DragCard
            title={activeSkill.name}
            detail={`${activeResizePlacementId ? "Resize block" : activePlacementId ? "Moving block" : "Drop on grid"} - ${previewPlacement?.duration ?? activeSkill.defaultDuration} counts`}
            invalid={Boolean(previewStatus && !previewStatus.valid)}
            color={activeSkill.color}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

