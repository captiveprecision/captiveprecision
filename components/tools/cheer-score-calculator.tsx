"use client";

import { useEffect, useMemo, useState } from "react";

import {
  Badge,
  Button,
  ButtonLink,
  Card,
  CardContent,
  EmptyState,
  Input,
  PageColumns,
  PageHero,
  PageMainColumn,
  PageSideColumn,
  SectionHeader,
  StatGrid,
  Tabs
} from "@/components/ui";
import { useScoringSystems } from "@/lib/scoring/use-scoring-systems";
import { getSystemById, getVersionById } from "@/lib/scoring/scoring-systems";

type Section = {
  id: number;
  name: string;
  maxPoints: number;
  earnedPoints: number;
};

type Mode = "full" | "quick";

type Totals = {
  maxRaw: number;
  earnedRaw: number;
  basePercent: number;
  finalPercent: number;
  targetRaw: number;
  rawPointsNeeded: number;
  deductions: number;
  isGoalReachable: boolean;
};

const CUSTOM_VERSION_ID = "custom";

function buildTemplateSections(version: ReturnType<typeof getVersionById>) {
  return version.sections.map((section, index) => ({
    id: index + 1,
    name: section.name,
    maxPoints: section.maxPoints,
    earnedPoints: 0
  }));
}

function buildCustomSections() {
  return [{ id: 1, name: "Section 1", maxPoints: 0, earnedPoints: 0 }];
}

function round(value: number, decimals = 3) {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function formatNumber(value: number) {
  return round(value, 3).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function buildTotals(maxRawInput: number, earnedRawInput: number, deductions: number, goalPercent: number): Totals {
  const maxRaw = Math.max(maxRawInput || 0, 0);
  const earnedRaw = clamp(earnedRawInput || 0, 0, maxRaw);
  const basePercent = maxRaw > 0 ? (earnedRaw / maxRaw) * 100 : 0;
  const finalPercent = Math.max(basePercent - deductions, 0);
  const targetRaw = (goalPercent / 100) * maxRaw;
  const rawPointsNeeded = Math.max(targetRaw - earnedRaw, 0);
  const isGoalReachable = targetRaw <= maxRaw;

  return {
    maxRaw: round(maxRaw),
    earnedRaw: round(earnedRaw),
    basePercent: round(basePercent),
    finalPercent: round(finalPercent),
    targetRaw: round(targetRaw),
    rawPointsNeeded: round(rawPointsNeeded),
    deductions: round(deductions),
    isGoalReachable
  };
}

export function CheerScoreCalculator() {
  const { config, isReady } = useScoringSystems();
  const [selectedVersionId, setSelectedVersionId] = useState<string>(CUSTOM_VERSION_ID);
  const [selectedMode, setSelectedMode] = useState<Mode>("full");
  const [sections, setSections] = useState<Section[]>(buildCustomSections());
  const [isEditingTemplate, setIsEditingTemplate] = useState(false);
  const [deductions, setDeductions] = useState(0);
  const [goalPercent, setGoalPercent] = useState(97);
  const [quickMaxRaw, setQuickMaxRaw] = useState(0);
  const [quickEarnedRaw, setQuickEarnedRaw] = useState(0);

  const activeSystem = useMemo(() => getSystemById(config, config.activeSystemId), [config]);
  const availableVersions = activeSystem.versions;
  const activeVersion = useMemo(
    () => getVersionById(activeSystem, selectedVersionId === CUSTOM_VERSION_ID ? activeSystem.activeVersionId : selectedVersionId),
    [activeSystem, selectedVersionId]
  );

  useEffect(() => {
    if (!isReady) {
      return;
    }

    setSelectedVersionId(activeSystem.activeVersionId);
    setSections(buildTemplateSections(getVersionById(activeSystem, activeSystem.activeVersionId)));
  }, [activeSystem, isReady]);

  const resetCalculator = () => {
    setIsEditingTemplate(false);
    setDeductions(0);
    setGoalPercent(97);
    setQuickMaxRaw(0);
    setQuickEarnedRaw(0);
    setSections(
      selectedVersionId === CUSTOM_VERSION_ID
        ? buildCustomSections()
        : buildTemplateSections(getVersionById(activeSystem, selectedVersionId))
    );
  };

  const setVersion = (versionId: string) => {
    setSelectedVersionId(versionId);
    setIsEditingTemplate(false);
    setSections(
      versionId === CUSTOM_VERSION_ID
        ? buildCustomSections()
        : buildTemplateSections(getVersionById(activeSystem, versionId))
    );
  };

  const addSection = () => {
    setSections((current) => [
      {
        id: Date.now(),
        name: `Section ${current.length + 1}`,
        maxPoints: 0,
        earnedPoints: 0
      },
      ...current
    ]);
  };

  const removeSection = (id: number) => {
    setSections((current) => current.filter((section) => section.id !== id));
  };

  const updateSection = (id: number, field: keyof Section, value: string) => {
    setSections((current) =>
      current.map((section) => {
        if (section.id !== id) return section;
        if (field === "name") return { ...section, name: value };

        const parsed = Number(value);
        const safeValue = Number.isFinite(parsed) ? Math.max(parsed, 0) : 0;

        if (field === "maxPoints") {
          return {
            ...section,
            maxPoints: safeValue,
            earnedPoints: clamp(section.earnedPoints, 0, safeValue)
          };
        }

        return {
          ...section,
          earnedPoints: clamp(safeValue, 0, section.maxPoints)
        };
      })
    );
  };

  const detailedTotals = buildTotals(
    sections.reduce((sum, section) => sum + section.maxPoints, 0),
    sections.reduce((sum, section) => sum + section.earnedPoints, 0),
    deductions,
    goalPercent
  );

  const quickTotals = buildTotals(quickMaxRaw, quickEarnedRaw, deductions, goalPercent);
  const totals = selectedMode === "quick" ? quickTotals : detailedTotals;
  const canEditStructure = selectedVersionId === CUSTOM_VERSION_ID || isEditingTemplate;
  const progressWidth = clamp(totals.finalPercent, 0, 100);

  const modeItems = [
    { value: "full" as const, label: "Sections" },
    { value: "quick" as const, label: "Final Score" }
  ];

  const versionItems = availableVersions.map((version) => ({
    value: version.id,
    label: version.label
  }));

  if (!isReady) {
    return null;
  }

  return (
    <main className="workspace-shell page-stack scorecalc-shell">
      <PageHero
        eyebrow="Live tool"
        title="Cheer Score Calculator"
        description="Calculate the final routine result from section-based raw scores or a quick final-score pass."
        actions={<Badge variant="dark">{selectedMode === "full" ? "Sections mode" : "Final score mode"}</Badge>}
      >
        <div className="scorecalc-hero-badges">
          <Badge variant="accent">{activeSystem.name}</Badge>
          <Badge variant="subtle">{selectedVersionId === CUSTOM_VERSION_ID ? "Custom template" : activeVersion.label}</Badge>
        </div>
      </PageHero>

      <PageColumns>
        <PageMainColumn>
          <Card radius="panel">
            <CardContent className="scorecalc-panel__content">
              <SectionHeader
                eyebrow="Calculation mode"
                title="Choose how you want to calculate"
                description="Switch between section-based scoring and a quick final-score pass without changing the underlying scoring logic."
              />

              <Tabs
                items={modeItems}
                value={selectedMode}
                onValueChange={(value) => setSelectedMode(value)}
                ariaLabel="Calculator mode"
                className="scorecalc-mode-tabs"
              />

              {selectedMode === "full" ? (
                <div className="scorecalc-template-grid">
                  <Card variant="subtle">
                    <CardContent className="scorecalc-card__content">
                      <SectionHeader
                        eyebrow="Scoring system"
                        title={activeSystem.name}
                        description="Load a published version from admin before entering section scores."
                      />
                      <Tabs
                        items={versionItems}
                        value={selectedVersionId === CUSTOM_VERSION_ID ? activeSystem.activeVersionId : selectedVersionId}
                        onValueChange={setVersion}
                        ariaLabel="Scoring version"
                        className="scorecalc-version-tabs"
                      />
                    </CardContent>
                  </Card>

                  <Card variant="subtle">
                    <CardContent className="scorecalc-card__content">
                      <SectionHeader
                        eyebrow="Create your own"
                        title="Custom template"
                        description="Start from scratch when you need a manual layout outside the published versions."
                      />
                      <div className="scorecalc-custom-action">
                        <Button
                          variant={selectedVersionId === CUSTOM_VERSION_ID ? "primary" : "secondary"}
                          onClick={() => setVersion(CUSTOM_VERSION_ID)}
                        >
                          Custom
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <Card variant="subtle">
                  <CardContent className="scorecalc-card__content">
                    <SectionHeader
                      eyebrow="Quick mode"
                      title="Fast final-score pass"
                      description="Quick mode skips sections and asks only for max raw score, current raw score, deductions, and target score."
                    />
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>

          {selectedMode === "quick" ? (
            <Card radius="panel">
              <CardContent className="scorecalc-panel__content">
                <SectionHeader
                  eyebrow="Quick inputs"
                  title="Final score mode"
                  description="Use this version when you already know the max raw score of the routine and only want a fast answer."
                  actions={<Button variant="secondary" onClick={resetCalculator}>Reset</Button>}
                />

                <div className="scorecalc-quick-grid">
                  <Input label="Max Raw Score" type="number" step="0.001" min="0" value={quickMaxRaw || ""} onChange={(event) => setQuickMaxRaw(Number(event.target.value) || 0)} />
                  <Input label="Current Raw Score" type="number" step="0.001" min="0" max={quickMaxRaw} value={quickEarnedRaw || ""} onChange={(event) => setQuickEarnedRaw(Number(event.target.value) || 0)} />
                  <Input label="Deductions" type="number" step="0.001" min="0" value={deductions || ""} onChange={(event) => setDeductions(Number(event.target.value) || 0)} />
                  <Input label="Target Score" type="number" step="0.001" min="0" max="100" value={goalPercent || ""} onChange={(event) => setGoalPercent(Number(event.target.value) || 0)} />
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <StatGrid className="scorecalc-summary-grid">
                <Card variant="subtle">
                  <CardContent className="scorecalc-card__content">
                    <SectionHeader
                      eyebrow="Deductions"
                      title="Final-score deductions"
                      description="These reduce the final percentage score, not the raw score."
                    />
                    <Input label="Total Deductions" type="number" step="0.001" min="0" value={deductions || ""} onChange={(event) => setDeductions(Number(event.target.value) || 0)} />
                  </CardContent>
                </Card>

                <Card variant="subtle">
                  <CardContent className="scorecalc-card__content">
                    <SectionHeader
                      eyebrow="Goal"
                      title="Target percentage"
                      description="The calculator estimates how many raw points are still needed to reach this score."
                    />
                    <Input label="Target Percentage" type="number" step="0.001" min="0" max="100" value={goalPercent || ""} onChange={(event) => setGoalPercent(Number(event.target.value) || 0)} />
                  </CardContent>
                </Card>
              </StatGrid>

              <Card radius="panel">
                <CardContent className="scorecalc-panel__content">
                  <SectionHeader
                    eyebrow="Scoring breakdown"
                    title="Section input"
                    description={
                      selectedVersionId === CUSTOM_VERSION_ID
                        ? "Build your own scoresheet from scratch."
                        : isEditingTemplate
                          ? `Editing ${activeVersion.label} as a starting point.`
                          : `${activeSystem.name} / ${activeVersion.label} is loaded from admin.`
                    }
                    actions={
                      <div className="scorecalc-action-row">
                        {selectedVersionId !== CUSTOM_VERSION_ID && !isEditingTemplate ? (
                          <Button variant="secondary" onClick={() => setIsEditingTemplate(true)}>
                            Edit Template
                          </Button>
                        ) : null}
                        <Button variant="ghost" onClick={resetCalculator}>Reset</Button>
                        {canEditStructure ? (
                          <Button onClick={addSection}>Add Section</Button>
                        ) : null}
                      </div>
                    }
                  />

                  {sections.length ? (
                    <div className="scorecalc-sections-list">
                      {sections.map((section, index) => {
                        const percent = section.maxPoints > 0 ? (section.earnedPoints / section.maxPoints) * 100 : 0;

                        return (
                          <Card key={section.id} variant="subtle" className="scorecalc-section-card">
                            <CardContent className="scorecalc-section-card__content">
                              <div className="scorecalc-section-head">
                                <div className="scorecalc-section-title-row">
                                  <span className="scorecalc-section-title-label">Section</span>
                                  <span className="scorecalc-section-index">{index + 1}</span>
                                </div>
                                <div className="scorecalc-section-meta">
                                  <Badge variant="accent">{formatNumber(percent)}%</Badge>
                                  {canEditStructure ? (
                                    <Button size="sm" variant="ghost" onClick={() => removeSection(section.id)}>
                                      Remove
                                    </Button>
                                  ) : (
                                    <Badge variant="subtle">Locked</Badge>
                                  )}
                                </div>
                              </div>

                              <div className="scorecalc-section-grid">
                                <Input label="Section name" type="text" value={section.name} readOnly={!canEditStructure} onChange={(event) => updateSection(section.id, "name", event.target.value)} />
                                <Input label="Max Value" type="number" step="0.001" min="0" value={section.maxPoints || ""} readOnly={!canEditStructure} onChange={(event) => updateSection(section.id, "maxPoints", event.target.value)} />
                                <Input label="Score" type="number" step="0.001" min="0" max={section.maxPoints} value={section.earnedPoints || ""} onChange={(event) => updateSection(section.id, "earnedPoints", event.target.value)} />
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  ) : (
                    <EmptyState
                      title="No sections added"
                      description="Add a section to start building the score breakdown."
                      action={canEditStructure ? <Button onClick={addSection}>Add Section</Button> : undefined}
                    />
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </PageMainColumn>

        <PageSideColumn>
          <Card radius="panel" variant="dark" className="scorecalc-result-card">
            <CardContent className="scorecalc-result-card__content">
              <SectionHeader
                className="scorecalc-result-header"
                eyebrow="Calculated result"
                title="Score output"
                description="Live result based on the current inputs and deductions."
              />

              <div className="scorecalc-result-meter" aria-hidden="true">
                <div className="scorecalc-result-meter-fill" style={{ width: `${progressWidth}%` }} />
              </div>

              <StatGrid className="scorecalc-result-grid">
                <div className="scorecalc-result-box">
                  <div className="scorecalc-result-label">Current Raw Score</div>
                  <div className="scorecalc-result-value">{formatNumber(totals.earnedRaw)}</div>
                  <div className="scorecalc-result-sub">out of {formatNumber(totals.maxRaw)}</div>
                </div>
                <div className="scorecalc-result-box">
                  <div className="scorecalc-result-label">Final Score</div>
                  <div className="scorecalc-result-value">{formatNumber(totals.finalPercent)}%</div>
                  <div className="scorecalc-result-sub">after deductions</div>
                </div>
                <div className="scorecalc-result-box">
                  <div className="scorecalc-result-label">Points Needed For Goal</div>
                  <div className="scorecalc-result-value">{formatNumber(totals.rawPointsNeeded)}</div>
                  <div className="scorecalc-result-sub">Goal raw: {formatNumber(totals.targetRaw)}</div>
                </div>
              </StatGrid>

              <div className="scorecalc-callout">
                <div className="scorecalc-callout-top">
                  Base {formatNumber(totals.basePercent)}% - Deductions -{formatNumber(totals.deductions)}%
                </div>
                <p>
                  {totals.isGoalReachable
                    ? `Need ${formatNumber(totals.rawPointsNeeded)} more raw points to reach ${formatNumber(goalPercent)}%.`
                    : "Goal is above the maximum possible score for this setup."}
                </p>
                <div className="scorecalc-cta-row">
                  <ButtonLink href="https://www.captiveprecision.com" variant="secondary" target="_blank" rel="noopener noreferrer">
                    Need expert help with your routine?
                  </ButtonLink>
                </div>
              </div>
            </CardContent>
          </Card>
        </PageSideColumn>
      </PageColumns>
    </main>
  );
}
