import { NextRequest, NextResponse } from "next/server";

import { getPlannerScopeContext, requirePlannerSession } from "@/lib/services/planner-api-access";
import { listPlannerTrash } from "@/lib/services/planner-command-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function parseLimit(value: string | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 200) : 100;
}

function parseEntityType(value: string | null) {
  return value === "athlete" || value === "team" ? value : null;
}

export async function GET(request: NextRequest) {
  try {
    const { session, error } = await requirePlannerSession();

    if (error || !session) {
      return error!;
    }

    const scope = getPlannerScopeContext(request, session);
    const result = await listPlannerTrash(session, scope.scope, {
      workspaceRootId: request.nextUrl.searchParams.get("workspaceRootId"),
      entityType: parseEntityType(request.nextUrl.searchParams.get("entityType")),
      search: request.nextUrl.searchParams.get("search"),
      limit: parseLimit(request.nextUrl.searchParams.get("limit"))
    });

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load planner trash.";
    return NextResponse.json({ error: message }, {
      status: 500,
      headers: {
        "Cache-Control": "no-store"
      }
    });
  }
}
