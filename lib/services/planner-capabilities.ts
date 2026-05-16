import type { PlannerWorkspaceScope } from "@/lib/services/planner-workspace";

export type PlannerAccessLevel = "none" | "read" | "team-write" | "full";
export type PlannerSeatRole = "owner" | "program_director" | "coach" | "assistant" | "staff" | null;

export type PlannerAccessContext = {
  uiWorkspace: PlannerWorkspaceScope;
  dataScope: PlannerWorkspaceScope;
  gymId: string | null;
  seatRole: PlannerSeatRole;
  accessLevel: PlannerAccessLevel;
  canOpenGymWorkspace: boolean;
  canReadPlanner: boolean;
  canConfigureTryouts: boolean;
  canManageAthletes: boolean;
  canSaveTryoutRecords: boolean;
  canEditTeamBuilder: boolean;
  canCreateTeams: boolean;
  canEditTeams: boolean;
  canAssignRosters: boolean;
  canDeleteTeams: boolean;
  canRestoreTrash: boolean;
  canEditSkillPlanner: boolean;
  canEditRoutineBuilder: boolean;
  canEditSeasonPlanner: boolean;
  canEditSeasonManualEntries: boolean;
  editablePlanningTeamIds: string[];
};

export type CheerPlannerCapabilities = {
  canConfigureTryouts: boolean;
  canManageAthletes: boolean;
  canSaveTryoutRecords: boolean;
  canEditTeamBuilder: boolean;
  canCreateTeams: boolean;
  canEditTeams: boolean;
  canAssignRosters: boolean;
  canDeleteTeams: boolean;
  canRestoreTrash: boolean;
  canEditSkillPlanner: boolean;
  canEditRoutineBuilder: boolean;
  canEditSeasonPlanner: boolean;
  canEditSeasonManualEntries: boolean;
  editablePlanningTeamIds: string[];
};

export function buildDefaultPlannerAccessContext(uiWorkspace: PlannerWorkspaceScope): PlannerAccessContext {
  const isGym = uiWorkspace === "gym";

  return {
    uiWorkspace,
    dataScope: uiWorkspace,
    gymId: null,
    seatRole: isGym ? "owner" : null,
    accessLevel: isGym ? "full" : "team-write",
    canOpenGymWorkspace: isGym,
    canReadPlanner: true,
    canConfigureTryouts: true,
    canManageAthletes: true,
    canSaveTryoutRecords: true,
    canEditTeamBuilder: isGym,
    canCreateTeams: isGym,
    canEditTeams: isGym,
    canAssignRosters: isGym,
    canDeleteTeams: isGym,
    canRestoreTrash: isGym,
    canEditSkillPlanner: true,
    canEditRoutineBuilder: true,
    canEditSeasonPlanner: true,
    canEditSeasonManualEntries: true,
    editablePlanningTeamIds: []
  };
}

export function buildCheerPlannerCapabilities(
  scope: PlannerWorkspaceScope,
  accessContext?: PlannerAccessContext | null
): CheerPlannerCapabilities {
  if (accessContext) {
    return {
      canConfigureTryouts: accessContext.canConfigureTryouts,
      canManageAthletes: accessContext.canManageAthletes,
      canSaveTryoutRecords: accessContext.canSaveTryoutRecords,
      canEditTeamBuilder: accessContext.canEditTeamBuilder,
      canCreateTeams: accessContext.canCreateTeams,
      canEditTeams: accessContext.canEditTeams,
      canAssignRosters: accessContext.canAssignRosters,
      canDeleteTeams: accessContext.canDeleteTeams,
      canRestoreTrash: accessContext.canRestoreTrash,
      canEditSkillPlanner: accessContext.canEditSkillPlanner,
      canEditRoutineBuilder: accessContext.canEditRoutineBuilder,
      canEditSeasonPlanner: accessContext.canEditSeasonPlanner,
      canEditSeasonManualEntries: accessContext.canEditSeasonManualEntries,
      editablePlanningTeamIds: accessContext.editablePlanningTeamIds
    };
  }

  if (scope === "gym") {
    return {
      canConfigureTryouts: true,
      canManageAthletes: true,
      canSaveTryoutRecords: true,
      canEditTeamBuilder: true,
      canCreateTeams: true,
      canEditTeams: true,
      canAssignRosters: true,
      canDeleteTeams: true,
      canRestoreTrash: true,
      canEditSkillPlanner: true,
      canEditRoutineBuilder: true,
      canEditSeasonPlanner: true,
      canEditSeasonManualEntries: true,
      editablePlanningTeamIds: []
    };
  }

  return {
    canConfigureTryouts: true,
    canManageAthletes: true,
    canSaveTryoutRecords: true,
    canEditTeamBuilder: false,
    canCreateTeams: false,
    canEditTeams: false,
    canAssignRosters: false,
    canDeleteTeams: false,
    canRestoreTrash: false,
    canEditSkillPlanner: true,
    canEditRoutineBuilder: true,
    canEditSeasonPlanner: true,
    canEditSeasonManualEntries: true,
    editablePlanningTeamIds: []
  };
}

export function canScopeWritePlannerCommand(
  scope: PlannerWorkspaceScope,
  command: "tryout-save" | "skill-plan-save" | "routine-plan-save" | "season-plan-save" | "team-save" | "team-assignments-set" | "athlete-save"
) {
  const capabilities = buildCheerPlannerCapabilities(scope);

  switch (command) {
    case "tryout-save":
      return capabilities.canSaveTryoutRecords;
    case "skill-plan-save":
      return capabilities.canEditSkillPlanner;
    case "routine-plan-save":
      return capabilities.canEditRoutineBuilder;
    case "season-plan-save":
      return capabilities.canEditSeasonPlanner;
    case "team-save":
      return capabilities.canCreateTeams || capabilities.canEditTeams;
    case "team-assignments-set":
      return capabilities.canAssignRosters;
    case "athlete-save":
      return capabilities.canManageAthletes;
    default:
      return false;
  }
}
