import { NextRequest, NextResponse } from "next/server";

import { deriveRoutineItemsFromDocument, normalizeRoutineDocument } from "@/lib/services/planner-routine-builder";
import { getPlannerScopeContext, requirePlannerSession, canEditTeamForSession } from "@/lib/services/planner-api-access";
import { requireCheerPlannerPremium } from "@/lib/access/membership";
import { getPlannerCommandError, savePlannerRoutinePlanCommand } from "@/lib/services/planner-command-service";

type RoutinePlanPayload = {
  teamId?: string;
  status?: "draft" | "approved" | "archived";
  notes?: string;
  document?: unknown;
  scope?: "coach" | "gym";
};

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isRoutinePlanStatus(value: unknown): value is "draft" | "approved" | "archived" {
  return value === "draft" || value === "approved" || value === "archived";
}

export async function POST(request: NextRequest) {
  try {
    const { session, error } = await requirePlannerSession();

    if (error || !session) {
      return error!;
    }

    const payload = await request.json().catch(() => null) as RoutinePlanPayload | null;
    const scope = getPlannerScopeContext(request, session, payload?.scope ?? null);
    const premiumError = await requireCheerPlannerPremium(session, scope);

    if (premiumError) {
      return premiumError;
    }

    const teamId = asString(payload?.teamId);
    const notes = asString(payload?.notes);
    const status = isRoutinePlanStatus(payload?.status) ? payload.status : "draft";

    if (!teamId) {
      return NextResponse.json({ error: "A team id is required to save a routine plan." }, { status: 400 });
    }

    if (!(await canEditTeamForSession(teamId, session, scope))) {
      return NextResponse.json({ error: "You do not have access to edit this routine plan." }, { status: 403 });
    }

    const document = normalizeRoutineDocument(payload?.document as Parameters<typeof normalizeRoutineDocument>[0], "Untitled routine");
    const result = await savePlannerRoutinePlanCommand(session, scope.scope, {
      workspaceRootId: typeof (payload as Record<string, unknown> | null)?.workspaceRootId === "string"
        ? (payload as Record<string, unknown>).workspaceRootId as string
        : null,
      expectedLockVersion: typeof (payload as Record<string, unknown> | null)?.expectedLockVersion === "number"
        ? (payload as Record<string, unknown>).expectedLockVersion as number
        : null,
      teamId,
      status,
      notes,
      document: document as Record<string, unknown>
    });

    return NextResponse.json({
      routinePlan: {
        ...result.entity,
        items: deriveRoutineItemsFromDocument(result.entity.document ?? document)
      },
      lockVersion: result.lockVersion,
      changeSetId: result.changeSetId,
      latestVersionNumber: result.latestVersionNumber
    });
  } catch (error) {
    const plannerError = getPlannerCommandError(error);
    return NextResponse.json({ error: plannerError.message, code: plannerError.code }, { status: plannerError.code ? 409 : 500 });
  }
}

