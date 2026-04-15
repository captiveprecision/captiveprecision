import { NextRequest, NextResponse } from "next/server";

import { getPlannerScopeContext, requirePlannerSession, canEditTeamForSession } from "@/lib/services/planner-api-access";
import { requireCheerPlannerPremium } from "@/lib/access/membership";
import type { TeamSeasonPlan } from "@/lib/domain/season-plan";
import { getPlannerCommandError, savePlannerSeasonPlanCommand } from "@/lib/services/planner-command-service";

type SeasonPlanPayload = {
  teamId?: string;
  status?: TeamSeasonPlan["status"];
  notes?: string;
  checkpoints?: unknown;
  scope?: "coach" | "gym";
};

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isPlanStatus(value: unknown): value is TeamSeasonPlan["status"] {
  return value === "draft" || value === "approved" || value === "archived";
}

export async function POST(request: NextRequest) {
  try {
    const { session, error } = await requirePlannerSession();

    if (error || !session) {
      return error!;
    }

    const payload = await request.json().catch(() => null) as SeasonPlanPayload | null;
    const scope = getPlannerScopeContext(request, session, payload?.scope ?? null);
    const premiumError = await requireCheerPlannerPremium(session, scope);

    if (premiumError) {
      return premiumError;
    }

    const teamId = asString(payload?.teamId);
    const notes = asString(payload?.notes);
    const status = isPlanStatus(payload?.status) ? payload.status : "draft";
    const checkpoints = Array.isArray(payload?.checkpoints) ? payload.checkpoints : [];

    if (!teamId) {
      return NextResponse.json({ error: "A team id is required to save a season plan." }, { status: 400 });
    }

    if (!(await canEditTeamForSession(teamId, session, scope))) {
      return NextResponse.json({ error: "You do not have access to edit this season plan." }, { status: 403 });
    }
    const result = await savePlannerSeasonPlanCommand(session, scope.scope, {
      workspaceRootId: typeof (payload as Record<string, unknown> | null)?.workspaceRootId === "string"
        ? (payload as Record<string, unknown>).workspaceRootId as string
        : null,
      expectedLockVersion: typeof (payload as Record<string, unknown> | null)?.expectedLockVersion === "number"
        ? (payload as Record<string, unknown>).expectedLockVersion as number
        : null,
      teamId,
      status,
      notes,
      checkpoints
    });

    return NextResponse.json({
      seasonPlan: result.entity,
      lockVersion: result.lockVersion,
      changeSetId: result.changeSetId,
      latestVersionNumber: result.latestVersionNumber
    });
  } catch (error) {
    const plannerError = getPlannerCommandError(error);
    return NextResponse.json({ error: plannerError.message, code: plannerError.code }, { status: plannerError.code ? 409 : 500 });
  }
}

