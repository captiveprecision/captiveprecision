"use client";

import { Pencil } from "lucide-react";

import { Badge, Button, Card, CardContent, EmptyState, SectionHeader } from "@/components/ui";
import type { CheerPlannerIntegration } from "@/lib/services/planner-integration";

type SeasonPlannerSurfaceProps = {
  teams: CheerPlannerIntegration["seasonPlannerTeams"];
  seasonPlannerDraft: CheerPlannerIntegration["seasonPlannerDraft"];
  openSeasonPlannerTeam: (teamId: string) => void;
  cancelSeasonPlannerEdit: () => void;
  toggleSeasonPlannerCheckpoint: (checkpointId: string) => void;
  saveSeasonPlannerEdit: () => void;
};

export function SeasonPlannerSurface(props: SeasonPlannerSurfaceProps) {
  const {
    teams,
    seasonPlannerDraft,
    openSeasonPlannerTeam,
    cancelSeasonPlannerEdit,
    toggleSeasonPlannerCheckpoint,
    saveSeasonPlannerEdit
  } = props;

  const selectedCheckpointIds = new Set(seasonPlannerDraft?.checkpointIds ?? []);

  return (
    <div className="planner-team-builder-stack">
      <Card radius="panel" className="planner-panel-stack">
        <CardContent className="planner-panel-stack">
          <SectionHeader
            eyebrow="Season Planner"
            title="Team Season Checkpoints"
            description="Select the season checkpoints to keep for one team at a time. Saving replaces the full persisted checkpoint set for that team."
          />
          <div className="planner-team-card-list">
            {teams.length ? teams.map((team) => {
              const isEditing = seasonPlannerDraft?.teamId === team.teamId;
              const selectedCount = isEditing
                ? seasonPlannerDraft.checkpointIds.length
                : (team.seasonPlan?.checkpoints.length ?? 0);

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
                          <Badge variant={team.routinePlan ? "accent" : "subtle"}>{team.routinePlan ? `Routine ${team.routinePlan.status.charAt(0).toUpperCase()}${team.routinePlan.status.slice(1)}` : "No Routine"}</Badge>
                          <Badge variant={team.seasonPlan ? "dark" : "subtle"}>{team.seasonPlan ? `Season ${team.seasonPlan.status.charAt(0).toUpperCase()}${team.seasonPlan.status.slice(1)}` : "No Season Plan"}</Badge>
                        </div>
                        {isEditing ? (
                          <>
                            <Button size="sm" onClick={saveSeasonPlannerEdit}>Save</Button>
                            <Button variant="secondary" size="sm" onClick={cancelSeasonPlannerEdit}>Cancel</Button>
                          </>
                        ) : team.availableCheckpoints.length ? (
                          <Button variant="ghost" size="sm" leadingIcon={<Pencil />} onClick={() => openSeasonPlannerTeam(team.teamId)}>Edit team</Button>
                        ) : null}
                      </div>
                    </div>
                    <div className="planner-team-summary-row">
                      <span>{team.routineInput ? `${team.routineInput.itemCount} Routine Items / ${team.routineInput.approvedItemCount} Approved` : "No Routine Context"}</span>
                      <span>{team.seasonPlan?.checkpoints.length ?? 0} persisted / {selectedCount} current</span>
                    </div>
                    <div className="planner-team-members-list">
                      {team.availableCheckpoints.length ? team.availableCheckpoints.map((checkpoint) => (
                        <label key={checkpoint.id} className="planner-team-member-row">
                          <div>
                            <strong>{checkpoint.name}</strong>
                            <p>{checkpoint.targetDate ? new Date(checkpoint.targetDate).toLocaleDateString("en-US") : "No Target Date"}</p>
                          </div>
                          <input
                            type="checkbox"
                            checked={selectedCheckpointIds.has(checkpoint.id)}
                            disabled={!isEditing}
                            onChange={() => toggleSeasonPlannerCheckpoint(checkpoint.id)}
                          />
                        </label>
                      )) : (
                        <EmptyState title="No Season Checkpoints Available." description="Season Planner depends on routine context or an existing season plan for this team." />
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            }) : (
              <EmptyState title="No Teams Available Yet." description="Season Planner depends on the canonical team pipeline already stored in PlannerProject." />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

