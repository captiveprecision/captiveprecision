import type { PlannerWorkspaceScope } from "@/lib/services/planner-workspace";

export type CheerPlannerCapabilities = {
  canConfigureTryouts: boolean;
  canManageAthletes: boolean;
  canSaveTryoutRecords: boolean;
  canCreateTeams: boolean;
  canEditTeams: boolean;
  canAssignRosters: boolean;
  canDeleteTeams: boolean;
  canEditSkillPlanner: boolean;
  canEditRoutineBuilder: boolean;
  canEditSeasonPlanner: boolean;
  canEditSeasonManualEntries: boolean;
};

export function buildCheerPlannerCapabilities(scope: PlannerWorkspaceScope): CheerPlannerCapabilities {
  if (scope === "gym") {
    return {
      canConfigureTryouts: true,
      canManageAthletes: true,
      canSaveTryoutRecords: false,
      canCreateTeams: true,
      canEditTeams: true,
      canAssignRosters: true,
      canDeleteTeams: false,
      canEditSkillPlanner: false,
      canEditRoutineBuilder: false,
      canEditSeasonPlanner: true,
      canEditSeasonManualEntries: true
    };
  }

  return {
    canConfigureTryouts: true,
    canManageAthletes: true,
    canSaveTryoutRecords: true,
    canCreateTeams: true,
    canEditTeams: true,
    canAssignRosters: true,
    canDeleteTeams: true,
    canEditSkillPlanner: true,
    canEditRoutineBuilder: true,
    canEditSeasonPlanner: true,
    canEditSeasonManualEntries: true
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
