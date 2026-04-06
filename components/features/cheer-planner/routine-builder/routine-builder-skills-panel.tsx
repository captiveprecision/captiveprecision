"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button, Card, CardContent, Input } from "@/components/ui";
import type { RoutineDocument, TeamRoutinePlacement } from "@/lib/domain/routine-plan";
import type { RoutineBuilderSkillDefinition } from "@/lib/services/planner-routine-builder";
import type { RoutineEditorDragSkillPayload } from "@/components/features/cheer-planner/routine-builder/routine-builder-editor-utils";

const PRESET_COLORS = [
  { label: "Black", value: "#0f0f0f" },
  { label: "Yellow", value: "#ffc800" },
  { label: "Dark Gray", value: "#1f1f1f" },
  { label: "Mid Gray", value: "#6b7280" },
  { label: "Light Gray", value: "#9ca3af" }
] as const;

function ColorPicker({
  color,
  onChange,
  disabled = false
}: {
  color: string;
  onChange: (color: string) => void;
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="planner-routine-color-picker">
      <button
        type="button"
        className="planner-routine-color-trigger"
        onClick={() => {
          if (!disabled) {
            setIsOpen((current) => !current);
          }
        }}
        disabled={disabled}
        aria-label="Choose section color"
      >
        <span className="planner-routine-color-line" style={{ background: color }} />
      </button>
      {isOpen && !disabled ? (
        <div className="planner-routine-color-popover">
          {PRESET_COLORS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              className={preset.value.toLowerCase() === color.toLowerCase() ? "planner-routine-swatch active" : "planner-routine-swatch"}
              style={{ background: preset.value }}
              onClick={() => {
                onChange(preset.value);
                setIsOpen(false);
              }}
              aria-label={preset.label}
              title={preset.label}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SkillLibraryItem({
  skill,
  isSelected,
  placementCount,
  readOnly,
  onSelect,
  onDurationChange,
  onColorChange
}: {
  skill: RoutineBuilderSkillDefinition;
  isSelected: boolean;
  placementCount: number;
  readOnly: boolean;
  onSelect: (skillId: string) => void;
  onDurationChange: (skillId: string, duration: number) => void;
  onColorChange: (skillId: string, color: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `skill:${skill.id}`,
    data: {
      type: "skill",
      skillId: skill.id
    } satisfies RoutineEditorDragSkillPayload,
    disabled: readOnly
  });
  const isTransition = skill.kind === "transition";

  return (
    <div
      ref={setNodeRef}
      className={isSelected ? "planner-routine-editor-item selected" : "planner-routine-editor-item"}
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.35 : 1
      }}
    >
      <button
        type="button"
        className="planner-routine-editor-select"
        onClick={() => onSelect(skill.id)}
        {...(!readOnly ? listeners : {})}
        {...(!readOnly ? attributes : {})}
      >
        <div className="planner-routine-editor-copy">
          <strong>{skill.name}</strong>
          <span>
            {skill.category}
            {placementCount > 0 ? ` / ${placementCount} placed` : ""}
          </span>
        </div>
      </button>
      <div className="planner-routine-editor-actions">
        <ColorPicker color={skill.color} onChange={(color) => onColorChange(skill.id, color)} disabled={readOnly || isTransition} />
        <label className="planner-routine-mini-field">
          <span>Counts</span>
          <input
            min={1}
            max={32}
            type="number"
            value={skill.defaultDuration}
            disabled={readOnly}
            onChange={(event) => onDurationChange(skill.id, Number(event.target.value))}
          />
        </label>
      </div>
    </div>
  );
}

export function RoutineBuilderSkillsPanel({
  document,
  skills,
  selectedSkillId,
  selectedPlacementId,
  readOnly,
  onPlacementDurationChange,
  onPlacementColorChange,
  onRemovePlacement,
  onSelectPlacement,
  onSelectSkill,
  onSkillDurationChange,
  onSkillColorChange,
  onAddTransition
}: {
  document: RoutineDocument;
  skills: RoutineBuilderSkillDefinition[];
  selectedSkillId: string | null;
  selectedPlacementId: string | null;
  readOnly: boolean;
  onPlacementDurationChange: (placementId: string, duration: number) => void;
  onPlacementColorChange: (placementId: string, color: string) => void;
  onRemovePlacement: (placementId: string) => void;
  onSelectPlacement: (placementId: string) => void;
  onSelectSkill: (skillId: string) => void;
  onSkillDurationChange: (skillId: string, duration: number) => void;
  onSkillColorChange: (skillId: string, color: string) => void;
  onAddTransition: () => void;
}) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const placedListRef = useRef<HTMLDivElement | null>(null);
  const placedItemRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const categories = useMemo(() => ["All", ...Array.from(new Set(skills.map((skill) => skill.category)))], [skills]);
  const placementCountBySkillId = useMemo(() => {
    return document.placements.reduce<Record<string, number>>((accumulator, placement) => {
      if (!placement.skillSelectionId) {
        return accumulator;
      }

      accumulator[placement.skillSelectionId] = (accumulator[placement.skillSelectionId] ?? 0) + 1;
      return accumulator;
    }, {});
  }, [document.placements]);

  const filteredSkills = useMemo(() => {
    return skills.filter((skill) => {
      const matchesCategory = activeCategory === "All" || skill.category === activeCategory;
      const normalizedQuery = query.trim().toLowerCase();
      const matchesQuery = normalizedQuery.length === 0
        || skill.name.toLowerCase().includes(normalizedQuery)
        || skill.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery));

      return matchesCategory && matchesQuery;
    });
  }, [activeCategory, query, skills]);

  const unplacedSkills = useMemo(() => {
    return filteredSkills.filter((skill) => skill.kind === "transition" || !placementCountBySkillId[skill.skillSelectionId ?? ""]);
  }, [filteredSkills, placementCountBySkillId]);

  const placedSections = useMemo(() => {
    return [...document.placements].sort((left, right) => {
      if (left.startRow !== right.startRow) {
        return left.startRow - right.startRow;
      }

      if (left.startCol !== right.startCol) {
        return left.startCol - right.startCol;
      }

      return left.id.localeCompare(right.id);
    });
  }, [document.placements]);

  useEffect(() => {
    if (!selectedPlacementId) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      const listElement = placedListRef.current;
      const selectedElement = placedItemRefs.current[selectedPlacementId];
      if (!listElement || !selectedElement) {
        return;
      }

      const listRect = listElement.getBoundingClientRect();
      const itemRect = selectedElement.getBoundingClientRect();
      const itemOffsetTop = selectedElement.offsetTop - listElement.offsetTop;
      const targetTop = itemOffsetTop - listElement.clientHeight / 2 + selectedElement.offsetHeight / 2;
      const maxTop = Math.max(0, listElement.scrollHeight - listElement.clientHeight);
      const nextTop = Math.max(0, Math.min(targetTop, maxTop));
      const itemVisibleTop = itemRect.top - listRect.top;
      const itemVisibleBottom = itemRect.bottom - listRect.top;
      const comfortPadding = 20;
      const isComfortablyVisible = itemVisibleTop >= comfortPadding && itemVisibleBottom <= listElement.clientHeight - comfortPadding;

      if (!isComfortablyVisible) {
        listElement.scrollTo({ top: nextTop, behavior: "smooth" });
      }
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [placedSections.length, selectedPlacementId]);

  return (
    <div className="planner-routine-side-stack">
      <Card className="planner-routine-editor-card">
        <CardContent className="planner-panel-stack">
          <div className="planner-routine-card-head">
            <div>
              <strong>Available sections</strong>
              <p>Set colors and default durations before dropping sections into the grid.</p>
            </div>
            <span className="planner-routine-counter-pill">{unplacedSkills.length} remaining</span>
          </div>

          <Input
            label="Search sections"
            placeholder="Search by name or tag"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />

          <div className="planner-routine-chip-row">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                className={activeCategory === category ? "planner-routine-chip active" : "planner-routine-chip"}
                onClick={() => setActiveCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>

          <div className="planner-routine-inline-actions">
            <Button type="button" variant="secondary" size="sm" disabled={readOnly} onClick={onAddTransition}>
              Add transition
            </Button>
          </div>

          <div className="planner-routine-editor-list">
            {unplacedSkills.length ? unplacedSkills.map((skill) => (
              <SkillLibraryItem
                key={skill.id}
                skill={skill}
                isSelected={selectedSkillId === skill.id}
                placementCount={placementCountBySkillId[skill.skillSelectionId ?? ""] ?? 0}
                readOnly={readOnly}
                onSelect={onSelectSkill}
                onDurationChange={onSkillDurationChange}
                onColorChange={onSkillColorChange}
              />
            )) : <p className="planner-routine-empty-copy">All current sections are already placed in the routine.</p>}
          </div>
        </CardContent>
      </Card>

      <Card className="planner-routine-editor-card">
        <CardContent className="planner-panel-stack">
          <div className="planner-routine-card-head">
            <div>
              <strong>Placed sections</strong>
              <p>Review durations, colors and cleanup directly from the saved placements.</p>
            </div>
            <span className="planner-routine-counter-pill">{placedSections.length} placed</span>
          </div>

          <div className="planner-routine-editor-list planner-routine-placed-list" ref={placedListRef}>
            {placedSections.length ? placedSections.map((placement) => {
              const isTransition = placement.kind === "transition";

              return (
                <div
                  key={placement.id}
                  ref={(element) => {
                    placedItemRefs.current[placement.id] = element;
                  }}
                  className={selectedPlacementId === placement.id ? "planner-routine-editor-item selected" : "planner-routine-editor-item"}
                >
                  <button
                    type="button"
                    className="planner-routine-editor-select"
                    onClick={() => onSelectPlacement(placement.id)}
                  >
                    <div className="planner-routine-editor-copy">
                      <strong>{placement.title}</strong>
                      <span>
                        Row {placement.startRow + 1}, Count {placement.startCol + 1}
                      </span>
                    </div>
                  </button>
                  <div className="planner-routine-editor-actions">
                    <ColorPicker color={placement.color} onChange={(color) => onPlacementColorChange(placement.id, color)} disabled={readOnly || isTransition} />
                    <label className="planner-routine-mini-field">
                      <span>Counts</span>
                      <input
                        min={1}
                        max={32}
                        type="number"
                        value={placement.duration}
                        disabled={readOnly}
                        onChange={(event) => onPlacementDurationChange(placement.id, Number(event.target.value))}
                      />
                    </label>
                    <Button type="button" variant="ghost" size="sm" disabled={readOnly} onClick={() => onRemovePlacement(placement.id)}>
                      Remove
                    </Button>
                  </div>
                </div>
              );
            }) : <p className="planner-routine-empty-copy">Drag a section into the grid and it will appear here.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
