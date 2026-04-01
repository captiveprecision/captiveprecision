"use client";

import { Badge, Button, Card, CardContent, EmptyState, SectionHeader } from "@/components/ui";
import type { CheerPlannerIntegration } from "@/lib/services/planner-integration";

type RoutineBuilderSurfaceProps = {
  teams: CheerPlannerIntegration["routineBuilderTeams"];
  routineBuilderDraft: CheerPlannerIntegration["routineBuilderDraft"];
  openRoutineBuilderTeam: (teamId: string) => void;
  cancelRoutineBuilderEdit: () => void;
  toggleRoutineBuilderSkill: (skillSelectionId: string) => void;
  saveRoutineBuilderEdit: () => void;
};

export function RoutineBuilderSurface(props: RoutineBuilderSurfaceProps) {
  const {
    teams,
    routineBuilderDraft,
    openRoutineBuilderTeam,
    cancelRoutineBuilderEdit,
    toggleRoutineBuilderSkill,
    saveRoutineBuilderEdit
  } = props;

  const selectedSkillSelectionIds = new Set(routineBuilderDraft?.skillSelectionIds ?? []);

  return (
    <div className="planner-team-builder-stack">
      <Card radius="panel" className="planner-panel-stack">
        <CardContent className="planner-panel-stack">
          <SectionHeader
            eyebrow="Routine Builder"
            title="Available routine inputs"
            description="Select the routine items to keep for one team at a time. Saving replaces the full persisted item set for that team."
          />
          <div className="planner-team-card-list">
            {teams.length ? teams.map((team) => {
              const isEditing = routineBuilderDraft?.teamId === team.teamId;
              const selectedCount = isEditing
                ? routineBuilderDraft.skillSelectionIds.length
                : (team.routinePlan?.items.length ?? 0);

              return (
                <Card key={team.teamId} variant="subtle" className="planner-team-card">
                  <CardContent className="planner-panel-stack">
                    <div className="planner-team-card-head">
                      <div>
                        <strong>{team.teamName}</strong>
                        <p>{team.teamLevel} / {team.teamType}</p>
                      </div>
                      <div className="planner-team-card-actions">
                        <div className="planner-summary-chip-group">
                          <Badge variant={team.skillPlan ? "accent" : "subtle"}>{team.skillPlan ? `Skills ${team.skillPlan.status}` : "No skill plan"}</Badge>
                          <Badge variant={team.routinePlan ? "dark" : "subtle"}>{team.routinePlan ? `Routine ${team.routinePlan.status}` : "No routine"}</Badge>
                        </div>
                        {isEditing ? (
                          <>
                            <Button size="sm" onClick={saveRoutineBuilderEdit}>Save</Button>
                            <Button variant="secondary" size="sm" onClick={cancelRoutineBuilderEdit}>Cancel</Button>
                          </>
                        ) : (
                          <Button size="sm" onClick={() => openRoutineBuilderTeam(team.teamId)}>Edit team</Button>
                        )}
                      </div>
                    </div>
                    <div className="planner-team-summary-row">
                      <span>{team.availableSkills.length} available skills</span>
                      <span>{team.routinePlan?.items.length ?? 0} persisted / {selectedCount} current</span>
                    </div>
                    <div className="planner-team-members-list">
                      {team.availableSkills.length ? team.availableSkills.map((skill) => (
                        <label key={skill.skillSelectionId} className="planner-team-member-row">
                          <div>
                            <strong>{skill.skillName}</strong>
                            <p>{skill.athleteName} / {skill.registrationNumber}</p>
                          </div>
                          <div className="planner-summary-chip-group">
                            <Badge variant={skill.selectionStatus === "approved" ? "accent" : "subtle"}>{skill.selectionStatus}</Badge>
                            <input
                              type="checkbox"
                              checked={selectedSkillSelectionIds.has(skill.skillSelectionId)}
                              disabled={!isEditing}
                              onChange={() => toggleRoutineBuilderSkill(skill.skillSelectionId)}
                            />
                          </div>
                        </label>
                      )) : (
                        <EmptyState title="No routine inputs available." description="Approved or selected skills from Skill Planner will appear here." />
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            }) : (
              <EmptyState title="No teams available yet." description="Routine Builder will populate once teams exist in PlannerProject." />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
