"use client";

import { Pencil, Trash2 } from "lucide-react";
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

export function TeamBuilderSurface(props: TeamBuilderSurfaceProps) {
  const {
    stats,
    qualificationOpen,
    setQualificationOpen,
    qualificationRules,
    levelLabelsList,
    updateQualificationRule,
    saveQualificationRules,
    cancelQualificationRules,
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
                eyebrow="Qualification rules"
                title="Current Thresholds"
                actions={
                  <Button variant="ghost" size="sm" leadingIcon={<Pencil />} onClick={() => setQualificationOpen(true)}>
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
                    <Button onClick={saveQualificationRules} disabled={isSavingAction("qualification-rules")}>
                      {isSavingAction("qualification-rules") ? "Saving..." : "Save Changes"}
                    </Button>
                    <Button variant="secondary" onClick={cancelQualificationRules} disabled={isSavingAction("qualification-rules")}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card radius="panel" className="planner-panel-stack">
            <CardContent className="planner-panel-stack">
              <SectionHeader
                eyebrow="Athlete pool"
                title="Latest Saved Tryouts"
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
                          <option value="">No Team</option>
                          {teams.map((team) => (
                            <option
                              key={team.id}
                              value={team.id}
                            >
                              {team.name} ({team.teamLevel}){athlete.assignedTeamId !== team.id && !canAssignQualifiedLevelToTeam(athlete.displayLevel, team.teamLevel) ? " / Qualification Warning" : ""}
                            </option>
                          ))}
                        </Select>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <EmptyState
                    title="No Athletes Match The Current Filters."
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
                                <Button variant="ghost" size="sm" leadingIcon={<Trash2 />} onClick={() => removeFromTeam(member.id, team.id)}>
                                  Remove
                                </Button>
                              </div>
                            ))
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




