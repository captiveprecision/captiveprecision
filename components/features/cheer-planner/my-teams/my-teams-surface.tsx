"use client";

import { useState } from "react";

import { Badge, Button, Card, CardContent, EmptyState, Input, SectionHeader, Select } from "@/components/ui";
import type { TeamBuilderTeamDraftInput } from "@/lib/services/planner-team-builder";
import type { LinkedCoachOption } from "@/lib/services/team-coach-directory";
import type { CheerPlannerIntegration } from "@/lib/services/planner-integration";

const TEAM_LEVEL_OPTIONS = ["Level 1", "Level 2", "Level 3", "Level 4", "Level 5", "Level 6", "Level 7"] as const;
const TEAM_DIVISION_OPTIONS = ["Prep", "Elite", "Rec", "Novice"] as const;
const AGE_CATEGORY_OPTIONS = ["Tiny", "Mini", "Youth", "Junior", "Senior", "Open"] as const;
const MANUAL_COACH_VALUE = "__manual__";

type CoachAssignmentDraft = {
  selectedCoachId: string;
  manualName: string;
};

type MyTeamsTeamDraft = {
  name: string;
  teamLevel: typeof TEAM_LEVEL_OPTIONS[number];
  teamType: "" | typeof AGE_CATEGORY_OPTIONS[number];
  teamDivision: "" | typeof TEAM_DIVISION_OPTIONS[number];
  trainingDays: string;
  trainingHours: string;
  coachAssignments: CoachAssignmentDraft[];
};

type CreateTeamApiResponse = {
  teamId: string;
  assignedCoachNames: string[];
  linkedCoachIds: string[];
};

type MyTeamsSurfaceProps = {
  teams: CheerPlannerIntegration["myTeamsSummaries"];
  coachOptions: LinkedCoachOption[];
  saveMyTeamsTeamProfile: (draft: TeamBuilderTeamDraftInput) => string;
  updateMyTeamsTeamProfile: (teamId: string, draft: TeamBuilderTeamDraftInput) => void;
};

function buildEmptyCoachAssignment(): CoachAssignmentDraft {
  return {
    selectedCoachId: "",
    manualName: ""
  };
}

function buildEmptyTeamDraft(): MyTeamsTeamDraft {
  return {
    name: "",
    teamLevel: "Level 1",
    teamType: "",
    teamDivision: "",
    trainingDays: "",
    trainingHours: "",
    coachAssignments: [buildEmptyCoachAssignment()]
  };
}

function buildCoachAssignmentsFromTeam(
  team: MyTeamsSurfaceProps["teams"][number],
  coachOptions: LinkedCoachOption[]
): CoachAssignmentDraft[] {
  const optionMap = new Map(coachOptions.map((option) => [option.id, option] as const));
  const assignments: CoachAssignmentDraft[] = [];
  const remainingManualNames = [...team.assignedCoachNames];

  team.linkedCoachIds.forEach((coachId) => {
    const option = optionMap.get(coachId);
    if (!option) {
      return;
    }

    assignments.push({
      selectedCoachId: coachId,
      manualName: ""
    });

    const matchingIndex = remainingManualNames.findIndex((name) => name.trim().toLowerCase() === option.label.trim().toLowerCase());
    if (matchingIndex >= 0) {
      remainingManualNames.splice(matchingIndex, 1);
    }
  });

  remainingManualNames.forEach((name) => {
    if (!name.trim()) {
      return;
    }

    assignments.push({
      selectedCoachId: MANUAL_COACH_VALUE,
      manualName: name
    });
  });

  return assignments.length ? assignments : [buildEmptyCoachAssignment()];
}

function buildDraftFromTeam(team: MyTeamsSurfaceProps["teams"][number], coachOptions: LinkedCoachOption[]): MyTeamsTeamDraft {
  const normalizedLevel = TEAM_LEVEL_OPTIONS.includes(team.teamLevel as typeof TEAM_LEVEL_OPTIONS[number])
    ? team.teamLevel as typeof TEAM_LEVEL_OPTIONS[number]
    : "Level 1";
  const normalizedAgeCategory = AGE_CATEGORY_OPTIONS.includes(team.teamType as typeof AGE_CATEGORY_OPTIONS[number])
    ? team.teamType as typeof AGE_CATEGORY_OPTIONS[number]
    : "";
  const normalizedDivision = TEAM_DIVISION_OPTIONS.includes(team.teamDivision as typeof TEAM_DIVISION_OPTIONS[number])
    ? team.teamDivision as typeof TEAM_DIVISION_OPTIONS[number]
    : "";

  return {
    name: team.teamName,
    teamLevel: normalizedLevel,
    teamType: normalizedAgeCategory,
    teamDivision: normalizedDivision,
    trainingDays: team.trainingDays,
    trainingHours: team.trainingHours,
    coachAssignments: buildCoachAssignmentsFromTeam(team, coachOptions)
  };
}

export function MyTeamsSurface({ teams, coachOptions, saveMyTeamsTeamProfile, updateMyTeamsTeamProfile }: MyTeamsSurfaceProps) {
  const [createTeamOpen, setCreateTeamOpen] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [teamDraft, setTeamDraft] = useState<MyTeamsTeamDraft>(buildEmptyTeamDraft());
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const toggleSelectedTeam = (teamId: string) => {
    setSelectedTeamId((current) => current === teamId ? null : teamId);
  };

  const openCreateTeam = () => {
    setEditingTeamId(null);
    setTeamDraft(buildEmptyTeamDraft());
    setFormError(null);
    setCreateTeamOpen(true);
  };

  const openEditTeam = (team: MyTeamsSurfaceProps["teams"][number]) => {
    setEditingTeamId(team.teamId);
    setSelectedTeamId(team.teamId);
    setTeamDraft(buildDraftFromTeam(team, coachOptions));
    setFormError(null);
    setCreateTeamOpen(true);
  };

  const closeCreateTeam = () => {
    setCreateTeamOpen(false);
    setEditingTeamId(null);
    setFormError(null);
    setTeamDraft(buildEmptyTeamDraft());
  };

  const updateCoachAssignment = (index: number, nextAssignment: Partial<CoachAssignmentDraft>) => {
    setTeamDraft((current) => ({
      ...current,
      coachAssignments: current.coachAssignments.map((assignment, currentIndex) => (
        currentIndex === index ? { ...assignment, ...nextAssignment } : assignment
      ))
    }));
  };

  const addCoachAssignment = () => {
    setTeamDraft((current) => ({
      ...current,
      coachAssignments: [...current.coachAssignments, buildEmptyCoachAssignment()]
    }));
  };

  const removeCoachAssignment = (index: number) => {
    setTeamDraft((current) => {
      const nextAssignments = current.coachAssignments.filter((_, currentIndex) => currentIndex !== index);
      return {
        ...current,
        coachAssignments: nextAssignments.length ? nextAssignments : [buildEmptyCoachAssignment()]
      };
    });
  };

  const handleSaveTeam = async () => {
    if (!teamDraft.name.trim() || !teamDraft.teamType.trim() || !teamDraft.teamDivision) {
      setFormError("Team Name, Age Category, and Division are required.");
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      const editingTeam = editingTeamId ? teams.find((team) => team.teamId === editingTeamId) ?? null : null;
      const method = editingTeam ? "PATCH" : "POST";
      const response = await fetch("/api/coach/teams", {
        method,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          teamId: editingTeam?.remoteTeamId || undefined,
          name: teamDraft.name,
          teamLevel: teamDraft.teamLevel,
          teamType: teamDraft.teamType,
          teamDivision: teamDraft.teamDivision,
          trainingDays: teamDraft.trainingDays,
          trainingHours: teamDraft.trainingHours,
          coachAssignments: teamDraft.coachAssignments
        })
      });

      const result = await response.json().catch(() => null) as CreateTeamApiResponse & { error?: string } | null;

      if (!response.ok || !result) {
        setFormError(result?.error ?? `Unable to ${editingTeam ? "update" : "create"} the team right now.`);
        return;
      }

      const nextDraft: TeamBuilderTeamDraftInput = {
        name: teamDraft.name,
        teamLevel: teamDraft.teamLevel,
        teamType: teamDraft.teamType,
        teamDivision: teamDraft.teamDivision,
        trainingDays: teamDraft.trainingDays,
        trainingHours: teamDraft.trainingHours,
        assignedCoachNames: result.assignedCoachNames,
        linkedCoachIds: result.linkedCoachIds,
        remoteTeamId: result.teamId
      };

      const localTeamId = editingTeam
        ? editingTeam.teamId
        : saveMyTeamsTeamProfile(nextDraft);

      if (editingTeam) {
        updateMyTeamsTeamProfile(editingTeam.teamId, nextDraft);
      }

      setSelectedTeamId(localTeamId);
      closeCreateTeam();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : `Unexpected team ${editingTeamId ? "update" : "creation"} failure.`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="planner-team-builder-stack">
      <Card radius="panel" className="planner-panel-stack">
        <CardContent className="planner-panel-stack">
          <SectionHeader
            eyebrow="My Teams"
            title="Manage Team Records"
            description="Open a team to review details, roster, and planner status. Use Edit Team only when profile changes are needed."
            actions={
              <Button type="button" onClick={openCreateTeam}>
                Add Team
              </Button>
            }
          />

          {createTeamOpen ? (
            <Card variant="subtle" className="planner-create-team-card">
              <CardContent className="planner-panel-stack">
                <SectionHeader
                  eyebrow={editingTeamId ? "Edit Team" : "New Team"}
                  title={editingTeamId ? "Update Team Profile" : "Create Team Profile"}
                />
                <div className="planner-athlete-grid">
                  <Input
                    label="Team Name"
                    value={teamDraft.name}
                    onChange={(event) => setTeamDraft((current) => ({ ...current, name: event.target.value }))}
                  />
                  <Select
                    label="Level"
                    value={teamDraft.teamLevel}
                    onChange={(event) => setTeamDraft((current) => ({ ...current, teamLevel: event.target.value as MyTeamsTeamDraft["teamLevel"] }))}
                  >
                    {TEAM_LEVEL_OPTIONS.map((level) => (
                      <option key={level} value={level}>{level}</option>
                    ))}
                  </Select>
                  <Select
                    label="Age Category"
                    value={teamDraft.teamType}
                    onChange={(event) => setTeamDraft((current) => ({ ...current, teamType: event.target.value as MyTeamsTeamDraft["teamType"] }))}
                    placeholder="Select Age Category"
                  >
                    {AGE_CATEGORY_OPTIONS.map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </Select>
                  <Select
                    label="Division"
                    value={teamDraft.teamDivision}
                    onChange={(event) => setTeamDraft((current) => ({ ...current, teamDivision: event.target.value as MyTeamsTeamDraft["teamDivision"] }))}
                    placeholder="Select Division"
                  >
                    {TEAM_DIVISION_OPTIONS.map((division) => (
                      <option key={division} value={division}>{division}</option>
                    ))}
                  </Select>
                  <Input
                    label="Training Days"
                    value={teamDraft.trainingDays}
                    onChange={(event) => setTeamDraft((current) => ({ ...current, trainingDays: event.target.value }))}
                  />
                  <Input
                    label="Training Hours"
                    value={teamDraft.trainingHours}
                    onChange={(event) => setTeamDraft((current) => ({ ...current, trainingHours: event.target.value }))}
                  />
                </div>

                <div className="planner-athlete-parent-stack">
                  <SectionHeader
                    eyebrow="Coaches"
                    title="Assign Coaches"
                    description="Add one or more coaches for each team. Select linked gym coaches when available, or keep a manual name temporarily."
                    actions={
                      <Button type="button" variant="ghost" size="sm" onClick={addCoachAssignment}>
                        Add Coach
                      </Button>
                    }
                  />

                  {teamDraft.coachAssignments.map((assignment, index) => (
                    <Card key={index} variant="subtle" className="planner-parent-contact-card">
                      <CardContent className="planner-panel-stack">
                        <div className="planner-inline-actions planner-parent-contact-card__head">
                          <strong>Coach {index + 1}</strong>
                          <Button type="button" variant="ghost" size="sm" onClick={() => removeCoachAssignment(index)}>
                            Remove
                          </Button>
                        </div>

                        <div className="planner-team-coach-grid">
                          <Select
                            label="Coach Selection"
                            value={assignment.selectedCoachId}
                            onChange={(event) => {
                              const nextValue = event.target.value;
                              updateCoachAssignment(index, {
                                selectedCoachId: nextValue,
                                manualName: nextValue === MANUAL_COACH_VALUE ? assignment.manualName : ""
                              });
                            }}
                          >
                            <option value="">Optional</option>
                            {coachOptions.map((option) => (
                              <option key={option.id} value={option.id}>{option.label}</option>
                            ))}
                            <option value={MANUAL_COACH_VALUE}>Manual Entry</option>
                          </Select>

                          {assignment.selectedCoachId === MANUAL_COACH_VALUE ? (
                            <Input
                              label="Manual Coach Name"
                              value={assignment.manualName}
                              onChange={(event) => updateCoachAssignment(index, { manualName: event.target.value })}
                            />
                          ) : null}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {formError ? <p className="planner-form-error">{formError}</p> : null}

                <div className="planner-inline-actions">
                  <Button type="button" onClick={handleSaveTeam} disabled={isSaving}>
                    {isSaving ? "Saving..." : editingTeamId ? "Save Changes" : "Save Team"}
                  </Button>
                  <Button type="button" variant="secondary" onClick={closeCreateTeam} disabled={isSaving}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <div className="planner-team-card-list">
            {teams.length ? teams.map((team) => {
              const isSelected = selectedTeamId === team.teamId;

              return (
                <Card
                  key={team.teamId}
                  variant="subtle"
                  className="planner-team-card planner-team-card--interactive"
                  role="button"
                  tabIndex={0}
                  aria-expanded={isSelected}
                  onClick={() => toggleSelectedTeam(team.teamId)}
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget) {
                      return;
                    }

                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      toggleSelectedTeam(team.teamId);
                    }
                  }}
                >
                  <CardContent className="planner-panel-stack">
                    <div className="planner-team-card-head">
                      <div className="planner-team-card-head__copy">
                        <strong>{team.teamName}</strong>
                        <p>{[team.teamLevel, team.teamDivision, team.teamType].filter(Boolean).join(" / ")}</p>
                      </div>
                      <div className="planner-team-card-actions">
                        <Badge variant="subtle">{isSelected ? "Details Open" : "Open Details"}</Badge>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={(event) => {
                            event.stopPropagation();
                            openEditTeam(team);
                          }}
                        >
                          Edit Team
                        </Button>
                      </div>
                    </div>

                    <div className="planner-summary-row">
                      <strong>Team Summary</strong>
                      <span>{team.memberCount} Athletes / {team.assignedCoachNames.length} Coaches Assigned</span>
                    </div>

                    {isSelected ? (
                      <>
                        <div className="planner-summary-list">
                          {team.trainingDays ? (
                            <div className="planner-summary-row">
                              <strong>Training Days</strong>
                              <span>{team.trainingDays}</span>
                            </div>
                          ) : null}
                          {team.trainingHours ? (
                            <div className="planner-summary-row">
                              <strong>Training Hours</strong>
                              <span>{team.trainingHours}</span>
                            </div>
                          ) : null}
                          {!team.trainingDays && !team.trainingHours && team.trainingSchedule ? (
                            <div className="planner-summary-row">
                              <strong>Training</strong>
                              <span>{team.trainingSchedule}</span>
                            </div>
                          ) : null}
                          {team.assignedCoachNames.length ? (
                            <div className="planner-summary-row">
                              <strong>Coaches</strong>
                              <span>{team.assignedCoachNames.join(", ")}</span>
                            </div>
                          ) : null}
                          <div className="planner-summary-row">
                            <strong>Members</strong>
                            <span>{team.memberCount} Total / {team.qualifiedMemberCount} Qualified / {team.unqualifiedMemberCount} Unqualified</span>
                          </div>
                          <div className="planner-summary-row">
                            <strong>Skill Plan</strong>
                            <span>{team.skillPlan.selectionCount} Selections / {team.skillPlan.approvedSelectionCount} Approved</span>
                          </div>
                          <div className="planner-summary-row">
                            <strong>Routine Plan</strong>
                            <span>{team.routinePlan.itemCount} Items / {team.routinePlan.approvedItemCount} Approved</span>
                          </div>
                          <div className="planner-summary-row">
                            <strong>Season Plan</strong>
                            <span>{team.seasonPlan.checkpointCount} Checkpoints / {team.seasonPlan.completedCheckpointCount} Completed</span>
                          </div>
                          <div className="planner-summary-row">
                            <strong>Latest Evaluation</strong>
                            <span>{team.latestEvaluationOccurredAt ? new Date(team.latestEvaluationOccurredAt).toLocaleDateString("en-US") : "No Evaluation"}</span>
                          </div>
                        </div>

                        <div className="planner-team-members-list">
                          {team.members.length ? team.members.map((member) => (
                            <div key={member.athleteId} className="planner-team-member-row">
                              <div>
                                <strong>{member.athleteName}</strong>
                                <p>{member.registrationNumber} / {member.qualifiedLevel}</p>
                              </div>
                              <Badge variant="subtle">Skills {member.selectedSkillCount} / Routine {member.plannedRoutineItemCount}</Badge>
                            </div>
                          )) : (
                            <EmptyState title="No Members In This Team." description="Team membership is sourced from Team Builder and shown here without mutation." />
                          )}
                        </div>
                      </>
                    ) : null}
                  </CardContent>
                </Card>
              );
            }) : (
              <EmptyState title="No Team Summaries Available Yet." description="Create a new team here to start your program structure." />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
