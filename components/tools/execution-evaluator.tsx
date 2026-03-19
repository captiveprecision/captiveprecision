"use client";

import { useEffect, useMemo, useState } from "react";

import {
  Badge,
  Button,
  Card,
  CardContent,
  DetailGrid,
  EmptyState,
  Input,
  PageColumns,
  PageHero,
  PageMainColumn,
  PageSideColumn,
  SectionHeader,
  Select,
  StatGrid,
  Tabs
} from "@/components/ui";
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
const deductionStepItems = deductionSteps.map((step) => ({
  value: `${step}`,
  label: step.toFixed(2)
}));

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
      <PageHero
        eyebrow="Live tool"
        title="Execution Evaluator"
        description="Only sections labeled as execution allow deductions. The rest stay collapsed and can be opened only to edit score when needed."
        actions={<Badge variant="dark">{activeVersion.label}</Badge>}
      >
        <div className="execution-hero-meta">
          <div className="execution-hero-badges">
            <Badge variant="accent">{activeSystem.name}</Badge>
            <Badge variant="subtle">Level {level}</Badge>
            <Badge variant="subtle">{executionSections.length} execution / {manualSections.length} manual</Badge>
          </div>
          <Card variant="subtle" className="execution-score-box">
            <CardContent className="execution-score-box__content">
              <span className="execution-score-label">Live score</span>
              <strong>{formatNumber(totals.finalScore)}</strong>
              <span className="execution-score-subcopy">out of {formatNumber(totals.startScore)}</span>
            </CardContent>
          </Card>
        </div>
      </PageHero>

      <PageColumns>
        <PageMainColumn>
          <Card radius="panel">
            <CardContent className="execution-panel__content">
              <SectionHeader
                eyebrow="Active evaluation"
                title="Routine setup"
                description="Set the level, routine label, and team before applying deductions."
              />

              <div className="execution-top-fields">
                <Select id="execution-level" label="Level" value={level} onChange={(event) => setLevel(Number(event.target.value))}>
                  {[1, 2, 3, 4, 5, 6, 7].map((value) => (
                    <option key={value} value={value}>Level {value}</option>
                  ))}
                </Select>
                <Input id="execution-routine" label="Routine name" type="text" value={routineName} onChange={(event) => setRoutineName(event.target.value)} />
                <Input id="execution-team" label="Team name" type="text" value={teamName} onChange={(event) => setTeamName(event.target.value)} placeholder="Example: Senior Elite" />
              </div>

              <div className="execution-system-bar">
                <Badge variant="subtle">{activeSystem.name}</Badge>
                <Badge variant="subtle">{activeVersion.label}</Badge>
                <Badge variant="subtle">{executionSections.length} execution / {manualSections.length} manual</Badge>
              </div>
            </CardContent>
          </Card>

          <Card radius="panel">
            <CardContent className="execution-panel__content">
              <SectionHeader
                eyebrow="Execution sections"
                title="Deductions enabled"
                description="These sections subtract directly from the section maximum."
                actions={<Button variant="secondary" onClick={resetEvaluator}>Reset</Button>}
              />

              {executionSections.length ? (
                <div className="execution-sections-grid">
                  {executionSections.map((section) => {
                    const lossPct = section.maxPoints > 0 ? round((section.deductions / section.maxPoints) * 100) : 0;

                    return (
                      <Card key={section.id} variant="subtle" className="execution-section-card">
                        <CardContent className="execution-section-card__content">
                          <div className="execution-section-header">
                            <div className="execution-section-copy">
                              <h3>{section.name}</h3>
                              <p>Deduction-based section.</p>
                            </div>
                            <Badge variant="accent">Max {formatNumber(section.maxPoints)}</Badge>
                          </div>

                          <StatGrid className="execution-metrics-grid">
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
                          </StatGrid>

                          <div className="execution-actions-row">
                            <Button variant="secondary" onClick={() => updateExecutionDeduction(section.id, -1)}>
                              Remove deduction
                            </Button>
                            <Button onClick={() => updateExecutionDeduction(section.id, 1)}>
                              Add deduction
                            </Button>
                            <Button variant="ghost" onClick={() => resetExecutionDeduction(section.id)}>
                              Reset
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  title="No execution sections available"
                  description="The active scoring version does not currently include sections labeled as execution."
                />
              )}
            </CardContent>
          </Card>

          <Card radius="panel">
            <CardContent className="execution-panel__content">
              <SectionHeader
                eyebrow="Other sections"
                title="Manual score only"
                description="Open a section only when you need to manually override its score."
              />

              {manualSections.length ? (
                <div className="execution-sections-grid">
                  {manualSections.map((section) => {
                    const isOpen = openManualSections.includes(section.id);

                    return (
                      <Card key={section.id} variant="subtle" className="execution-manual-card" data-open={isOpen}>
                        <button type="button" className="execution-manual-toggle" onClick={() => toggleManualSection(section.id)}>
                          <span>{section.name}</span>
                          <Badge variant="subtle">{isOpen ? "Close" : "Open"}</Badge>
                        </button>
                        {isOpen ? (
                          <CardContent className="execution-manual-body">
                            <Input
                              id={`manual-score-${section.id}`}
                              label="Score"
                              type="number"
                              step="0.01"
                              min="0"
                              max={section.maxPoints}
                              value={section.earnedPoints}
                              onChange={(event) => updateManualScore(section.id, event.target.value)}
                              containerClassName="execution-manual-field"
                            />
                          </CardContent>
                        ) : null}
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  title="No manual sections"
                  description="All visible sections in this scoring version are currently deduction-based."
                />
              )}
            </CardContent>
          </Card>
        </PageMainColumn>

        <PageSideColumn>
          <Card radius="panel" variant="dark" className="execution-panel-dark">
            <CardContent className="execution-panel__content">
              <SectionHeader
                eyebrow="Score summary"
                title="Routine result"
                description="Current live evaluation totals."
              />

              <DetailGrid className="execution-summary-grid">
                <div className="execution-summary-item"><span>Level</span><strong>Level {level}</strong></div>
                <div className="execution-summary-item"><span>Routine</span><strong>{routineName || "Routine Practice Score"}</strong></div>
                <div className="execution-summary-item"><span>Team</span><strong>{teamName || "No team selected"}</strong></div>
                <div className="execution-summary-item"><span>Starting score</span><strong>{formatNumber(totals.startScore)}</strong></div>
                <div className="execution-summary-item"><span>Section loss</span><strong>-{formatNumber(totals.executionDeductions)}</strong></div>
                <div className="execution-summary-item"><span>Section subtotal</span><strong>{formatNumber(totals.executionSubtotal)}</strong></div>
                <div className="execution-summary-item"><span>General deductions</span><strong>-{formatNumber(totals.generalDeductions)}</strong></div>
                <div className="execution-summary-item"><span>Illegalities</span><strong>-{formatNumber(totals.illegalityDeductions)}</strong></div>
              </DetailGrid>

              <div className="execution-final-row">
                <span>Final score</span>
                <strong>{formatNumber(totals.finalScore)}</strong>
              </div>
              <p className="execution-loss-copy">Total routine loss: {totals.totalLossPct.toFixed(1)}%</p>
            </CardContent>
          </Card>

          <Card radius="panel">
            <CardContent className="execution-panel__content">
              <SectionHeader
                eyebrow="Routine deductions"
                title="General controls"
                description="Apply routine-level deductions and illegalities."
              />

              <Tabs
                items={deductionStepItems}
                value={`${generalStep}`}
                onValueChange={(value) => setGeneralStep(Number(value))}
                ariaLabel="Routine deduction step"
                className="execution-step-tabs"
              />

              <Card variant="subtle" className="execution-deduction-card">
                <CardContent className="execution-deduction-card__content">
                  <div className="execution-deduction-copy">
                    <h3>General deductions</h3>
                    <p>Falls or major routine-wide errors.</p>
                  </div>
                  <strong>-{formatNumber(generalDeductions)}</strong>
                </CardContent>
              </Card>
              <div className="execution-actions-row">
                <Button variant="secondary" onClick={() => setGeneralDeductions((value) => Math.max(0, round(value - generalStep)))}>
                  Remove
                </Button>
                <Button onClick={() => setGeneralDeductions((value) => round(value + generalStep))}>
                  Add
                </Button>
                <Button variant="ghost" onClick={() => setGeneralDeductions(0)}>
                  Reset
                </Button>
              </div>

              <Card variant="subtle" className="execution-deduction-card">
                <CardContent className="execution-deduction-card__content">
                  <div className="execution-deduction-copy">
                    <h3>Illegalities</h3>
                    <p>Separate routine-level impact.</p>
                  </div>
                  <strong>-{formatNumber(illegalityDeductions)}</strong>
                </CardContent>
              </Card>
              <div className="execution-actions-row">
                <Button variant="secondary" onClick={() => setIllegalityDeductions((value) => Math.max(0, round(value - generalStep)))}>
                  Remove
                </Button>
                <Button onClick={() => setIllegalityDeductions((value) => round(value + generalStep))}>
                  Add
                </Button>
                <Button variant="ghost" onClick={() => setIllegalityDeductions(0)}>
                  Reset
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card radius="panel">
            <CardContent className="execution-panel__content">
              <SectionHeader
                eyebrow="Saved records"
                title="By team name"
                description="Save the current snapshot and reopen recent saved evaluations."
                actions={<Button onClick={saveSnapshot}>Save snapshot</Button>}
              />
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
                )) : (
                  <EmptyState
                    title="No records saved yet"
                    description="Save a snapshot to build a record history by team name."
                  />
                )}
              </div>

              <div className="execution-record-list">
                <SectionHeader
                  eyebrow="Current team records"
                  title="Recent snapshots"
                  description="Type a team name to review that team's saved records."
                />
                {normalizedCurrentTeam && currentTeamRecords.length ? currentTeamRecords.slice(0, 5).map((record) => (
                  <button key={record.id} type="button" className="execution-record-row" onClick={() => loadSnapshot(record)}>
                    <div>
                      <strong>{record.routineName}</strong>
                      <span>{new Date(record.savedAt).toLocaleString()}</span>
                    </div>
                    <span>{formatNumber(record.totals.finalScore)}</span>
                  </button>
                )) : (
                  <EmptyState
                    title="No team records loaded"
                    description="Enter a team name to review saved snapshots for that team."
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </PageSideColumn>
      </PageColumns>
    </main>
  );
}

