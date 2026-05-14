import { NextRequest, NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth/session";
import { getServerEnv } from "@/lib/config/env";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/types/database";

export const dynamic = "force-dynamic";

type StaffSeatRole = "coach" | "staff" | "assistant";
type GymRow = Pick<Database["public"]["Tables"]["gyms"]["Row"], "id" | "name" | "owner_profile_id">;
type ProfileRow = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "id" | "email" | "display_name" | "role" | "beta_access_status" | "primary_gym_id" | "membership_type" | "gym_name"
>;
type LicenseRow = Pick<Database["public"]["Tables"]["gym_coach_licenses"]["Row"], "id" | "status" | "seat_role">;

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSeatRole(value: unknown): StaffSeatRole | null {
  return value === "coach" || value === "staff" || value === "assistant" ? value : null;
}

function isAlreadyRegisteredError(message: string) {
  return /already registered|already exists|already been registered|user already/i.test(message);
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function defaultDisplayName(email: string) {
  return email.split("@")[0] || "Invited staff";
}

function toSlug(value: string, fallback: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || fallback;
}

async function ensureGymForSession(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  primaryGymId: string | null,
  fallbackName: string
) {
  if (primaryGymId) {
    const { data, error } = await admin
      .from("gyms" as never)
      .select("id, name, owner_profile_id" as never)
      .eq("id", primaryGymId as never)
      .maybeSingle();

    if (error) {
      throw new Error("Unable to load Gym organization.");
    }

    const gym = data as GymRow | null;

    if (gym?.id) {
      return gym;
    }
  }

  const { data, error } = await admin
    .from("gyms" as never)
    .select("id, name, owner_profile_id" as never)
    .eq("owner_profile_id", userId as never)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to load Gym organization.");
  }

  const ownedGym = data as GymRow | null;

  if (ownedGym?.id) {
    return ownedGym;
  }

  const gymName = fallbackName || "Gym Organization";
  const slug = `${toSlug(gymName, `gym-${userId.slice(0, 8)}`)}-${userId.slice(0, 6)}`;
  const { data: createdGym, error: createError } = await admin
    .from("gyms" as never)
    .insert({
      owner_profile_id: userId,
      name: gymName,
      slug,
      metadata: {
        source: "gym-staff-invite",
        createdByProfileId: userId
      }
    } as never)
    .select("id, name, owner_profile_id" as never)
    .single();

  if (createError) {
    throw new Error("Unable to create Gym organization.");
  }

  return createdGym as GymRow;
}

async function findProfileByEmail(admin: ReturnType<typeof createAdminClient>, email: string) {
  const { data, error } = await admin
    .from("profiles" as never)
    .select("id, email, display_name, role, beta_access_status, primary_gym_id, membership_type, gym_name" as never)
    .eq("email", email as never)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to search profiles.");
  }

  return data as ProfileRow | null;
}

async function findLicense(admin: ReturnType<typeof createAdminClient>, gymId: string, profileId: string) {
  const { data, error } = await admin
    .from("gym_coach_licenses" as never)
    .select("id, status, seat_role" as never)
    .eq("gym_id", gymId as never)
    .eq("coach_profile_id", profileId as never)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to check existing Gym access.");
  }

  return data as LicenseRow | null;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();

    if (!session?.roles.includes("gym")) {
      return NextResponse.json({ error: "Gym access is required." }, { status: 403 });
    }

    const email = normalizeEmail(request.nextUrl.searchParams.get("email"));

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: "A valid email address is required." }, { status: 400 });
    }

    const admin = createAdminClient();
    const gym = await ensureGymForSession(admin, session.userId, session.primaryGymId, session.primaryGymName ?? session.displayName);

    const profile = await findProfileByEmail(admin, email);

    if (!profile?.id) {
      return NextResponse.json({ profile: null });
    }

    const license = await findLicense(admin, gym.id, profile.id);

    return NextResponse.json({
      profile: {
        id: profile.id,
        email: profile.email ?? email,
        displayName: profile.display_name || profile.email || defaultDisplayName(email),
        role: profile.role,
        alreadyLinked: Boolean(license?.id)
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected staff lookup failure.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();

    if (!session?.roles.includes("gym")) {
      return NextResponse.json({ error: "Gym access is required." }, { status: 403 });
    }

    const payload = await request.json().catch(() => null);
    const email = normalizeEmail(payload?.email);
    const displayName = normalizeText(payload?.displayName) || defaultDisplayName(email);
    const seatRole = normalizeSeatRole(payload?.seatRole);
    const profileId = normalizeText(payload?.profileId);

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: "A valid email address is required." }, { status: 400 });
    }

    if (!seatRole) {
      return NextResponse.json({ error: "A valid staff role is required." }, { status: 400 });
    }

    const admin = createAdminClient();
    const gym = await ensureGymForSession(admin, session.userId, session.primaryGymId, session.primaryGymName ?? session.displayName);

    const reviewedAt = new Date().toISOString();
    let profile = await findProfileByEmail(admin, email);
    let accountId = profile?.id ?? null;
    let invitationSent = false;

    if (profileId && profile?.id !== profileId) {
      return NextResponse.json({ error: "The selected profile does not match this email." }, { status: 409 });
    }

    if (!accountId) {
      const env = getServerEnv();
      const inviteResult = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/activate`,
        data: {
          display_name: displayName,
          role: "coach",
          invited_by_profile_id: session.userId,
          primary_gym_id: gym.id,
          gym_name: gym.name,
          seat_role: seatRole
        }
      });

      if (inviteResult.error) {
        if (!isAlreadyRegisteredError(inviteResult.error.message)) {
          return NextResponse.json({ error: inviteResult.error.message }, { status: 400 });
        }

        profile = await findProfileByEmail(admin, email);
        accountId = profile?.id ?? null;
      } else {
        accountId = inviteResult.data?.user?.id ?? null;
        invitationSent = true;
      }
    }

    if (!accountId) {
      return NextResponse.json({ error: "Unable to create or locate this account." }, { status: 500 });
    }

    const profileRole = profile?.role === "admin" || profile?.role === "gym" ? profile.role : "coach";

    const profileUpdate: Database["public"]["Tables"]["profiles"]["Insert"] = {
      id: accountId,
      email,
      display_name: displayName,
      role: profileRole,
      beta_access_status: "approved",
      beta_requested_at: profile?.beta_access_status ? undefined : reviewedAt,
      beta_reviewed_at: reviewedAt,
      beta_reviewed_by: session.userId,
      membership_type: profileRole === "coach" ? "gym_assigned" : profile?.membership_type ?? "independent",
      primary_gym_id: gym.id,
      gym_name: gym.name
    };

    const { error: profileError } = await admin
      .from("profiles" as never)
      .upsert(profileUpdate as never, { onConflict: "id" });

    if (profileError) {
      return NextResponse.json({ error: "Account was found, but the profile could not be updated." }, { status: 500 });
    }

    const { error: licenseError } = await admin
      .from("gym_coach_licenses" as never)
      .upsert({
        gym_id: gym.id,
        coach_profile_id: accountId,
        status: "active",
        license_seat_name: displayName,
        seat_role: seatRole,
        invited_by_profile_id: session.userId
      } as never, { onConflict: "gym_id,coach_profile_id" });

    if (licenseError) {
      return NextResponse.json({ error: "Profile was updated, but Gym access could not be assigned." }, { status: 500 });
    }

    return NextResponse.json({
      accountId,
      email,
      displayName,
      seatRole,
      invitationSent,
      message: invitationSent
        ? "Invitation sent and Gym access configured."
        : "Existing account linked to this Gym."
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected staff invitation failure.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
