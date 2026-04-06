import type { AthleteRecord } from "@/lib/domain/athlete";
import type { PlannerLevelLabel } from "@/lib/domain/planner-levels";
import type { PlannerProject } from "@/lib/domain/planner-project";
import type { TeamRecord } from "@/lib/domain/team";
import { buildPlannerTryoutAthletePool, type TryoutAthletePoolItem } from "@/lib/services/planner-tryouts";

// Pure derived Team Builder view over shared planner athletes + latest relevant tryout evaluation state. This is not a persisted entity.
export type TeamBuilderCandidate = TryoutAthletePoolItem;

export type TeamBuilderTeamDraftInput = {
  name: string;
  teamLevel: PlannerLevelLabel;
  teamType: string;
  teamDivision?: string;
  trainingDays?: string;
  trainingHours?: string;
  trainingSchedule?: string;
  assignedCoachNames?: string[];
  linkedCoachIds?: string[];
  remoteTeamId?: string;
};

export type TeamBuilderTeamEditInput = {
  teamId: string;
  name: string;
  teamLevel: PlannerLevelLabel;
  teamType: string;
};

export type MyTeamsTeamProfileUpdateInput = TeamBuilderTeamDraftInput & {
  teamId: string;
};

// Derived Team Builder read model. Skill Planner should consume canonical TeamRecord membership, not persist this expanded shape.
export type TeamBuilderTeamWithMembers = TeamRecord & {
  members: TeamBuilderCandidate[];
};

export function buildTeamBuilderCandidates(
  project: PlannerProject,
  levelLabels: readonly PlannerLevelLabel[]
): TeamBuilderCandidate[] {
  return buildPlannerTryoutAthletePool(project, levelLabels);
}

// Canonical memberAthleteIds remain authoritative. Legacy registration-number membership is only used when older local teams have not been normalized yet.
export function buildTeamBuilderTeamsWithMembers(
  project: PlannerProject,
  candidates: TeamBuilderCandidate[]
): TeamBuilderTeamWithMembers[] {
  const candidateMapById = new Map(candidates.map((candidate) => [candidate.id, candidate] as const));
  const candidateMapByRegistration = new Map(candidates.map((candidate) => [candidate.registrationNumber, candidate] as const));

  return project.teams.map((team) => ({
    ...team,
    members: team.memberAthleteIds.length
      ? team.memberAthleteIds
          .map((athleteId) => candidateMapById.get(athleteId))
          .filter((member): member is TeamBuilderCandidate => Boolean(member))
      : (team.memberRegistrationNumbers ?? [])
          .map((registrationNumber) => candidateMapByRegistration.get(registrationNumber))
          .filter((member): member is TeamBuilderCandidate => Boolean(member))
  }));
}

export function createPlannerTeamRecord(
  project: PlannerProject,
  draft: TeamBuilderTeamDraftInput,
  occurredAt: string
): TeamRecord {
  const trainingDays = draft.trainingDays?.trim() ?? "";
  const trainingHours = draft.trainingHours?.trim() ?? "";
  const legacyTrainingSchedule = draft.trainingSchedule?.trim() ?? [trainingDays, trainingHours].filter(Boolean).join(" / ");

  return {
    id: draft.remoteTeamId?.trim() || `team-${Date.now()}`,
    workspaceId: project.workspaceId,
    remoteTeamId: draft.remoteTeamId?.trim() ?? "",
    name: draft.name.trim() || `Team ${project.teams.length + 1}`,
    teamLevel: draft.teamLevel,
    teamType: draft.teamType.trim(),
    teamDivision: draft.teamDivision?.trim() ?? "",
    trainingDays,
    trainingHours,
    trainingSchedule: legacyTrainingSchedule,
    assignedCoachNames: (draft.assignedCoachNames ?? []).map((name) => name.trim()).filter(Boolean),
    linkedCoachIds: (draft.linkedCoachIds ?? []).map((id) => id.trim()).filter(Boolean),
    // Canonical roster linkage for future planner phases.
    memberAthleteIds: [],
    // Transitional compatibility for older local planner state only.
    memberRegistrationNumbers: [],
    status: "draft",
    createdAt: occurredAt,
    updatedAt: occurredAt
  };
}

export function updateMyTeamsTeamProfile(
  project: PlannerProject,
  draft: MyTeamsTeamProfileUpdateInput,
  occurredAt: string
): PlannerProject {
  const trainingDays = draft.trainingDays?.trim() ?? "";
  const trainingHours = draft.trainingHours?.trim() ?? "";
  const trainingSchedule = draft.trainingSchedule?.trim() ?? [trainingDays, trainingHours].filter(Boolean).join(" / ");

  return {
    ...project,
    teams: project.teams.map((team) => (
      team.id === draft.teamId
        ? {
            ...team,
            remoteTeamId: draft.remoteTeamId?.trim() ?? team.remoteTeamId ?? "",
            name: draft.name.trim() || team.name,
            teamLevel: draft.teamLevel,
            teamType: draft.teamType.trim(),
            teamDivision: draft.teamDivision?.trim() ?? "",
            trainingDays,
            trainingHours,
            trainingSchedule,
            assignedCoachNames: (draft.assignedCoachNames ?? []).map((name) => name.trim()).filter(Boolean),
            linkedCoachIds: (draft.linkedCoachIds ?? []).map((id) => id.trim()).filter(Boolean),
            updatedAt: occurredAt
          }
        : team
    ))
  };
}

export function assignAthleteToPlannerTeam(
  project: PlannerProject,
  athlete: AthleteRecord,
  teamId: string,
  occurredAt: string
): PlannerProject {
  return {
    ...project,
    teams: project.teams.map((team) => ({
      ...team,
      memberAthleteIds: team.id === teamId
        ? Array.from(new Set([...team.memberAthleteIds.filter((id) => id !== athlete.id), athlete.id]))
        : team.memberAthleteIds.filter((id) => id !== athlete.id),
      memberRegistrationNumbers: team.id === teamId
        ? Array.from(new Set([...(team.memberRegistrationNumbers ?? []).filter((registrationNumber) => registrationNumber !== athlete.registrationNumber), athlete.registrationNumber]))
        : (team.memberRegistrationNumbers ?? []).filter((registrationNumber) => registrationNumber !== athlete.registrationNumber),
      updatedAt: occurredAt
    }))
  };
}

export function removeAthleteFromPlannerTeam(
  project: PlannerProject,
  athlete: AthleteRecord,
  teamId: string,
  occurredAt: string
): PlannerProject {
  return {
    ...project,
    teams: project.teams.map((team) => (
      team.id === teamId
        ? {
            ...team,
            memberAthleteIds: team.memberAthleteIds.filter((id) => id !== athlete.id),
            memberRegistrationNumbers: (team.memberRegistrationNumbers ?? []).filter((registrationNumber) => registrationNumber !== athlete.registrationNumber),
            updatedAt: occurredAt
          }
        : team
    ))
  };
}

export function clearPlannerTeamRoster(project: PlannerProject, teamId: string, occurredAt: string): PlannerProject {
  return {
    ...project,
    teams: project.teams.map((team) => (
      team.id === teamId
        ? { ...team, memberAthleteIds: [], memberRegistrationNumbers: [], updatedAt: occurredAt }
        : team
    ))
  };
}

export function deletePlannerTeamRecord(project: PlannerProject, teamId: string): PlannerProject {
  return {
    ...project,
    teams: project.teams.filter((team) => team.id !== teamId)
  };
}

export function updatePlannerTeamDefinition(
  project: PlannerProject,
  edit: TeamBuilderTeamEditInput,
  occurredAt: string
): PlannerProject {
  return {
    ...project,
    teams: project.teams.map((team) => (
      team.id === edit.teamId
        ? {
            ...team,
            name: edit.name.trim() || team.name,
            teamLevel: edit.teamLevel,
            teamType: edit.teamType,
            updatedAt: occurredAt
          }
        : team
    ))
  };
}

