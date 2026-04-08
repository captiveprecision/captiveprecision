import { NextRequest, NextResponse } from "next/server";

import type { AthleteParentContact } from "@/lib/domain/athlete";
import { buildPlannerAthleteFromRow } from "@/lib/services/planner-supabase-foundation";
import { getEditableAthleteRow, getPlannerScopeContext, requirePlannerSession } from "@/lib/services/planner-api-access";
import { isUuidString, type PlannerWorkspaceScope } from "@/lib/services/planner-workspace";
import { createAdminClient } from "@/lib/supabase/admin";

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
  scope: ReturnType<typeof getPlannerScopeContext>,
  userId: string
) {
  if (!registrationNumber) {
    return null;
  }

  const admin = createAdminClient();
  let query = admin
    .from("athletes" as never)
    .select("*" as never)
    .eq("registration_number", registrationNumber as never)
    .limit(1);

  if (scope.scopeType === "gym") {
    query = query.eq("gym_id", (scope.gymId ?? null) as never);
  } else {
    query = query.eq("created_by_profile_id", userId as never);
  }

  const { data } = await query.maybeSingle();
  return data as Awaited<ReturnType<typeof getEditableAthleteRow>>;
}

async function saveAthlete(request: NextRequest) {
  try {
    const { session, error } = await requirePlannerSession();

    if (error || !session) {
      return error!;
    }

    const payload = await request.json().catch(() => null) as AthletePayload | null;
    const scope = getPlannerScopeContext(request, session, payload?.scope ?? null);
    const firstName = asString(payload?.firstName);
    const lastName = asString(payload?.lastName);
    const athleteId = asString(payload?.athleteId);
    const registrationNumber = asString(payload?.registrationNumber);
    const notes = asString(payload?.notes);
    const dateOfBirth = asString(payload?.dateOfBirth);
    const parentContacts = normalizeParentContacts(payload?.parentContacts);

    if (!firstName || !lastName) {
      return NextResponse.json({ error: "First name and last name are required." }, { status: 400 });
    }

    const admin = createAdminClient();
    const editableAthlete = isUuidString(athleteId)
      ? await getEditableAthleteRow(athleteId, session, scope)
      : null;

    if (athleteId && isUuidString(athleteId) && !editableAthlete) {
      return NextResponse.json({ error: "You do not have access to edit this athlete." }, { status: 403 });
    }

    const matchedAthlete = editableAthlete ?? await findExistingAthleteByRegistration(registrationNumber, scope, session.userId);
    const persistencePayload = {
      gym_id: scope.scopeType === "gym" ? (scope.gymId ?? session.primaryGymId ?? null) : null,
      created_by_profile_id: session.userId,
      first_name: firstName,
      last_name: lastName,
      birth_date: dateOfBirth || null,
      registration_number: registrationNumber || null,
      notes,
      parent_contacts: parentContacts,
      metadata: {
        registrationNumber,
        notes,
        parentContacts,
        createdByProfileId: session.userId
      }
    };

    const query = matchedAthlete
      ? admin
          .from("athletes" as never)
          .update(persistencePayload as never)
          .eq("id", matchedAthlete.id as never)
          .select("*" as never)
          .single()
      : admin
          .from("athletes" as never)
          .insert(persistencePayload as never)
          .select("*" as never)
          .single();

    const { data, error: writeError } = await query;

    if (writeError || !data) {
      if (writeError?.code === "42703" || writeError?.code === "42P01") {
        return NextResponse.json({ error: "Supabase athlete columns are missing. Run migration 006_planner_remote_persistence.sql first." }, { status: 409 });
      }

      return NextResponse.json({ error: writeError?.message ?? "Unable to save athlete." }, { status: 500 });
    }

    const athlete = buildPlannerAthleteFromRow(data, scope.workspaceId);
    return NextResponse.json({ athleteId: athlete.id, athlete });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save athlete.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return saveAthlete(request);
}

export async function PATCH(request: NextRequest) {
  return saveAthlete(request);
}
