import { LEVEL_LABELS, type PlannerLevelLabel, type PlannerQualifiedLevel } from "@/lib/domain/planner-levels";
import type { PlannerProject } from "@/lib/domain/planner-project";
import type { TeamRoutinePlan } from "@/lib/domain/routine-plan";
import type { TeamSeasonPlan } from "@/lib/domain/season-plan";
import type { TeamSkillPlan } from "@/lib/domain/skill-plan";
import { buildTeamBuilderCandidates, buildTeamBuilderTeamsWithMembers } from "@/lib/services/planner-team-builder";

// Derived member-level read model for My Teams. This is not persisted planner state.
// All counts are reproducible summaries over canonical planner-owned plans for this athlete within one team.
export type MyTeamsMemberSummary = {
  athleteId: string;
  athleteName: string;
  registrationNumber: string;
  qualifiedLevel: PlannerQualifiedLevel;
  // Minimal latest-evaluation provenance for UI display and drill-in. This is derived, not persisted here.
  latestEvaluationId: string | null;
  latestEvaluationOccurredAt: string | null;
  selectedSkillCount: number;
  approvedSkillCount: number;
  plannedRoutineItemCount: number;
  approvedRoutineItemCount: number;
};

// Derived summary of the team's persisted skill-planning state. This is not a source-of-truth entity.
export type MyTeamsSkillPlanSummary = {
  planId: string | null;
  status: TeamSkillPlan["status"] | null;
  selectionCount: number;
  approvedSelectionCount: number;
};

// Derived summary of the team's persisted routine-planning state. This is not a source-of-truth entity.
export type MyTeamsRoutinePlanSummary = {
  planId: string | null;
  status: TeamRoutinePlan["status"] | null;
  itemCount: number;
  approvedItemCount: number;
};

// Derived summary of the team's persisted season-planning state. This is not a source-of-truth entity.
export type MyTeamsSeasonPlanSummary = {
  planId: string | null;
  status: TeamSeasonPlan["status"] | null;
  checkpointCount: number;
  confirmedCheckpointCount: number;
  completedCheckpointCount: number;
  nextTargetDate: string | null;
};

// Derived per-team consolidated read model for My Teams. Future UI should consume this shape,
// but the persisted sources of truth remain PlannerProject and its canonical child aggregates.
export type MyTeamsTeamSummary = {
  teamId: string;
  teamName: string;
  teamLevel: PlannerLevelLabel;
  teamType: string;
  memberCount: number;
  qualifiedMemberCount: number;
  unqualifiedMemberCount: number;
  // Latest evaluation timestamp across the team's current canonical members.
  latestEvaluationOccurredAt: string | null;
  members: MyTeamsMemberSummary[];
  skillPlan: MyTeamsSkillPlanSummary;
  routinePlan: MyTeamsRoutinePlanSummary;
  seasonPlan: MyTeamsSeasonPlanSummary;
};

function getNextTargetDate(plan: TeamSeasonPlan | null) {
  if (!plan) {
    return null;
  }

  const candidates = plan.checkpoints
    .map((checkpoint) => checkpoint.targetDate)
    .filter((targetDate): targetDate is string => Boolean(targetDate))
    .sort((left, right) => new Date(left).getTime() - new Date(right).getTime());

  return candidates[0] ?? null;
}

function getLatestEvaluationOccurredAt(members: MyTeamsMemberSummary[]) {
  return members
    .map((member) => member.latestEvaluationOccurredAt)
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] ?? null;
}

export function buildMyTeamsTeamSummaries(project: PlannerProject): MyTeamsTeamSummary[] {
  // PlannerProject remains the canonical source of truth.
  // Team Builder read models are reused only as normalized derivation helpers over that aggregate.
  const candidates = buildTeamBuilderCandidates(project, LEVEL_LABELS);
  const teamsWithMembers = buildTeamBuilderTeamsWithMembers(project, candidates);
  const skillPlanMap = new Map(project.skillPlans.map((plan) => [plan.teamId, plan] as const));
  const routinePlanMap = new Map(project.routinePlans.map((plan) => [plan.teamId, plan] as const));
  const seasonPlanMap = new Map(project.seasonPlans.map((plan) => [plan.teamId, plan] as const));

  return teamsWithMembers.map((team) => {
    const skillPlan = skillPlanMap.get(team.id) ?? null;
    const routinePlan = routinePlanMap.get(team.id) ?? null;
    const seasonPlan = seasonPlanMap.get(team.id) ?? null;

    const members: MyTeamsMemberSummary[] = team.members.map((member) => {
      const selectedSkillCount = skillPlan?.selections.filter((selection) => selection.athleteId === member.id).length ?? 0;
      const approvedSkillCount = skillPlan?.selections.filter((selection) => selection.athleteId === member.id && selection.status === "approved").length ?? 0;
      const plannedRoutineItemCount = routinePlan?.items.filter((item) => item.athleteId === member.id).length ?? 0;
      const approvedRoutineItemCount = routinePlan?.items.filter((item) => item.athleteId === member.id && item.status === "approved").length ?? 0;

      return {
        athleteId: member.id,
        athleteName: member.name,
        registrationNumber: member.registrationNumber,
        qualifiedLevel: member.displayLevel,
        latestEvaluationId: member.latestEvaluation?.id ?? null,
        latestEvaluationOccurredAt: member.latestEvaluation?.occurredAt ?? member.latestEvaluation?.createdAt ?? null,
        selectedSkillCount,
        approvedSkillCount,
        plannedRoutineItemCount,
        approvedRoutineItemCount
      };
    });

    return {
      teamId: team.id,
      teamName: team.name,
      teamLevel: team.teamLevel,
      teamType: team.teamType,
      memberCount: members.length,
      qualifiedMemberCount: members.filter((member) => member.qualifiedLevel !== "Unqualified").length,
      unqualifiedMemberCount: members.filter((member) => member.qualifiedLevel === "Unqualified").length,
      latestEvaluationOccurredAt: getLatestEvaluationOccurredAt(members),
      members,
      skillPlan: {
        planId: skillPlan?.id ?? null,
        status: skillPlan?.status ?? null,
        selectionCount: skillPlan?.selections.length ?? 0,
        approvedSelectionCount: skillPlan?.selections.filter((selection) => selection.status === "approved").length ?? 0
      },
      routinePlan: {
        planId: routinePlan?.id ?? null,
        status: routinePlan?.status ?? null,
        itemCount: routinePlan?.items.length ?? 0,
        approvedItemCount: routinePlan?.items.filter((item) => item.status === "approved").length ?? 0
      },
      seasonPlan: {
        planId: seasonPlan?.id ?? null,
        status: seasonPlan?.status ?? null,
        checkpointCount: seasonPlan?.checkpoints.length ?? 0,
        confirmedCheckpointCount: seasonPlan?.checkpoints.filter((checkpoint) => checkpoint.status === "confirmed").length ?? 0,
        completedCheckpointCount: seasonPlan?.checkpoints.filter((checkpoint) => checkpoint.status === "completed").length ?? 0,
        nextTargetDate: getNextTargetDate(seasonPlan)
      }
    };
  });
}

export function getMyTeamsTeamSummary(project: PlannerProject, teamId: string) {
  return buildMyTeamsTeamSummaries(project).find((team) => team.teamId === teamId) ?? null;
}
