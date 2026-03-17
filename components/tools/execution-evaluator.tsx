"use client";

import { useEffect, useMemo, useState } from "react";

import { useScoringSystems } from "@/lib/scoring/use-scoring-systems";
import { getSystemById, getVersionById } from "@/lib/scoring/scoring-systems";
import {
  groupExecutionRecordsByTeam,
  normalizeTeamName,
  readExecutionEvaluatorRecords,
  type ExecutionEvaluatorRecord,
  type ExecutionSectionSnapshot,
  writeExecutionEvaluatorRecords
} from "@/lib/tools/execution-evaluator-records";

type SectionMode = "execution" | "manual";

type ExecutionSectionState = {
  id: string;
  name: string;
  maxPoints: number;
  earnedPoints: number;
  deductions: number;
  step: number;
  mode: SectionMode;
};

type ExecutionTotals = {
  startScore: number;
  executionDeductions: number;
  executionSubtotal: number;
  generalDeductions: number;
  illegalityDeductions: number;
  finalScore: number;
  totalLossPct: number;
};

const deductionSteps = [0.1, 0.25, 0.5, 1];

function round(value: number, decimals = 2) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function formatNumber(value: number) {
  return round(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getSectionMode(name: string): SectionMode {
  return /execution/i.test(name) ? "execution" : "manual";
}

function normalizeSavedSection(section: ExecutionSectionSnapshot): ExecutionSectionState {
  const mode = section.mode ?? getSectionMode(section.name);
  const earnedPoints = section.earnedPoints ?? Math.max(0, round(section.maxPoints - section.deductions));

  return {
    id: section.id,
    name: section.name,
    maxPoints: section.maxPoints,
    earnedPoints: clamp(earnedPoints, 0, section.maxPoints),
    deductions: mode === "execution" ? clamp(section.deductions, 0, section.maxPoints) : 0,
    step: section.step || 0.1,
    mode
  };
}

function buildSections(version: ReturnType<typeof getVersionById>) {
  return version.sections.map((section) => ({
    id: section.id,
    name: section.name,
    maxPoints: section.maxPoints,
    earnedPoints: section.maxPoints,
    deductions: 0,
    step: 0.1,
    mode: getSectionMode(section.name)
  }));
}

function buildTotals(
  sections: ExecutionSectionState[],
  generalDeductions: number,
  illegalityDeductions: number
): ExecutionTotals {
  const startScore = round(sections.reduce((sum, section) => sum + section.maxPoints, 0));
  const executionSubtotal = round(sections.reduce((sum, section) => sum + section.earnedPoints, 0));
  const executionDeductions = round(Math.max(0, startScore - executionSubtotal));
  const finalScore = round(Math.max(0, executionSubtotal - generalDeductions - illegalityDeductions));
  const totalLossPct = startScore > 0 ? round(((startScore - finalScore) / startScore) * 100) : 0;

  return {
    startScore,
    executionDeductions,
    executionSubtotal,
    generalDeductions: round(generalDeductions),
    illegalityDeductions: round(illegalityDeductions),
    finalScore,
    totalLossPct
  };
}

export function ExecutionEvaluator() {
  const { config, isReady } = useScoringSystems();
  const [level, setLevel] = useState(2);
  const [routineName, setRoutineName] = useState("Routine Practice Score");
  const [teamName, setTeamName] = useState("");
  const [generalDeductions, setGeneralDeductions] = useState(0);
  const [illegalityDeductions, setIllegalityDeductions] = useState(0);
  const [generalStep, setGeneralStep] = useState(0.5);
  const [sections, setSections] = useState<ExecutionSectionState[]>([]);
  const [records, setRecords] = useState<ExecutionEvaluatorRecord[]>([]);
  const [openManualSections, setOpenManualSections] = useState<string[]>([]);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const activeSystem = useMemo(() => getSystemById(config, config.activeSystemId), [config]);
  const activeVersion = useMemo(
    () => getVersionById(activeSystem, activeSystem.activeVersionId),
    [activeSystem]
  );

  useEffect(() => {
    if (!isReady) {
      return;
    }

    setSections(buildSections(activeVersion));
    setOpenManualSections([]);
    setRecords(readExecutionEvaluatorRecords());
  }, [activeVersion, isReady]);

  useEffect(() => {
    if (!saveMessage) {
      return;
    }

    const timeout = window.setTimeout(() => setSaveMessage(null), 2200);
    return () => window.clearTimeout(timeout);
  }, [saveMessage]);

  const executionSections = useMemo(
    () => sections.filter((section) => section.mode === "execution"),
    [sections]
  );
  const manualSections = useMemo(
    () => sections.filter((section) => section.mode === "manual"),
    [sections]
  );

  const totals = useMemo(
    () => buildTotals(sections, generalDeductions, illegalityDeductions),
    [sections, generalDeductions, illegalityDeductions]
  );

  const normalizedCurrentTeam = normalizeTeamName(teamName);
  const currentTeamRecords = useMemo(
    () => records.filter((record) => normalizeTeamName(record.teamName) === normalizedCurrentTeam),
    [normalizedCurrentTeam, records]
  );
  const groupedRecords = useMemo(() => groupExecutionRecordsByTeam(records), [records]);

  const updateExecutionDeduction = (id: string, direction: 1 | -1) => {
    setSections((current) => current.map((section) => {
      if (section.id !== id || section.mode !== "execution") {
        return section;
      }

      const nextDeductions = direction === 1
        ? Math.min(section.maxPoints, round(section.deductions + section.step))
        : Math.max(0, round(section.deductions - section.step));

      return {
        ...section,
        deductions: nextDeductions,
        earnedPoints: round(Math.max(0, section.maxPoints - nextDeductions))
      };
    }));
  };

  const resetExecutionDeduction = (id: string) => {
    setSections((current) => current.map((section) => (
      section.id === id && section.mode === "execution"
        ? { ...section, deductions: 0, earnedPoints: section.maxPoints }
        : section
    )));
  };

  const updateManualScore = (id: string, value: string) => {
    const parsed = Number(value);
    const safeValue = Number.isFinite(parsed) ? Math.max(parsed, 0) : 0;

    setSections((current) => current.map((section) => (
      section.id === id && section.mode === "manual"
        ? { ...section, earnedPoints: clamp(round(safeValue), 0, section.maxPoints) }
        : section
    )));
  };

  const resetEvaluator = () => {
    setLevel(2);
    setRoutineName("Routine Practice Score");
    setGeneralDeductions(0);
    setIllegalityDeductions(0);
    setGeneralStep(0.5);
    setSections(buildSections(activeVersion));
    setOpenManualSections([]);
  };

  const toggleManualSection = (id: string) => {
    setOpenManualSections((current) => (
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    ));
  };

  const saveSnapshot = () => {
    const safeTeamName = teamName.trim();

    if (!safeTeamName) {
      setSaveMessage("Add a team name before saving.");
      return;
    }

    const nextRecord: ExecutionEvaluatorRecord = {
      id: `${Date.now()}`,
      teamName: safeTeamName,
      routineName: routineName.trim() || "Routine Practice Score",
      level,
      systemId: activeSystem.id,
      systemName: activeSystem.name,
      versionId: activeVersion.id,
      versionLabel: activeVersion.label,
      savedAt: new Date().toISOString(),
      generalStep,
      sections: sections.map((section) => ({
        id: section.id,
        name: section.name,
        maxPoints: section.maxPoints,
        earnedPoints: section.earnedPoints,
        deductions: section.deductions,
        step: section.step,
        mode: section.mode
      })),
      totals
    };

    const nextRecords = [nextRecord, ...records].sort((left, right) => (
      new Date(right.savedAt).getTime() - new Date(left.savedAt).getTime()
    ));

    writeExecutionEvaluatorRecords(nextRecords);
    setRecords(nextRecords);
    setSaveMessage(`Saved under ${safeTeamName}.`);
  };

  const loadSnapshot = (record: ExecutionEvaluatorRecord) => {
    const nextSections = record.sections.map(normalizeSavedSection);

    setLevel(record.level);
    setRoutineName(record.routineName);
    setTeamName(record.teamName);
    setGeneralDeductions(record.totals.generalDeductions);
    setIllegalityDeductions(record.totals.illegalityDeductions);
    setGeneralStep(record.generalStep);
    setSections(nextSections);
    setOpenManualSections(nextSections.filter((section) => section.mode === "manual" && section.earnedPoints !== section.maxPoints).map((section) => section.id));
    setSaveMessage(`Loaded ${record.teamName} record.`);
  };

  if (!isReady) {
    return null;
  }

  return (
    <main className="workspace-shell page-stack execution-tool-shell">
      <section className="execution-hero surface-card panel-pad">
        <div>
          <div className="metric-label">Live tool</div>
          <h1 className="page-title settings-title">Execution Evaluator</h1>
          <p className="page-copy">
            Only sections labeled as execution allow deductions. The rest stay collapsed and can be opened only to edit score when needed.
          </p>
        </div>
        <div className="execution-score-box">
          <span className="execution-score-label">Live score</span>
          <strong>{formatNumber(totals.finalScore)}</strong>
          <span className="execution-score-subcopy">out of {formatNumber(totals.startScore)}</span>
        </div>
      </section>

      <section className="execution-layout">
        <div className="execution-main-column">
          <article className="surface-card panel-pad execution-panel">
            <div className="execution-top-fields">
              <div className="profile-form-field">
                <label htmlFor="execution-level">Level</label>
                <select id="execution-level" value={level} onChange={(event) => setLevel(Number(event.target.value))}>
                  {[1, 2, 3, 4, 5, 6, 7].map((value) => (
                    <option key={value} value={value}>Level {value}</option>
                  ))}
                </select>
              </div>
              <div className="profile-form-field">
                <label htmlFor="execution-routine">Routine name</label>
                <input id="execution-routine" type="text" value={routineName} onChange={(event) => setRoutineName(event.target.value)} />
              </div>
              <div className="profile-form-field">
                <label htmlFor="execution-team">Team name</label>
                <input id="execution-team" type="text" value={teamName} onChange={(event) => setTeamName(event.target.value)} placeholder="Example: Senior Elite" />
              </div>
            </div>

            <div className="execution-system-bar">
              <span>{activeSystem.name}</span>
              <span>{activeVersion.label}</span>
              <span>{executionSections.length} execution / {manualSections.length} manual</span>
            </div>
          </article>

          <article className="surface-card panel-pad execution-panel">
            <div className="execution-panel-head">
              <div>
                <div className="metric-label">Execution sections</div>
                <h2>Deductions enabled</h2>
              </div>
              <button type="button" className="profile-edit-button" onClick={resetEvaluator}>Reset</button>
            </div>

            <div className="execution-sections-grid">
              {executionSections.length ? executionSections.map((section) => {
                const lossPct = section.maxPoints > 0 ? round((section.deductions / section.maxPoints) * 100) : 0;

                return (
                  <article className="execution-section-card" key={section.id}>
                    <div className="execution-section-header">
                      <div>
                        <h3>{section.name}</h3>
                        <p>Deduction-based section.</p>
                      </div>
                      <div className="execution-section-chip">Max {formatNumber(section.maxPoints)}</div>
                    </div>

                    <div className="execution-metrics-grid">
                      <div className="execution-metric-box">
                        <span>Start</span>
                        <strong>{formatNumber(section.maxPoints)}</strong>
                      </div>
                      <div className="execution-metric-box">
                        <span>Deductions</span>
                        <strong>-{formatNumber(section.deductions)}</strong>
                      </div>
                      <div className="execution-metric-box">
                        <span>Execution</span>
                        <strong>{formatNumber(section.earnedPoints)}</strong>
                      </div>
                      <div className="execution-metric-box">
                        <span>Loss</span>
                        <strong>{lossPct.toFixed(0)}%</strong>
                      </div>
                    </div>

                    <div className="execution-actions-row">
                      <button type="button" className="execution-action-button" onClick={() => updateExecutionDeduction(section.id, -1)}>
                        Remove deduction
                      </button>
                      <button type="button" className="execution-action-button execution-action-button-primary" onClick={() => updateExecutionDeduction(section.id, 1)}>
                        Add deduction
                      </button>
                      <button type="button" className="execution-action-button execution-action-button-ghost" onClick={() => resetExecutionDeduction(section.id)}>
                        Reset
                      </button>
                    </div>
                  </article>
                );
              }) : <p className="muted-copy">No sections labeled as execution are present in the active scoring version.</p>}
            </div>
          </article>

          <article className="surface-card panel-pad execution-panel">
            <div className="execution-panel-head">
              <div>
                <div className="metric-label">Other sections</div>
                <h2>Manual score only</h2>
              </div>
            </div>

            <div className="execution-sections-grid">
              {manualSections.length ? manualSections.map((section) => {
                const isOpen = openManualSections.includes(section.id);

                return (
                  <article className="execution-manual-card" key={section.id} data-open={isOpen}>
                    <button type="button" className="execution-manual-toggle" onClick={() => toggleManualSection(section.id)}>
                      <span>{section.name}</span>
                      <span>{isOpen ? "Close" : "Open"}</span>
                    </button>
                    {isOpen ? (
                      <div className="execution-manual-body">
                        <div className="profile-form-field execution-manual-field">
                          <label htmlFor={`manual-score-${section.id}`}>Score</label>
                          <input
                            id={`manual-score-${section.id}`}
                            type="number"
                            step="0.01"
                            min="0"
                            max={section.maxPoints}
                            value={section.earnedPoints}
                            onChange={(event) => updateManualScore(section.id, event.target.value)}
                          />
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              }) : <p className="muted-copy">All visible sections are currently execution sections.</p>}
            </div>
          </article>
        </div>

        <aside className="execution-side-column">
          <article className="surface-card panel-pad execution-panel execution-panel-dark">
            <div className="metric-label">Score summary</div>
            <h2>Routine result</h2>

            <div className="execution-summary-list">
              <div><span>Level</span><strong>Level {level}</strong></div>
              <div><span>Routine</span><strong>{routineName || "Routine Practice Score"}</strong></div>
              <div><span>Team</span><strong>{teamName || "No team selected"}</strong></div>
              <div><span>Starting score</span><strong>{formatNumber(totals.startScore)}</strong></div>
              <div><span>Section loss</span><strong>-{formatNumber(totals.executionDeductions)}</strong></div>
              <div><span>Section subtotal</span><strong>{formatNumber(totals.executionSubtotal)}</strong></div>
              <div><span>General deductions</span><strong>-{formatNumber(totals.generalDeductions)}</strong></div>
              <div><span>Illegalities</span><strong>-{formatNumber(totals.illegalityDeductions)}</strong></div>
            </div>

            <div className="execution-final-row">
              <span>Final score</span>
              <strong>{formatNumber(totals.finalScore)}</strong>
            </div>
            <p className="execution-loss-copy">Total routine loss: {totals.totalLossPct.toFixed(1)}%</p>
          </article>

          <article className="surface-card panel-pad execution-panel">
            <div className="metric-label">Routine deductions</div>
            <h2>General controls</h2>

            <div className="execution-step-row">
              {deductionSteps.map((step) => (
                <button
                  key={step}
                  type="button"
                  className="dashboard-tab"
                  data-active={generalStep === step}
                  onClick={() => setGeneralStep(step)}
                >
                  {step.toFixed(2)}
                </button>
              ))}
            </div>

            <div className="execution-deduction-card">
              <div>
                <h3>General deductions</h3>
                <p>Falls or major routine-wide errors.</p>
              </div>
              <strong>-{formatNumber(generalDeductions)}</strong>
            </div>
            <div className="execution-actions-row">
              <button type="button" className="execution-action-button" onClick={() => setGeneralDeductions((value) => Math.max(0, round(value - generalStep)))}>
                Remove
              </button>
              <button type="button" className="execution-action-button execution-action-button-primary" onClick={() => setGeneralDeductions((value) => round(value + generalStep))}>
                Add
              </button>
              <button type="button" className="execution-action-button execution-action-button-ghost" onClick={() => setGeneralDeductions(0)}>
                Reset
              </button>
            </div>

            <div className="execution-deduction-card">
              <div>
                <h3>Illegalities</h3>
                <p>Separate routine-level impact.</p>
              </div>
              <strong>-{formatNumber(illegalityDeductions)}</strong>
            </div>
            <div className="execution-actions-row">
              <button type="button" className="execution-action-button" onClick={() => setIllegalityDeductions((value) => Math.max(0, round(value - generalStep)))}>
                Remove
              </button>
              <button type="button" className="execution-action-button execution-action-button-primary" onClick={() => setIllegalityDeductions((value) => round(value + generalStep))}>
                Add
              </button>
              <button type="button" className="execution-action-button execution-action-button-ghost" onClick={() => setIllegalityDeductions(0)}>
                Reset
              </button>
            </div>
          </article>

          <article className="surface-card panel-pad execution-panel">
            <div className="execution-panel-head">
              <div>
                <div className="metric-label">Saved records</div>
                <h2>By team name</h2>
              </div>
              <button type="button" className="profile-edit-button" onClick={saveSnapshot}>Save snapshot</button>
            </div>
            {saveMessage ? <p className="execution-save-message">{saveMessage}</p> : null}

            <div className="execution-team-groups">
              {groupedRecords.length ? groupedRecords.map((group) => (
                <button key={group.key} type="button" className="execution-team-group" onClick={() => loadSnapshot(group.latestRecord)}>
                  <div>
                    <strong>{group.teamName}</strong>
                    <span>{group.count} saved record{group.count === 1 ? "" : "s"}</span>
                  </div>
                  <span>{formatNumber(group.latestRecord.totals.finalScore)}</span>
                </button>
              )) : <p className="muted-copy">No records saved yet.</p>}
            </div>

            <div className="execution-record-list">
              <div className="metric-label">Current team records</div>
              {normalizedCurrentTeam && currentTeamRecords.length ? currentTeamRecords.slice(0, 5).map((record) => (
                <button key={record.id} type="button" className="execution-record-row" onClick={() => loadSnapshot(record)}>
                  <div>
                    <strong>{record.routineName}</strong>
                    <span>{new Date(record.savedAt).toLocaleString()}</span>
                  </div>
                  <span>{formatNumber(record.totals.finalScore)}</span>
                </button>
              )) : <p className="muted-copy">Type a team name to review that team&apos;s saved records.</p>}
            </div>
          </article>
        </aside>
      </section>
    </main>
  );
}
