import { NextRequest, NextResponse } from "next/server";

import { requireCheerPlannerPremium } from "@/lib/access/membership";
import { getPlannerScopeContext, requirePlannerSession } from "@/lib/services/planner-api-access";
import { getPlannerCommandError, savePlannerTeamCommand } from "@/lib/services/planner-command-service";

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

    const result = await savePlannerTeamCommand(session, scope.scope, {
      workspaceRootId: typeof payload?.workspaceRootId === "string" ? payload.workspaceRootId : null,
      expectedLockVersion: typeof payload?.expectedLockVersion === "number" ? payload.expectedLockVersion : null,
      teamId: asString(payload?.teamId) || null,
      name: asString(payload?.name),
      teamLevel: asString(payload?.teamLevel),
      teamType: asString(payload?.teamType),
      teamDivision: asString(payload?.teamDivision),
      trainingDays: asString(payload?.trainingDays),
      trainingHours: asString(payload?.trainingHours),
      linkedCoachIds: asStringArray(payload?.linkedCoachIds),
      assignedCoachNames: asStringArray(payload?.assignedCoachNames)
    });

    return NextResponse.json(result);
  } catch (error) {
    const plannerError = getPlannerCommandError(error);
    return NextResponse.json({ error: plannerError.message, code: plannerError.code }, { status: plannerError.code ? 409 : 500 });
  }
}
