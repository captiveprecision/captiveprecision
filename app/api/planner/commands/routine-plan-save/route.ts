import { NextRequest, NextResponse } from "next/server";

import { requireCheerPlannerPremium } from "@/lib/access/membership";
import { canEditPlanningTeamForAccess, getPlannerAccessContext, plannerAccessForbidden, requirePlannerSession } from "@/lib/services/planner-api-access";
import { getPlannerCommandError, savePlannerRoutinePlanCommand } from "@/lib/services/planner-command-service";

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export async function POST(request: NextRequest) {
  try {
    const { session, error } = await requirePlannerSession();

    if (error || !session) {
      return error!;
    }

    const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
    const access = await getPlannerAccessContext(request, session, typeof payload?.scope === "string" ? payload.scope : null);
    const premiumError = await requireCheerPlannerPremium(session, access.scopeContext);

    if (premiumError) {
      return premiumError;
    }

    const teamId = asString(payload?.teamId);

    if (!access.canEditRoutineBuilder || !canEditPlanningTeamForAccess(access, teamId)) {
      return plannerAccessForbidden("You can review this routine, but cannot edit this team.");
    }

    const result = await savePlannerRoutinePlanCommand(session, access.dataScope, {
      workspaceRootId: typeof payload?.workspaceRootId === "string" ? payload.workspaceRootId : null,
      expectedLockVersion: typeof payload?.expectedLockVersion === "number" ? payload.expectedLockVersion : null,
      teamId,
      status: asString(payload?.status) || "draft",
      notes: asString(payload?.notes),
      document: asObject(payload?.document)
    });

    return NextResponse.json(result);
  } catch (error) {
    const plannerError = getPlannerCommandError(error);
    return NextResponse.json({ error: plannerError.message, code: plannerError.code }, { status: plannerError.code ? 409 : 500 });
  }
}
