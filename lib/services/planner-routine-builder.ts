import type { PlannerLevelKey, PlannerLevelLabel } from "@/lib/domain/planner-levels";
import type { PlannerProject } from "@/lib/domain/planner-project";
import type { TeamRoutineItem, TeamRoutinePlan, TeamRoutinePlanStatus } from "@/lib/domain/routine-plan";
import type { TeamSkillPlan, TeamSkillSelection } from "@/lib/domain/skill-plan";

// Derived read model for one selected skill available to the routine builder.
// This is not persisted planner state.
export type RoutineBuilderSkillInput = {
  skillSelectionId: string;
  athleteId: string;
  athleteName: string;
  registrationNumber: string;
  levelKey: PlannerLevelKey;
  skillName: string;
  isExtra: boolean;
  selectionStatus: TeamSkillSelection["status"];
};

// Derived read model for one team inside Routine Builder. Future Season Planner should consume canonical team ids plus persisted TeamRoutinePlan output, not persist this shape.
export type RoutineBuilderTeamInput = {
  teamId: string;
  teamName: string;
  teamLevel: PlannerLevelLabel;
  teamType: string;
  availableSkills: RoutineBuilderSkillInput[];
  skillPlan: TeamSkillPlan | null;
  routinePlan: TeamRoutinePlan | null;
};

function cloneRoutineItem(item: TeamRoutineItem): TeamRoutineItem {
  return { ...item };
}

export function buildRoutineBuilderTeamInputs(project: PlannerProject): RoutineBuilderTeamInput[] {
  const athleteMap = new Map(project.athletes.map((athlete) => [athlete.id, athlete] as const));
  const skillPlanMap = new Map(project.skillPlans.map((plan) => [plan.teamId, plan] as const));
  const routinePlanMap = new Map(project.routinePlans.map((plan) => [plan.teamId, plan] as const));

  return project.teams.map((team) => {
    const skillPlan = skillPlanMap.get(team.id) ?? null;
    const routinePlan = routinePlanMap.get(team.id) ?? null;

    return {
      teamId: team.id,
      teamName: team.name,
      teamLevel: team.teamLevel,
      teamType: team.teamType,
      skillPlan,
      routinePlan,
      availableSkills: (skillPlan?.selections ?? []).flatMap((selection) => {
        const athlete = athleteMap.get(selection.athleteId);
        if (!athlete) {
          return [];
        }

        return [{
          skillSelectionId: selection.id,
          athleteId: selection.athleteId,
          athleteName: athlete.name,
          registrationNumber: athlete.registrationNumber,
          levelKey: selection.levelKey,
          skillName: selection.skillName,
          isExtra: selection.isExtra,
          selectionStatus: selection.status
        }];
      })
    };
  });
}

export function createTeamRoutinePlanRecord(project: PlannerProject, teamId: string, occurredAt: string): TeamRoutinePlan {
  return {
    id: `team-routine-plan-${teamId}`,
    workspaceId: project.workspaceId,
    plannerProjectId: project.id,
    teamId,
    status: "draft",
    notes: "",
    items: [],
    createdAt: occurredAt,
    updatedAt: occurredAt
  };
}

export function normalizeTeamRoutineItems(items: TeamRoutineItem[]): TeamRoutineItem[] {
  const byId = new Map<string, TeamRoutineItem>();

  items.forEach((item) => {
    byId.set(item.id, cloneRoutineItem(item));
  });

  return [...byId.values()].sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id));
}

export function upsertTeamRoutinePlan(project: PlannerProject, nextPlan: TeamRoutinePlan, occurredAt: string): PlannerProject {
  const normalizedPlan: TeamRoutinePlan = {
    ...nextPlan,
    items: normalizeTeamRoutineItems(nextPlan.items),
    updatedAt: occurredAt
  };

  return {
    ...project,
    routinePlans: project.routinePlans.some((plan) => plan.id === normalizedPlan.id)
      ? project.routinePlans.map((plan) => (plan.id === normalizedPlan.id ? normalizedPlan : plan))
      : [...project.routinePlans, normalizedPlan]
  };
}

// Conservative Phase 5 update strategy: replace the full routine item set for one team plan.
// This keeps routine composition writes deterministic until later phases need granular editing.
export function replaceTeamRoutinePlanItems(
  project: PlannerProject,
  input: {
    teamId: string;
    items: TeamRoutineItem[];
    notes?: string;
    status?: TeamRoutinePlanStatus;
    occurredAt: string;
  }
): PlannerProject {
  const existingPlan = project.routinePlans.find((plan) => plan.teamId === input.teamId) ?? createTeamRoutinePlanRecord(project, input.teamId, input.occurredAt);

  return upsertTeamRoutinePlan(project, {
    ...existingPlan,
    notes: input.notes ?? existingPlan.notes,
    status: input.status ?? existingPlan.status,
    items: input.items,
    updatedAt: input.occurredAt
  }, input.occurredAt);
}

export function getTeamRoutineBuilderInput(project: PlannerProject, teamId: string) {
  return buildRoutineBuilderTeamInputs(project).find((team) => team.teamId === teamId) ?? null;
}
