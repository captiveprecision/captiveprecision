import { NextRequest, NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth/session";
import { findDuplicateAthleteRegistrationNumberByIds } from "@/lib/services/athlete-registration-numbers";
import { canManageGymAdministration, resolveGymAccessContext } from "@/lib/services/gym-access";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/types/database";

export const dynamic = "force-dynamic";

type GymRow = Pick<Database["public"]["Tables"]["gyms"]["Row"], "id" | "owner_profile_id">;
type WorkspaceRootRow = {
  id: string;
  scope_type: "coach" | "gym";
  gym_id: string | null;
  owner_profile_id: string | null;
};
type GymLicenseProfileRow = Pick<Database["public"]["Tables"]["gym_coach_licenses"]["Row"], "coach_profile_id">;
type AthleteRow = Pick<Database["public"]["Tables"]["athletes"]["Row"], "id" | "metadata">;

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function normalizeParentContacts(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item, index) => {
    const row = asRecord(item);
    const name = normalizeText(row.name);
    const email = normalizeText(row.email);
    const phone = normalizeText(row.phone);

    return name || email || phone
      ? [{
        id: normalizeText(row.id) || `parent-${index + 1}`,
        name,
        email,
        phone
      }]
      : [];
  });
}

async function resolveGymAthleteIds(admin: ReturnType<typeof createAdminClient>, gym: GymRow) {
  const { data: licenseRows } = await admin
    .from("gym_coach_licenses" as never)
    .select("coach_profile_id" as never)
    .eq("gym_id", gym.id as never)
    .eq("status", "active" as never);
  const ownerProfileIds = Array.from(new Set([
    gym.owner_profile_id,
    ...((licenseRows ?? []) as GymLicenseProfileRow[]).map((row) => row.coach_profile_id)
  ].filter((value): value is string => Boolean(value))));
  const { data: gymRoots } = await admin
    .from("workspace_roots" as never)
    .select("id, scope_type, gym_id, owner_profile_id" as never)
    .eq("gym_id", gym.id as never);
  const { data: coachRoots } = ownerProfileIds.length
    ? await admin
      .from("workspace_roots" as never)
      .select("id, scope_type, gym_id, owner_profile_id" as never)
      .in("owner_profile_id", ownerProfileIds as never)
    : { data: [] as unknown[] };
  const relatedRootIds = ([...(gymRoots ?? []), ...(coachRoots ?? [])] as WorkspaceRootRow[])
    .filter((root) => (
      (root.scope_type === "gym" && root.gym_id === gym.id)
      || (root.scope_type === "coach" && typeof root.owner_profile_id === "string" && ownerProfileIds.includes(root.owner_profile_id))
    ))
    .map((root) => root.id);
  const { data: gymAthletes } = await admin
    .from("athletes" as never)
    .select("id" as never)
    .eq("gym_id", gym.id as never);
  const { data: rootAthletes } = relatedRootIds.length
    ? await admin
      .from("athletes" as never)
      .select("id" as never)
      .in("workspace_root_id", relatedRootIds as never)
    : { data: [] as unknown[] };

  return Array.from(new Set([
    ...((gymAthletes ?? []) as Array<{ id: string }>).map((athlete) => athlete.id),
    ...((rootAthletes ?? []) as Array<{ id: string }>).map((athlete) => athlete.id)
  ]));
}
export async function PATCH(request: NextRequest) {
  try {
    const session = await getAuthSession();

    if (!session?.roles.includes("gym")) {
      return NextResponse.json({ error: "Gym access is required." }, { status: 403 });
    }

    const access = await resolveGymAccessContext(session, { ensureOwnerSeat: true });

    if (!access || !canManageGymAdministration(access)) {
      return NextResponse.json({ error: "Program Director access is required." }, { status: 403 });
    }

    const payload = await request.json().catch(() => null);
    const athleteId = normalizeText(payload?.athleteId);
    const firstName = normalizeText(payload?.firstName);
    const lastName = normalizeText(payload?.lastName);
    const dateOfBirth = normalizeText(payload?.dateOfBirth);
    const registrationNumber = normalizeText(payload?.registrationNumber);
    const notes = normalizeText(payload?.notes);
    const parentContacts = normalizeParentContacts(payload?.parentContacts);

    if (!athleteId) {
      return NextResponse.json({ error: "Athlete id is required." }, { status: 400 });
    }

    if (!firstName || !lastName) {
      return NextResponse.json({ error: "Athlete first and last name are required." }, { status: 400 });
    }

    if (dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
      return NextResponse.json({ error: "A valid birth date is required." }, { status: 400 });
    }

    const admin = createAdminClient();
    const manageableAthleteIds = await resolveGymAthleteIds(admin, access.gym);

    if (!manageableAthleteIds.includes(athleteId)) {
      return NextResponse.json({ error: "Athlete was not found for this Gym." }, { status: 404 });
    }

    const duplicateRegistration = await findDuplicateAthleteRegistrationNumberByIds(
      admin,
      manageableAthleteIds,
      registrationNumber,
      athleteId
    );

    if (duplicateRegistration) {
      return NextResponse.json({
        error: "That registration number is already assigned to another athlete."
      }, { status: 409 });
    }

    const { data: currentAthlete } = await admin
      .from("athletes" as never)
      .select("id, metadata" as never)
      .eq("id", athleteId as never)
      .maybeSingle();
    const metadata = {
      ...asRecord((currentAthlete as AthleteRow | null)?.metadata),
      registrationNumber,
      notes,
      parentContacts
    };
    const { error } = await admin
      .from("athletes" as never)
      .update({
        first_name: firstName,
        last_name: lastName,
        birth_date: dateOfBirth || null,
        registration_number: registrationNumber || null,
        notes,
        parent_contacts: parentContacts,
        metadata
      } as never)
      .eq("id", athleteId as never);

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({
          error: "That registration number is already assigned to another athlete."
        }, { status: 409 });
      }

      return NextResponse.json({ error: "Unable to update athlete." }, { status: 500 });
    }

    return NextResponse.json({
      athleteId,
      message: "Athlete updated."
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Unexpected athlete update failure."
    }, { status: 500 });
  }
}
