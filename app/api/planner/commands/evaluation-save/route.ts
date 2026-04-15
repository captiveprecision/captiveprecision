import { NextRequest, NextResponse } from "next/server";

import { requireCheerPlannerPremium } from "@/lib/access/membership";
import { getPlannerScopeContext, requirePlannerSession } from "@/lib/services/planner-api-access";
import { getPlannerCommandError, savePlannerEvaluationCommand } from "@/lib/services/planner-command-service";

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

    const evaluation = asObject(payload?.payload) ?? asObject(payload);

    if (!evaluation) {
      return NextResponse.json({ error: "A valid evaluation payload is required." }, { status: 400 });
    }

    const result = await savePlannerEvaluationCommand(session, scope.scope, {
      workspaceRootId: typeof evaluation.workspaceRootId === "string" ? evaluation.workspaceRootId : null,
      expectedLockVersion: typeof evaluation.expectedLockVersion === "number" ? evaluation.expectedLockVersion : null,
      evaluationId: asString(evaluation.evaluationId ?? evaluation.id),
      athleteId: asString(evaluation.athleteId),
      occurredAt: asString(evaluation.occurredAt) || null,
      record: asObject(evaluation.record) ?? evaluation
    });

    return NextResponse.json(result);
  } catch (error) {
    const plannerError = getPlannerCommandError(error);
    return NextResponse.json({ error: plannerError.message, code: plannerError.code }, { status: plannerError.code ? 409 : 500 });
  }
}
