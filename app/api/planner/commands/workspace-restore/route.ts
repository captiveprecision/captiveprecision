import { NextRequest, NextResponse } from "next/server";

import { requireCheerPlannerPremium } from "@/lib/access/membership";
import { getPlannerScopeContext, requirePlannerSession } from "@/lib/services/planner-api-access";
import { getPlannerCommandError, restorePlannerWorkspaceCommand } from "@/lib/services/planner-command-service";

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

    const result = await restorePlannerWorkspaceCommand(session, scope.scope, {
      workspaceRootId: typeof payload?.workspaceRootId === "string" ? payload.workspaceRootId : null,
      backupId: asString(payload?.backupId)
    });

    return NextResponse.json(result);
  } catch (error) {
    const plannerError = getPlannerCommandError(error);
    return NextResponse.json({ error: plannerError.message, code: plannerError.code }, { status: plannerError.code ? 409 : 500 });
  }
}
