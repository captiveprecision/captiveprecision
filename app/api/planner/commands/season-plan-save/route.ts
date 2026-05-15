import { NextRequest, NextResponse } from "next/server";

import { requireCheerPlannerPremium } from "@/lib/access/membership";
import { canEditTeamForSession, getPlannerScopeContext, requirePlannerSession } from "@/lib/services/planner-api-access";
import { getPlannerCommandError, savePlannerSeasonPlanCommand } from "@/lib/services/planner-command-service";

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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
      return NextResponse.json({ error: "You do not have permission to update this Gym team's season plan." }, { status: 403 });
    }

    const result = await savePlannerSeasonPlanCommand(session, scope.scope, {
      workspaceRootId: typeof payload?.workspaceRootId === "string" ? payload.workspaceRootId : null,
      expectedLockVersion: typeof payload?.expectedLockVersion === "number" ? payload.expectedLockVersion : null,
      teamId,
      status: asString(payload?.status) || "draft",
      notes: asString(payload?.notes),
      checkpoints: Array.isArray(payload?.checkpoints) ? payload.checkpoints : [],
      manualEntries: Array.isArray(payload?.manualEntries) ? payload.manualEntries : []
    });

    return NextResponse.json(result);
  } catch (error) {
    const plannerError = getPlannerCommandError(error);
    return NextResponse.json({ error: plannerError.message, code: plannerError.code }, { status: plannerError.code ? 409 : 500 });
  }
}
