import { NextRequest, NextResponse } from "next/server";

import { requireCheerPlannerPremium } from "@/lib/access/membership";
import { findDuplicateAthleteRegistrationNumberByWorkspaceRoot } from "@/lib/services/athlete-registration-numbers";
import { canAdministerPlannerGymScope, getPlannerScopeContext, requirePlannerSession } from "@/lib/services/planner-api-access";
import { getPlannerCommandError, resolveWorkspaceRoot, savePlannerAthleteCommand } from "@/lib/services/planner-command-service";
import { createAdminClient } from "@/lib/supabase/admin";

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

    if (!(await canAdministerPlannerGymScope(session, scope))) {
      return NextResponse.json({ error: "Only the Gym owner or Program Director can manage Gym athlete records." }, { status: 403 });
    }

    const workspaceRoot = await resolveWorkspaceRoot(session, scope.scope, typeof payload?.workspaceRootId === "string" ? payload.workspaceRootId : null);
    const athleteId = asString(payload?.athleteId) || null;
    const registrationNumber = asString(payload?.registrationNumber);
    const duplicateRegistration = await findDuplicateAthleteRegistrationNumberByWorkspaceRoot(
      createAdminClient(),
      workspaceRoot.id,
      registrationNumber,
      athleteId
    );

    if (duplicateRegistration) {
      return NextResponse.json({
        error: "That registration number is already assigned to another athlete."
      }, { status: 409 });
    }

    const result = await savePlannerAthleteCommand(session, scope.scope, {
      workspaceRootId: workspaceRoot.id,
      expectedLockVersion: typeof payload?.expectedLockVersion === "number" ? payload.expectedLockVersion : null,
      athleteId,
      firstName: asString(payload?.firstName),
      lastName: asString(payload?.lastName),
      dateOfBirth: asString(payload?.dateOfBirth),
      registrationNumber,
      notes: asString(payload?.notes),
      parentContacts: Array.isArray(payload?.parentContacts) ? payload?.parentContacts : []
    });

    return NextResponse.json(result);
  } catch (error) {
    const plannerError = getPlannerCommandError(error);
    return NextResponse.json({ error: plannerError.message, code: plannerError.code }, { status: plannerError.code ? 409 : 500 });
  }
}
