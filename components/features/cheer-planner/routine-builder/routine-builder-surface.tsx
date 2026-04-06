"use client";

import { useEffect, useState } from "react";

import { RoutineBuilderEditor } from "@/components/features/cheer-planner/routine-builder/routine-builder-editor";
import { Badge, Button, Card, CardContent, EmptyState, SectionHeader } from "@/components/ui";
import type { RoutineDocument } from "@/lib/domain/routine-plan";
import { buildRoutineBuilderSkillDefinitions, resolveRoutineBuilderDocument } from "@/lib/services/planner-routine-builder";
import type { CheerPlannerIntegration } from "@/lib/services/planner-integration";

type RoutineBuilderSurfaceProps = {
  teams: CheerPlannerIntegration["routineBuilderTeams"];
  routineBuilderDraft: CheerPlannerIntegration["routineBuilderDraft"];
  openRoutineBuilderTeam: (teamId: string) => void | Promise<void>;
  cancelRoutineBuilderEdit: () => void;
  updateRoutineBuilderDocument: (document: RoutineDocument) => void;
  saveRoutineBuilderEdit: () => void | Promise<void>;
};

export function RoutineBuilderSurface(props: RoutineBuilderSurfaceProps) {
  const {
    teams,
    routineBuilderDraft,
    openRoutineBuilderTeam,
    cancelRoutineBuilderEdit,
    updateRoutineBuilderDocument,
    saveRoutineBuilderEdit
  } = props;
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  useEffect(() => {
    if (!teams.length) {
      setSelectedTeamId(null);
      return;
    }

    if (routineBuilderDraft?.teamId) {
      setSelectedTeamId(routineBuilderDraft.teamId);
      return;
    }

    setSelectedTeamId((current) => (
      current && teams.some((team) => team.teamId === current) ? current : null
    ));
  }, [routineBuilderDraft?.teamId, teams]);

  return (
    <div className="planner-team-builder-stack">
      <Card radius="panel" className="planner-panel-stack">
        <CardContent className="planner-panel-stack">
          <SectionHeader
            eyebrow="Routine Builder"
            title="Interactive team routine editor"
            description="Select one team to review or edit its full routine map. Skill Planner remains the source for routine-ready sections."
          />
          <div className="planner-team-card-list">
            {teams.length ? teams.map((team) => {
              const isEditing = routineBuilderDraft?.teamId === team.teamId;
              const isSelected = selectedTeamId === team.teamId;
              const effectiveDocument = isEditing && routineBuilderDraft
                ? routineBuilderDraft.document
                : resolveRoutineBuilderDocument(team);
              const editorSkills = buildRoutineBuilderSkillDefinitions(team, effectiveDocument);
              const persistedCount = team.routinePlan?.items.length ?? 0;
              const currentCount = effectiveDocument.placements.length;

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
                            <Button size="sm" onClick={() => void saveRoutineBuilderEdit()}>Save</Button>
                            <Button variant="secondary" size="sm" onClick={cancelRoutineBuilderEdit}>Cancel</Button>
                          </>
                        ) : (
                          <>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setSelectedTeamId((current) => current === team.teamId ? null : team.teamId)}
                            >
                              {isSelected ? "Hide details" : "View team"}
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedTeamId(team.teamId);
                                void openRoutineBuilderTeam(team.teamId);
                              }}
                            >
                              Edit team
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="planner-team-summary-row">
                      <span>{team.availableSkills.length} routine-ready sections</span>
                      <span>{persistedCount} persisted / {currentCount} current placements</span>
                    </div>
                    {isSelected ? (
                      <div className="planner-routine-team-stack">
                        <RoutineBuilderEditor
                          teamName={team.teamName}
                          initialDocument={effectiveDocument}
                          skills={editorSkills}
                          readOnly={!isEditing}
                          onDocumentChange={updateRoutineBuilderDocument}
                        />
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              );
            }) : (
              <EmptyState title="No routine inputs available yet." description="Create teams and save team skill rows before building routines." />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


