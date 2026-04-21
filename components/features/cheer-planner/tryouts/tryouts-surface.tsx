"use client";

import { ChevronDown, ChevronUp, Eye, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";

import { Badge, Button, Card, CardContent, EmptyState, Input, SectionHeader, Tabs, Textarea } from "@/components/ui";
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
  { value: "jumps", label: "Jumps / Coming Soon" },
  { value: "stunts", label: "Stunts / Coming Soon" },
  { value: "dance", label: "Dance / Coming Soon" }
];

const ATHLETE_INTAKE_TABS: { value: AthleteIntakeMode; label: string }[] = [
  { value: "registered", label: "Registered Athlete" },
  { value: "new", label: "New Athlete" }
];

const ATHLETE_SEARCH_LETTER_PATTERN = /\p{L}/u;

type AthleteIntakeMode = "registered" | "new";
type RegisteredAthleteDetailMode = "collapsed" | "view" | "edit";

function isPlannerSportTab(value: string): value is PlannerSportTab {
  return TRYOUT_SPORT_TABS.some((tab) => tab.value === value);
}

function buildSelectedAthleteName(firstName: string, lastName: string, registrationNumber: string) {
  const trimmedName = `${firstName} ${lastName}`.trim();

  if (trimmedName) {
    return trimmedName;
  }

  if (registrationNumber.trim()) {
    return registrationNumber.trim();
  }

  return "Selected Athlete";
}

function buildRegisteredAthleteSearchLabel(name: string, registrationNumber: string) {
  const trimmedRegistrationNumber = registrationNumber.trim();
  return trimmedRegistrationNumber ? `${name} (${trimmedRegistrationNumber})` : name;
}

function formatSelectedAthleteBirthDate(dateOfBirth: string) {
  const trimmedDateOfBirth = dateOfBirth.trim();

  if (!trimmedDateOfBirth) {
    return "Not added";
  }

  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(trimmedDateOfBirth)
    ? new Date(`${trimmedDateOfBirth}T00:00:00`)
    : new Date(trimmedDateOfBirth);

  if (Number.isNaN(parsedDate.getTime())) {
    return trimmedDateOfBirth;
  }

  return parsedDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
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
  templateEditor: PlannerTryoutTemplate;
  settingsOpen: boolean;
  setSettingsOpen: Dispatch<SetStateAction<boolean>>;
  updateTemplateOption: (index: number, field: "label" | "value", value: string) => void;
  removeTemplateOption: (optionId: string) => void;
  addTemplateOption: () => void;
  levelKeys: readonly PlannerLevelKey[];
  levelLabels: CheerPlannerIntegration["levelLabels"];
  updateTemplateSkill: (levelKey: PlannerLevelKey, skillId: string, value: string) => void;
  addTemplateSkill: (levelKey: PlannerLevelKey) => void;
  removeTemplateSkill: (levelKey: PlannerLevelKey, skillId: string) => void;
  saveTemplate: () => void;
  resetTemplate: () => void;
  cancelTemplateChanges: () => void;
  isSavingAction: (actionKey: string) => boolean;
  levelsDraft: PlannerLevelEvaluation[];
  openLevels: PlannerLevelKey[];
  toggleLevel: (levelKey: PlannerLevelKey) => void;
  summary: CheerPlannerIntegration["summary"];
  updateSkillName: (levelKey: PlannerLevelKey, skillId: string, value: string) => void;
  updateSkillOption: (levelKey: PlannerLevelKey, skillId: string, optionId: string) => void;
  addExtraSkill: (levelKey: PlannerLevelKey) => void;
  saveEvaluation: () => void;
  recentEvaluations: PlannerTryoutEvaluation[];
  loadEvaluation: (evaluation: PlannerTryoutEvaluation, options?: { expandLevels?: boolean }) => void;
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
    templateEditor,
    settingsOpen,
    setSettingsOpen,
    updateTemplateOption,
    removeTemplateOption,
    addTemplateOption,
    levelKeys,
    levelLabels,
    updateTemplateSkill,
    addTemplateSkill,
    removeTemplateSkill,
    saveTemplate,
    resetTemplate,
    cancelTemplateChanges,
    isSavingAction,
    levelsDraft,
    openLevels,
    toggleLevel,
    summary,
    updateSkillName,
    updateSkillOption,
    addExtraSkill,
    saveEvaluation,
    recentEvaluations,
    loadEvaluation,
    getRecentAthleteLabel,
    getEvaluationDate,
    formatScore
  } = props;
  const [athleteIntakeMode, setAthleteIntakeMode] = useState<AthleteIntakeMode>("registered");
  const [registeredAthleteDetailMode, setRegisteredAthleteDetailMode] = useState<RegisteredAthleteDetailMode>("collapsed");
  const [registeredSearch, setRegisteredSearch] = useState("");
  const [previewEvaluation, setPreviewEvaluation] = useState<PlannerTryoutEvaluation | null>(null);
  const [scoringOpen, setScoringOpen] = useState(true);
  const [openTemplateLevels, setOpenTemplateLevels] = useState<PlannerLevelKey[]>(["beginner"]);
  const previousRegisteredAthleteId = useRef<string | null>(null);
  const normalizedRegisteredSearch = registeredSearch.trim();
  const hasRegisteredSearchQuery = ATHLETE_SEARCH_LETTER_PATTERN.test(normalizedRegisteredSearch);
  const selectedAthleteName = useMemo(
    () => buildSelectedAthleteName(athleteDraft.firstName, athleteDraft.lastName, athleteDraft.registrationNumber),
    [athleteDraft.firstName, athleteDraft.lastName, athleteDraft.registrationNumber]
  );
  const selectedAthleteSearchLabel = useMemo(
    () => athleteDraft.athleteId ? buildRegisteredAthleteSearchLabel(selectedAthleteName, athleteDraft.registrationNumber) : "",
    [athleteDraft.athleteId, athleteDraft.registrationNumber, selectedAthleteName]
  );
  const selectedAthleteBirthDate = useMemo(
    () => formatSelectedAthleteBirthDate(athleteDraft.dateOfBirth),
    [athleteDraft.dateOfBirth]
  );
  const shouldUseCompactSkillOptionLabels = template.options.length >= 4 || template.options.some((option) => option.label.trim().length > 12);
  const toggleTemplateLevel = (levelKey: PlannerLevelKey) => {
    setOpenTemplateLevels((current) => (
      current.includes(levelKey) ? current.filter((item) => item !== levelKey) : [...current, levelKey]
    ));
  };
  const previewEvaluationSkills = useMemo(() => {
    if (!previewEvaluation) {
      return [];
    }

    const templateOptionsById = new Map(template.options.map((option) => [option.id, option]));

    return previewEvaluation.rawData.levels.flatMap((level) => (
      level.skills.flatMap((skill) => {
        if (!skill.optionId) {
          return [];
        }

        const matchedOption = templateOptionsById.get(skill.optionId);

        return [{
          id: `${level.levelKey}-${skill.id}`,
          name: skill.name,
          optionLabel: matchedOption?.label ?? "Scored",
          optionValue: matchedOption ? formatScore(matchedOption.value) : null
        }];
      })
    ));
  }, [formatScore, previewEvaluation, template.options]);
  const showSelectedAthleteSummary = athleteIntakeMode === "registered" && Boolean(athleteDraft.athleteId);
  const isSearchShowingSelectedAthlete = showSelectedAthleteSummary && normalizedRegisteredSearch === selectedAthleteSearchLabel;

  const matchingRegisteredAthletes = useMemo(() => {
    const search = normalizedRegisteredSearch.toLowerCase();

    if (!hasRegisteredSearchQuery) {
      return [];
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
  }, [athletePool, hasRegisteredSearchQuery, normalizedRegisteredSearch]);

  useEffect(() => {
    const nextRegisteredAthleteId = athleteIntakeMode === "registered" ? athleteDraft.athleteId ?? null : null;

    if (nextRegisteredAthleteId && previousRegisteredAthleteId.current !== nextRegisteredAthleteId) {
      setRegisteredAthleteDetailMode("collapsed");
      setRegisteredSearch(buildRegisteredAthleteSearchLabel(
        buildSelectedAthleteName(athleteDraft.firstName, athleteDraft.lastName, athleteDraft.registrationNumber),
        athleteDraft.registrationNumber
      ));
    }

    previousRegisteredAthleteId.current = nextRegisteredAthleteId;
  }, [athleteDraft.athleteId, athleteDraft.firstName, athleteDraft.lastName, athleteDraft.registrationNumber, athleteIntakeMode]);

  const showAthleteView = athleteIntakeMode === "registered" && showSelectedAthleteSummary && registeredAthleteDetailMode === "view";
  const showAthleteForm = athleteIntakeMode === "new" || (showSelectedAthleteSummary && registeredAthleteDetailMode === "edit");
  const canSaveAthleteRecord = athleteIntakeMode === "new" || Boolean(athleteDraft.athleteId);
  const athleteFieldsReadOnly = athleteIntakeMode === "registered" && registeredAthleteDetailMode === "view";

  const selectNewAthleteMode = () => {
    setAthleteIntakeMode("new");
    setRegisteredAthleteDetailMode("edit");
    setRegisteredSearch("");
    startNewAthlete();
  };

  const selectRegisteredAthleteMode = () => {
    setAthleteIntakeMode("registered");
    setRegisteredAthleteDetailMode("collapsed");
  };

  const handleRegisteredAthleteSelect = (athleteId: string) => {
    const selectedAthlete = athletePool.find((athlete) => athlete.id === athleteId) ?? null;

    if (!selectedAthlete) {
      return;
    }

    setAthleteIntakeMode("registered");
    setRegisteredAthleteDetailMode("collapsed");
    setRegisteredSearch(`${selectedAthlete.name} (${selectedAthlete.registrationNumber})`);
    loadRegisteredAthlete(athleteId);
  };

  const handlePreviewEdit = () => {
    if (!previewEvaluation) {
      return;
    }

    setPreviewEvaluation(null);
    loadEvaluation(previewEvaluation, { expandLevels: false });
  };

  return (
    <>
      <div className="planner-layout-grid">
      <div className="planner-main-column">
        <Card radius="panel" className="planner-panel-stack">
          <CardContent className="planner-panel-stack">
            <SectionHeader
              className="planner-tryout-header"
              eyebrow="Athlete Intake"
              title="Tryout Record"
              actions={
                <Tabs
                  className="planner-athlete-intake-tabs"
                  items={ATHLETE_INTAKE_TABS}
                  value={athleteIntakeMode}
                  onValueChange={(value) => {
                    if (value === "registered") {
                      selectRegisteredAthleteMode();
                      return;
                    }

                    selectNewAthleteMode();
                  }}
                  ariaLabel="Athlete intake mode"
                />
              }
            />

            <div className="planner-athlete-intake-stack">
              {athleteIntakeMode === "registered" ? (
                <div className="planner-panel-stack">
                  <Input
                    label="Search Athletes"
                    placeholder="Search by name, registration, or parent contact"
                    value={registeredSearch}
                    onChange={(event) => setRegisteredSearch(event.target.value)}
                  />
                  {hasRegisteredSearchQuery && !isSearchShowingSelectedAthlete ? (
                    matchingRegisteredAthletes.length ? (
                      <div className="planner-athlete-search-results">
                        {matchingRegisteredAthletes.map((athlete) => (
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
                        ))}
                      </div>
                    ) : (
                      <p className="planner-athlete-search-feedback">
                        No athletes match that search.
                      </p>
                    )
                  ) : null}

                  {showSelectedAthleteSummary ? (
                    <div className="planner-selected-athlete-summary">
                      <div className="planner-selected-athlete-summary__copy">
                        <div className="planner-selected-athlete-summary__field">
                          <span>Athlete</span>
                          <strong>{selectedAthleteName}</strong>
                        </div>
                        <div className="planner-selected-athlete-summary__meta">
                          <span>DOB</span>
                          <strong>{selectedAthleteBirthDate}</strong>
                          <strong className="planner-selected-athlete-summary__registration">#{athleteDraft.registrationNumber || "Pending"}</strong>
                        </div>
                      </div>
                      <div className="planner-selected-athlete-summary__actions">
                        <Button
                          type="button"
                          variant={registeredAthleteDetailMode === "view" ? "secondary" : "ghost"}
                          size="sm"
                          iconOnly
                          leadingIcon={<Eye />}
                          aria-label={registeredAthleteDetailMode === "view" ? "Collapse athlete details" : "View athlete details"}
                          onClick={() => setRegisteredAthleteDetailMode((current) => (current === "view" ? "collapsed" : "view"))}
                        />
                        <Button
                          type="button"
                          variant={registeredAthleteDetailMode === "edit" ? "secondary" : "ghost"}
                          size="sm"
                          iconOnly
                          leadingIcon={<Pencil />}
                          aria-label={registeredAthleteDetailMode === "edit" ? "Collapse athlete editor" : "Edit athlete details"}
                          onClick={() => setRegisteredAthleteDetailMode((current) => (current === "edit" ? "collapsed" : "edit"))}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {showAthleteView ? (
                <div className="planner-panel-stack">
                  <div className="planner-athlete-detail-list">
                    <div className="planner-athlete-detail-row">
                      <span>Athlete</span>
                      <strong>{selectedAthleteName}</strong>
                    </div>
                    <div className="planner-athlete-detail-row">
                      <span>Registration #</span>
                      <strong>{athleteDraft.registrationNumber || "Pending"}</strong>
                    </div>
                    <div className="planner-athlete-detail-row">
                      <span>First Name</span>
                      <strong>{athleteDraft.firstName || "-"}</strong>
                    </div>
                    <div className="planner-athlete-detail-row">
                      <span>Last Name</span>
                      <strong>{athleteDraft.lastName || "-"}</strong>
                    </div>
                    <div className="planner-athlete-detail-row">
                      <span>Date Of Birth</span>
                      <strong>{selectedAthleteBirthDate}</strong>
                    </div>
                    {athleteDraft.notes.trim() ? (
                      <div className="planner-athlete-detail-row">
                        <span>Notes</span>
                        <strong>{athleteDraft.notes}</strong>
                      </div>
                    ) : null}
                  </div>

                  {athleteDraft.parentContacts.length ? (
                    <div className="planner-athlete-parent-stack">
                      <SectionHeader eyebrow="Parents" title="Parent Or Guardian Contacts" />
                      <div className="planner-athlete-detail-list">
                        {athleteDraft.parentContacts.map((contact, index) => (
                          <div key={contact.id} className="planner-athlete-detail-group">
                            <div className="planner-athlete-detail-row">
                              <span>Contact</span>
                              <strong>{index + 1}</strong>
                            </div>
                            {contact.name.trim() ? (
                              <div className="planner-athlete-detail-row">
                                <span>Parent Name</span>
                                <strong>{contact.name}</strong>
                              </div>
                            ) : null}
                            {contact.email.trim() ? (
                              <div className="planner-athlete-detail-row">
                                <span>Parent Email</span>
                                <strong>{contact.email}</strong>
                              </div>
                            ) : null}
                            {contact.phone.trim() ? (
                              <div className="planner-athlete-detail-row">
                                <span>Parent Phone</span>
                                <strong>{contact.phone}</strong>
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {showAthleteForm ? (
                <div className="planner-panel-stack">
                  <div className="planner-athlete-grid">
                    <Input label="Registration #" value={athleteDraft.registrationNumber || "Auto-assigned on Save"} readOnly />
                    <Input
                      label="First Name"
                      value={athleteDraft.firstName}
                      readOnly={athleteFieldsReadOnly}
                      onChange={(event) => updateAthleteDraft("firstName", event.target.value)}
                    />
                    <Input
                      label="Last Name"
                      value={athleteDraft.lastName}
                      readOnly={athleteFieldsReadOnly}
                      onChange={(event) => updateAthleteDraft("lastName", event.target.value)}
                    />
                    <Input
                      type="date"
                      label="Date Of Birth"
                      value={athleteDraft.dateOfBirth}
                      readOnly={athleteFieldsReadOnly}
                      onChange={(event) => updateAthleteDraft("dateOfBirth", event.target.value)}
                    />
                    <Textarea
                      label="Notes"
                      rows={3}
                      containerClassName="planner-athlete-grid-wide"
                      value={athleteDraft.notes}
                      readOnly={athleteFieldsReadOnly}
                      onChange={(event) => updateAthleteDraft("notes", event.target.value)}
                    />
                  </div>

                  <div className="planner-athlete-parent-stack">
                    <SectionHeader
                      eyebrow="Parents"
                      title="Parent Or Guardian Contacts"
                      actions={!athleteFieldsReadOnly ? (
                        <Button type="button" variant="ghost" size="sm" onClick={addParentContact}>
                          Add Contact
                        </Button>
                      ) : undefined}
                    />
                    {athleteDraft.parentContacts.map((contact, index) => (
                      <Card key={contact.id} variant="subtle" className="planner-parent-contact-card">
                        <CardContent className="planner-panel-stack">
                          <div className="planner-inline-actions planner-parent-contact-card__head">
                            <strong>Contact {index + 1}</strong>
                            {!athleteFieldsReadOnly ? (
                              <Button type="button" variant="ghost" size="sm" leadingIcon={<Trash2 />} onClick={() => removeParentContact(contact.id)}>
                                Remove
                              </Button>
                            ) : null}
                          </div>
                          <div className="planner-athlete-grid">
                            <Input
                              label="Parent Name"
                              value={contact.name}
                              readOnly={athleteFieldsReadOnly}
                              onChange={(event) => updateParentContact(contact.id, "name", event.target.value)}
                            />
                            <Input
                              label="Parent Email"
                              type="email"
                              value={contact.email}
                              readOnly={athleteFieldsReadOnly}
                              onChange={(event) => updateParentContact(contact.id, "email", event.target.value)}
                            />
                            <Input
                              label="Parent Phone"
                              value={contact.phone}
                              readOnly={athleteFieldsReadOnly}
                              onChange={(event) => updateParentContact(contact.id, "phone", event.target.value)}
                            />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="planner-panel-divider" aria-hidden="true" />

              <div className="planner-panel-stack">
                <SectionHeader title="Tryout Track" />
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
              </div>
            </div>
          </CardContent>
        </Card>

        {activeSport === "tumbling" ? (
          <>
            <Card radius="panel" className="planner-panel-stack">
              <CardContent className="planner-panel-stack">
                <SectionHeader
                  className="planner-settings-header"
                  eyebrow="Template"
                  title="Tryout Settings"
                  actions={
                    <Button variant="ghost" size="sm" leadingIcon={settingsOpen ? undefined : <Pencil />} onClick={() => setSettingsOpen((current) => !current)}>
                      {settingsOpen ? "Hide" : "Edit"}
                    </Button>
                  }
                />

                {settingsOpen ? (
                  <div className="planner-settings-stack">
                    <Card variant="subtle" className="planner-template-level-card">
                      <CardContent className="planner-template-level-card__content">
                        <Button
                          type="button"
                          variant="ghost"
                          className="planner-template-level-head"
                          onClick={() => setScoringOpen((current) => !current)}
                        >
                          <span className="planner-template-level-title">Scoring</span>
                          <div className="planner-template-level-meta">
                            <span>{templateEditor.options.length} options</span>
                            {scoringOpen ? <ChevronUp /> : <ChevronDown />}
                          </div>
                        </Button>

                        {scoringOpen ? (
                          <div className="planner-option-grid">
                            {templateEditor.options.map((option, index) => (
                              <Card key={option.id} variant="subtle" className="planner-option-card">
                                <CardContent className="planner-option-row">
                                  <label className="planner-option-inline-field planner-option-inline-field--label">
                                    <span className="planner-field-label">Label</span>
                                    <input
                                      className="ui-input planner-option-inline-input"
                                      aria-label={`Template option ${index + 1} label`}
                                      value={option.label}
                                      onChange={(event) => updateTemplateOption(index, "label", event.target.value)}
                                    />
                                  </label>
                                  <label className="planner-option-inline-field planner-option-inline-field--value">
                                    <span className="planner-field-label">Value</span>
                                    <input
                                      type="number"
                                      step="0.1"
                                      className="ui-input planner-option-inline-input planner-option-inline-input--value"
                                      aria-label={`Template option ${index + 1} value`}
                                      value={option.value}
                                      onChange={(event) => updateTemplateOption(index, "value", event.target.value)}
                                    />
                                  </label>
                                  <div className="planner-option-row__action">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      iconOnly
                                      leadingIcon={<Trash2 />}
                                      aria-label={`Delete score option ${index + 1}`}
                                      onClick={() => removeTemplateOption(option.id)}
                                    />
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="planner-template-add-skill"
                              leadingIcon={<Plus />}
                              onClick={addTemplateOption}
                            >
                              Add Score
                            </Button>
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>

                    <div className="planner-template-level-stack">
                      {levelKeys.map((levelKey) => {
                        const isOpen = openTemplateLevels.includes(levelKey);
                        const skills = templateEditor.skillLibrary[levelKey] ?? [];

                        return (
                          <Card key={levelKey} variant="subtle" className="planner-template-level-card">
                            <CardContent className="planner-template-level-card__content">
                              <Button
                                type="button"
                                variant="ghost"
                                className="planner-template-level-head"
                                onClick={() => toggleTemplateLevel(levelKey)}
                              >
                                <span className="planner-template-level-title">{levelLabels[levelKey]}</span>
                                <div className="planner-template-level-meta">
                                  <span>{skills.length} skills</span>
                                  {isOpen ? <ChevronUp /> : <ChevronDown />}
                                </div>
                              </Button>

                              {isOpen ? (
                                <div className="planner-template-skill-stack">
                                  {skills.map((skill, index) => (
                                    <Card key={skill.id} variant="subtle" className="planner-template-skill-card">
                                      <CardContent className="planner-template-skill-card__content">
                                        <span className="planner-field-label">{`Skill Name ${index + 1}`}</span>
                                        <div className="planner-template-skill-card__grid">
                                          <Input
                                            value={skill.name}
                                            onChange={(event) => updateTemplateSkill(levelKey, skill.id, event.target.value)}
                                          />
                                        </div>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          iconOnly
                                          leadingIcon={<Trash2 />}
                                          aria-label={`Delete skill ${index + 1}`}
                                          onClick={() => removeTemplateSkill(levelKey, skill.id)}
                                        />
                                      </CardContent>
                                    </Card>
                                  ))}
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    className="planner-template-add-skill"
                                    leadingIcon={<Plus />}
                                    onClick={() => addTemplateSkill(levelKey)}
                                  >
                                    Add Skill
                                  </Button>
                                </div>
                              ) : null}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>

                    <div className="planner-template-actions">
                      <Button onClick={saveTemplate} disabled={isSavingAction("template")}>
                        {isSavingAction("template") ? "Saving..." : "Save Template"}
                      </Button>
                      <div className="planner-template-actions__secondary">
                        <Button variant="ghost" onClick={resetTemplate}>Reset Template</Button>
                        <Button variant="ghost" onClick={cancelTemplateChanges}>Cancel</Button>
                      </div>
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
                            <span className="planner-level-count">{level.skills.length} skills</span>
                            <strong className="planner-level-title">{levelLabels[level.levelKey]}</strong>
                            <div className="planner-level-meta">
                              <span>Main {formatScore(levelSummary?.baseScore ?? 0)}</span>
                              <span>Extra {formatScore(levelSummary?.extraScore ?? 0)}</span>
                            </div>
                          </Button>

                          {isOpen ? (
                            <div className="planner-skill-list">
                              {level.skills.map((skill) => (
                                <div key={skill.id} className="planner-skill-row">
                                  <div className="planner-skill-name-stack">
                                    <div className="planner-skill-head">
                                      <span className="planner-field-label">{skill.isExtra ? "Extra skill" : "Skill"}</span>
                                    </div>
                                    <div className="planner-skill-input-field planner-skill-input-field--readonly">
                                      <div className="planner-skill-name-display">
                                        <strong>{skill.name || "Unnamed skill"}</strong>
                                      </div>
                                      <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        iconOnly
                                        className="planner-skill-inline-clean"
                                        leadingIcon={<Trash2 />}
                                        aria-label="Clean skill evaluation"
                                        title="Clean"
                                        onClick={() => updateSkillOption(level.levelKey, skill.id, "")}
                                      />
                                    </div>
                                  </div>
                                  <div className="planner-skill-option-field">
                                    <span className="planner-field-label">Evaluation</span>
                                    <Tabs
                                      className={`planner-skill-option-tabs${shouldUseCompactSkillOptionLabels ? " planner-skill-option-tabs--compact" : ""}`}
                                      ariaLabel={`${skill.name || levelLabels[level.levelKey]} evaluation options`}
                                      value={skill.optionId ?? ""}
                                      onValueChange={(value) => updateSkillOption(level.levelKey, skill.id, value)}
                                      items={template.options.map((option) => ({
                                        value: option.id,
                                        label: shouldUseCompactSkillOptionLabels ? formatScore(option.value) : `${option.label} / ${formatScore(option.value)}`
                                      }))}
                                    />
                                  </div>
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

                <Button
                  size="lg"
                  className="planner-save-evaluation-button"
                  leadingIcon={<Save />}
                  onClick={saveEvaluation}
                  disabled={activeSport !== "tumbling" || !canSaveAthleteRecord || isSavingAction("evaluation")}
                >
                  {isSavingAction("evaluation") ? "Saving..." : "Save Athlete Record"}
                </Button>

                <div className="planner-panel-divider" aria-hidden="true" />

                <div className="planner-panel-stack">
                  <SectionHeader title="Top Levels" />
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
                </div>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>

      <aside className="planner-side-column">
        <Card radius="panel" className="planner-panel-stack">
          <CardContent className="planner-panel-stack">
            <SectionHeader eyebrow="Recent" title="Latest Evaluations" />
            <div className="planner-recent-list">
              {recentEvaluations.length ? recentEvaluations.map((evaluation) => {
                const recentLevelLabel = evaluation.resultSummary.topLevels[0]?.levelLabel;

                return (
                  <Button
                    key={evaluation.id}
                    type="button"
                    variant="ghost"
                    className="planner-recent-card"
                    onClick={() => setPreviewEvaluation(evaluation)}
                  >
                    <div className="planner-recent-card__copy">
                      <strong>{getRecentAthleteLabel(evaluation)}</strong>
                      <span>
                        {(evaluation.athleteSnapshot?.registrationNumber ?? evaluation.athleteRegistrationNumber ?? "No registration")}
                        {" / "}
                        {evaluation.athleteSnapshot?.parentContacts?.[0]?.name || "No parent contact yet"}
                      </span>
                    </div>
                    <div className="planner-recent-card__meta">
                      <Badge variant={recentLevelLabel ? "dark" : "subtle"}>
                        {recentLevelLabel ?? "No level"}
                      </Badge>
                      <span>{new Date(getEvaluationDate(evaluation)).toLocaleDateString("en-US")}</span>
                    </div>
                  </Button>
                );
              }) : (
                <EmptyState title="No Tryout Records Saved Yet." description="Saved evaluations will appear here for quick reload." />
              )}
            </div>
          </CardContent>
        </Card>
      </aside>
      </div>

      {previewEvaluation ? (
        <div className="planner-evaluation-sheet-backdrop" role="presentation" onClick={() => setPreviewEvaluation(null)}>
          <div
            className="planner-evaluation-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="planner-evaluation-sheet-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="planner-evaluation-sheet__handle" aria-hidden="true" />
            <div className="planner-evaluation-sheet__header">
              <div className="planner-evaluation-sheet__copy">
                <span className="planner-evaluation-sheet__eyebrow">Tryout evaluation</span>
                <h2 id="planner-evaluation-sheet-title">{getRecentAthleteLabel(previewEvaluation)}</h2>
                <p>
                  {(previewEvaluation.athleteSnapshot?.registrationNumber ?? previewEvaluation.athleteRegistrationNumber ?? "No registration")}
                  {" / "}
                  {previewEvaluation.athleteSnapshot?.parentContacts?.[0]?.name || "No parent contact yet"}
                </p>
              </div>
              <div className="planner-evaluation-sheet__header-meta">
                <div className="planner-evaluation-sheet__header-actions">
                  <Button variant="ghost" size="sm" iconOnly leadingIcon={<Pencil />} aria-label="Edit evaluation" onClick={handlePreviewEdit} />
                  <Button variant="ghost" size="sm" iconOnly leadingIcon={<X />} aria-label="Close evaluation summary" onClick={() => setPreviewEvaluation(null)} />
                </div>
                <div className="planner-evaluation-sheet__header-status">
                  <Badge variant={previewEvaluation.resultSummary.topLevels[0]?.levelLabel ? "dark" : "subtle"}>
                    {previewEvaluation.resultSummary.topLevels[0]?.levelLabel ?? "No level"}
                  </Badge>
                  <span>{new Date(getEvaluationDate(previewEvaluation)).toLocaleDateString("en-US")}</span>
                </div>
              </div>
            </div>

            <div className="planner-evaluation-sheet__body">
              {previewEvaluationSkills.length ? (
                <div className="planner-evaluation-sheet__list">
                  {previewEvaluationSkills.map((skill) => (
                    <div key={skill.id} className="planner-evaluation-sheet__row">
                      <div className="planner-evaluation-sheet__row-copy">
                        <strong>{skill.name || "Unnamed skill"}</strong>
                      </div>
                      <div className="planner-evaluation-sheet__row-score">
                        <span>{skill.optionLabel}{skill.optionValue ? ` / ${skill.optionValue}` : ""}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}



