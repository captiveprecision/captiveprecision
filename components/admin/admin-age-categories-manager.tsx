"use client";

import { useMemo, useState } from "react";
import { Plus, Save, Send, Trash2 } from "lucide-react";

import { Badge, Button, Card, CardContent, Input, PageColumns, PageHero, PageMainColumn, PageSideColumn, SectionHeader, Select, Textarea } from "@/components/ui";
import type { AgeCategoryGrid, AgeCategoryGridStatus, AgeCategoryRuleStatus } from "@/lib/domain/age-category";

type AdminAgeCategoriesManagerProps = {
  initialGrids: AgeCategoryGrid[];
};

type DraftRule = {
  id: string;
  categoryKey: string;
  categoryName: string;
  minBirthYear: string;
  maxBirthYear: string;
  sortOrder: string;
  status: AgeCategoryRuleStatus;
};

type DraftGrid = {
  id: string;
  isNew: boolean;
  seasonLabel: string;
  label: string;
  status: AgeCategoryGridStatus;
  sourceName: string;
  notes: string;
  rules: DraftRule[];
};

const COMMON_CATEGORY_NAMES = ["Tiny", "Mini", "Youth", "Junior", "Senior", "Open"];

function buildCurrentSeasonLabel() {
  const now = new Date();
  const startYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return `${startYear}-${startYear + 1}`;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildDraftRule(categoryName = "", index = 0): DraftRule {
  return {
    id: `draft-rule-${Date.now()}-${index}`,
    categoryKey: slugify(categoryName),
    categoryName,
    minBirthYear: "",
    maxBirthYear: "",
    sortOrder: String(index + 1),
    status: "active"
  };
}

function buildDraftFromGrid(grid: AgeCategoryGrid): DraftGrid {
  return {
    id: grid.id,
    isNew: false,
    seasonLabel: grid.seasonLabel,
    label: grid.label,
    status: grid.status,
    sourceName: grid.sourceName ?? "",
    notes: grid.notes ?? "",
    rules: grid.rules.map((rule) => ({
      id: rule.id,
      categoryKey: rule.categoryKey,
      categoryName: rule.categoryName,
      minBirthYear: String(rule.minBirthYear),
      maxBirthYear: String(rule.maxBirthYear),
      sortOrder: String(rule.sortOrder),
      status: rule.status
    }))
  };
}

function buildNewDraft(): DraftGrid {
  const seasonLabel = buildCurrentSeasonLabel();

  return {
    id: `new-grid-${Date.now()}`,
    isNew: true,
    seasonLabel,
    label: `USASF ${seasonLabel} Age Grid`,
    status: "draft",
    sourceName: "USASF",
    notes: "",
    rules: COMMON_CATEGORY_NAMES.map(buildDraftRule)
  };
}

function buildPayload(draft: DraftGrid, status: AgeCategoryGridStatus) {
  return {
    gridId: draft.isNew ? undefined : draft.id,
    seasonLabel: draft.seasonLabel,
    label: draft.label,
    status,
    sourceName: draft.sourceName,
    notes: draft.notes,
    rules: draft.rules.map((rule, index) => ({
      categoryKey: rule.categoryKey || slugify(rule.categoryName),
      categoryName: rule.categoryName,
      minBirthYear: Number(rule.minBirthYear),
      maxBirthYear: Number(rule.maxBirthYear),
      sortOrder: Number(rule.sortOrder) || index + 1,
      status: rule.status
    }))
  };
}

export function AdminAgeCategoriesManager({ initialGrids }: AdminAgeCategoriesManagerProps) {
  const [grids, setGrids] = useState(initialGrids);
  const [selectedGridId, setSelectedGridId] = useState(initialGrids[0]?.id ?? "");
  const selectedGrid = useMemo(() => grids.find((grid) => grid.id === selectedGridId) ?? grids[0] ?? null, [grids, selectedGridId]);
  const [draft, setDraft] = useState<DraftGrid>(() => selectedGrid ? buildDraftFromGrid(selectedGrid) : buildNewDraft());
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function selectGrid(gridId: string) {
    const grid = grids.find((item) => item.id === gridId) ?? null;

    if (!grid) {
      return;
    }

    setSelectedGridId(grid.id);
    setDraft(buildDraftFromGrid(grid));
    setNotice(null);
  }

  function createGridDraft() {
    const nextDraft = buildNewDraft();
    setSelectedGridId("");
    setDraft(nextDraft);
    setNotice(null);
  }

  function updateRule(ruleId: string, field: keyof DraftRule, value: string) {
    setDraft((current) => ({
      ...current,
      rules: current.rules.map((rule) => {
        if (rule.id !== ruleId) {
          return rule;
        }

        const nextRule = { ...rule, [field]: value };
        return field === "categoryName" && !rule.categoryKey.trim()
          ? { ...nextRule, categoryKey: slugify(value) }
          : nextRule;
      })
    }));
  }

  function addRule() {
    setDraft((current) => ({
      ...current,
      rules: [...current.rules, buildDraftRule("", current.rules.length)]
    }));
  }

  function addCommonCategories() {
    setDraft((current) => {
      const existingKeys = new Set(current.rules.map((rule) => rule.categoryKey || slugify(rule.categoryName)));
      const additions = COMMON_CATEGORY_NAMES
        .filter((categoryName) => !existingKeys.has(slugify(categoryName)))
        .map((categoryName, index) => buildDraftRule(categoryName, current.rules.length + index));

      return {
        ...current,
        rules: [...current.rules, ...additions]
      };
    });
  }

  async function saveDraft(status: AgeCategoryGridStatus) {
    setSubmitting(true);
    setNotice(null);

    try {
      const response = await fetch("/api/admin/age-categories", {
        method: draft.isNew ? "POST" : "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(buildPayload(draft, status))
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(typeof payload.error === "string" ? payload.error : "Unable to save age category grid.");
      }

      const nextGrids = Array.isArray(payload.grids) ? payload.grids as AgeCategoryGrid[] : grids;
      const nextGridId = typeof payload.gridId === "string" ? payload.gridId : draft.id;
      const nextGrid = nextGrids.find((grid) => grid.id === nextGridId) ?? nextGrids[0] ?? null;

      setGrids(nextGrids);
      if (nextGrid) {
        setSelectedGridId(nextGrid.id);
        setDraft(buildDraftFromGrid(nextGrid));
      }
      setNotice({ type: "success", message: typeof payload.message === "string" ? payload.message : "Age category grid saved." });
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to save age category grid." });
    } finally {
      setSubmitting(false);
    }
  }

  const activeGrid = grids.find((grid) => grid.status === "active");

  return (
    <main className="workspace-shell page-stack age-category-admin-shell">
      <PageHero
        eyebrow="Age categories"
        title="USASF Birth Year Grids"
        description="Maintain season-specific eligibility rules released by USASF. Gyms read the active grid for their season label."
        actions={
          <Button type="button" variant="secondary" leadingIcon={<Plus size={16} />} onClick={createGridDraft}>
            Create Grid
          </Button>
        }
      />

      {notice ? <p className={`manage-gym-staff-notice manage-gym-staff-notice--${notice.type}`}>{notice.message}</p> : null}

      <PageColumns className="age-category-admin-layout">
        <PageMainColumn className="scoring-admin-main">
          <Card radius="panel">
            <CardContent className="scoring-admin-panel">
              <SectionHeader
                eyebrow="Grid settings"
                title={draft.label || "New age grid"}
                actions={<Badge variant={draft.status === "active" ? "accent" : "subtle"}>{draft.status}</Badge>}
              />

              <div className="scoring-admin-grid">
                <Input
                  id="age-grid-season-label"
                  label="Season Label"
                  value={draft.seasonLabel}
                  onChange={(event) => setDraft((current) => ({ ...current, seasonLabel: event.target.value }))}
                  placeholder="2026-2027"
                />
                <Input
                  id="age-grid-label"
                  label="Grid Label"
                  value={draft.label}
                  onChange={(event) => setDraft((current) => ({ ...current, label: event.target.value }))}
                />
                <Input
                  id="age-grid-source"
                  label="Source"
                  value={draft.sourceName}
                  onChange={(event) => setDraft((current) => ({ ...current, sourceName: event.target.value }))}
                  placeholder="USASF"
                />
                <Select
                  id="age-grid-status"
                  label="Status"
                  value={draft.status}
                  onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as AgeCategoryGridStatus }))}
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </Select>
                <Textarea
                  id="age-grid-notes"
                  label="Notes"
                  rows={3}
                  containerClassName="scoring-admin-grid__full"
                  value={draft.notes}
                  onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
                />
              </div>
            </CardContent>
          </Card>

          <Card radius="panel">
            <CardContent className="scoring-admin-panel">
              <SectionHeader
                eyebrow="Birth year rules"
                title="Eligible Categories"
                actions={
                  <div className="age-category-admin-actions">
                    <Button type="button" variant="secondary" size="sm" onClick={addCommonCategories}>
                      Add Common
                    </Button>
                    <Button type="button" variant="secondary" size="sm" leadingIcon={<Plus size={16} />} onClick={addRule}>
                      Add Category
                    </Button>
                  </div>
                }
              />

              <div className="age-category-rule-list">
                {draft.rules.map((rule) => (
                  <div key={rule.id} className="age-category-rule-row">
                    <div className="age-category-rule-row__main">
                      <Input
                        label="Category"
                        value={rule.categoryName}
                        onChange={(event) => updateRule(rule.id, "categoryName", event.target.value)}
                      />
                      <Input
                        label="Key"
                        value={rule.categoryKey}
                        onChange={(event) => updateRule(rule.id, "categoryKey", event.target.value)}
                      />
                    </div>
                    <div className="age-category-rule-row__meta">
                      <Input
                        label="Min Birth Year"
                        type="number"
                        value={rule.minBirthYear}
                        onChange={(event) => updateRule(rule.id, "minBirthYear", event.target.value)}
                      />
                      <Input
                        label="Max Birth Year"
                        type="number"
                        value={rule.maxBirthYear}
                        onChange={(event) => updateRule(rule.id, "maxBirthYear", event.target.value)}
                      />
                      <Input
                        label="Sort"
                        type="number"
                        value={rule.sortOrder}
                        onChange={(event) => updateRule(rule.id, "sortOrder", event.target.value)}
                      />
                      <Select
                        label="Status"
                        value={rule.status}
                        onChange={(event) => updateRule(rule.id, "status", event.target.value)}
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </Select>
                      <Button
                        type="button"
                        variant="ghost"
                        iconOnly
                        aria-label={`Remove ${rule.categoryName || "category"}`}
                        onClick={() => setDraft((current) => ({ ...current, rules: current.rules.filter((item) => item.id !== rule.id) }))}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="scoring-admin-save-row">
                <Button type="button" variant="primary" size="lg" leadingIcon={<Save size={16} />} disabled={submitting} onClick={() => void saveDraft("draft")}>
                  {submitting ? "Saving..." : "Save Draft"}
                </Button>
                <Button type="button" variant="secondary" size="lg" leadingIcon={<Send size={16} />} disabled={submitting} onClick={() => void saveDraft("active")}>
                  Publish
                </Button>
              </div>
            </CardContent>
          </Card>
        </PageMainColumn>

        <PageSideColumn className="scoring-admin-side">
          <Card radius="panel">
            <CardContent className="scoring-admin-panel">
              <SectionHeader eyebrow="Grids" title="Season Library" />
              <div className="age-category-grid-list">
                {grids.length ? grids.map((grid) => (
                  <button
                    key={grid.id}
                    type="button"
                    className={`age-category-grid-card${grid.id === selectedGrid?.id ? " age-category-grid-card--active" : ""}`}
                    onClick={() => selectGrid(grid.id)}
                  >
                    <span>{grid.label}</span>
                    <small>{grid.seasonLabel} / {grid.status} / {grid.rules.length} rules</small>
                  </button>
                )) : (
                  <p className="metric-subtext">No age category grids yet.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card radius="panel">
            <CardContent className="scoring-admin-panel">
              <SectionHeader eyebrow="Active reference" title={activeGrid?.label ?? "No active grid"} />
              <p className="metric-subtext">
                Only one active grid can exist per season label. Publishing this draft archives the currently active grid for that same season.
              </p>
            </CardContent>
          </Card>
        </PageSideColumn>
      </PageColumns>
    </main>
  );
}
