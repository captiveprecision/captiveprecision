import { NextRequest, NextResponse } from "next/server";

import type { AthleteParentContact } from "@/lib/domain/athlete";
import { getPlannerScopeContext, requirePlannerSession } from "@/lib/services/planner-api-access";
import { requireCheerPlannerPremium } from "@/lib/access/membership";
import { isUuidString, type PlannerWorkspaceScope } from "@/lib/services/planner-workspace";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerCommandError, resolveWorkspaceRoot, savePlannerAthleteCommand } from "@/lib/services/planner-command-service";

type AthletePayload = {
  athleteId?: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  registrationNumber?: string;
  notes?: string;
  parentContacts?: AthleteParentContact[];
  scope?: PlannerWorkspaceScope;
};

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeParentContacts(value: unknown): AthleteParentContact[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((contact, index) => {
    if (!contact || typeof contact !== "object" || Array.isArray(contact)) {
      return [];
    }

    const row = contact as Record<string, unknown>;

    return [{
      id: asString(row.id) || `parent-contact-${index + 1}`,
      name: asString(row.name),
      email: asString(row.email),
      phone: asString(row.phone)
    }];
  });
}

async function findExistingAthleteByRegistration(
  registrationNumber: string,
  workspaceRootId: string
) {
  if (!registrationNumber) {
    return null;
  }

  const admin = createAdminClient();
  const query = admin
    .from("athletes" as never)
    .select("*" as never)
    .eq("registration_number", registrationNumber as never)
    .eq("workspace_root_id", workspaceRootId as never)
    .is("deleted_at" as never, null)
    .limit(1);

  const { data } = await query.maybeSingle();
  return data as { id: string } | null;
}

async function saveAthlete(request: NextRequest) {
  try {
    const { session, error } = await requirePlannerSession();

    if (error || !session) {
      return error!;
    }

    const payload = await request.json().catch(() => null) as AthletePayload | null;
    const scope = getPlannerScopeContext(request, session, payload?.scope ?? null);
    const premiumError = await requireCheerPlannerPremium(session, scope);

    if (premiumError) {
      return premiumError;
    }
    const firstName = asString(payload?.firstName);
    const lastName = asString(payload?.lastName);
    const athleteId = asString(payload?.athleteId);
    const registrationNumber = asString(payload?.registrationNumber);
    const notes = asString(payload?.notes);
    const dateOfBirth = asString(payload?.dateOfBirth);
    const parentContacts = normalizeParentContacts(payload?.parentContacts);
    const workspaceRoot = await resolveWorkspaceRoot(session, scope.scope);

    if (!firstName || !lastName) {
      return NextResponse.json({ error: "First name and last name are required." }, { status: 400 });
    }
    const matchedAthlete = !athleteId
      ? await findExistingAthleteByRegistration(registrationNumber, workspaceRoot.id)
      : null;
    const result = await savePlannerAthleteCommand(session, scope.scope, {
      workspaceRootId: workspaceRoot.id,
      expectedLockVersion: typeof (payload as Record<string, unknown> | null)?.expectedLockVersion === "number"
        ? (payload as Record<string, unknown>).expectedLockVersion as number
        : null,
      athleteId: isUuidString(athleteId) ? athleteId : matchedAthlete?.id ?? null,
      firstName,
      lastName,
      dateOfBirth,
      registrationNumber,
      notes,
      parentContacts
    });

    return NextResponse.json({
      athleteId: result.entity.id,
      athlete: result.entity,
      lockVersion: result.lockVersion,
      changeSetId: result.changeSetId,
      latestVersionNumber: result.latestVersionNumber
    });
  } catch (error) {
    const plannerError = getPlannerCommandError(error);
    return NextResponse.json({ error: plannerError.message, code: plannerError.code }, { status: plannerError.code ? 409 : 500 });
  }
}

export async function POST(request: NextRequest) {
  return saveAthlete(request);
}

export async function PATCH(request: NextRequest) {
  return saveAthlete(request);
}

