import { NextRequest, NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth/session";
import { requireCheerPlannerPremium } from "@/lib/access/membership";
import { parsePlannerWorkspaceScope, resolvePlannerScopeContext } from "@/lib/services/planner-workspace";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerCommandError, setPlannerTeamAssignmentsCommand } from "@/lib/services/planner-command-service";

type RosterAction = "assign" | "remove" | "clear";

type RosterPayload = {
  action?: RosterAction;
  teamId?: string;
  athleteId?: string;
  scope?: "coach" | "gym";
};

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function canEditTeam(teamId: string, session: Awaited<ReturnType<typeof getAuthSession>>) {
  if (!session) {
    return false;
  }

  if (session.role === "admin") {
    return true;
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("teams" as never)
    .select("id, gym_id, primary_coach_profile_id" as never)
    .eq("id", teamId as never)
    .maybeSingle();

  const team = data as { id: string; gym_id: string | null; primary_coach_profile_id: string | null } | null;

  if (!team) {
    return false;
  }

  return team.gym_id
    ? team.gym_id === (session.primaryGymId ?? null)
    : team.primary_coach_profile_id === session.userId;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();

    if (!session || !session.roles.includes("coach")) {
      return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
    }

    const payload = await request.json().catch(() => null) as RosterPayload | null;
    const scope = resolvePlannerScopeContext(session, parsePlannerWorkspaceScope(payload?.scope));
    const premiumError = await requireCheerPlannerPremium(session, scope);

    if (premiumError) {
      return premiumError;
    }

    const action = payload?.action;
    const teamId = asString(payload?.teamId);
    const athleteId = asString(payload?.athleteId);

    if (!teamId || !(await canEditTeam(teamId, session))) {
      return NextResponse.json({ error: "You do not have access to edit this roster." }, { status: 403 });
    }

    const admin = createAdminClient();
    const { data: assignmentData, error: assignmentError } = await admin
      .from("athlete_team_assignments" as never)
      .select("athlete_id" as never)
      .eq("team_id", teamId as never)
      .is("deleted_at" as never, null);

    if (assignmentError) {
      return NextResponse.json({ error: assignmentError.message }, { status: 500 });
    }

    const currentAthleteIds = new Set(
      ((assignmentData ?? []) as Array<{ athlete_id: string }>).map((row) => row.athlete_id)
    );

    if (action === "assign") {
      if (!athleteId) {
        return NextResponse.json({ error: "An athlete id is required to assign roster membership." }, { status: 400 });
      }
      currentAthleteIds.add(athleteId);
      const result = await setPlannerTeamAssignmentsCommand(session, scope.scope, {
        teamId,
        athleteIds: [...currentAthleteIds]
      });

      return NextResponse.json({
        ok: true,
        assignments: result.entity,
        changeSetId: result.changeSetId,
        latestVersionNumber: result.latestVersionNumber
      });
    }

    if (action === "remove") {
      if (!athleteId) {
        return NextResponse.json({ error: "An athlete id is required to remove roster membership." }, { status: 400 });
      }
      currentAthleteIds.delete(athleteId);
      const result = await setPlannerTeamAssignmentsCommand(session, scope.scope, {
        teamId,
        athleteIds: [...currentAthleteIds]
      });

      return NextResponse.json({
        ok: true,
        assignments: result.entity,
        changeSetId: result.changeSetId,
        latestVersionNumber: result.latestVersionNumber
      });
    }

    if (action === "clear") {
      const result = await setPlannerTeamAssignmentsCommand(session, scope.scope, {
        teamId,
        athleteIds: []
      });

      return NextResponse.json({
        ok: true,
        assignments: result.entity,
        changeSetId: result.changeSetId,
        latestVersionNumber: result.latestVersionNumber
      });
    }

    return NextResponse.json({ error: "Unsupported roster action." }, { status: 400 });
  } catch (error) {
    const plannerError = getPlannerCommandError(error);
    return NextResponse.json({ error: plannerError.message, code: plannerError.code }, { status: plannerError.code ? 409 : 500 });
  }
}



