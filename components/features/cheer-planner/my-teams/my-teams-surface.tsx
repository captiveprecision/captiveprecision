"use client";

import { Badge, Card, CardContent, EmptyState, SectionHeader } from "@/components/ui";
import type { CheerPlannerIntegration } from "@/lib/services/planner-integration";

type MyTeamsSurfaceProps = {
  teams: CheerPlannerIntegration["myTeamsSummaries"];
};

export function MyTeamsSurface({ teams }: MyTeamsSurfaceProps) {
  return (
    <div className="planner-team-builder-stack">
      <Card radius="panel" className="planner-panel-stack">
        <CardContent className="planner-panel-stack">
          <SectionHeader
            eyebrow="My Teams"
            title="Read-only team summaries"
            description="This surface is read-only and consumes only the existing consolidated summaries derived from PlannerProject."
          />
          <div className="planner-team-card-list">
            {teams.length ? teams.map((team) => (
              <Card key={team.teamId} variant="subtle" className="planner-team-card">
                <CardContent className="planner-panel-stack">
                  <div className="planner-team-card-head">
                    <div>
                      <strong>{team.teamName}</strong>
                      <p>{team.teamLevel} / {team.teamType}</p>
                    </div>
                    <Badge variant="subtle">Read-only</Badge>
                  </div>
                  <div className="planner-summary-list">
                    <div className="planner-summary-row">
                      <strong>Members</strong>
                      <span>{team.memberCount} total / {team.qualifiedMemberCount} qualified / {team.unqualifiedMemberCount} unqualified</span>
                    </div>
                    <div className="planner-summary-row">
                      <strong>Skill plan</strong>
                      <span>{team.skillPlan.selectionCount} selections / {team.skillPlan.approvedSelectionCount} approved</span>
                    </div>
                    <div className="planner-summary-row">
                      <strong>Routine plan</strong>
                      <span>{team.routinePlan.itemCount} items / {team.routinePlan.approvedItemCount} approved</span>
                    </div>
                    <div className="planner-summary-row">
                      <strong>Season plan</strong>
                      <span>{team.seasonPlan.checkpointCount} checkpoints / {team.seasonPlan.completedCheckpointCount} completed</span>
                    </div>
                    <div className="planner-summary-row">
                      <strong>Latest evaluation</strong>
                      <span>{team.latestEvaluationOccurredAt ? new Date(team.latestEvaluationOccurredAt).toLocaleDateString("en-US") : "No evaluation"}</span>
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
                      <EmptyState title="No members in this team." description="Team membership is sourced from Team Builder and shown here without mutation." />
                    )}
                  </div>
                </CardContent>
              </Card>
            )) : (
              <EmptyState title="No team summaries available yet." description="My Teams remains read-only and will populate from the existing planner pipeline." />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
