import { NextRequest, NextResponse } from "next/server";

import { requireCheerPlannerPremium } from "@/lib/access/membership";
import { resolveGymAccessContext } from "@/lib/services/gym-access";
import { loadActiveGymTeamSeasonState, replaceActiveGymTeamSeasonRoster } from "@/lib/services/gym-team-seasons";
import { canEditTeamForSession, getPlannerScopeContext, requirePlannerSession } from "@/lib/services/planner-api-access";
import { getPlannerCommandError, setPlannerTeamAssignmentsCommand } from "@/lib/services/planner-command-service";
import { createAdminClient } from "@/lib/supabase/admin";

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.flatMap((item) => typeof item === "string" ? [item.trim()] : []).filter(Boolean) : [];
}

export async function POST(request: NextRequest) {
  try {
    const { session, error } = await requirePlannerSession();

    if (error || !session) {
      return error!;
    }

    const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
    const scope = getPlannerScopeContext(request, session, typeof payload?.scope === "string" ? payload.scope : null);
    const premiumError = await requireCheerPlannerPremium(session, scope);

    if (premiumError) {
      return premiumError;
    }

    const teamId = asString(payload?.teamId);

    if (scope.scope === "gym" && !(await canEditTeamForSession(teamId, session, scope))) {
      return NextResponse.json({ error: "You do not have permission to manage this Gym team roster." }, { status: 403 });
    }

    const athleteIds = asStringArray(payload?.athleteIds);
    const result = await setPlannerTeamAssignmentsCommand(session, scope.scope, {
      workspaceRootId: typeof payload?.workspaceRootId === "string" ? payload.workspaceRootId : null,
      teamId,
      athleteIds
    });

    if (scope.scope === "gym") {
      const access = await resolveGymAccessContext(session);

      if (access?.gym) {
        const admin = createAdminClient();
        const activeSeasonState = await loadActiveGymTeamSeasonState(admin, access.gym.id, session.userId);

        if (activeSeasonState) {
          await replaceActiveGymTeamSeasonRoster(admin, {
            gymId: access.gym.id,
            seasonId: activeSeasonState.season.id,
            teamId,
            athleteIds
          });
        }
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    const plannerError = getPlannerCommandError(error);
    return NextResponse.json({ error: plannerError.message, code: plannerError.code }, { status: plannerError.code ? 409 : 500 });
  }
}
