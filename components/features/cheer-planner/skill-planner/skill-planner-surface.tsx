"use client";

import { Badge, Button, Card, CardContent, EmptyState, SectionHeader } from "@/components/ui";
import type { CheerPlannerIntegration } from "@/lib/services/planner-integration";

type SkillPlannerSurfaceProps = {
  teams: CheerPlannerIntegration["skillPlannerTeams"];
  skillPlannerDraft: CheerPlannerIntegration["skillPlannerDraft"];
  openSkillPlannerTeam: (teamId: string) => void;
  cancelSkillPlannerEdit: () => void;
  toggleSkillPlannerOption: (optionId: string) => void;
  saveSkillPlannerEdit: () => void;
};

export function SkillPlannerSurface(props: SkillPlannerSurfaceProps) {
  const {
    teams,
    skillPlannerDraft,
    openSkillPlannerTeam,
    cancelSkillPlannerEdit,
    toggleSkillPlannerOption,
    saveSkillPlannerEdit
  } = props;

  const selectedOptionIds = new Set(skillPlannerDraft?.selectionOptionIds ?? []);

  return (
    <div className="planner-team-builder-stack">
      <Card radius="panel" className="planner-panel-stack">
        <CardContent className="planner-panel-stack">
          <SectionHeader
            eyebrow="Skill Planner"
            title="Team skill inputs"
            description="Select the skills to keep for one team at a time. Saving replaces the full persisted selection set for that team."
          />
          <div className="planner-team-card-list">
            {teams.length ? teams.map((team) => {
              const isEditing = skillPlannerDraft?.teamId === team.teamId;
              const selectedCount = isEditing
                ? skillPlannerDraft.selectionOptionIds.length
                : (team.existingPlan?.selections.length ?? 0);

              return (
                <Card key={team.teamId} variant="subtle" className="planner-team-card">
                  <CardContent className="planner-panel-stack">
                    <div className="planner-team-card-head">
                      <div>
                        <strong>{team.teamName}</strong>
                        <p>{team.teamLevel} / {team.teamType}</p>
                      </div>
                      <div className="planner-team-card-actions">
                        <Badge variant={team.existingPlan ? "accent" : "subtle"}>
                          {team.existingPlan ? `Plan ${team.existingPlan.status}` : "No plan"}
                        </Badge>
                        {isEditing ? (
                          <>
                            <Button size="sm" onClick={saveSkillPlannerEdit}>Save</Button>
                            <Button variant="secondary" size="sm" onClick={cancelSkillPlannerEdit}>Cancel</Button>
                          </>
                        ) : (
                          <Button size="sm" onClick={() => openSkillPlannerTeam(team.teamId)}>Edit team</Button>
                        )}
                      </div>
                    </div>
                    <div className="planner-team-summary-row">
                      <span>{team.members.length} athletes</span>
                      <span>{team.existingPlan?.selections.length ?? 0} persisted / {selectedCount} current</span>
                    </div>
                    <div className="planner-team-members-list">
                      {team.members.length ? team.members.map((member) => (
                        <div key={member.athleteId} className="planner-team-card">
                          <CardContent className="planner-panel-stack">
                            <div className="planner-team-card-head">
                              <div>
                                <strong>{member.athleteName}</strong>
                                <p>{member.registrationNumber} / {member.qualifiedLevel}</p>
                              </div>
                              <Badge variant="subtle">{member.availableSkillOptions.length} options</Badge>
                            </div>
                            {member.availableSkillOptions.length ? (
                              <div className="planner-team-members-list">
                                {member.availableSkillOptions.map((option) => (
                                  <label key={option.id} className="planner-team-member-row">
                                    <div>
                                      <strong>{option.skillName}</strong>
                                      <p>{option.levelLabel} / {option.isExtra ? "Extra" : "Base"}</p>
                                    </div>
                                    <input
                                      type="checkbox"
                                      checked={selectedOptionIds.has(option.id)}
                                      disabled={!isEditing}
                                      onChange={() => toggleSkillPlannerOption(option.id)}
                                    />
                                  </label>
                                ))}
                              </div>
                            ) : (
                              <EmptyState title="No skill options from tryouts." description="This athlete needs a saved tryout evaluation before Skill Planner can select skills." />
                            )}
                          </CardContent>
                        </div>
                      )) : (
                        <EmptyState title="No athletes in this team yet." description="Team Builder membership will flow into Skill Planner automatically." />
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            }) : (
              <EmptyState title="No team inputs available yet." description="Create teams and assign athletes before Skill Planner can consume them." />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
