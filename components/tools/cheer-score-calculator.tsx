"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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

  if (!isReady) {
    return null;
  }

  return (
    <div className="cp-tool">
      <div className="cp-wrap">
        <div className="cp-card cp-stack-12">
          <div className="cp-stack-14">
            <h1>Cheer Score Calculator</h1>
            <p className="cp-subtext">Select how you want to calculate the result.</p>
          </div>

          <div className="cp-tab-row">
            <button className={`cp-tab ${selectedMode === "full" ? "active" : ""}`} onClick={() => setSelectedMode("full")}>
              Sections
            </button>
            <button className={`cp-tab ${selectedMode === "quick" ? "active" : ""}`} onClick={() => setSelectedMode("quick")}>
              Final Score
            </button>
          </div>

          {selectedMode === "full" ? (
            <>
              <div className="cp-stack-12">
                <h3>{activeSystem.name}</h3>
                <div className="cp-btn-row">
                  {availableVersions.map((version) => (
                    <button
                      key={version.id}
                      className={`cp-tab ${selectedVersionId === version.id ? "active" : ""}`}
                      onClick={() => setVersion(version.id)}
                    >
                      {version.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="cp-stack-10">
                <h3>Create Your Own</h3>
                <div className="cp-btn-row">
                  <button className={`cp-tab ${selectedVersionId === CUSTOM_VERSION_ID ? "active" : ""}`} onClick={() => setVersion(CUSTOM_VERSION_ID)}>
                    Custom
                  </button>
                </div>
              </div>
            </>
          ) : (
            <p className="cp-subtext">Quick mode skips sections and asks only for max raw score, current raw score, deductions, and target score.</p>
          )}
        </div>

        <div className="cp-card-dark cp-stack-10">
          <h2>Calculated Result</h2>

          <div className="cp-result-meter" aria-hidden="true">
            <div className="cp-result-meter-fill" style={{ width: `${progressWidth}%` }} />
          </div>

          <div className="cp-result-grid">
            <div className="cp-result-box">
              <div className="cp-result-label">Current Raw Score</div>
              <div className="cp-result-value">{formatNumber(totals.earnedRaw)}</div>
              <div className="cp-result-sub">out of {formatNumber(totals.maxRaw)}</div>
            </div>
            <div className="cp-result-box">
              <div className="cp-result-label">Final Score</div>
              <div className="cp-result-value">{formatNumber(totals.finalPercent)}%</div>
              <div className="cp-result-sub">after deductions</div>
            </div>
            <div className="cp-result-box">
              <div className="cp-result-label">Points Needed For Goal</div>
              <div className="cp-result-value">{formatNumber(totals.rawPointsNeeded)}</div>
              <div className="cp-result-sub">Goal raw: {formatNumber(totals.targetRaw)}</div>
            </div>
          </div>

          <div className="cp-callout">
            <div className="cp-callout-top">
              Base {formatNumber(totals.basePercent)}% - Deductions -{formatNumber(totals.deductions)}%
            </div>
            <p>
              {totals.isGoalReachable
                ? `Need ${formatNumber(totals.rawPointsNeeded)} more raw points to reach ${formatNumber(goalPercent)}%.`
                : "Goal is above the maximum possible score for this setup."}
            </p>
            <div className="cp-cta-row">
              <Link className="cp-link" href="https://www.captiveprecision.com" target="_blank" rel="noopener noreferrer">
                Need expert help with your routine?
              </Link>
            </div>
          </div>
        </div>

        {selectedMode === "quick" ? (
          <div className="cp-card cp-stack-10">
            <div className="cp-toolbar" style={{ alignItems: "center", marginBottom: 2 }}>
              <h2>Quick Inputs</h2>
              <div className="cp-btn-row">
                <button className="cp-btn" onClick={resetCalculator}>Reset</button>
              </div>
            </div>
            <div className="cp-final-grid">
              <div className="cp-field-group">
                <label>Max Raw Score</label>
                <input type="number" step="0.001" min="0" value={quickMaxRaw || ""} onChange={(event) => setQuickMaxRaw(Number(event.target.value) || 0)} />
              </div>
              <div className="cp-field-group">
                <label>Current Raw Score</label>
                <input type="number" step="0.001" min="0" max={quickMaxRaw} value={quickEarnedRaw || ""} onChange={(event) => setQuickEarnedRaw(Number(event.target.value) || 0)} />
              </div>
              <div className="cp-field-group">
                <label>Deductions</label>
                <input type="number" step="0.001" min="0" value={deductions || ""} onChange={(event) => setDeductions(Number(event.target.value) || 0)} />
              </div>
              <div className="cp-field-group">
                <label>Target Score</label>
                <input type="number" step="0.001" min="0" max="100" value={goalPercent || ""} onChange={(event) => setGoalPercent(Number(event.target.value) || 0)} />
              </div>
            </div>
            <p className="cp-subtext">Use this version when you already know the max raw score of the routine and only want a fast answer.</p>
          </div>
        ) : (
          <>
            <div className="cp-summary-grid">
              <div className="cp-card cp-stack-10">
                <h2>Deductions</h2>
                <div className="cp-field-group">
                  <label>Total Deductions</label>
                  <input type="number" step="0.001" min="0" value={deductions || ""} onChange={(event) => setDeductions(Number(event.target.value) || 0)} />
                </div>
                <p className="cp-subtext">Enter the total deductions from the judges. These reduce the final percentage score, not the raw score.</p>
              </div>
              <div className="cp-card cp-stack-10">
                <h2>Goal</h2>
                <div className="cp-field-group">
                  <label>Target Percentage</label>
                  <input type="number" step="0.001" min="0" max="100" value={goalPercent || ""} onChange={(event) => setGoalPercent(Number(event.target.value) || 0)} />
                </div>
                <p className="cp-subtext">Enter the percentage you want to reach and the calculator will estimate the raw points still needed.</p>
              </div>
            </div>

            <div className="cp-card cp-stack-12">
              <div className="cp-toolbar">
                <div className="cp-stack-6">
                  <h2>Scoring Breakdown</h2>
                  <p className="cp-subtext">
                    {selectedVersionId === CUSTOM_VERSION_ID
                      ? "Build your own scoresheet from scratch."
                      : isEditingTemplate
                        ? `Editing ${activeVersion.label} as a starting point.`
                        : `${activeSystem.name} / ${activeVersion.label} is loaded from admin.`}
                  </p>
                </div>
                <div className="cp-btn-row">
                  {selectedVersionId !== CUSTOM_VERSION_ID && !isEditingTemplate ? (
                    <button className="cp-btn" onClick={() => setIsEditingTemplate(true)}>
                      Edit Template
                    </button>
                  ) : null}
                  <button className="cp-btn" onClick={resetCalculator}>Reset</button>
                  {canEditStructure ? (
                    <button className="cp-btn cp-btn-secondary" onClick={addSection}>
                      Add Section
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="cp-sections-list">
                {sections.map((section, index) => {
                  const percent = section.maxPoints > 0 ? (section.earnedPoints / section.maxPoints) * 100 : 0;

                  return (
                    <div className="cp-section-card" key={section.id}>
                      <div className="cp-section-head">
                        <div className="cp-section-title-row">
                          <span className="cp-section-title-label">Section</span>
                          <span className="cp-section-index">{index + 1}</span>
                        </div>
                        <div className="cp-section-meta">
                          <span className="cp-chip">{formatNumber(percent)}%</span>
                          {canEditStructure ? (
                            <button className="cp-remove" onClick={() => removeSection(section.id)}>
                              Remove
                            </button>
                          ) : (
                            <span className="cp-locked">Locked</span>
                          )}
                        </div>
                      </div>

                      <div className="cp-section-inputs-compact">
                        <div className="cp-field-group">
                          <input type="text" value={section.name} readOnly={!canEditStructure} onChange={(event) => updateSection(section.id, "name", event.target.value)} />
                        </div>
                        <div className="cp-inline-pair">
                          <div className="cp-field-group">
                            <label>Max Value</label>
                            <input type="number" step="0.001" min="0" value={section.maxPoints || ""} readOnly={!canEditStructure} onChange={(event) => updateSection(section.id, "maxPoints", event.target.value)} />
                          </div>
                          <div className="cp-field-group">
                            <label>Score</label>
                            <input type="number" step="0.001" min="0" max={section.maxPoints} value={section.earnedPoints || ""} onChange={(event) => updateSection(section.id, "earnedPoints", event.target.value)} />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
