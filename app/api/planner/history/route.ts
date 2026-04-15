import { NextRequest, NextResponse } from "next/server";

import { getPlannerScopeContext, requirePlannerSession } from "@/lib/services/planner-api-access";
import { listPlannerHistory } from "@/lib/services/planner-command-service";

function parseLimit(value: string | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 100) : 50;
}

export async function GET(request: NextRequest) {
  try {
    const { session, error } = await requirePlannerSession();

    if (error || !session) {
      return error!;
    }

    const scope = getPlannerScopeContext(request, session);
    const result = await listPlannerHistory(session, scope.scope, {
      workspaceRootId: request.nextUrl.searchParams.get("workspaceRootId"),
      entityType: request.nextUrl.searchParams.get("entityType"),
      entityId: request.nextUrl.searchParams.get("entityId"),
      limit: parseLimit(request.nextUrl.searchParams.get("limit"))
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load planner history.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
