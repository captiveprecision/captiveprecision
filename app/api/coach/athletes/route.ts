import { NextRequest, NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AthleteParentContact } from "@/lib/domain/athlete";

type AthletePayload = {
  athleteId?: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  registrationNumber?: string;
  notes?: string;
  parentContacts?: AthleteParentContact[];
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

async function saveAthlete(request: NextRequest) {
  try {
    const session = await getAuthSession();

    if (!session || !session.roles.includes("coach")) {
      return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
    }

    const payload = await request.json().catch(() => null) as AthletePayload | null;
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
    const nextAthleteId = athleteId || crypto.randomUUID();
    const metadata = {
      registrationNumber,
      notes,
      parentContacts,
      createdByProfileId: session.userId
    };

    const { error } = await admin
      .from("athletes" as never)
      .upsert({
        id: nextAthleteId,
        gym_id: session.primaryGymId,
        first_name: firstName,
        last_name: lastName,
        birth_date: dateOfBirth || null,
        metadata
      } as never, { onConflict: "id" as never });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ athleteId: nextAthleteId });
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
