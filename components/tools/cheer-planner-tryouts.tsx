"use client";

import { useEffect, useMemo, useState } from "react";

import {
  LEVEL_KEYS,
  cloneTemplate,
  defaultSkillLibrary,
  defaultTryoutTemplate,
  levelLabels,
  readCheerPlannerTryoutsState,
  type PlannerLevelEvaluation,
  type PlannerLevelKey,
  type PlannerSkillEvaluation,
  type PlannerTopLevel,
  type PlannerTryoutEvaluation,
  type PlannerTryoutTemplate,
  writeCheerPlannerTryoutsState
} from "@/lib/tools/cheer-planner-tryouts";

type PlannerSportTab = "tumbling" | "dance" | "jumps" | "stunts";

type AthleteFormState = {
  name: string;
  dateOfBirth: string;
  teamName: string;
  athleteNotes: string;
};

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function formatScore(value: number) {
  return round(value).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

function buildSkillRow(name: string, isExtra = false): PlannerSkillEvaluation {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    optionId: null,
    isExtra
  };
}

function buildLevelEvaluations(template: PlannerTryoutTemplate): PlannerLevelEvaluation[] {
  return LEVEL_KEYS.map((levelKey) => {
    const desiredCount = template.defaultSkillCounts[levelKey] || 3;
    const defaults = defaultSkillLibrary[levelKey] || [];

    return {
      levelKey,
      skills: Array.from({ length: desiredCount }, (_, index) => buildSkillRow(defaults[index] || "", false))
    };
  });
}

function calculateSummary(template: PlannerTryoutTemplate, evaluations: PlannerLevelEvaluation[]) {
  const optionMap = new Map(template.options.map((option) => [option.id, option]));

  const levelScores: PlannerTopLevel[] = evaluations.map((level) => {
    const baseScore = level.skills
      .filter((skill) => !skill.isExtra)
      .reduce((sum, skill) => sum + (skill.optionId ? optionMap.get(skill.optionId)?.value ?? 0 : 0), 0);

    const extraScore = level.skills
      .filter((skill) => skill.isExtra)
      .reduce((sum, skill) => sum + (skill.optionId ? optionMap.get(skill.optionId)?.value ?? 0 : 0), 0);

    return {
      levelKey: level.levelKey,
      levelLabel: levelLabels[level.levelKey],
      baseScore: round(baseScore),
      extraScore: round(extraScore)
    };
  });

  const totalBaseScore = round(levelScores.reduce((sum, item) => sum + item.baseScore, 0));
  const totalExtraScore = round(levelScores.reduce((sum, item) => sum + item.extraScore, 0));
  const topLevels = [...levelScores]
    .sort((left, right) => {
      if (right.baseScore !== left.baseScore) {
        return right.baseScore - left.baseScore;
      }

      const rightRank = right.levelKey === "beginner" ? 0 : Number(right.levelKey);
      const leftRank = left.levelKey === "beginner" ? 0 : Number(left.levelKey);
      return rightRank - leftRank;
    })
    .slice(0, 3);

  return {
    totalBaseScore,
    totalExtraScore,
    levelScores,
    topLevels
  };
}

function getRecentAthleteLabel(evaluation: PlannerTryoutEvaluation) {
  return evaluation.athlete.name || "Unnamed athlete";
}

export function CheerPlannerTryouts() {
  const [activeTab, setActiveTab] = useState<PlannerSportTab>("tumbling");
  const [template, setTemplate] = useState<PlannerTryoutTemplate>(cloneTemplate(defaultTryoutTemplate));
  const [athlete, setAthlete] = useState<AthleteFormState>({
    name: "",
    dateOfBirth: "",
    teamName: "",
    athleteNotes: ""
  });
  const [levels, setLevels] = useState<PlannerLevelEvaluation[]>(() => buildLevelEvaluations(defaultTryoutTemplate));
  const [savedEvaluations, setSavedEvaluations] = useState<PlannerTryoutEvaluation[]>([]);
  const [openLevels, setOpenLevels] = useState<PlannerLevelKey[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    const state = readCheerPlannerTryoutsState();
    setTemplate(state.template);
    setSavedEvaluations(state.evaluations);
    setLevels(buildLevelEvaluations(state.template));
  }, []);

  useEffect(() => {
    if (!saveMessage) {
      return;
    }

    const timeout = window.setTimeout(() => setSaveMessage(null), 2500);
    return () => window.clearTimeout(timeout);
  }, [saveMessage]);

  const summary = useMemo(() => calculateSummary(template, levels), [template, levels]);

  const updateAthlete = (field: keyof AthleteFormState, value: string) => {
    setAthlete((current) => ({ ...current, [field]: value }));
  };

  const updateTemplateOption = (index: number, field: "label" | "value", value: string) => {
    setTemplate((current) => ({
      ...current,
      options: current.options.map((option, optionIndex) => {
        if (optionIndex !== index) {
          return option;
        }

        return {
          ...option,
          [field]: field === "value" ? Number(value) || 0 : value
        };
      })
    }));
  };

  const updateSkillCount = (levelKey: PlannerLevelKey, value: string) => {
    const nextCount = Math.max(1, Math.min(20, Number(value) || 1));
    setTemplate((current) => ({
      ...current,
      defaultSkillCounts: {
        ...current.defaultSkillCounts,
        [levelKey]: nextCount
      }
    }));
  };

  const saveTemplate = () => {
    const nextTemplate = {
      ...template,
      updatedAt: new Date().toISOString()
    };
    const state = readCheerPlannerTryoutsState();

    writeCheerPlannerTryoutsState({
      ...state,
      template: nextTemplate
    });
    setTemplate(nextTemplate);
    setLevels(buildLevelEvaluations(nextTemplate));
    setOpenLevels([]);
    setSaveMessage("Template saved.");
  };

  const resetTemplate = () => {
    writeCheerPlannerTryoutsState({
      ...readCheerPlannerTryoutsState(),
      template: cloneTemplate(defaultTryoutTemplate)
    });
    setTemplate(cloneTemplate(defaultTryoutTemplate));
    setLevels(buildLevelEvaluations(defaultTryoutTemplate));
    setOpenLevels([]);
    setSaveMessage("Template reset.");
  };

  const toggleLevel = (levelKey: PlannerLevelKey) => {
    setOpenLevels((current) => (
      current.includes(levelKey) ? current.filter((item) => item !== levelKey) : [...current, levelKey]
    ));
  };

  const updateSkillName = (levelKey: PlannerLevelKey, skillId: string, value: string) => {
    setLevels((current) => current.map((level) => (
      level.levelKey === levelKey
        ? {
            ...level,
            skills: level.skills.map((skill) => skill.id === skillId ? { ...skill, name: value } : skill)
          }
        : level
    )));
  };

  const updateSkillOption = (levelKey: PlannerLevelKey, skillId: string, optionId: string) => {
    setLevels((current) => current.map((level) => (
      level.levelKey === levelKey
        ? {
            ...level,
            skills: level.skills.map((skill) => skill.id === skillId ? { ...skill, optionId } : skill)
          }
        : level
    )));
  };

  const removeSkill = (levelKey: PlannerLevelKey, skillId: string) => {
    setLevels((current) => current.map((level) => (
      level.levelKey === levelKey
        ? {
            ...level,
            skills: level.skills.filter((skill) => skill.id !== skillId)
          }
        : level
    )));
  };

  const addExtraSkill = (levelKey: PlannerLevelKey) => {
    setLevels((current) => current.map((level) => (
      level.levelKey === levelKey
        ? {
            ...level,
            skills: [...level.skills, buildSkillRow("", true)]
          }
        : level
    )));
  };

  const saveEvaluation = () => {
    const state = readCheerPlannerTryoutsState();
    const nextEvaluation: PlannerTryoutEvaluation = {
      id: `${Date.now()}`,
      plannerStage: "tryouts",
      sport: "tumbling",
      athlete: {
        name: athlete.name.trim(),
        dateOfBirth: athlete.dateOfBirth,
        teamName: athlete.teamName.trim(),
        athleteNotes: athlete.athleteNotes.trim()
      },
      templateId: template.id,
      templateName: template.name,
      templateUpdatedAt: template.updatedAt,
      evaluations: levels.map((level) => ({
        ...level,
        skills: level.skills.map((skill) => ({ ...skill }))
      })),
      summary,
      savedAt: new Date().toISOString()
    };

    const nextEvaluations = [nextEvaluation, ...state.evaluations].slice(0, 50);
    writeCheerPlannerTryoutsState({
      template,
      evaluations: nextEvaluations
    });
    setSavedEvaluations(nextEvaluations);
    setSaveMessage(`Saved evaluation for ${nextEvaluation.athlete.name || "athlete"}.`);
  };

  const loadEvaluation = (evaluation: PlannerTryoutEvaluation) => {
    setAthlete({
      name: evaluation.athlete.name,
      dateOfBirth: evaluation.athlete.dateOfBirth,
      teamName: evaluation.athlete.teamName,
      athleteNotes: evaluation.athlete.athleteNotes
    });
    setLevels(evaluation.evaluations.map((level) => ({
      ...level,
      skills: level.skills.map((skill) => ({ ...skill }))
    })));
    setOpenLevels(evaluation.evaluations.map((level) => level.levelKey));
    setSaveMessage(`Loaded ${getRecentAthleteLabel(evaluation)}.`);
  };

  return (
    <main className="workspace-shell page-stack planner-shell">
      <section className="planner-hero surface-card panel-pad">
        <div>
          <div className="metric-label">Cheer Planner</div>
          <h1 className="page-title settings-title">Step 1: Tryouts</h1>
          <p className="page-copy">
            First phase of the planner. Evaluate athletes during tryouts, keep tumbling results structured, and save data in a format we can grow into the full Cheer Planner later.
          </p>
        </div>
        <div className="planner-hero-metrics">
          <div className="planner-hero-pill">
            <span>Total score</span>
            <strong>{formatScore(summary.totalBaseScore)}</strong>
          </div>
          <div className="planner-hero-pill planner-hero-pill-accent">
            <span>Extra score</span>
            <strong>{formatScore(summary.totalExtraScore)}</strong>
          </div>
        </div>
      </section>

      <section className="planner-layout">
        <div className="planner-main-column">
          <article className="surface-card panel-pad planner-panel">
            <div className="planner-header-row">
              <div className="planner-badge-row">
                {(["tumbling", "dance", "jumps", "stunts"] as PlannerSportTab[]).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    className="dashboard-tab"
                    data-active={activeTab === tab}
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {activeTab === "tumbling" ? (
              <>
                <div className="planner-info-bar">
                  <span className="planner-info-dot">i</span>
                  <p>
                    Template-driven tumbling evaluation. Scores are local to Cheer Planner and do not use the routine scoring system.
                  </p>
                </div>

                <div className="planner-athlete-grid">
                  <div className="profile-form-field">
                    <label htmlFor="planner-athlete-name">Athlete</label>
                    <input id="planner-athlete-name" type="text" value={athlete.name} onChange={(event) => updateAthlete("name", event.target.value)} placeholder="Athlete name" />
                  </div>
                  <div className="profile-form-field">
                    <label htmlFor="planner-athlete-dob">Date of birth</label>
                    <input id="planner-athlete-dob" type="date" value={athlete.dateOfBirth} onChange={(event) => updateAthlete("dateOfBirth", event.target.value)} />
                  </div>
                  <div className="profile-form-field">
                    <label htmlFor="planner-athlete-team">Team</label>
                    <input id="planner-athlete-team" type="text" value={athlete.teamName} onChange={(event) => updateAthlete("teamName", event.target.value)} placeholder="Optional" />
                  </div>
                  <div className="profile-form-field planner-athlete-notes">
                    <label htmlFor="planner-athlete-notes">Athlete ID / Notes</label>
                    <input id="planner-athlete-notes" type="text" value={athlete.athleteNotes} onChange={(event) => updateAthlete("athleteNotes", event.target.value)} placeholder="Optional" />
                  </div>
                </div>

                <div className="planner-settings-card" data-open={settingsOpen}>
                  <div className="planner-settings-head">
                    <div>
                      <div className="metric-label">Template settings</div>
                      <h2>Tryout template</h2>
                      <p className="muted-copy">Edit option labels, option values, and default skill counts for each level.</p>
                    </div>
                    <button type="button" className="profile-edit-button" onClick={() => setSettingsOpen((value) => !value)}>
                      {settingsOpen ? "Close template" : "Edit template"}
                    </button>
                  </div>

                  {settingsOpen ? (
                    <div className="planner-settings-body">
                      <div className="planner-settings-grid">
                        {template.options.map((option, index) => (
                          <div className="planner-setting-card" key={option.id}>
                            <label>Option label</label>
                            <input type="text" value={option.label} onChange={(event) => updateTemplateOption(index, "label", event.target.value)} />
                            <label>Points</label>
                            <input type="number" step="0.1" value={option.value} onChange={(event) => updateTemplateOption(index, "value", event.target.value)} />
                          </div>
                        ))}
                      </div>

                      <div className="planner-skill-count-grid">
                        {LEVEL_KEYS.map((levelKey) => (
                          <div className="planner-setting-card planner-skill-count-card" key={levelKey}>
                            <label>{levelLabels[levelKey]}</label>
                            <input type="number" min="1" max="20" value={template.defaultSkillCounts[levelKey]} onChange={(event) => updateSkillCount(levelKey, event.target.value)} />
                          </div>
                        ))}
                      </div>

                      <div className="planner-settings-actions">
                        <button type="button" className="profile-edit-button" onClick={saveTemplate}>Save template</button>
                        <button type="button" className="profile-edit-button planner-secondary-button" onClick={resetTemplate}>Reset template</button>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="planner-level-list">
                  {levels.map((level) => {
                    const isOpen = openLevels.includes(level.levelKey);
                    const normalSkills = level.skills.filter((skill) => !skill.isExtra);
                    const extraSkills = level.skills.filter((skill) => skill.isExtra);

                    return (
                      <article className="planner-level-card" key={level.levelKey} data-open={isOpen}>
                        <button type="button" className="planner-level-toggle" onClick={() => toggleLevel(level.levelKey)}>
                          <div>
                            <span className="metric-label">Collapsed by default</span>
                            <h3>{levelLabels[level.levelKey]} Tumbling</h3>
                            <p>Open this section if the athlete shows skills from this level.</p>
                          </div>
                          <span>{isOpen ? "Close" : "Open"}</span>
                        </button>

                        {isOpen ? (
                          <div className="planner-level-body">
                            <div className="planner-skill-list">
                              {[...normalSkills, ...extraSkills].map((skill) => {
                                const baseIndex = normalSkills.findIndex((item) => item.id === skill.id);
                                const extraIndex = extraSkills.findIndex((item) => item.id === skill.id);

                                return (
                                  <div className="planner-skill-row" key={skill.id} data-extra={skill.isExtra}>
                                    <div className="planner-skill-copy">
                                      <label>{skill.isExtra ? `Extra skill ${extraIndex + 1}` : `Skill ${baseIndex + 1}`}</label>
                                      <input type="text" value={skill.name} onChange={(event) => updateSkillName(level.levelKey, skill.id, event.target.value)} placeholder="Enter skill name" />
                                      <small>{skill.isExtra ? "Extra skills count as bonus score only." : "Edit the skill name if needed."}</small>
                                    </div>
                                    <div className="planner-option-group">
                                      {template.options.map((option) => (
                                        <button
                                          key={option.id}
                                          type="button"
                                          className="planner-option-button"
                                          data-active={skill.optionId === option.id}
                                          onClick={() => updateSkillOption(level.levelKey, skill.id, option.id)}
                                        >
                                          {formatScore(option.value)}
                                        </button>
                                      ))}
                                    </div>
                                    <button type="button" className="planner-remove-button" onClick={() => removeSkill(level.levelKey, skill.id)}>
                                      Remove
                                    </button>
                                  </div>
                                );
                              })}
                            </div>

                            <div className="planner-level-actions">
                              <button type="button" className="planner-secondary-button profile-edit-button" onClick={() => addExtraSkill(level.levelKey)}>
                                + Add extra skill
                              </button>
                              <span className="muted-copy">Default setup: {template.defaultSkillCounts[level.levelKey]} skills for this level.</span>
                            </div>
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="planner-placeholder">
                <h2>{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} placeholder</h2>
                <p>This part of Cheer Planner will be connected in later stages. Right now the live build is focused on Tryouts / Tumbling.</p>
              </div>
            )}
          </article>
        </div>

        <aside className="planner-side-column">
          <article className="surface-card panel-pad planner-panel planner-summary-card">
            <div className="planner-summary-head">
              <div>
                <div className="metric-label">Evaluation summary</div>
                <h2>Tumbling score overview</h2>
                <p className="muted-copy">Unselected skills count as 0 points. Extra skills are tracked separately.</p>
              </div>
              <span className="planner-template-tag">Tryouts</span>
            </div>

            <div className="planner-athlete-summary-grid">
              <div className="planner-athlete-summary-item">
                <span className="profile-detail-label">Athlete</span>
                <p className="profile-detail-value">{athlete.name || "-"}</p>
              </div>
              <div className="planner-athlete-summary-item">
                <span className="profile-detail-label">Date of birth</span>
                <p className="profile-detail-value">{athlete.dateOfBirth || "-"}</p>
              </div>
              <div className="planner-athlete-summary-item">
                <span className="profile-detail-label">Team</span>
                <p className="profile-detail-value">{athlete.teamName || "-"}</p>
              </div>
              <div className="planner-athlete-summary-item">
                <span className="profile-detail-label">Notes</span>
                <p className="profile-detail-value">{athlete.athleteNotes || "-"}</p>
              </div>
            </div>

            <div className="planner-summary-metrics">
              <div className="planner-summary-total">
                <span>Total score</span>
                <strong>{formatScore(summary.totalBaseScore)}</strong>
              </div>
              <div className="planner-summary-total planner-summary-total-accent">
                <span>Extra score</span>
                <strong>{formatScore(summary.totalExtraScore)}</strong>
              </div>
            </div>

            <div className="planner-summary-grid-boxes">
              <div className="planner-summary-box">
                <h3>All level totals</h3>
                <div className="planner-level-score-list">
                  {summary.levelScores.map((item) => (
                    <div className="planner-level-score-row" key={item.levelKey}>
                      <span>{item.levelLabel}</span>
                      <strong>{formatScore(item.baseScore)}</strong>
                    </div>
                  ))}
                </div>
              </div>
              <div className="planner-summary-box">
                <h3>Top 3 levels</h3>
                <div className="planner-level-score-list">
                  {summary.topLevels.map((item, index) => (
                    <div className="planner-level-score-row" key={item.levelKey}>
                      <span><b>{index + 1}.</b> {item.levelLabel}</span>
                      <strong>{formatScore(item.baseScore)}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="planner-save-row">
              <button type="button" className="landing-auth-button" onClick={saveEvaluation}>Save full evaluation</button>
              {saveMessage ? <p className="planner-save-message">{saveMessage}</p> : null}
            </div>
          </article>

          <article className="surface-card panel-pad planner-panel">
            <div className="metric-label">Saved evaluations</div>
            <h2>Recent athletes</h2>
            <div className="planner-recent-list">
              {savedEvaluations.length ? savedEvaluations.slice(0, 8).map((evaluation) => (
                <button type="button" key={evaluation.id} className="planner-recent-item" onClick={() => loadEvaluation(evaluation)}>
                  <div>
                    <strong>{getRecentAthleteLabel(evaluation)}</strong>
                    <span>{evaluation.athlete.teamName || "No team"}</span>
                  </div>
                  <span>{formatScore(evaluation.summary.totalBaseScore)}</span>
                </button>
              )) : <p className="muted-copy">No tryout evaluations saved yet.</p>}
            </div>
          </article>
        </aside>
      </section>
    </main>
  );
}