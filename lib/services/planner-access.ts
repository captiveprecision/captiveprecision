import type { AuthSession } from "@/lib/auth/session";
import { canManageGymAdministration, resolveGymAccessContext, type GymAccessContext } from "@/lib/services/gym-access";
import {
  buildDefaultPlannerAccessContext,
  type PlannerAccessContext,
  type PlannerAccessLevel,
  type PlannerSeatRole
} from "@/lib/services/planner-capabilities";
import { loadActiveGymTeamSeasonState } from "@/lib/services/gym-team-seasons";
import { parsePlannerWorkspaceScope, resolvePlannerScopeContext, type PlannerScopeContext, type PlannerWorkspaceScope } from "@/lib/services/planner-workspace";
import { createAdminClient } from "@/lib/supabase/admin";

function mapSeatRole(access: GymAccessContext | null): PlannerSeatRole {
  if (!access) {
    return null;
  }

  return access.seatRole;
}

function mapAccessLevel(access: GymAccessContext | null): PlannerAccessLevel {
  return access?.accessLevel ?? "none";
}

async function listEditablePlanningTeamIds(session: AuthSession, access: GymAccessContext | null) {
  if (!access?.gym.id || access.accessLevel !== "team-write") {
    return [];
  }

  const admin = createAdminClient();
  const ids = new Set<string>();

  const activeSeasonState = await loadActiveGymTeamSeasonState(admin, access.gym.id, session.userId);

  activeSeasonState?.coaches
    .filter((coach) => coach.coach_profile_id === session.userId)
    .forEach((coach) => ids.add(coach.team_id));

  const { data: legacyRows } = await admin
    .from("team_coaches" as never)
    .select("team_id" as never)
    .eq("coach_profile_id", session.userId as never);

  ((legacyRows ?? []) as Array<{ team_id?: string | null }>)
    .forEach((row) => {
      if (row.team_id) {
        ids.add(row.team_id);
      }
    });

  const { data: primaryCoachRows } = await admin
    .from("teams" as never)
    .select("id" as never)
    .eq("gym_id", access.gym.id as never)
    .eq("primary_coach_profile_id", session.userId as never)
    .is("deleted_at", null as never);

  ((primaryCoachRows ?? []) as Array<{ id?: string | null }>).forEach((row) => {
    if (row.id) {
      ids.add(row.id);
    }
  });

  return [...ids];
}

function buildScopeContext(
  session: Pick<AuthSession, "userId" | "primaryGymId">,
  dataScope: PlannerWorkspaceScope,
  gymId?: string | null
): PlannerScopeContext {
  const context = resolvePlannerScopeContext(session, dataScope);

  if (dataScope !== "gym" || !gymId) {
    return context;
  }

  return {
    ...context,
    projectId: `planner-project:gym:${gymId}`,
    workspaceId: `workspace:gym:${gymId}`,
    gymId
  };
}

export function canEditPlannerTeam(access: Pick<PlannerAccessContext, "accessLevel" | "dataScope" | "editablePlanningTeamIds">, teamId: string) {
  if (access.accessLevel === "full") {
    return true;
  }

  if (access.dataScope === "coach" && access.accessLevel === "team-write") {
    return true;
  }

  return access.editablePlanningTeamIds.includes(teamId);
}

export async function resolvePlannerAccessContext(
  session: AuthSession,
  requestedScopeInput: PlannerWorkspaceScope | string | null | undefined
): Promise<PlannerAccessContext & { scopeContext: PlannerScopeContext }> {
  const uiWorkspace = parsePlannerWorkspaceScope(requestedScopeInput);
  const access = await resolveGymAccessContext(session, { ensureOwnerSeat: uiWorkspace === "gym" });
  const hasFullGymAccess = session.role === "admin" || canManageGymAdministration(access);

  if (uiWorkspace === "gym") {
    const dataScope: PlannerWorkspaceScope = "gym";
    const editablePlanningTeamIds = hasFullGymAccess ? [] : await listEditablePlanningTeamIds(session, access);
    const hasLinkedGymAccess = Boolean(access && access.accessLevel !== "none");
    const canOpenGymWorkspace = hasFullGymAccess || hasLinkedGymAccess;
    const canManageGymAthletes = hasFullGymAccess || access?.accessLevel === "team-write";
    const base: PlannerAccessContext = {
      uiWorkspace,
      dataScope,
      gymId: access?.gym.id ?? session.primaryGymId ?? null,
      seatRole: mapSeatRole(access),
      accessLevel: hasFullGymAccess ? "full" : mapAccessLevel(access),
      canOpenGymWorkspace,
      canReadPlanner: canOpenGymWorkspace,
      canConfigureTryouts: hasFullGymAccess,
      canManageAthletes: canManageGymAthletes,
      canSaveTryoutRecords: hasFullGymAccess,
      canEditTeamBuilder: hasFullGymAccess,
      canCreateTeams: hasFullGymAccess,
      canEditTeams: hasFullGymAccess,
      canAssignRosters: hasFullGymAccess,
      canDeleteTeams: hasFullGymAccess,
      canRestoreTrash: hasFullGymAccess,
      canEditSkillPlanner: hasFullGymAccess,
      canEditRoutineBuilder: hasFullGymAccess,
      canEditSeasonPlanner: hasFullGymAccess,
      canEditSeasonManualEntries: hasFullGymAccess,
      editablePlanningTeamIds
    };

    return {
      ...base,
      scopeContext: buildScopeContext(session, dataScope, access?.gym.id ?? session.primaryGymId ?? null)
    };
  }

  const linkedCoachAccess = access && (access.accessLevel === "team-write" || access.accessLevel === "read");

  if (linkedCoachAccess) {
    const editablePlanningTeamIds = await listEditablePlanningTeamIds(session, access);
    const canPlanAssignedTeams = access.accessLevel === "team-write" && editablePlanningTeamIds.length > 0;
    const base: PlannerAccessContext = {
      uiWorkspace,
      dataScope: "gym",
      gymId: access.gym.id,
      seatRole: mapSeatRole(access),
      accessLevel: access.accessLevel,
      canOpenGymWorkspace: false,
      canReadPlanner: true,
      canConfigureTryouts: false,
      canManageAthletes: true,
      canSaveTryoutRecords: true,
      canEditTeamBuilder: false,
      canCreateTeams: false,
      canEditTeams: false,
      canAssignRosters: false,
      canDeleteTeams: false,
      canRestoreTrash: false,
      canEditSkillPlanner: canPlanAssignedTeams,
      canEditRoutineBuilder: canPlanAssignedTeams,
      canEditSeasonPlanner: canPlanAssignedTeams,
      canEditSeasonManualEntries: canPlanAssignedTeams,
      editablePlanningTeamIds
    };

    return {
      ...base,
      scopeContext: buildScopeContext(session, "gym", access.gym.id)
    };
  }

  if (access?.accessLevel === "none") {
    const base: PlannerAccessContext = {
      ...buildDefaultPlannerAccessContext(uiWorkspace),
      dataScope: "coach",
      gymId: access.gym.id,
      seatRole: mapSeatRole(access),
      accessLevel: "none",
      canOpenGymWorkspace: false,
      canReadPlanner: false,
      canConfigureTryouts: false,
      canManageAthletes: false,
      canSaveTryoutRecords: false,
      canEditTeamBuilder: false,
      canCreateTeams: false,
      canEditTeams: false,
      canAssignRosters: false,
      canDeleteTeams: false,
      canRestoreTrash: false,
      canEditSkillPlanner: false,
      canEditRoutineBuilder: false,
      canEditSeasonPlanner: false,
      canEditSeasonManualEntries: false,
      editablePlanningTeamIds: []
    };

    return {
      ...base,
      scopeContext: buildScopeContext(session, "coach")
    };
  }

  const base = buildDefaultPlannerAccessContext("coach");

  return {
    ...base,
    uiWorkspace,
    dataScope: "coach",
    canOpenGymWorkspace: hasFullGymAccess,
    scopeContext: buildScopeContext(session, "coach")
  };
}
