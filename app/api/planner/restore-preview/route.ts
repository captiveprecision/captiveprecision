import { NextRequest, NextResponse } from "next/server";

import { getPlannerAccessContext, plannerAccessForbidden, requirePlannerSession } from "@/lib/services/planner-api-access";
import { getPlannerCommandError, getPlannerRestorePreview } from "@/lib/services/planner-command-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getPlannerStatusCode(code: string | null) {
  switch (code) {
    case "WORKSPACE_ACCESS_DENIED":
      return 403;
    case "WORKSPACE_ROOT_NOT_FOUND":
    case "VERSION_NOT_FOUND":
      return 404;
    case "RESTORE_NOT_AVAILABLE":
    case "RESTORE_EXPIRED":
      return 410;
    default:
      return code ? 409 : 500;
  }
}

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

    const access = await getPlannerAccessContext(request, session);

    if (!access.canRestoreTrash) {
      return plannerAccessForbidden("Only Gym administrators can preview shared planner restore actions.");
    }

    const result = await getPlannerRestorePreview(session, access.dataScope, {
      workspaceRootId: request.nextUrl.searchParams.get("workspaceRootId"),
      entityType,
      versionId
    });

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    const plannerError = getPlannerCommandError(error);
    return NextResponse.json(
      { error: plannerError.message, code: plannerError.code },
      {
        status: getPlannerStatusCode(plannerError.code),
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  }
}
