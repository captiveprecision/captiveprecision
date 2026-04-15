import { NextRequest, NextResponse } from "next/server";

import { requireCheerPlannerPremium } from "@/lib/access/membership";
import { getPlannerScopeContext, requirePlannerSession } from "@/lib/services/planner-api-access";
import { getPlannerCommandError, resolveWorkspaceRoot, savePlannerAthleteCommand } from "@/lib/services/planner-command-service";

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

    const workspaceRoot = await resolveWorkspaceRoot(session, scope.scope, typeof payload?.workspaceRootId === "string" ? payload.workspaceRootId : null);
    const result = await savePlannerAthleteCommand(session, scope.scope, {
      workspaceRootId: workspaceRoot.id,
      expectedLockVersion: typeof payload?.expectedLockVersion === "number" ? payload.expectedLockVersion : null,
      athleteId: asString(payload?.athleteId) || null,
      firstName: asString(payload?.firstName),
      lastName: asString(payload?.lastName),
      dateOfBirth: asString(payload?.dateOfBirth),
      registrationNumber: asString(payload?.registrationNumber),
      notes: asString(payload?.notes),
      parentContacts: Array.isArray(payload?.parentContacts) ? payload?.parentContacts : []
    });

    return NextResponse.json(result);
  } catch (error) {
    const plannerError = getPlannerCommandError(error);
    return NextResponse.json({ error: plannerError.message, code: plannerError.code }, { status: plannerError.code ? 409 : 500 });
  }
}
