import { NextRequest, NextResponse } from "next/server";

import { getPlannerScopeContext, requirePlannerSession } from "@/lib/services/planner-api-access";
import { requireCheerPlannerPremium } from "@/lib/access/membership";
import { getPlannerCommandError, savePlannerEvaluationCommand } from "@/lib/services/planner-command-service";
import { isUuidString } from "@/lib/services/planner-workspace";

function asObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

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
    const evaluation = asObject(payload?.evaluation);
    const evaluationId = asString(evaluation?.id);
    const athleteId = asString(evaluation?.athleteId);

    if (!evaluation || !evaluationId || !isUuidString(athleteId)) {
      return NextResponse.json({ error: "A valid evaluation payload with a persisted athlete id is required." }, { status: 400 });
    }
    const result = await savePlannerEvaluationCommand(session, scope.scope, {
      workspaceRootId: typeof payload?.workspaceRootId === "string" ? payload.workspaceRootId : null,
      expectedLockVersion: typeof evaluation.lockVersion === "number" ? evaluation.lockVersion : null,
      evaluationId,
      athleteId,
      occurredAt: asString(evaluation.occurredAt) || null,
      record: evaluation
    });

    return NextResponse.json({
      evaluation: result.entity,
      lockVersion: result.lockVersion,
      changeSetId: result.changeSetId,
      latestVersionNumber: result.latestVersionNumber
    });
  } catch (error) {
    const plannerError = getPlannerCommandError(error);
    return NextResponse.json({ error: plannerError.message, code: plannerError.code }, { status: plannerError.code ? 409 : 500 });
  }
}

