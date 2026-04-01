import type { PlannerLevelLabel } from "@/lib/domain/planner-levels";
import type { PlannerProject } from "@/lib/domain/planner-project";
import type { TeamRoutinePlan } from "@/lib/domain/routine-plan";
import type { TeamSeasonCheckpoint, TeamSeasonPlan, TeamSeasonPlanStatus } from "@/lib/domain/season-plan";
import type { TeamSkillPlan } from "@/lib/domain/skill-plan";

// Derived read model for the canonical routine context available to Season Planner.
// This is not persisted planner state.
export type SeasonPlannerRoutineInput = {
  routinePlanId: string;
  routinePlanStatus: TeamRoutinePlan["status"];
  itemCount: number;
  approvedItemCount: number;
};

// Derived read model for one team inside Season Planner. Future My Teams should consume
// canonical team ids plus persisted TeamSeasonPlan output, not persist this shape.
export type SeasonPlannerTeamInput = {
  teamId: string;
  teamName: string;
  teamLevel: PlannerLevelLabel;
  teamType: string;
  skillPlan: TeamSkillPlan | null;
  routinePlan: TeamRoutinePlan | null;
  routineInput: SeasonPlannerRoutineInput | null;
  seasonPlan: TeamSeasonPlan | null;
  selectedSkillCount: number;
  approvedSkillCount: number;
};

function cloneCheckpoint(checkpoint: TeamSeasonCheckpoint): TeamSeasonCheckpoint {
  return { ...checkpoint };
}

export function buildSeasonPlannerTeamInputs(project: PlannerProject): SeasonPlannerTeamInput[] {
  const skillPlanMap = new Map(project.skillPlans.map((plan) => [plan.teamId, plan] as const));
  const routinePlanMap = new Map(project.routinePlans.map((plan) => [plan.teamId, plan] as const));
  const seasonPlanMap = new Map(project.seasonPlans.map((plan) => [plan.teamId, plan] as const));

  return project.teams.map((team) => {
    const skillPlan = skillPlanMap.get(team.id) ?? null;
    const routinePlan = routinePlanMap.get(team.id) ?? null;
    const seasonPlan = seasonPlanMap.get(team.id) ?? null;
    const selectedSkillCount = skillPlan?.selections.length ?? 0;
    const approvedSkillCount = skillPlan?.selections.filter((selection) => selection.status === "approved").length ?? 0;

    return {
      teamId: team.id,
      teamName: team.name,
      teamLevel: team.teamLevel,
      teamType: team.teamType,
      skillPlan,
      routinePlan,
      routineInput: routinePlan ? {
        routinePlanId: routinePlan.id,
        routinePlanStatus: routinePlan.status,
        itemCount: routinePlan.items.length,
        approvedItemCount: routinePlan.items.filter((item) => item.status === "approved").length
      } : null,
      seasonPlan,
      selectedSkillCount,
      approvedSkillCount
    };
  });
}

export function createTeamSeasonPlanRecord(project: PlannerProject, teamId: string, occurredAt: string): TeamSeasonPlan {
  return {
    id: `team-season-plan-${teamId}`,
    workspaceId: project.workspaceId,
    plannerProjectId: project.id,
    teamId,
    status: "draft",
    notes: "",
    checkpoints: [],
    createdAt: occurredAt,
    updatedAt: occurredAt
  };
}

export function normalizeTeamSeasonCheckpoints(checkpoints: TeamSeasonCheckpoint[]): TeamSeasonCheckpoint[] {
  const byId = new Map<string, TeamSeasonCheckpoint>();

  checkpoints.forEach((checkpoint) => {
    byId.set(checkpoint.id, cloneCheckpoint(checkpoint));
  });

  return [...byId.values()].sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id));
}

export function upsertTeamSeasonPlan(project: PlannerProject, nextPlan: TeamSeasonPlan, occurredAt: string): PlannerProject {
  const normalizedPlan: TeamSeasonPlan = {
    ...nextPlan,
    checkpoints: normalizeTeamSeasonCheckpoints(nextPlan.checkpoints),
    updatedAt: occurredAt
  };

  return {
    ...project,
    seasonPlans: project.seasonPlans.some((plan) => plan.id === normalizedPlan.id)
      ? project.seasonPlans.map((plan) => (plan.id === normalizedPlan.id ? normalizedPlan : plan))
      : [...project.seasonPlans, normalizedPlan]
  };
}

// Conservative Phase 6 update strategy: replace the full checkpoint set for one team season plan.
// This keeps season writes deterministic until later phases need granular scheduling or approval transitions.
export function replaceTeamSeasonPlanCheckpoints(
  project: PlannerProject,
  input: {
    teamId: string;
    checkpoints: TeamSeasonCheckpoint[];
    notes?: string;
    status?: TeamSeasonPlanStatus;
    occurredAt: string;
  }
): PlannerProject {
  const existingPlan = project.seasonPlans.find((plan) => plan.teamId === input.teamId) ?? createTeamSeasonPlanRecord(project, input.teamId, input.occurredAt);

  return upsertTeamSeasonPlan(project, {
    ...existingPlan,
    notes: input.notes ?? existingPlan.notes,
    status: input.status ?? existingPlan.status,
    checkpoints: input.checkpoints,
    updatedAt: input.occurredAt
  }, input.occurredAt);
}

export function getTeamSeasonPlannerInput(project: PlannerProject, teamId: string) {
  return buildSeasonPlannerTeamInputs(project).find((team) => team.teamId === teamId) ?? null;
}

