import { NextRequest, NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth/session";
import { getServerEnv } from "@/lib/config/env";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/types/database";

export const dynamic = "force-dynamic";

type AccountRole = "coach" | "gym" | "admin";
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type GymRow = Database["public"]["Tables"]["gyms"]["Row"];
type MembershipPlanRow = Database["public"]["Tables"]["membership_plans"]["Row"];

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeRole(value: unknown): AccountRole | null {
  return value === "coach" || value === "gym" || value === "admin" ? value : null;
}

function toSlug(value: string, fallback: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || fallback;
}

function isAlreadyRegisteredError(message: string) {
  return /already registered|already exists|already been registered|user already/i.test(message);
}

async function findProfileByEmail(admin: ReturnType<typeof createAdminClient>, email: string) {
  const { data } = await admin
    .from("profiles" as never)
    .select("id, email, display_name, role, beta_access_status, primary_gym_id, membership_type, gym_name" as never)
    .eq("email", email as never)
    .maybeSingle();

  return data as Pick<
    ProfileRow,
    "id" | "email" | "display_name" | "role" | "beta_access_status" | "primary_gym_id" | "membership_type" | "gym_name"
  > | null;
}

async function getPremiumPlanId(admin: ReturnType<typeof createAdminClient>) {
  const { data, error } = await admin
    .from("membership_plans" as never)
    .select("id, code, active" as never)
    .eq("code", "premium" as never)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to load Premium plan.");
  }

  const plan = data as Pick<MembershipPlanRow, "id" | "code" | "active"> | null;
  return plan?.id ?? null;
}

async function ensureGymForOwner(
  admin: ReturnType<typeof createAdminClient>,
  ownerProfileId: string,
  gymName: string,
  metadata: Record<string, unknown>
) {
  const { data: existingData, error: existingError } = await admin
    .from("gyms" as never)
    .select("id, name, slug, owner_profile_id, metadata" as never)
    .eq("owner_profile_id", ownerProfileId as never)
    .maybeSingle();

  if (existingError) {
    throw new Error("Unable to check existing Gym organization.");
  }

  const existing = existingData as Pick<GymRow, "id" | "name" | "slug" | "owner_profile_id" | "metadata"> | null;

  if (existing?.id) {
    const { data, error } = await admin
      .from("gyms" as never)
      .update({
        name: gymName,
        metadata: {
          ...(typeof existing.metadata === "object" && existing.metadata !== null && !Array.isArray(existing.metadata) ? existing.metadata : {}),
          ...metadata
        }
      } as never)
      .eq("id", existing.id as never)
      .select("id, name, slug, owner_profile_id" as never)
      .single();

    if (error) {
      throw new Error("Unable to update Gym organization.");
    }

    return data as Pick<GymRow, "id" | "name" | "slug" | "owner_profile_id">;
  }

  const fallbackSlug = `gym-${ownerProfileId.slice(0, 8)}`;
  const slug = `${toSlug(gymName, fallbackSlug)}-${ownerProfileId.slice(0, 6)}`;
  const { data, error } = await admin
    .from("gyms" as never)
    .insert({
      owner_profile_id: ownerProfileId,
      name: gymName,
      slug,
      metadata
    } as never)
    .select("id, name, slug, owner_profile_id" as never)
    .single();

  if (error) {
    throw new Error("Unable to create Gym organization.");
  }

  return data as Pick<GymRow, "id" | "name" | "slug" | "owner_profile_id">;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();

    if (!session?.roles.includes("admin")) {
      return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
    }
    const payload = await request.json().catch(() => null);
    const email = normalizeEmail(payload?.email);
    const displayName = normalizeText(payload?.displayName) || email.split("@")[0] || "Invited account";
    const role = normalizeRole(payload?.role);
    const manualPremium = Boolean(payload?.manualPremium);
    const gymId = normalizeText(payload?.gymId);
    const gymName = normalizeText(payload?.gymName);
    const internalLabel = normalizeText(payload?.internalLabel);
    const notes = normalizeText(payload?.notes);

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "A valid email address is required." }, { status: 400 });
    }

    if (!role) {
      return NextResponse.json({ error: "A valid account role is required." }, { status: 400 });
    }

    if (role === "gym" && !gymName) {
      return NextResponse.json({ error: "Gym organization name is required for Gym accounts." }, { status: 400 });
    }

    const admin = createAdminClient();
    const env = getServerEnv();
    const reviewedAt = new Date().toISOString();
    const invitationMetadata = {
      display_name: displayName,
      role,
      invited_by_profile_id: session.userId,
      manual_premium_requested: manualPremium,
      internal_label: internalLabel || null
    };

    const inviteResult = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/activate`,
      data: invitationMetadata
    });

    let userId = inviteResult.data?.user?.id ?? null;
    let invitationSent = true;

    if (inviteResult.error) {
      if (!isAlreadyRegisteredError(inviteResult.error.message)) {
        return NextResponse.json({ error: inviteResult.error.message }, { status: 400 });
      }

      const existingProfile = await findProfileByEmail(admin, email);
      if (!existingProfile?.id) {
        return NextResponse.json(
          { error: "This email already exists in Supabase Auth, but no profile was found to update." },
          { status: 409 }
        );
      }

      userId = existingProfile.id;
      invitationSent = false;
    }

    if (!userId) {
      return NextResponse.json({ error: "Unable to create or locate the invited user." }, { status: 500 });
    }

    const profileUpdate: Database["public"]["Tables"]["profiles"]["Insert"] = {
      id: userId,
      email,
      display_name: displayName,
      role,
      beta_access_status: "approved",
      beta_requested_at: reviewedAt,
      beta_reviewed_at: reviewedAt,
      beta_reviewed_by: session.userId,
      membership_type: role === "coach" && gymId ? "gym_assigned" : "independent",
      primary_gym_id: role === "coach" && gymId ? gymId : null,
      gym_name: null
    };

    let linkedGym: Pick<GymRow, "id" | "name" | "slug" | "owner_profile_id"> | null = null;

    if (role === "coach" && gymId) {
      const { data: gymData, error: gymError } = await admin
        .from("gyms" as never)
        .select("id, name, slug, owner_profile_id" as never)
        .eq("id", gymId as never)
        .maybeSingle();

      if (gymError || !gymData) {
        return NextResponse.json({ error: "Selected Gym organization was not found." }, { status: 404 });
      }

      linkedGym = gymData as Pick<GymRow, "id" | "name" | "slug" | "owner_profile_id">;
      profileUpdate.gym_name = linkedGym.name;
    }

    if (role === "gym") {
      linkedGym = await ensureGymForOwner(admin, userId, gymName, {
        invitedByProfileId: session.userId,
        internalLabel: internalLabel || null,
        notes: notes || null,
        source: "admin-account-invite"
      });
      profileUpdate.primary_gym_id = linkedGym.id;
      profileUpdate.gym_name = linkedGym.name;
    }

    const { error: profileError } = await admin
      .from("profiles" as never)
      .upsert(profileUpdate as never, { onConflict: "id" });

    if (profileError) {
      return NextResponse.json({ error: "Invitation was created, but the profile could not be updated." }, { status: 500 });
    }

    if (role === "coach" && linkedGym?.id) {
      const { error: licenseError } = await admin
        .from("gym_coach_licenses" as never)
        .upsert({
          gym_id: linkedGym.id,
          coach_profile_id: userId,
          status: "active",
          license_seat_name: displayName
        } as never, { onConflict: "gym_id,coach_profile_id" });

      if (licenseError) {
        return NextResponse.json({ error: "Profile was updated, but the Gym coach license could not be assigned." }, { status: 500 });
      }

      await admin.rpc("planner_adopt_coach_workspace_into_gym" as never, {
        p_coach_profile_id: userId,
        p_gym_id: linkedGym.id
      } as never);
    }

    if (manualPremium) {
      const premiumPlanId = await getPremiumPlanId(admin);

      if (!premiumPlanId) {
        return NextResponse.json({ error: "Premium plan is not configured." }, { status: 500 });
      }

      const { error: membershipError } = await admin
        .from("user_memberships" as never)
        .upsert({
          user_id: userId,
          membership_plan_id: premiumPlanId,
          provider: "manual",
          provider_membership_id: `manual:${userId}:premium`,
          status: "active",
          current_period_start: reviewedAt,
          current_period_end: null,
          cancel_at_period_end: false,
          metadata: {
            grantedByProfileId: session.userId,
            source: "admin-account-invite",
            internalLabel: internalLabel || null,
            notes: notes || null
          }
        } as never, { onConflict: "provider_membership_id" });

      if (membershipError) {
        return NextResponse.json({ error: "Profile was updated, but manual Premium could not be granted." }, { status: 500 });
      }
    }

    return NextResponse.json({
      accountId: userId,
      invitationSent,
      message: invitationSent
        ? "Invitation sent and account access configured."
        : "Existing account found. Access was updated; no new invitation email was sent."
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected account invitation failure.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
