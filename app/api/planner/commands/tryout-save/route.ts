import { NextRequest, NextResponse } from "next/server";

import { requireCheerPlannerPremium } from "@/lib/access/membership";
import { getPlannerScopeContext, requirePlannerSession } from "@/lib/services/planner-api-access";
import { getPlannerCommandError, savePlannerTryoutRecordCommand } from "@/lib/services/planner-command-service";

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

    const tryoutRecord = asObject(payload?.payload) ?? asObject(payload);

    if (!tryoutRecord) {
      return NextResponse.json({ error: "A valid tryout record payload is required." }, { status: 400 });
    }

    const result = await savePlannerTryoutRecordCommand(session, scope.scope, {
      workspaceRootId: typeof tryoutRecord.workspaceRootId === "string" ? tryoutRecord.workspaceRootId : null,
      expectedLockVersion: typeof tryoutRecord.expectedLockVersion === "number" ? tryoutRecord.expectedLockVersion : null,
      tryoutRecordId: asString(tryoutRecord.tryoutRecordId ?? tryoutRecord.id),
      athleteId: asString(tryoutRecord.athleteId),
      occurredAt: asString(tryoutRecord.occurredAt) || null,
      record: asObject(tryoutRecord.record) ?? tryoutRecord
    });

    return NextResponse.json(result);
  } catch (error) {
    const plannerError = getPlannerCommandError(error);
    return NextResponse.json({ error: plannerError.message, code: plannerError.code }, { status: plannerError.code ? 409 : 500 });
  }
}
