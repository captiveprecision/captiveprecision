import { NextRequest, NextResponse } from "next/server";

import { getPlannerAccessContext, plannerAccessForbidden, requirePlannerSession } from "@/lib/services/planner-api-access";
import { listPlannerBackups } from "@/lib/services/planner-command-service";

function parseLimit(value: string | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 50) : 20;
}

export async function GET(request: NextRequest) {
  try {
    const { session, error } = await requirePlannerSession();

    if (error || !session) {
      return error!;
    }

    const access = await getPlannerAccessContext(request, session);

    if (!access.canRestoreTrash) {
      return plannerAccessForbidden("Only Gym administrators can review planner backups.");
    }

    const result = await listPlannerBackups(session, access.dataScope, {
      workspaceRootId: request.nextUrl.searchParams.get("workspaceRootId"),
      limit: parseLimit(request.nextUrl.searchParams.get("limit"))
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load planner backups.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
