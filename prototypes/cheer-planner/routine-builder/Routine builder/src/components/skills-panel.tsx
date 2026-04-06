"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useMemo, useRef, useState } from "react";
import { RoutineDocument, RoutinePlacement, SkillDefinition } from "@/lib/types";

const PRESET_COLORS = [
  { label: "Blue", value: "#3b82f6" },
  { label: "Pink", value: "#ec4899" },
  { label: "Red", value: "#ef4444" },
  { label: "Green", value: "#22c55e" },
  { label: "Yellow", value: "#eab308" },
] as const;

function isTransitionSkill(skill: SkillDefinition) {
  return skill.tags.includes("__transition__");
}

function ColorPicker({
  color,
  onChange,
  disabled = false,
}: {
  color: string;
  onChange: (color: string) => void;
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="color-picker-shell">
      <button
        type="button"
        className="color-line-button"
        onClick={() => {
          if (!disabled) {
            setIsOpen((current) => !current);
          }
        }}
        aria-label="Choose section color"
        disabled={disabled}
      >
        <span className="color-line-preview" style={{ background: color }} />
      </button>
      {isOpen && !disabled ? (
        <div className="preset-color-popover">
          {PRESET_COLORS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              className={`preset-color-swatch${preset.value.toLowerCase() === color.toLowerCase() ? " active" : ""}`}
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
  onSelect,
  onDurationChange,
  onColorChange,
}: {
  skill: SkillDefinition;
  isSelected: boolean;
  placementCount: number;
  onSelect: (skillId: string) => void;
  onDurationChange: (skillId: string, duration: number) => void;
  onColorChange: (skillId: string, color: string) => void;
}) {
  const isTransition = isTransitionSkill(skill);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `skill:${skill.id}`,
    data: {
      type: "skill",
      skillId: skill.id,
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={`placement-editor${isSelected ? " selected" : ""}`}
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.35 : 1,
      }}
    >
      <button
        type="button"
        className="placement-select-button"
        onClick={() => onSelect(skill.id)}
        {...listeners}
        {...attributes}
      >
        <div className="placement-editor-copy">
          <strong>{skill.name}</strong>
          <span>
            {skill.category}
            {placementCount > 0 ? ` | ${placementCount} placed` : ""}
          </span>
        </div>
      </button>
      <div className="placement-editor-actions">
        <ColorPicker
          color={skill.color}
          onChange={(color) => onColorChange(skill.id, color)}
          disabled={isTransition}
        />
        <label className="mini-field">
          <span>Counts</span>
          <input
            min={1}
            max={32}
            type="number"
            value={skill.defaultDuration}
            onChange={(event) => onDurationChange(skill.id, Number(event.target.value))}
          />
        </label>
      </div>
    </div>
  );
}

export function SkillsPanel({
  document,
  selectedSkill,
  selectedPlacement,
  skills,
  onPlacementDurationChange,
  onPlacementColorChange,
  onRemovePlacement,
  onSelectPlacement,
  onSelectSkill,
  onSkillDurationChange,
  onSkillColorChange,
  onAddTransition,
}: {
  document: RoutineDocument;
  selectedSkill: SkillDefinition | null;
  selectedPlacement: RoutinePlacement | null;
  skills: SkillDefinition[];
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

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(skills.map((skill) => skill.category)))],
    [skills],
  );

  const placementCountBySkillId = useMemo(() => {
    return document.placements.reduce<Record<string, number>>((accumulator, placement) => {
      accumulator[placement.skillId] = (accumulator[placement.skillId] ?? 0) + 1;
      return accumulator;
    }, {});
  }, [document.placements]);

  const filteredSkills = useMemo(() => {
    return skills.filter((skill) => {
      const matchesCategory = activeCategory === "All" || skill.category === activeCategory;
      const normalizedQuery = query.trim().toLowerCase();
      const matchesQuery =
        normalizedQuery.length === 0 ||
        skill.name.toLowerCase().includes(normalizedQuery) ||
        skill.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery));

      return matchesCategory && matchesQuery;
    });
  }, [activeCategory, query, skills]);

  const unplacedSkills = useMemo(
    () => filteredSkills.filter((skill) => !placementCountBySkillId[skill.id]),
    [filteredSkills, placementCountBySkillId],
  );

  const placedSections = useMemo(() => {
    return [...document.placements].sort((left, right) => {
      if (left.startRow !== right.startRow) {
        return left.startRow - right.startRow;
      }

      return left.startCol - right.startCol;
    });
  }, [document.placements]);

  useEffect(() => {
    if (!selectedPlacement?.id) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      const listElement = placedListRef.current;
      const selectedElement = placedItemRefs.current[selectedPlacement.id];
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
      const isComfortablyVisible =
        itemVisibleTop >= comfortPadding &&
        itemVisibleBottom <= listElement.clientHeight - comfortPadding;

      if (!isComfortablyVisible) {
        listElement.scrollTo({ top: nextTop, behavior: "smooth" });
      }
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [placedSections.length, selectedPlacement?.id]);

  return (
    <aside className="sidebar-panel">
      <div className="panel-card">
        <div className="section-heading">
          <div>
            <p className="section-label">Available sections</p>
            <h2>{unplacedSkills.length ? "Set colors and durations" : "All sections placed"}</h2>
          </div>
          <span className="pill">{unplacedSkills.length} remaining</span>
        </div>

        <label className="field">
          <span>Search sections</span>
          <input
            placeholder="Search by name or tag"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        <div className="category-row">
          {categories.map((category) => (
            <button
              className={`chip-button${activeCategory === category ? " active" : ""}`}
              key={category}
              onClick={() => setActiveCategory(category)}
              type="button"
            >
              {category}
            </button>
          ))}
        </div>

        {selectedSkill ? <p className="detail-copy selected-hint">Selected: {selectedSkill.name}</p> : null}

        <button className="secondary-button add-transition-button" type="button" onClick={onAddTransition}>
          Add transition
        </button>

        {unplacedSkills.length ? (
          <div className="placement-list">
            {unplacedSkills.map((skill) => (
              <SkillLibraryItem
                key={skill.id}
                skill={skill}
                isSelected={selectedSkill?.id === skill.id}
                placementCount={placementCountBySkillId[skill.id] ?? 0}
                onSelect={onSelectSkill}
                onDurationChange={onSkillDurationChange}
                onColorChange={onSkillColorChange}
              />
            ))}
          </div>
        ) : (
          <p className="detail-copy">
            Every mock section is already in the routine. Remove one from the placed list if you want to use it again.
          </p>
        )}
      </div>

      <div className="panel-card detail-card placed-sections-card">
        <div className="section-heading">
          <div>
            <p className="section-label">Placed sections</p>
            <h2>{placedSections.length ? "Edit colors and durations" : "No sections yet"}</h2>
          </div>
          <span className="pill">{placedSections.length} placed</span>
        </div>

        {selectedPlacement ? (
          <p className="detail-copy selected-hint">
            Selected: Row {selectedPlacement.startRow + 1}, Count {selectedPlacement.startCol + 1}
          </p>
        ) : null}

        {placedSections.length ? (
          <div className="placement-list" ref={placedListRef}>
            {placedSections.map((placement) => {
              const skill = skills.find((item) => item.id === placement.skillId);
              if (!skill) {
                return null;
              }

              const isSelected = selectedPlacement?.id === placement.id;
              const isTransition = isTransitionSkill(skill);

              return (
                <div
                  key={placement.id}
                  ref={(element) => {
                    placedItemRefs.current[placement.id] = element;
                  }}
                  className={`placement-editor${isSelected ? " selected" : ""}`}
                >
                  <button
                    type="button"
                    className="placement-select-button"
                    onClick={() => onSelectPlacement(placement.id)}
                  >
                    <div className="placement-editor-copy">
                      <strong>{skill.name}</strong>
                      <span>
                        Row {placement.startRow + 1}, Count {placement.startCol + 1}
                      </span>
                    </div>
                  </button>
                  <div className="placement-editor-actions">
                    <ColorPicker
                      color={skill.color}
                      onChange={(color) => onPlacementColorChange(placement.id, color)}
                      disabled={isTransition}
                    />
                    <label className="mini-field">
                      <span>Counts</span>
                      <input
                        min={1}
                        max={32}
                        type="number"
                        value={placement.duration}
                        onChange={(event) =>
                          onPlacementDurationChange(placement.id, Number(event.target.value))
                        }
                      />
                    </label>
                    <button
                      className="mini-remove-button"
                      type="button"
                      onClick={() => onRemovePlacement(placement.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="detail-copy">
            Drag a section into the grid and it will appear here with its editable color and duration.
          </p>
        )}
      </div>
    </aside>
  );
}
