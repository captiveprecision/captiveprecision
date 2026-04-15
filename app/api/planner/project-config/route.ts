import { NextRequest, NextResponse } from "next/server";

import { getPlannerScopeContext, requirePlannerSession } from "@/lib/services/planner-api-access";
import { requireCheerPlannerPremium } from "@/lib/access/membership";
import { getPlannerCommandError, savePlannerProjectCommand } from "@/lib/services/planner-command-service";

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
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
    const result = await savePlannerProjectCommand(session, scope.scope, {
      expectedLockVersion: typeof payload?.expectedLockVersion === "number" ? payload.expectedLockVersion : null,
      workspaceRootId: typeof payload?.workspaceRootId === "string" ? payload.workspaceRootId : null,
      name: asString(payload?.name) || undefined,
      status: asString(payload?.status) || undefined,
      pipelineStage: asString(payload?.pipelineStage) || undefined,
      template: asObject(payload?.template) ?? undefined,
      qualificationRules: asObject(payload?.qualificationRules) ?? undefined
    });

    return NextResponse.json({
      plannerProject: result.entity,
      lockVersion: result.lockVersion,
      changeSetId: result.changeSetId,
      latestVersionNumber: result.latestVersionNumber
    });
  } catch (error) {
    const plannerError = getPlannerCommandError(error);
    return NextResponse.json({ error: plannerError.message, code: plannerError.code }, { status: plannerError.code ? 409 : 500 });
  }
}

