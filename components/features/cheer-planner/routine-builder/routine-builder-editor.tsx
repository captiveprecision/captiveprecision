"use client";

import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import { useEffect, useMemo, useState } from "react";

import { ROUTINE_BUILDER_COLUMN_COUNT, type RoutineDocument, type TeamRoutinePlacement } from "@/lib/domain/routine-plan";
import type { RoutineBuilderSkillDefinition } from "@/lib/services/planner-routine-builder";
import { RoutineBuilderGrid } from "@/components/features/cheer-planner/routine-builder/routine-builder-grid";
import { RoutineBuilderSkillsPanel } from "@/components/features/cheer-planner/routine-builder/routine-builder-skills-panel";
import {
  clampRoutineRowCount,
  createRoutinePlacementId,
  getOccupiedCells,
  getPlacementDurationFromCell,
  getPlacementFromStartResize,
  parseCellId,
  placementFits,
  placementWithinOverlapLimit,
  type RoutineEditorDragPlacementPayload,
  type RoutineEditorDragResizePayload,
  type RoutineEditorDragSkillPayload
} from "@/components/features/cheer-planner/routine-builder/routine-builder-editor-utils";

const MAX_CELL_OVERLAP = 3;

function buildTransitionSkill(index: number): RoutineBuilderSkillDefinition {
  return {
    id: `transition-draft-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    skillSelectionId: null,
    athleteId: null,
    kind: "transition",
    name: `Transition ${index}`,
    category: "Transitions",
    description: "Coach marker for athlete movement and floor travel between sections.",
    defaultDuration: 4,
    color: "#ffffff",
    tags: ["__transition__"]
  };
}

function mergeEditorSkills(externalSkills: RoutineBuilderSkillDefinition[], currentSkills: RoutineBuilderSkillDefinition[]) {
  const currentMap = new Map(currentSkills.map((skill) => [skill.id, skill] as const));
  const mergedBaseSkills = externalSkills.map((skill) => {
    const currentSkill = currentMap.get(skill.id);

    if (!currentSkill) {
      return skill;
    }

    return {
      ...skill,
      defaultDuration: currentSkill.defaultDuration,
      color: skill.kind === "transition" ? "#ffffff" : currentSkill.color
    };
  });
  const mergedSkillIds = new Set(mergedBaseSkills.map((skill) => skill.id));
  const transitionSkills = currentSkills.filter((skill) => skill.kind === "transition" && !mergedSkillIds.has(skill.id));

  return [...mergedBaseSkills, ...transitionSkills];
}

function updateDocument(document: RoutineDocument, updater: (current: RoutineDocument) => RoutineDocument, onDocumentChange: (nextDocument: RoutineDocument) => void) {
  onDocumentChange(updater(document));
}

function DragCard({
  title,
  detail,
  invalid,
  color
}: {
  title: string;
  detail: string;
  invalid?: boolean;
  color: string;
}) {
  return (
    <div className={invalid ? "planner-routine-drag-card invalid" : "planner-routine-drag-card"} style={invalid ? undefined : { background: color }}>
      <strong>{title}</strong>
      <span>{detail}</span>
    </div>
  );
}

export function RoutineBuilderEditor({
  initialDocument,
  skills,
  teamName,
  readOnly = false,
  onDocumentChange
}: {
  initialDocument: RoutineDocument;
  skills: RoutineBuilderSkillDefinition[];
  teamName: string;
  readOnly?: boolean;
  onDocumentChange: (nextDocument: RoutineDocument) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const document = initialDocument;
  const [editorSkills, setEditorSkills] = useState<RoutineBuilderSkillDefinition[]>(() => skills);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(skills[0]?.id ?? null);
  const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(null);
  const [activeSkillId, setActiveSkillId] = useState<string | null>(null);
  const [activePlacementId, setActivePlacementId] = useState<string | null>(null);
  const [activeResizePlacementId, setActiveResizePlacementId] = useState<string | null>(null);
  const [activeResizeEdge, setActiveResizeEdge] = useState<"start" | "end" | null>(null);
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null);

  useEffect(() => {
    setEditorSkills((currentSkills) => mergeEditorSkills(skills, currentSkills));
  }, [skills]);

  useEffect(() => {
    setSelectedSkillId((current) => {
      if (current && editorSkills.some((skill) => skill.id === current)) {
        return current;
      }

      return editorSkills[0]?.id ?? null;
    });
  }, [editorSkills]);

  useEffect(() => {
    if (!selectedPlacementId) {
      return;
    }

    if (!document.placements.some((placement) => placement.id === selectedPlacementId)) {
      setSelectedPlacementId(null);
    }
  }, [document.placements, selectedPlacementId]);

  const selectedSkill = useMemo(
    () => editorSkills.find((skill) => skill.id === selectedSkillId) ?? null,
    [editorSkills, selectedSkillId]
  );

  const activeSkill = useMemo(() => {
    if (activeSkillId) {
      return editorSkills.find((skill) => skill.id === activeSkillId) ?? null;
    }

    const drivenPlacementId = activeResizePlacementId ?? activePlacementId;
    if (drivenPlacementId) {
      const placement = document.placements.find((item) => item.id === drivenPlacementId);
      if (!placement) {
        return null;
      }

      return {
        id: placement.skillSelectionId ?? placement.id,
        skillSelectionId: placement.skillSelectionId,
        athleteId: placement.athleteId,
        kind: placement.kind,
        name: placement.title,
        category: placement.category,
        description: placement.category,
        defaultDuration: placement.duration,
        color: placement.color,
        tags: placement.kind === "transition" ? ["__transition__"] : []
      } satisfies RoutineBuilderSkillDefinition;
    }

    return null;
  }, [activePlacementId, activeResizePlacementId, activeSkillId, document.placements, editorSkills]);

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
        duration: getPlacementDurationFromCell(placement, hoveredCell.row, hoveredCell.col)
      };
    }

    const basePlacement = activePlacementId
      ? document.placements.find((placement) => placement.id === activePlacementId) ?? null
      : null;

    return {
      id: basePlacement?.id ?? "preview",
      skillSelectionId: activeSkill.skillSelectionId,
      athleteId: activeSkill.athleteId,
      kind: activeSkill.kind,
      title: activeSkill.name,
      category: activeSkill.category,
      color: activeSkill.kind === "transition" ? "#ffffff" : activeSkill.color,
      startRow: hoveredCell.row,
      startCol: hoveredCell.col,
      duration: basePlacement?.duration ?? activeSkill.defaultDuration,
      sortOrder: basePlacement?.sortOrder ?? document.placements.length,
      status: basePlacement?.status ?? "planned",
      notes: basePlacement?.notes ?? ""
    } satisfies TeamRoutinePlacement;
  }, [activePlacementId, activeResizeEdge, activeResizePlacementId, activeSkill, document.placements, hoveredCell]);

  const previewStatus = useMemo(() => {
    if (!previewPlacement) {
      return null;
    }

    const fits = placementFits(previewPlacement, document.config.rowCount);
    const withinOverlapLimit = placementWithinOverlapLimit(previewPlacement, document.placements, document.config.rowCount, MAX_CELL_OVERLAP);

    return {
      fits,
      valid: fits && withinOverlapLimit,
      cells: getOccupiedCells(previewPlacement, document.config.rowCount)
    };
  }, [document.config.rowCount, document.placements, previewPlacement]);

  function handleDragStart(event: DragStartEvent) {
    if (readOnly) {
      return;
    }

    const data = event.active.data.current as RoutineEditorDragSkillPayload | RoutineEditorDragPlacementPayload | RoutineEditorDragResizePayload | undefined;
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
      return;
    }

    setActivePlacementId(data.placementId);
    setActiveResizePlacementId(null);
    setActiveSkillId(null);
    setSelectedPlacementId(data.placementId);
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
    const data = event.active.data.current as RoutineEditorDragSkillPayload | RoutineEditorDragPlacementPayload | RoutineEditorDragResizePayload | undefined;
    const overId = event.over?.id;
    setActiveSkillId(null);
    setActivePlacementId(null);
    setActiveResizePlacementId(null);
    setActiveResizeEdge(null);
    setHoveredCell(null);

    if (readOnly || !data || typeof overId !== "string") {
      return;
    }

    const cell = parseCellId(overId);
    if (!cell) {
      return;
    }

    if (data.type === "skill") {
      const skill = editorSkills.find((item) => item.id === data.skillId);
      if (!skill) {
        return;
      }

      const candidate: TeamRoutinePlacement = {
        id: createRoutinePlacementId(),
        skillSelectionId: skill.skillSelectionId,
        athleteId: skill.athleteId,
        kind: skill.kind,
        title: skill.name,
        category: skill.category,
        color: skill.kind === "transition" ? "#ffffff" : skill.color,
        startRow: cell.row,
        startCol: cell.col,
        duration: skill.defaultDuration,
        sortOrder: document.placements.length,
        status: "planned",
        notes: ""
      };

      if (!placementFits(candidate, document.config.rowCount) || !placementWithinOverlapLimit(candidate, document.placements, document.config.rowCount, MAX_CELL_OVERLAP)) {
        return;
      }

      updateDocument(document, (currentDocument) => ({
        ...currentDocument,
        placements: [...currentDocument.placements, candidate]
      }), onDocumentChange);
      setSelectedPlacementId(candidate.id);
      return;
    }

    if (data.type === "resize") {
      const placement = document.placements.find((item) => item.id === data.placementId);
      if (!placement) {
        return;
      }

      const candidate: TeamRoutinePlacement = data.edge === "start"
        ? getPlacementFromStartResize(placement, cell.row, cell.col)
        : {
            ...placement,
            duration: getPlacementDurationFromCell(placement, cell.row, cell.col)
          };

      if (!placementFits(candidate, document.config.rowCount) || !placementWithinOverlapLimit(candidate, document.placements, document.config.rowCount, MAX_CELL_OVERLAP)) {
        return;
      }

      updateDocument(document, (currentDocument) => ({
        ...currentDocument,
        placements: currentDocument.placements.map((item) => (item.id === candidate.id ? candidate : item))
      }), onDocumentChange);
      setSelectedPlacementId(candidate.id);
      return;
    }

    const placement = document.placements.find((item) => item.id === data.placementId);
    if (!placement) {
      return;
    }

    const candidate: TeamRoutinePlacement = {
      ...placement,
      startRow: cell.row,
      startCol: cell.col
    };

    if (!placementFits(candidate, document.config.rowCount) || !placementWithinOverlapLimit(candidate, document.placements, document.config.rowCount, MAX_CELL_OVERLAP)) {
      return;
    }

    updateDocument(document, (currentDocument) => ({
      ...currentDocument,
      placements: currentDocument.placements.map((item) => (item.id === candidate.id ? candidate : item))
    }), onDocumentChange);
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
  }

  function handleRemovePlacement(placementId: string) {
    updateDocument(document, (currentDocument) => ({
      ...currentDocument,
      placements: currentDocument.placements.filter((placement) => placement.id !== placementId),
      cueNotes: Object.fromEntries(Object.entries(currentDocument.cueNotes).filter(([key]) => !key.startsWith(`${placementId}:`)))
    }), onDocumentChange);

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
      duration
    };

    if (!placementFits(candidate, document.config.rowCount) || !placementWithinOverlapLimit(candidate, document.placements, document.config.rowCount, MAX_CELL_OVERLAP)) {
      return;
    }

    updateDocument(document, (currentDocument) => ({
      ...currentDocument,
      placements: currentDocument.placements.map((item) => (item.id === placementId ? candidate : item))
    }), onDocumentChange);
  }

  function handleSkillDurationChange(skillId: string, duration: number) {
    if (!Number.isFinite(duration) || duration < 1) {
      return;
    }

    setEditorSkills((currentSkills) => currentSkills.map((skill) => (
      skill.id === skillId ? { ...skill, defaultDuration: duration } : skill
    )));
  }

  function handleSkillColorChange(skillId: string, color: string) {
    setEditorSkills((currentSkills) => currentSkills.map((skill) => {
      if (skill.id !== skillId) {
        return skill;
      }

      if (skill.kind === "transition") {
        return { ...skill, color: "#ffffff" };
      }

      return { ...skill, color };
    }));

    const skill = editorSkills.find((currentSkill) => currentSkill.id === skillId);
    if (!skill || skill.kind === "transition") {
      return;
    }

    updateDocument(document, (currentDocument) => ({
      ...currentDocument,
      placements: currentDocument.placements.map((placement) => (
        placement.skillSelectionId && placement.skillSelectionId === skill.skillSelectionId
          ? { ...placement, color }
          : placement
      ))
    }), onDocumentChange);
  }

  function handlePlacementColorChange(placementId: string, color: string) {
    const placement = document.placements.find((item) => item.id === placementId);
    if (!placement || placement.kind === "transition") {
      return;
    }

    const matchingSkill = editorSkills.find((skill) => skill.skillSelectionId && skill.skillSelectionId === placement.skillSelectionId) ?? null;

    if (matchingSkill) {
      handleSkillColorChange(matchingSkill.id, color);
      return;
    }

    updateDocument(document, (currentDocument) => ({
      ...currentDocument,
      placements: currentDocument.placements.map((item) => (item.id === placementId ? { ...item, color } : item))
    }), onDocumentChange);
  }

  function handleAddTransition() {
    const transitionCount = editorSkills.filter((skill) => skill.kind === "transition").length + 1;
    const nextSkill = buildTransitionSkill(transitionCount);
    setEditorSkills((currentSkills) => [...currentSkills, nextSkill]);
    setSelectedSkillId(nextSkill.id);
  }

  function handleCueNoteChange(noteId: string, value: string) {
    updateDocument(document, (currentDocument) => ({
      ...currentDocument,
      cueNotes: {
        ...currentDocument.cueNotes,
        [noteId]: value
      }
    }), onDocumentChange);
  }

  function handleUpdateConfig(name: string, rowCount: number) {
    updateDocument(document, (currentDocument) => ({
      ...currentDocument,
      config: {
        ...currentDocument.config,
        name: name.trim() || `${teamName} Routine`,
        rowCount: clampRoutineRowCount(rowCount),
        columnCount: ROUTINE_BUILDER_COLUMN_COUNT
      }
    }), onDocumentChange);
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="planner-routine-editor-layout">
        <RoutineBuilderGrid
          document={document}
          readOnly={readOnly}
          previewCells={previewStatus?.cells ?? []}
          previewValid={previewStatus?.valid ?? false}
          selectedPlacementId={selectedPlacementId}
          cueNotes={document.cueNotes}
          onUpdateConfig={handleUpdateConfig}
          onSelectPlacement={handleSelectPlacement}
          onCueNoteChange={handleCueNoteChange}
        />
        <RoutineBuilderSkillsPanel
          document={document}
          skills={editorSkills}
          selectedSkillId={selectedSkillId}
          selectedPlacementId={selectedPlacementId}
          readOnly={readOnly}
          onPlacementDurationChange={handlePlacementDurationChange}
          onPlacementColorChange={handlePlacementColorChange}
          onRemovePlacement={handleRemovePlacement}
          onSelectPlacement={handleSelectPlacement}
          onSelectSkill={setSelectedSkillId}
          onSkillDurationChange={handleSkillDurationChange}
          onSkillColorChange={handleSkillColorChange}
          onAddTransition={handleAddTransition}
        />
      </div>

      <DragOverlay dropAnimation={null}>
        {activeSkill && !activeResizePlacementId ? (
          <DragCard
            title={activeSkill.name}
            detail={`${activeResizePlacementId ? "Resize block" : activePlacementId ? "Moving block" : "Drop on grid"} / ${previewPlacement?.duration ?? activeSkill.defaultDuration} counts`}
            invalid={Boolean(previewStatus && !previewStatus.valid)}
            color={activeSkill.color}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
