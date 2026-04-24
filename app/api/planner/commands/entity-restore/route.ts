import { NextRequest, NextResponse } from "next/server";

import { requireCheerPlannerPremium } from "@/lib/access/membership";
import { getPlannerScopeContext, requirePlannerSession } from "@/lib/services/planner-api-access";
import { getPlannerCommandError, restorePlannerEntityCommand } from "@/lib/services/planner-command-service";

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getPlannerStatusCode(code: string | null) {
  switch (code) {
    case "WORKSPACE_ACCESS_DENIED":
      return 403;
    case "WORKSPACE_ROOT_NOT_FOUND":
    case "VERSION_NOT_FOUND":
      return 404;
    case "PLANNER_CONFLICT":
      return 409;
    case "RESTORE_NOT_AVAILABLE":
    case "RESTORE_EXPIRED":
      return 410;
    default:
      return code ? 409 : 500;
  }
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

    const result = await restorePlannerEntityCommand(session, scope.scope, {
      workspaceRootId: typeof payload?.workspaceRootId === "string" ? payload.workspaceRootId : null,
      entityType: asString(payload?.entityType),
      versionId: asString(payload?.versionId),
      expectedLockVersion: typeof payload?.expectedLockVersion === "number" ? payload.expectedLockVersion : null
    });

    return NextResponse.json(result);
  } catch (error) {
    const plannerError = getPlannerCommandError(error);
    return NextResponse.json(
      { error: plannerError.message, code: plannerError.code },
      { status: getPlannerStatusCode(plannerError.code) }
    );
  }
}
