"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";

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
  { value: "dance", label: "Dance / Coming Soon" },
  { value: "jumps", label: "Jumps / Coming Soon" },
  { value: "stunts", label: "Stunts / Coming Soon" }
];

type AthleteIntakeMode = "registered" | "new";

function isPlannerSportTab(value: string): value is PlannerSportTab {
  return TRYOUT_SPORT_TABS.some((tab) => tab.value === value);
}

type TryoutsSurfaceProps = {
  athleteDraft: AthleteDraftState;
  athletePool: CheerPlannerIntegration["athletePool"];
  updateAthleteDraft: (field: keyof AthleteDraftState, value: string) => void;
  updateParentContact: (contactId: string, field: "name" | "email" | "phone", value: string) => void;
  addParentContact: () => void;
  removeParentContact: (contactId: string) => void;
  startNewAthlete: () => void;
  loadRegisteredAthlete: (athleteId: string) => void;
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
    athletePool,
    updateAthleteDraft,
    updateParentContact,
    addParentContact,
    removeParentContact,
    startNewAthlete,
    loadRegisteredAthlete,
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
  const [athleteIntakeMode, setAthleteIntakeMode] = useState<AthleteIntakeMode>("registered");
  const [registeredSearch, setRegisteredSearch] = useState("");

  const matchingRegisteredAthletes = useMemo(() => {
    const search = registeredSearch.trim().toLowerCase();

    if (!search) {
      return athletePool.slice(0, 8);
    }

    return athletePool
      .filter((athlete) => (
        athlete.name.toLowerCase().includes(search)
        || athlete.firstName.toLowerCase().includes(search)
        || athlete.lastName.toLowerCase().includes(search)
        || athlete.registrationNumber.toLowerCase().includes(search)
        || athlete.parentContacts.some((contact) => (
          contact.name.toLowerCase().includes(search)
          || contact.email.toLowerCase().includes(search)
          || contact.phone.toLowerCase().includes(search)
        ))
      ))
      .slice(0, 8);
  }, [athletePool, registeredSearch]);

  const showAthleteForm = athleteIntakeMode === "new" || Boolean(athleteDraft.athleteId);
  const canSaveAthleteRecord = athleteIntakeMode === "new" || Boolean(athleteDraft.athleteId);

  const selectNewAthleteMode = () => {
    setAthleteIntakeMode("new");
    setRegisteredSearch("");
    startNewAthlete();
  };

  const selectRegisteredAthleteMode = () => {
    setAthleteIntakeMode("registered");
  };

  const handleRegisteredAthleteSelect = (athleteId: string) => {
    const selectedAthlete = athletePool.find((athlete) => athlete.id === athleteId) ?? null;

    if (!selectedAthlete) {
      return;
    }

    setAthleteIntakeMode("registered");
    setRegisteredSearch(`${selectedAthlete.name} (${selectedAthlete.registrationNumber})`);
    loadRegisteredAthlete(athleteId);
  };

  return (
    <div className="planner-layout-grid">
      <div className="planner-main-column">
        <Card radius="panel" className="planner-panel-stack">
          <CardContent className="planner-panel-stack">
            <SectionHeader eyebrow="Athlete Intake" title="Tryout Record" />

            <div className="planner-athlete-intake-stack">
              <div className="planner-athlete-intake-toggle">
                <Button
                  type="button"
                  variant={athleteIntakeMode === "registered" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={selectRegisteredAthleteMode}
                >
                  Registered Athlete
                </Button>
                <Button
                  type="button"
                  variant={athleteIntakeMode === "new" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={selectNewAthleteMode}
                >
                  New Athlete
                </Button>
              </div>

              {athleteIntakeMode === "registered" ? (
                <div className="planner-panel-stack">
                  <Input
                    label="Search Athletes"
                    placeholder="Search by name, registration, or parent contact"
                    value={registeredSearch}
                    onChange={(event) => setRegisteredSearch(event.target.value)}
                  />
                  <div className="planner-athlete-search-results">
                    {matchingRegisteredAthletes.length ? (
                      matchingRegisteredAthletes.map((athlete) => (
                        <Button
                          key={athlete.id}
                          type="button"
                          variant="ghost"
                          className="planner-athlete-search-result"
                          onClick={() => handleRegisteredAthleteSelect(athlete.id)}
                        >
                          <div className="planner-athlete-search-result__copy">
                            <strong>{athlete.name}</strong>
                            <span>
                              {athlete.registrationNumber} / {athlete.parentContacts[0]?.name || "No parent contact yet"}
                            </span>
                          </div>
                          <Badge variant={athlete.displayLevel === "Unqualified" ? "subtle" : "dark"}>
                            {athlete.displayLevel}
                          </Badge>
                        </Button>
                      ))
                    ) : (
                      <EmptyState
                        title="No Registered Athletes Found."
                        description="Search another athlete or switch to New Athlete to create one."
                      />
                    )}
                  </div>
                </div>
              ) : null}

              {showAthleteForm ? (
                <div className="planner-panel-stack">
                  <div className="planner-athlete-grid">
                    <Input label="Registration #" value={athleteDraft.registrationNumber || "Auto-assigned on Save"} readOnly />
                    <Input label="First Name" value={athleteDraft.firstName} onChange={(event) => updateAthleteDraft("firstName", event.target.value)} />
                    <Input label="Last Name" value={athleteDraft.lastName} onChange={(event) => updateAthleteDraft("lastName", event.target.value)} />
                    <Input type="date" label="Date Of Birth" value={athleteDraft.dateOfBirth} onChange={(event) => updateAthleteDraft("dateOfBirth", event.target.value)} />
                    <Textarea
                      label="Notes"
                      rows={3}
                      containerClassName="planner-athlete-grid-wide"
                      value={athleteDraft.notes}
                      onChange={(event) => updateAthleteDraft("notes", event.target.value)}
                    />
                  </div>

                  <div className="planner-athlete-parent-stack">
                    <SectionHeader
                      eyebrow="Parents"
                      title="Parent Or Guardian Contacts"
                      actions={
                        <Button type="button" variant="ghost" size="sm" onClick={addParentContact}>
                          Add Contact
                        </Button>
                      }
                    />
                    {athleteDraft.parentContacts.map((contact, index) => (
                      <Card key={contact.id} variant="subtle" className="planner-parent-contact-card">
                        <CardContent className="planner-panel-stack">
                          <div className="planner-inline-actions planner-parent-contact-card__head">
                            <strong>Contact {index + 1}</strong>
                            <Button type="button" variant="ghost" size="sm" onClick={() => removeParentContact(contact.id)}>
                              Remove
                            </Button>
                          </div>
                          <div className="planner-athlete-grid">
                            <Input label="Parent Name" value={contact.name} onChange={(event) => updateParentContact(contact.id, "name", event.target.value)} />
                            <Input label="Parent Email" type="email" value={contact.email} onChange={(event) => updateParentContact(contact.id, "email", event.target.value)} />
                            <Input label="Parent Phone" value={contact.phone} onChange={(event) => updateParentContact(contact.id, "phone", event.target.value)} />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyState
                  title="Select A Registered Athlete To Continue."
                  description="Choosing an athlete will populate the tryout form automatically."
                />
              )}
            </div>
          </CardContent>
        </Card>

        <Card radius="panel" className="planner-panel-stack">
          <CardContent className="planner-panel-stack">
            <SectionHeader eyebrow="Sport" title="Tryout Track" />
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
                title="Tumbling Is The Active Track"
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
                  title="Tryout Settings"
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
                          label={`${levelLabels[levelKey]} Skills`}
                          value={template.defaultSkillCounts[levelKey]}
                          onChange={(event) => updateSkillCount(levelKey, event.target.value)}
                        />
                      ))}
                    </div>

                    <div className="planner-inline-actions">
                      <Button onClick={saveTemplate}>Save Template</Button>
                      <Button variant="secondary" onClick={resetTemplate}>Reset Template</Button>
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
                  title="Tumbling Levels"
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
                                Add Extra Skill
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
            <SectionHeader eyebrow="Live Summary" title="Top Levels" />
            <div className="planner-summary-list">
              {summary.topLevels.length ? summary.topLevels.map((item) => (
                <div key={item.levelKey} className="planner-summary-row">
                  <strong>{item.levelLabel}</strong>
                  <span>Main {formatScore(item.baseScore)} / Extra {formatScore(item.extraScore)}</span>
                </div>
              )) : (
                <EmptyState
                  title="No Evaluated Levels Yet."
                  description="Top Levels will appear after at least one level has recorded an evaluation."
                />
              )}
            </div>
            <Button onClick={saveEvaluation} disabled={activeSport !== "tumbling" || !canSaveAthleteRecord}>
              Save Athlete Record
            </Button>
          </CardContent>
        </Card>

        <Card radius="panel" className="planner-panel-stack">
          <CardContent className="planner-panel-stack">
            <SectionHeader eyebrow="Recent" title="Latest Evaluations" />
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
                <EmptyState title="No Tryout Records Saved Yet." description="Saved evaluations will appear here for quick reload." />
              )}
            </div>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
