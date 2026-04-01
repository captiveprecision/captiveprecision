"use client";

import { useState } from "react";

import { MyTeamsSurface } from "@/components/features/cheer-planner/my-teams/my-teams-surface";
import { RoutineBuilderSurface } from "@/components/features/cheer-planner/routine-builder/routine-builder-surface";
import { SeasonPlannerSurface } from "@/components/features/cheer-planner/season-planner/season-planner-surface";
import { TeamBuilderSurface } from "@/components/features/cheer-planner/team-builder/team-builder-surface";
import { TryoutsSurface } from "@/components/features/cheer-planner/tryouts/tryouts-surface";
import { SkillPlannerSurface } from "@/components/features/cheer-planner/skill-planner/skill-planner-surface";
import { Badge, Card, CardContent, SectionHeader, Tabs } from "@/components/ui";
import type { PlannerPipelineStage } from "@/lib/domain/planner-levels";
import type { CheerPlannerIntegration } from "@/lib/services/planner-integration";

const PLANNER_WORKSPACE_TABS: { value: PlannerPipelineStage; label: string }[] = [
  { value: "tryouts", label: "Tryouts" },
  { value: "team-builder", label: "Team Builder" },
  { value: "skill-planner", label: "Skill Planner" },
  { value: "routine-builder", label: "Routine Builder" },
  { value: "season-planner", label: "Season Planner" },
  { value: "my-teams", label: "My Teams" }
];

function isPlannerWorkspaceTab(value: string): value is PlannerPipelineStage {
  return PLANNER_WORKSPACE_TABS.some((tab) => tab.value === value);
}

type CheerPlannerShellProps = {
  integration: CheerPlannerIntegration;
};

export function CheerPlannerShell({ integration }: CheerPlannerShellProps) {
  const [workspaceTab, setWorkspaceTab] = useState<PlannerPipelineStage>("tryouts");

  return (
    <main className="workspace-shell page-stack planner-shell">
      <Card radius="panel" variant="subtle">
        <CardContent className="planner-hero-card planner-panel-stack">
          <SectionHeader
            eyebrow="Cheer Planner"
            title="Build and review the full planning pipeline."
            description="The planner stays anchored on PlannerProject. Each phase surface consumes integration-layer outputs without redefining domain state."
            actions={
              <div className="planner-hero-actions">
                <Tabs
                  className="planner-workspace-switch"
                  items={PLANNER_WORKSPACE_TABS}
                  value={workspaceTab}
                  onValueChange={(value) => {
                    if (isPlannerWorkspaceTab(value)) {
                      setWorkspaceTab(value);
                    }
                  }}
                  ariaLabel="Cheer planner workspace"
                />
                {integration.saveMessage ? <Badge variant="accent">{integration.saveMessage}</Badge> : null}
              </div>
            }
          />
        </CardContent>
      </Card>

      {workspaceTab === "tryouts" ? (
        <TryoutsSurface
          athleteDraft={integration.athleteDraft}
          updateAthleteDraft={integration.updateAthleteDraft}
          startNewAthlete={integration.startNewAthlete}
          activeSport={integration.activeSport}
          setActiveSport={integration.setActiveSport}
          template={integration.plannerState.template}
          settingsOpen={integration.settingsOpen}
          setSettingsOpen={integration.setSettingsOpen}
          updateTemplateOption={integration.updateTemplateOption}
          levelKeys={integration.levelKeys}
          levelLabels={integration.levelLabels}
          updateSkillCount={integration.updateSkillCount}
          saveTemplate={integration.saveTemplate}
          resetTemplate={integration.resetTemplate}
          levelsDraft={integration.levelsDraft}
          openLevels={integration.openLevels}
          toggleLevel={integration.toggleLevel}
          summary={integration.summary}
          updateSkillName={integration.updateSkillName}
          updateSkillOption={integration.updateSkillOption}
          removeSkill={integration.removeSkill}
          addExtraSkill={integration.addExtraSkill}
          saveEvaluation={integration.saveEvaluation}
          recentEvaluations={integration.recentEvaluations}
          loadEvaluation={(evaluation) => {
            setWorkspaceTab("tryouts");
            integration.loadEvaluation(evaluation);
          }}
          getRecentAthleteLabel={integration.getRecentAthleteLabel}
          getEvaluationDate={integration.getEvaluationDate}
          formatScore={integration.formatScore}
        />
      ) : null}

      {workspaceTab === "team-builder" ? (
        <TeamBuilderSurface
          stats={integration.stats}
          qualificationOpen={integration.qualificationOpen}
          setQualificationOpen={integration.setQualificationOpen}
          qualificationRules={integration.plannerState.qualificationRules}
          levelLabelsList={integration.levelLabelsList}
          updateQualificationRule={integration.updateQualificationRule}
          createTeamOpen={integration.createTeamOpen}
          setCreateTeamOpen={(value) => {
            setWorkspaceTab("team-builder");
            integration.setCreateTeamOpen(value);
          }}
          teamDraft={integration.teamDraft}
          setTeamDraft={integration.setTeamDraft}
          createTeam={integration.createTeam}
          filters={integration.filters}
          setFilters={integration.setFilters}
          filteredAthletePool={integration.filteredAthletePool}
          teams={integration.plannerState.teams}
          canAssignQualifiedLevelToTeam={integration.canAssignQualifiedLevelToTeam}
          assignToTeam={integration.assignToTeam}
          removeFromTeam={integration.removeFromTeam}
          teamEdit={integration.teamEdit}
          setTeamEdit={integration.setTeamEdit}
          confirmTeamEdit={integration.confirmTeamEdit}
          openTeamEdit={integration.openTeamEdit}
          teamsWithMembers={integration.teamsWithMembers}
          clearTeam={integration.clearTeam}
          deleteTeam={integration.deleteTeam}
          formatScore={integration.formatScore}
        />
      ) : null}

      {workspaceTab === "skill-planner" ? (
        <SkillPlannerSurface
          teams={integration.skillPlannerTeams}
          skillPlannerDraft={integration.skillPlannerDraft}
          openSkillPlannerTeam={integration.openSkillPlannerTeam}
          cancelSkillPlannerEdit={integration.cancelSkillPlannerEdit}
          toggleSkillPlannerOption={integration.toggleSkillPlannerOption}
          saveSkillPlannerEdit={integration.saveSkillPlannerEdit}
        />
      ) : null}
      {workspaceTab === "routine-builder" ? (
        <RoutineBuilderSurface
          teams={integration.routineBuilderTeams}
          routineBuilderDraft={integration.routineBuilderDraft}
          openRoutineBuilderTeam={integration.openRoutineBuilderTeam}
          cancelRoutineBuilderEdit={integration.cancelRoutineBuilderEdit}
          toggleRoutineBuilderSkill={integration.toggleRoutineBuilderSkill}
          saveRoutineBuilderEdit={integration.saveRoutineBuilderEdit}
        />
      ) : null}
      {workspaceTab === "season-planner" ? (
        <SeasonPlannerSurface
          teams={integration.seasonPlannerTeams}
          seasonPlannerDraft={integration.seasonPlannerDraft}
          openSeasonPlannerTeam={integration.openSeasonPlannerTeam}
          cancelSeasonPlannerEdit={integration.cancelSeasonPlannerEdit}
          toggleSeasonPlannerCheckpoint={integration.toggleSeasonPlannerCheckpoint}
          saveSeasonPlannerEdit={integration.saveSeasonPlannerEdit}
        />
      ) : null}
      {workspaceTab === "my-teams" ? <MyTeamsSurface teams={integration.myTeamsSummaries} /> : null}
    </main>
  );
}

