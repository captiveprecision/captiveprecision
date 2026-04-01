import type { PlannerLevelLabel } from "@/lib/domain/planner-levels";
import type { PlannerProject } from "@/lib/domain/planner-project";
import type { TeamSkillPlan, TeamSkillPlanStatus, TeamSkillSelection } from "@/lib/domain/skill-plan";
import { levelLabels, type PlannerLevelKey } from "@/lib/domain/planner-levels";
import { buildTeamBuilderCandidates, buildTeamBuilderTeamsWithMembers, type TeamBuilderCandidate } from "@/lib/services/planner-team-builder";

// Derived read model for candidate skill options sourced from the latest relevant tryout evaluation.
// This is not persisted planner state.
export type SkillPlannerAthleteSkillOption = {
  id: string;
  athleteId: string;
  sourceEvaluationId: string | null;
  sourceOccurredAt: string | null;
  levelKey: PlannerLevelKey;
  levelLabel: PlannerLevelLabel;
  skillName: string;
  sourceOptionId: string | null;
  isExtra: boolean;
};

// Derived read model for one athlete inside Skill Planner. This is not a persisted core entity.
export type SkillPlannerAthleteInput = {
  athleteId: string;
  athleteName: string;
  registrationNumber: string;
  qualifiedLevel: TeamBuilderCandidate["displayLevel"];
  latestEvaluationId: string | null;
  latestEvaluationOccurredAt: string | null;
  availableSkillOptions: SkillPlannerAthleteSkillOption[];
};

// Derived read model for one team inside Skill Planner. Future Routine Builder should consume canonical team ids plus persisted TeamSkillPlan output, not persist this shape.
export type SkillPlannerTeamInput = {
  teamId: string;
  teamName: string;
  teamLevel: PlannerLevelLabel;
  teamType: string;
  members: SkillPlannerAthleteInput[];
  existingPlan: TeamSkillPlan | null;
};

function cloneSelection(selection: TeamSkillSelection): TeamSkillSelection {
  return { ...selection };
}

export function buildSkillPlannerTeamInputs(
  project: PlannerProject,
  levelLabelsList: readonly PlannerLevelLabel[]
): SkillPlannerTeamInput[] {
  const candidates = buildTeamBuilderCandidates(project, levelLabelsList);
  const teamsWithMembers = buildTeamBuilderTeamsWithMembers(project, candidates);
  const skillPlanMap = new Map(project.skillPlans.map((plan) => [plan.teamId, plan] as const));

  return teamsWithMembers.map((team) => ({
    teamId: team.id,
    teamName: team.name,
    teamLevel: team.teamLevel,
    teamType: team.teamType,
    existingPlan: skillPlanMap.get(team.id) ?? null,
    members: team.members.map((member) => ({
      athleteId: member.id,
      athleteName: member.name,
      registrationNumber: member.registrationNumber,
      qualifiedLevel: member.displayLevel,
      latestEvaluationId: member.latestEvaluation?.id ?? null,
      latestEvaluationOccurredAt: member.latestEvaluation?.occurredAt ?? member.latestEvaluation?.createdAt ?? null,
      availableSkillOptions: (member.latestEvaluation?.rawData.levels ?? []).flatMap((level) => (
        level.skills
          .filter((skill) => skill.name.trim().length > 0)
          .map((skill) => ({
            id: `${member.id}:${level.levelKey}:${skill.id}`,
            athleteId: member.id,
            sourceEvaluationId: member.latestEvaluation?.id ?? null,
            sourceOccurredAt: member.latestEvaluation?.occurredAt ?? member.latestEvaluation?.createdAt ?? null,
            levelKey: level.levelKey,
            levelLabel: levelLabels[level.levelKey],
            skillName: skill.name,
            sourceOptionId: skill.optionId,
            isExtra: skill.isExtra
          }))
      ))
    }))
  }));
}

export function createTeamSkillPlanRecord(project: PlannerProject, teamId: string, occurredAt: string): TeamSkillPlan {
  return {
    id: `team-skill-plan-${teamId}`,
    workspaceId: project.workspaceId,
    plannerProjectId: project.id,
    teamId,
    status: "draft",
    notes: "",
    selections: [],
    createdAt: occurredAt,
    updatedAt: occurredAt
  };
}

export function normalizeTeamSkillSelections(selections: TeamSkillSelection[]): TeamSkillSelection[] {
  const byId = new Map<string, TeamSkillSelection>();

  selections.forEach((selection) => {
    byId.set(selection.id, cloneSelection(selection));
  });

  return [...byId.values()];
}

export function upsertTeamSkillPlan(project: PlannerProject, nextPlan: TeamSkillPlan, occurredAt: string): PlannerProject {
  const normalizedPlan: TeamSkillPlan = {
    ...nextPlan,
    selections: normalizeTeamSkillSelections(nextPlan.selections),
    updatedAt: occurredAt
  };

  return {
    ...project,
    skillPlans: project.skillPlans.some((plan) => plan.id === normalizedPlan.id)
      ? project.skillPlans.map((plan) => (plan.id === normalizedPlan.id ? normalizedPlan : plan))
      : [...project.skillPlans, normalizedPlan]
  };
}

// Conservative Phase 4 update strategy: replace the full selection set for one team plan.
// This keeps writes deterministic until later phases need granular edit or approval transitions.
export function replaceTeamSkillPlanSelections(
  project: PlannerProject,
  input: {
    teamId: string;
    selections: TeamSkillSelection[];
    notes?: string;
    status?: TeamSkillPlanStatus;
    occurredAt: string;
  }
): PlannerProject {
  const existingPlan = project.skillPlans.find((plan) => plan.teamId === input.teamId) ?? createTeamSkillPlanRecord(project, input.teamId, input.occurredAt);

  return upsertTeamSkillPlan(project, {
    ...existingPlan,
    notes: input.notes ?? existingPlan.notes,
    status: input.status ?? existingPlan.status,
    selections: input.selections,
    updatedAt: input.occurredAt
  }, input.occurredAt);
}

export function getTeamSkillPlannerInput(project: PlannerProject, teamId: string, levelLabelsList: readonly PlannerLevelLabel[]) {
  return buildSkillPlannerTeamInputs(project, levelLabelsList).find((team) => team.teamId === teamId) ?? null;
}
