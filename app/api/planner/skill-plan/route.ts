import { NextRequest, NextResponse } from "next/server";

import { canEditPlanningTeamForAccess, getPlannerAccessContext, plannerAccessForbidden, requirePlannerSession } from "@/lib/services/planner-api-access";
import { requireCheerPlannerPremium } from "@/lib/access/membership";
import type { TeamSkillPlan, TeamSkillPlanStatus } from "@/lib/domain/skill-plan";
import { getPlannerCommandError, savePlannerSkillPlanCommand } from "@/lib/services/planner-command-service";

type SkillPlanPayload = {
  teamId?: string;
  status?: TeamSkillPlan["status"];
  notes?: string;
  selections?: unknown;
  scope?: "coach" | "gym";
};

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isPlanStatus(value: unknown): value is TeamSkillPlan["status"] {
  return value === "draft" || value === "approved" || value === "archived";
}

export async function POST(request: NextRequest) {
  try {
    const { session, error } = await requirePlannerSession();

    if (error || !session) {
      return error!;
    }

    const payload = await request.json().catch(() => null) as SkillPlanPayload | null;
    const access = await getPlannerAccessContext(request, session, payload?.scope ?? null);
    const premiumError = await requireCheerPlannerPremium(session, access.scopeContext);

    if (premiumError) {
      return premiumError;
    }

    const teamId = asString(payload?.teamId);
    const notes = asString(payload?.notes);
    const status = isPlanStatus(payload?.status) ? payload.status : "draft";
    const selections = Array.isArray(payload?.selections) ? payload.selections : [];

    if (!teamId) {
      return NextResponse.json({ error: "A team id is required to save a skill plan." }, { status: 400 });
    }

    if (!access.canEditSkillPlanner || !canEditPlanningTeamForAccess(access, teamId)) {
      return plannerAccessForbidden("You do not have access to edit this skill plan.");
    }
    const result = await savePlannerSkillPlanCommand(session, access.dataScope, {
      workspaceRootId: typeof (payload as Record<string, unknown> | null)?.workspaceRootId === "string"
        ? (payload as Record<string, unknown>).workspaceRootId as string
        : null,
      expectedLockVersion: typeof (payload as Record<string, unknown> | null)?.expectedLockVersion === "number"
        ? (payload as Record<string, unknown>).expectedLockVersion as number
        : null,
      teamId,
      status,
      notes,
      selections
    });

    return NextResponse.json({
      skillPlan: result.entity,
      lockVersion: result.lockVersion,
      changeSetId: result.changeSetId,
      latestVersionNumber: result.latestVersionNumber
    });
  } catch (error) {
    const plannerError = getPlannerCommandError(error);
    return NextResponse.json({ error: plannerError.message, code: plannerError.code }, { status: plannerError.code ? 409 : 500 });
  }
}

