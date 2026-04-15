import { NextRequest, NextResponse } from "next/server";

import { getPlannerScopeContext, requirePlannerSession } from "@/lib/services/planner-api-access";
import { getPlannerRestorePreview } from "@/lib/services/planner-command-service";

export async function GET(request: NextRequest) {
  try {
    const { session, error } = await requirePlannerSession();

    if (error || !session) {
      return error!;
    }

    const entityType = request.nextUrl.searchParams.get("entityType");
    const versionId = request.nextUrl.searchParams.get("versionId");

    if (!entityType || !versionId) {
      return NextResponse.json({ error: "entityType and versionId are required." }, { status: 400 });
    }

    const scope = getPlannerScopeContext(request, session);
    const result = await getPlannerRestorePreview(session, scope.scope, {
      workspaceRootId: request.nextUrl.searchParams.get("workspaceRootId"),
      entityType,
      versionId
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load restore preview.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
