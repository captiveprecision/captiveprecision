"use client";

import { Pencil, Trash2 } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";

import { Badge, Button, Card, CardContent, EmptyState, Input, SectionHeader, Select } from "@/components/ui";
import type { TeamSelectionProfile } from "@/lib/domain/team";
import {
  buildTeamFitSummary,
  buildTeamSelectionWarnings,
  formatTeamBuilderSportCapability,
  getTeamSelectionGroupLabel
} from "@/lib/services/planner-team-builder";
import type {
  AthleteFilters,
  CheerPlannerIntegration,
  PlannerStatItem,
  TeamDraftState,
  TeamEditState
} from "@/lib/services/planner-integration";
import type { PlannerLevelLabel } from "@/lib/tools/cheer-planner-tryouts";

type TeamBuilderSurfaceProps = {
  stats: PlannerStatItem[];
  qualificationOpen: boolean;
  setQualificationOpen: Dispatch<SetStateAction<boolean>>;
  qualificationRules: CheerPlannerIntegration["qualificationRulesDraft"];
  levelLabelsList: readonly PlannerLevelLabel[];
  updateQualificationRule: (levelLabel: PlannerLevelLabel, value: string) => void;
  saveQualificationRules: () => void;
  cancelQualificationRules: () => void;
  isSavingAction: (actionKey: string) => boolean;
  createTeamOpen: boolean;
  setCreateTeamOpen: Dispatch<SetStateAction<boolean>>;
  teamDraft: TeamDraftState;
  setTeamDraft: Dispatch<SetStateAction<TeamDraftState>>;
  createTeam: () => void;
  filters: AthleteFilters;
  setFilters: Dispatch<SetStateAction<AthleteFilters>>;
  filteredAthletePool: CheerPlannerIntegration["filteredAthletePool"];
  teams: CheerPlannerIntegration["plannerState"]["teams"];
  canAssignQualifiedLevelToTeam: (
    qualifiedLevel: CheerPlannerIntegration["filteredAthletePool"][number]["displayLevel"],
    teamLevel: PlannerLevelLabel
  ) => boolean;
  assignToTeam: (athleteId: string, teamId: string) => void;
  removeFromTeam: (athleteId: string, teamId: string) => void;
  teamEdit: TeamEditState;
  setTeamEdit: Dispatch<SetStateAction<TeamEditState>>;
  confirmTeamEdit: () => void;
  openTeamEdit: (team: CheerPlannerIntegration["plannerState"]["teams"][number]) => void;
  teamsWithMembers: CheerPlannerIntegration["teamsWithMembers"];
  clearTeam: (teamId: string) => void;
  deleteTeam: (teamId: string) => void;
  formatScore: (value: number) => string;
};

type SelectionProfileEditorProps = {
  profile: TeamSelectionProfile;
  levelLabelsList: readonly PlannerLevelLabel[];
  onChange: (updater: (current: TeamSelectionProfile) => TeamSelectionProfile) => void;
};

function SelectionProfileEditor({ profile, levelLabelsList, onChange }: SelectionProfileEditorProps) {
  return (
    <div className="planner-panel-stack">
      <div className="planner-team-rules-grid is-open">
        <Select
          label="Tumbling"
          value={profile.sports.tumbling.enabled ? "enabled" : "disabled"}
          onChange={(event) => onChange((current) => ({
            ...current,
            sports: {
              ...current.sports,
              tumbling: {
                ...current.sports.tumbling,
                enabled: event.target.value === "enabled"
              }
            }
          }))}
        >
          <option value="disabled">Ignore</option>
          <option value="enabled">Use</option>
        </Select>
        <Select
          label="Tumbling Min Level"
          value={profile.sports.tumbling.minLevel}
          onChange={(event) => onChange((current) => ({
            ...current,
            sports: {
              ...current.sports,
              tumbling: {
                ...current.sports.tumbling,
                minLevel: event.target.value as PlannerLevelLabel
              }
            }
          }))}
        >
          {levelLabelsList.map((levelLabel) => (
            <option key={`tumbling-${levelLabel}`} value={levelLabel}>
              {levelLabel}
            </option>
          ))}
        </Select>
        <Input
          label="Tumbling Min Score"
          type="number"
          step="0.1"
          value={profile.sports.tumbling.minScore}
          onChange={(event) => onChange((current) => ({
            ...current,
            sports: {
              ...current.sports,
              tumbling: {
                ...current.sports.tumbling,
                minScore: Number(event.target.value) || 0
              }
            }
          }))}
        />

        <Select
          label="Stunts"
          value={profile.sports.stunts.enabled ? "enabled" : "disabled"}
          onChange={(event) => onChange((current) => ({
            ...current,
            sports: {
              ...current.sports,
              stunts: {
                ...current.sports.stunts,
                enabled: event.target.value === "enabled"
              }
            }
          }))}
        >
          <option value="disabled">Ignore</option>
          <option value="enabled">Use</option>
        </Select>
        <Select
          label="Stunts Min Level"
          value={profile.sports.stunts.minLevel}
          onChange={(event) => onChange((current) => ({
            ...current,
            sports: {
              ...current.sports,
              stunts: {
                ...current.sports.stunts,
                minLevel: event.target.value as PlannerLevelLabel
              }
            }
          }))}
        >
          {levelLabelsList.filter((levelLabel) => levelLabel !== "Beginner").map((levelLabel) => (
            <option key={`stunts-${levelLabel}`} value={levelLabel}>
              {levelLabel}
            </option>
          ))}
        </Select>
        <Input
          label="Stunts Min Score"
          type="number"
          step="0.1"
          value={profile.sports.stunts.minScore}
          onChange={(event) => onChange((current) => ({
            ...current,
            sports: {
              ...current.sports,
              stunts: {
                ...current.sports.stunts,
                minScore: Number(event.target.value) || 0
              }
            }
          }))}
        />

        <Select
          label="Jumps"
          value={profile.sports.jumps.enabled ? "enabled" : "disabled"}
          onChange={(event) => onChange((current) => ({
            ...current,
            sports: {
              ...current.sports,
              jumps: {
                ...current.sports.jumps,
                enabled: event.target.value === "enabled"
              }
            }
          }))}
        >
          <option value="disabled">Ignore</option>
          <option value="enabled">Use</option>
        </Select>
        <Select
          label="Jumps Group"
          value={profile.sports.jumps.group}
          onChange={(event) => onChange((current) => ({
            ...current,
            sports: {
              ...current.sports,
              jumps: {
                ...current.sports.jumps,
                group: event.target.value as "basic" | "advanced"
              }
            }
          }))}
        >
          <option value="basic">Basic</option>
          <option value="advanced">Advanced</option>
        </Select>
        <Input
          label="Jumps Min Score"
          type="number"
          step="0.1"
          value={profile.sports.jumps.minScore}
          onChange={(event) => onChange((current) => ({
            ...current,
            sports: {
              ...current.sports,
              jumps: {
                ...current.sports.jumps,
                minScore: Number(event.target.value) || 0
              }
            }
          }))}
        />

        <Select
          label="Dance"
          value={profile.sports.dance.enabled ? "enabled" : "disabled"}
          onChange={(event) => onChange((current) => ({
            ...current,
            sports: {
              ...current.sports,
              dance: {
                ...current.sports.dance,
                enabled: event.target.value === "enabled"
              }
            }
          }))}
        >
          <option value="disabled">Ignore</option>
          <option value="enabled">Use</option>
        </Select>
        <Input
          label="Dance Min Total"
          type="number"
          step="0.1"
          value={profile.sports.dance.minTotalScore}
          onChange={(event) => onChange((current) => ({
            ...current,
            sports: {
              ...current.sports,
              dance: {
                ...current.sports.dance,
                minTotalScore: Number(event.target.value) || 0
              }
            }
          }))}
        />
      </div>
    </div>
  );
}

export function TeamBuilderSurface(props: TeamBuilderSurfaceProps) {
  const {
    stats,
    levelLabelsList,
    isSavingAction,
    createTeamOpen,
    setCreateTeamOpen,
    teamDraft,
    setTeamDraft,
    createTeam,
    filters,
    setFilters,
    filteredAthletePool,
    teams,
    assignToTeam,
    removeFromTeam,
    teamEdit,
    setTeamEdit,
    confirmTeamEdit,
    openTeamEdit,
    teamsWithMembers,
    clearTeam,
    deleteTeam,
    formatScore
  } = props;

  return (
    <div className="planner-team-builder-stack">
      <Card radius="panel" className="planner-panel-stack planner-team-stats-summary-card">
        <CardContent className="planner-panel-stack planner-team-stats-summary-card__content">
          <SectionHeader
            eyebrow="Team Builder"
            title="Current Athlete Summary"
            description={stats.map((stat) => `${stat.label}: ${stat.value}`).join(" | ")}
          />
        </CardContent>
      </Card>

      <div className="planner-layout-grid">
        <div className="planner-main-column">
          <Card radius="panel" className="planner-panel-stack">
            <CardContent className="planner-panel-stack">
              <SectionHeader
                eyebrow="Athlete pool"
                title="Best Tryout Profiles"
                description="Selection now reads the tryout logbook by sport. Team criteria warn, but do not block assignments."
                actions={
                  <Button onClick={() => setCreateTeamOpen((current) => !current)}>
                    {createTeamOpen ? "Close" : "Create Team"}
                  </Button>
                }
              />

              {createTeamOpen ? (
                <Card variant="subtle" className="planner-create-team-card">
                  <CardContent className="planner-panel-stack">
                    <Input
                      label="Team Name"
                      value={teamDraft.name}
                      onChange={(event) => setTeamDraft((current) => ({ ...current, name: event.target.value }))}
                    />
                    <Select
                      label="Team Level"
                      value={teamDraft.teamLevel}
                      onChange={(event) => setTeamDraft((current) => ({ ...current, teamLevel: event.target.value as PlannerLevelLabel }))}
                    >
                      {levelLabelsList.map((levelLabel) => (
                        <option key={levelLabel} value={levelLabel}>
                          {levelLabel}
                        </option>
                      ))}
                    </Select>
                    <Input
                      label="Team Type"
                      value={teamDraft.teamType}
                      onChange={(event) => setTeamDraft((current) => ({ ...current, teamType: event.target.value }))}
                    />
                    <SectionHeader
                      eyebrow="Selection Criteria"
                      title="Warn-Only Team Filters"
                      description="Choose which sports matter for this roster. Unused sports still show later in team stats."
                    />
                    <SelectionProfileEditor
                      profile={teamDraft.selectionProfile}
                      levelLabelsList={levelLabelsList}
                      onChange={(updater) => setTeamDraft((current) => ({ ...current, selectionProfile: updater(current.selectionProfile) }))}
                    />
                    <Button onClick={createTeam} disabled={isSavingAction("create-team")}>
                      {isSavingAction("create-team") ? "Saving..." : "Save Team"}
                    </Button>
                  </CardContent>
                </Card>
              ) : null}

              <div className="planner-team-filter-search-row">
                <Input
                  label="Search"
                  containerClassName="planner-team-filter-search"
                  value={filters.search}
                  onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                />
              </div>

              <div className="planner-team-filters">
                <Select
                  label="Tumbling Best"
                  value={filters.level}
                  onChange={(event) => setFilters((current) => ({ ...current, level: event.target.value as AthleteFilters["level"] }))}
                >
                  <option value="all">All</option>
                  <option value="Unqualified">No Tumbling Result</option>
                  {levelLabelsList.map((levelLabel) => (
                    <option key={levelLabel} value={levelLabel}>
                      {levelLabel}
                    </option>
                  ))}
                </Select>
                <Select
                  label="Availability"
                  value={filters.availability}
                  onChange={(event) => setFilters((current) => ({ ...current, availability: event.target.value as AthleteFilters["availability"] }))}
                >
                  <option value="all">All</option>
                  <option value="available">Available</option>
                  <option value="assigned">Assigned</option>
                </Select>
                <Select
                  label="Sort"
                  value={filters.sort}
                  onChange={(event) => setFilters((current) => ({ ...current, sort: event.target.value as AthleteFilters["sort"] }))}
                >
                  <option value="score-desc">Tumbling Score</option>
                  <option value="name-asc">Name</option>
                  <option value="age-asc">Age Low To High</option>
                  <option value="age-desc">Age High To Low</option>
                </Select>
              </div>

              <div className="planner-athlete-pool-list">
                {filteredAthletePool.length ? (
                  filteredAthletePool.map((athlete) => (
                    <Card key={athlete.id} variant="subtle" className="planner-athlete-pool-row">
                      <CardContent className="planner-athlete-pool-row__content">
                        <div className="planner-athlete-pool-copy">
                          <div className="planner-athlete-pool-title-row">
                            <strong>{athlete.name}</strong>
                            <Badge variant={athlete.displayLevel === "Unqualified" ? "subtle" : "dark"}>
                              Tumbling {athlete.displayLevel}
                            </Badge>
                          </div>
                          <p>
                            {athlete.registrationNumber} / Age {athlete.age ?? "-"} / Parent {athlete.parentContacts[0]?.name || "No parent contact yet"}
                          </p>
                          <p>Tumbling: {formatTeamBuilderSportCapability(athlete.capabilitiesBySport.tumbling)}</p>
                          <p>Stunts: {formatTeamBuilderSportCapability(athlete.capabilitiesBySport.stunts)}</p>
                          <p>Jumps: {formatTeamBuilderSportCapability(athlete.capabilitiesBySport.jumps)}</p>
                          <p>Dance: {formatTeamBuilderSportCapability(athlete.capabilitiesBySport.dance)}</p>
                          <p>Builder team {athlete.assignedTeamName}</p>
                          {athlete.assignedTeamId && athlete.selectionWarnings.length ? (
                            <p>{athlete.teamFitSummary}</p>
                          ) : null}
                        </div>
                        <Select
                          label="Assign to builder team"
                          containerClassName="planner-athlete-assign-field"
                          value={athlete.assignedTeamId ?? ""}
                          onChange={(event) => {
                            const nextTeamId = event.target.value;

                            if (!nextTeamId) {
                              if (athlete.assignedTeamId) {
                                removeFromTeam(athlete.id, athlete.assignedTeamId);
                              }
                              return;
                            }

                            assignToTeam(athlete.id, nextTeamId);
                          }}
                        >
                          <option value="">No Team</option>
                          {teams.map((team) => {
                            const warnings = buildTeamSelectionWarnings(athlete, team);
                            return (
                              <option key={team.id} value={team.id}>
                                {team.name} ({team.teamLevel}){warnings.length ? ` / ${buildTeamFitSummary(warnings)}` : ""}
                              </option>
                            );
                          })}
                        </Select>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <EmptyState
                    title="No Athletes Match The Current Filters."
                    description="Adjust filters or save more tryout records."
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="planner-side-column">
          <Card radius="panel" className="planner-panel-stack">
            <CardContent className="planner-panel-stack">
              <SectionHeader eyebrow="Teams Review" title="Saved Rosters" />

              {teamEdit ? (
                <Card variant="subtle" className="planner-team-edit-card">
                  <CardContent className="planner-panel-stack">
                    <Input
                      label="Team Name"
                      value={teamEdit.name}
                      onChange={(event) => setTeamEdit((current) => (current ? { ...current, name: event.target.value } : current))}
                    />
                    <Select
                      label="Team Level"
                      value={teamEdit.teamLevel}
                      onChange={(event) => setTeamEdit((current) => (current ? { ...current, teamLevel: event.target.value as PlannerLevelLabel } : current))}
                    >
                      {levelLabelsList.map((levelLabel) => (
                        <option key={levelLabel} value={levelLabel}>
                          {levelLabel}
                        </option>
                      ))}
                    </Select>
                    <Input
                      label="Team Type"
                      value={teamEdit.teamType}
                      onChange={(event) => setTeamEdit((current) => (current ? { ...current, teamType: event.target.value } : current))}
                    />
                    <SectionHeader
                      eyebrow="Selection Criteria"
                      title="Warn-Only Team Filters"
                      description="These criteria flag roster fit by sport but will not block the save."
                    />
                    <SelectionProfileEditor
                      profile={teamEdit.selectionProfile}
                      levelLabelsList={levelLabelsList}
                      onChange={(updater) => setTeamEdit((current) => (current ? { ...current, selectionProfile: updater(current.selectionProfile) } : current))}
                    />
                    <div className="planner-inline-actions">
                      <Button onClick={confirmTeamEdit} disabled={isSavingAction("team-edit")}>
                        {isSavingAction("team-edit") ? "Saving..." : "Save Changes"}
                      </Button>
                      <Button variant="secondary" onClick={() => setTeamEdit(null)}>
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              <div className="planner-team-card-list">
                {teamsWithMembers.length ? (
                  teamsWithMembers.map((team) => (
                    <Card key={team.id} variant="subtle" className="planner-team-card">
                      <CardContent className="planner-panel-stack">
                        <div className="planner-team-card-head">
                          <div>
                            <strong>{team.name}</strong>
                            <p>
                              {team.teamLevel} / {team.teamType}
                            </p>
                          </div>
                          <Badge variant="subtle">{team.members.length} athletes</Badge>
                        </div>
                        <div className="planner-inline-actions">
                          <Button variant="ghost" size="sm" leadingIcon={<Pencil />} onClick={() => openTeamEdit(team)}>
                            Edit Team
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => clearTeam(team.id)}>
                            Clear Roster
                          </Button>
                          <Button variant="ghost" size="sm" leadingIcon={<Trash2 />} onClick={() => deleteTeam(team.id)}>
                            Delete Team
                          </Button>
                        </div>

                        <div className="planner-panel-stack">
                          <p>Tumbling avg {formatScore(team.sportAverages.tumbling.averageScore)} / Coverage {team.sportAverages.tumbling.coverageCount}/{team.sportAverages.tumbling.rosterSize}</p>
                          <p>Stunts avg {formatScore(team.sportAverages.stunts.averageScore)} / Coverage {team.sportAverages.stunts.coverageCount}/{team.sportAverages.stunts.rosterSize}</p>
                          <p>Jumps avg {formatScore(team.sportAverages.jumps.averageScore)} / Coverage {team.sportAverages.jumps.coverageCount}/{team.sportAverages.jumps.rosterSize}</p>
                          <p>Dance avg {formatScore(team.sportAverages.dance.averageScore)} / Coverage {team.sportAverages.dance.coverageCount}/{team.sportAverages.dance.rosterSize}</p>
                          <p>
                            Criteria: {team.selectionProfile.sports.tumbling.enabled ? `Tumbling ${team.selectionProfile.sports.tumbling.minLevel} ${formatScore(team.selectionProfile.sports.tumbling.minScore)}+` : "Tumbling ignored"} / {team.selectionProfile.sports.stunts.enabled ? `Stunts ${team.selectionProfile.sports.stunts.minLevel} ${formatScore(team.selectionProfile.sports.stunts.minScore)}+` : "Stunts ignored"} / {team.selectionProfile.sports.jumps.enabled ? `Jumps ${getTeamSelectionGroupLabel(team.selectionProfile.sports.jumps.group)} ${formatScore(team.selectionProfile.sports.jumps.minScore)}+` : "Jumps ignored"} / {team.selectionProfile.sports.dance.enabled ? `Dance ${formatScore(team.selectionProfile.sports.dance.minTotalScore)}+` : "Dance ignored"}
                          </p>
                        </div>

                        <div className="planner-team-members-list">
                          {team.members.length ? (
                            team.members.map((member) => {
                              const warnings = buildTeamSelectionWarnings(member, team);
                              return (
                                <div key={member.id} className="planner-team-member-row">
                                  <div>
                                    <strong>{member.name}</strong>
                                    <p>
                                      {member.registrationNumber} / T {formatTeamBuilderSportCapability(member.capabilitiesBySport.tumbling)} / S {formatTeamBuilderSportCapability(member.capabilitiesBySport.stunts)}
                                    </p>
                                    <p>
                                      J {formatTeamBuilderSportCapability(member.capabilitiesBySport.jumps)} / D {formatTeamBuilderSportCapability(member.capabilitiesBySport.dance)}
                                    </p>
                                    {warnings.length ? <p>{buildTeamFitSummary(warnings)}</p> : null}
                                  </div>
                                  <Button variant="ghost" size="sm" leadingIcon={<Trash2 />} onClick={() => removeFromTeam(member.id, team.id)}>
                                    Remove
                                  </Button>
                                </div>
                              );
                            })
                          ) : (
                            <EmptyState
                              title="No Athletes Assigned Yet."
                              description="Assign athletes from the pool to start building this roster."
                            />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <EmptyState
                    title="Create Your First Team To Start Assigning Athletes."
                    description="Team Builder now reads the tryout logbook by sport and keeps warnings non-blocking."
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
