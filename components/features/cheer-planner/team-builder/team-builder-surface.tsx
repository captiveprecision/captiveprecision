"use client";

import type { Dispatch, SetStateAction } from "react";

import { Badge, Button, Card, CardContent, EmptyState, Input, SectionHeader, Select } from "@/components/ui";
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
  qualificationRules: CheerPlannerIntegration["plannerState"]["qualificationRules"];
  levelLabelsList: readonly PlannerLevelLabel[];
  updateQualificationRule: (levelLabel: PlannerLevelLabel, value: string) => void;
  saveQualificationRules: () => void;
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

export function TeamBuilderSurface(props: TeamBuilderSurfaceProps) {
  const {
    stats,
    qualificationOpen,
    setQualificationOpen,
    qualificationRules,
    levelLabelsList,
    updateQualificationRule,
    saveQualificationRules,
    createTeamOpen,
    setCreateTeamOpen,
    teamDraft,
    setTeamDraft,
    createTeam,
    filters,
    setFilters,
    filteredAthletePool,
    teams,
    canAssignQualifiedLevelToTeam,
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
            title="Current athlete summary"
            description={stats.map((stat) => `${stat.label}: ${stat.value}`).join(" | ")}
          />
        </CardContent>
      </Card>

      <div className="planner-layout-grid">
        <div className="planner-main-column">
          <Card radius="panel" className="planner-panel-stack">
            <CardContent className="planner-panel-stack">
              <SectionHeader
                eyebrow="Qualification rules"
                title="Current thresholds"
                actions={
                  <Button variant="ghost" size="sm" onClick={() => setQualificationOpen(true)}>
                    Edit
                  </Button>
                }
              />
              {qualificationOpen ? (
                <div className="planner-panel-stack">
                  <div className="planner-team-rules-grid is-open">
                    {levelLabelsList.map((levelLabel) => (
                      <Input
                        key={levelLabel}
                        type="number"
                        step="0.1"
                        label={levelLabel}
                        value={qualificationRules[levelLabel]}
                        onChange={(event) => updateQualificationRule(levelLabel, event.target.value)}
                      />
                    ))}
                  </div>
                  <div className="planner-inline-actions">
                    <Button onClick={saveQualificationRules}>Save changes</Button>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card radius="panel" className="planner-panel-stack">
            <CardContent className="planner-panel-stack">
              <SectionHeader
                eyebrow="Athlete pool"
                title="Latest saved tryouts"
                actions={
                  <Button onClick={() => setCreateTeamOpen((current) => !current)}>
                    {createTeamOpen ? "Close" : "Create team"}
                  </Button>
                }
              />

              {createTeamOpen ? (
                <Card variant="subtle" className="planner-create-team-card">
                  <CardContent className="planner-panel-stack">
                    <Input
                      label="Team name"
                      value={teamDraft.name}
                      onChange={(event) => setTeamDraft((current) => ({ ...current, name: event.target.value }))}
                    />
                    <Select
                      label="Team level"
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
                      label="Team type"
                      value={teamDraft.teamType}
                      onChange={(event) => setTeamDraft((current) => ({ ...current, teamType: event.target.value }))}
                    />
                    <Button onClick={createTeam}>Save team</Button>
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
                  label="Level"
                  value={filters.level}
                  onChange={(event) => setFilters((current) => ({ ...current, level: event.target.value as AthleteFilters["level"] }))}
                >
                  <option value="all">All</option>
                  <option value="Unqualified">Unqualified</option>
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
                  <option value="score-desc">Score</option>
                  <option value="name-asc">Name</option>
                  <option value="age-asc">Age low to high</option>
                  <option value="age-desc">Age high to low</option>
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
                              {athlete.displayLevel}
                            </Badge>
                          </div>
                          <p>
                            {athlete.registrationNumber} / Age {athlete.age ?? "-"} / Parent {athlete.parentContacts[0]?.name || "No parent contact yet"}
                          </p>
                          <p>
                            Score {formatScore(athlete.displayScore)} / Extra {formatScore(athlete.extraScore)} / Builder team {athlete.assignedTeamName}
                          </p>
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
                          <option value="">No team</option>
                          {teams.map((team) => (
                            <option
                              key={team.id}
                              value={team.id}
                            >
                              {team.name} ({team.teamLevel}){athlete.assignedTeamId !== team.id && !canAssignQualifiedLevelToTeam(athlete.displayLevel, team.teamLevel) ? " / Qualification warning" : ""}
                            </option>
                          ))}
                        </Select>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <EmptyState
                    title="No athletes match the current filters."
                    description="Adjust filters or save more tryout evaluations."
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="planner-side-column">
          <Card radius="panel" className="planner-panel-stack">
            <CardContent className="planner-panel-stack">
              <SectionHeader eyebrow="Teams review" title="Saved rosters" />

              {teamEdit ? (
                <Card variant="subtle" className="planner-team-edit-card">
                  <CardContent className="planner-panel-stack">
                    <Input
                      label="Team name"
                      value={teamEdit.name}
                      onChange={(event) => setTeamEdit((current) => (current ? { ...current, name: event.target.value } : current))}
                    />
                    <Select
                      label="Team level"
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
                      label="Team type"
                      value={teamEdit.teamType}
                      onChange={(event) => setTeamEdit((current) => (current ? { ...current, teamType: event.target.value } : current))}
                    />
                    <div className="planner-inline-actions">
                      <Button onClick={confirmTeamEdit}>Save edits</Button>
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
                          <Button variant="ghost" size="sm" onClick={() => openTeamEdit(team)}>
                            Edit
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => clearTeam(team.id)}>
                            Clear roster
                          </Button>
                          <Button variant="danger" size="sm" onClick={() => deleteTeam(team.id)}>
                            Delete
                          </Button>
                        </div>
                        <div className="planner-team-members-list">
                          {team.members.length ? (
                            team.members.map((member) => (
                              <div key={member.id} className="planner-team-member-row">
                                <div>
                                  <strong>{member.name}</strong>
                                  <p>
                                    {member.registrationNumber} / {member.displayLevel}
                                  </p>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => removeFromTeam(member.id, team.id)}>
                                  Remove
                                </Button>
                              </div>
                            ))
                          ) : (
                            <EmptyState
                              title="No athletes assigned yet."
                              description="Assign athletes from the pool to start building this roster."
                            />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <EmptyState
                    title="Create your first team to start assigning athletes."
                    description="Team Builder will keep rosters as persistent planner objects."
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


