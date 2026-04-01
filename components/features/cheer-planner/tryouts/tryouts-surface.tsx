"use client";

import type { Dispatch, SetStateAction } from "react";

import { Badge, Button, Card, CardContent, EmptyState, Input, SectionHeader, Select, Tabs, Textarea } from "@/components/ui";
import type {
  AthleteDraftState,
  CheerPlannerIntegration,
  PlannerSportTab
} from "@/lib/services/planner-integration";
import type {
  PlannerLevelEvaluation,
  PlannerLevelKey,
  PlannerTryoutEvaluation,
  PlannerTryoutTemplate
} from "@/lib/tools/cheer-planner-tryouts";

const TRYOUT_SPORT_TABS: { value: PlannerSportTab; label: string }[] = [
  { value: "tumbling", label: "Tumbling" },
  { value: "dance", label: "Dance / Coming soon" },
  { value: "jumps", label: "Jumps / Coming soon" },
  { value: "stunts", label: "Stunts / Coming soon" }
];

function isPlannerSportTab(value: string): value is PlannerSportTab {
  return TRYOUT_SPORT_TABS.some((tab) => tab.value === value);
}

type TryoutsSurfaceProps = {
  athleteDraft: AthleteDraftState;
  updateAthleteDraft: (field: keyof AthleteDraftState, value: string) => void;
  startNewAthlete: () => void;
  activeSport: PlannerSportTab;
  setActiveSport: (value: PlannerSportTab) => void;
  template: PlannerTryoutTemplate;
  settingsOpen: boolean;
  setSettingsOpen: Dispatch<SetStateAction<boolean>>;
  updateTemplateOption: (index: number, field: "label" | "value", value: string) => void;
  levelKeys: readonly PlannerLevelKey[];
  levelLabels: CheerPlannerIntegration["levelLabels"];
  updateSkillCount: (levelKey: PlannerLevelKey, value: string) => void;
  saveTemplate: () => void;
  resetTemplate: () => void;
  levelsDraft: PlannerLevelEvaluation[];
  openLevels: PlannerLevelKey[];
  toggleLevel: (levelKey: PlannerLevelKey) => void;
  summary: CheerPlannerIntegration["summary"];
  updateSkillName: (levelKey: PlannerLevelKey, skillId: string, value: string) => void;
  updateSkillOption: (levelKey: PlannerLevelKey, skillId: string, optionId: string) => void;
  removeSkill: (levelKey: PlannerLevelKey, skillId: string) => void;
  addExtraSkill: (levelKey: PlannerLevelKey) => void;
  saveEvaluation: () => void;
  recentEvaluations: PlannerTryoutEvaluation[];
  loadEvaluation: (evaluation: PlannerTryoutEvaluation) => void;
  getRecentAthleteLabel: (evaluation: PlannerTryoutEvaluation) => string;
  getEvaluationDate: (evaluation: PlannerTryoutEvaluation) => string;
  formatScore: (value: number) => string;
};

export function TryoutsSurface(props: TryoutsSurfaceProps) {
  const {
    athleteDraft,
    updateAthleteDraft,
    startNewAthlete,
    activeSport,
    setActiveSport,
    template,
    settingsOpen,
    setSettingsOpen,
    updateTemplateOption,
    levelKeys,
    levelLabels,
    updateSkillCount,
    saveTemplate,
    resetTemplate,
    levelsDraft,
    openLevels,
    toggleLevel,
    summary,
    updateSkillName,
    updateSkillOption,
    removeSkill,
    addExtraSkill,
    saveEvaluation,
    recentEvaluations,
    loadEvaluation,
    getRecentAthleteLabel,
    getEvaluationDate,
    formatScore
  } = props;

  return (
    <div className="planner-layout-grid">
      <div className="planner-main-column">
        <Card radius="panel" className="planner-panel-stack">
          <CardContent className="planner-panel-stack">
            <SectionHeader
              eyebrow="Athlete intake"
              title="Tryout record"
              actions={<Button variant="ghost" size="sm" onClick={startNewAthlete}>New athlete</Button>}
            />
            <div className="planner-athlete-grid">
              <Input label="Registration #" value={athleteDraft.registrationNumber || "Auto-assigned on save"} readOnly />
              <Input label="Athlete name" value={athleteDraft.name} onChange={(event) => updateAthleteDraft("name", event.target.value)} />
              <Input type="date" label="Date of birth" value={athleteDraft.dateOfBirth} onChange={(event) => updateAthleteDraft("dateOfBirth", event.target.value)} />
              <Input label="Source team" value={athleteDraft.sourceTeamName} onChange={(event) => updateAthleteDraft("sourceTeamName", event.target.value)} />
              <Textarea
                label="Notes"
                rows={3}
                containerClassName="planner-athlete-grid-wide"
                value={athleteDraft.athleteNotes}
                onChange={(event) => updateAthleteDraft("athleteNotes", event.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card radius="panel" className="planner-panel-stack">
          <CardContent className="planner-panel-stack">
            <SectionHeader eyebrow="Sport" title="Tryout track" />
            <Tabs
              className="planner-sport-tabs"
              items={TRYOUT_SPORT_TABS}
              value={activeSport}
              onValueChange={(value) => {
                if (isPlannerSportTab(value)) {
                  setActiveSport(value);
                }
              }}
              ariaLabel="Planner sport"
            />
            {activeSport !== "tumbling" ? (
              <EmptyState
                title="Tumbling is the active track"
                description="This step is wired for tumbling first. The other tryout lanes will connect next."
              />
            ) : null}
          </CardContent>
        </Card>

        {activeSport === "tumbling" ? (
          <>
            <Card radius="panel" className="planner-panel-stack">
              <CardContent className="planner-panel-stack">
                <SectionHeader
                  eyebrow="Template"
                  title="Tryout settings"
                  actions={
                    <Button variant="ghost" size="sm" onClick={() => setSettingsOpen((current) => !current)}>
                      {settingsOpen ? "Hide" : "Edit"}
                    </Button>
                  }
                />

                {settingsOpen ? (
                  <div className="planner-settings-stack">
                    <div className="planner-option-grid">
                      {template.options.map((option, index) => (
                        <Card key={option.id} variant="subtle" className="planner-option-card">
                          <CardContent className="planner-panel-stack">
                            <Input
                              label="Label"
                              value={option.label}
                              onChange={(event) => updateTemplateOption(index, "label", event.target.value)}
                            />
                            <Input
                              type="number"
                              step="0.1"
                              label="Value"
                              value={option.value}
                              onChange={(event) => updateTemplateOption(index, "value", event.target.value)}
                            />
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    <div className="planner-count-grid">
                      {levelKeys.map((levelKey) => (
                        <Input
                          key={levelKey}
                          type="number"
                          min={1}
                          max={20}
                          label={`${levelLabels[levelKey]} skills`}
                          value={template.defaultSkillCounts[levelKey]}
                          onChange={(event) => updateSkillCount(levelKey, event.target.value)}
                        />
                      ))}
                    </div>

                    <div className="planner-inline-actions">
                      <Button onClick={saveTemplate}>Save template</Button>
                      <Button variant="secondary" onClick={resetTemplate}>Reset template</Button>
                    </div>
                  </div>
                ) : (
                  <div className="planner-chip-row">
                    {template.options.map((option) => (
                      <Badge key={option.id} variant="accent">
                        {option.label} / {formatScore(option.value)}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card radius="panel" className="planner-panel-stack">
              <CardContent className="planner-panel-stack">
                <SectionHeader
                  eyebrow="Evaluation"
                  title="Tumbling levels"
                  actions={
                    <div className="planner-summary-chip-group">
                      <Badge variant="accent">Main {formatScore(summary.totalBaseScore)}</Badge>
                      <Badge variant="subtle">Extra {formatScore(summary.totalExtraScore)}</Badge>
                    </div>
                  }
                />

                <div className="planner-level-stack">
                  {levelsDraft.map((level) => {
                    const levelSummary = summary.levelScores.find((item) => item.levelKey === level.levelKey);
                    const isOpen = openLevels.includes(level.levelKey);

                    return (
                      <Card key={level.levelKey} variant="subtle" className="planner-level-card">
                        <CardContent className="planner-level-card__content">
                          <Button
                            type="button"
                            variant="ghost"
                            className="planner-level-head"
                            onClick={() => toggleLevel(level.levelKey)}
                          >
                            <div>
                              <strong>{levelLabels[level.levelKey]}</strong>
                              <span>{level.skills.length} skills</span>
                            </div>
                            <div className="planner-level-meta">
                              <span>Main {formatScore(levelSummary?.baseScore ?? 0)}</span>
                              <span>Extra {formatScore(levelSummary?.extraScore ?? 0)}</span>
                            </div>
                          </Button>

                          {isOpen ? (
                            <div className="planner-skill-list">
                              {level.skills.map((skill) => (
                                <div key={skill.id} className="planner-skill-row">
                                  <Input
                                    label={skill.isExtra ? "Extra skill" : "Skill"}
                                    containerClassName="planner-skill-name-field"
                                    value={skill.name}
                                    onChange={(event) => updateSkillName(level.levelKey, skill.id, event.target.value)}
                                  />
                                  <Select
                                    label="Evaluation"
                                    containerClassName="planner-skill-option-field"
                                    value={skill.optionId ?? ""}
                                    onChange={(event) => updateSkillOption(level.levelKey, skill.id, event.target.value)}
                                    placeholder="Select"
                                  >
                                    {template.options.map((option) => (
                                      <option key={option.id} value={option.id}>
                                        {option.label}
                                      </option>
                                    ))}
                                  </Select>
                                  <Button type="button" variant="ghost" onClick={() => removeSkill(level.levelKey, skill.id)}>
                                    Remove
                                  </Button>
                                </div>
                              ))}
                              <Button type="button" variant="secondary" size="sm" onClick={() => addExtraSkill(level.levelKey)}>
                                Add extra skill
                              </Button>
                            </div>
                          ) : null}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>

      <aside className="planner-side-column">
        <Card radius="panel" className="planner-panel-stack">
          <CardContent className="planner-panel-stack">
            <SectionHeader eyebrow="Live summary" title="Top levels" />
            <div className="planner-summary-list">
              {summary.topLevels.map((item) => (
                <div key={item.levelKey} className="planner-summary-row">
                  <strong>{item.levelLabel}</strong>
                  <span>Main {formatScore(item.baseScore)} / Extra {formatScore(item.extraScore)}</span>
                </div>
              ))}
            </div>
            <Button onClick={saveEvaluation} disabled={activeSport !== "tumbling"}>Save athlete record</Button>
          </CardContent>
        </Card>

        <Card radius="panel" className="planner-panel-stack">
          <CardContent className="planner-panel-stack">
            <SectionHeader eyebrow="Recent" title="Latest evaluations" />
            <div className="planner-recent-list">
              {recentEvaluations.length ? recentEvaluations.map((evaluation) => (
                <Button
                  key={evaluation.id}
                  type="button"
                  variant="ghost"
                  className="planner-recent-card"
                  onClick={() => loadEvaluation(evaluation)}
                >
                  <strong>{getRecentAthleteLabel(evaluation)}</strong>
                  <span>{evaluation.athleteSnapshot?.registrationNumber ?? evaluation.athleteRegistrationNumber ?? "No registration"}</span>
                  <span>{new Date(getEvaluationDate(evaluation)).toLocaleDateString("en-US")}</span>
                </Button>
              )) : (
                <EmptyState title="No tryout records saved yet." description="Saved evaluations will appear here for quick reload." />
              )}
            </div>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
