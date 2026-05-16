import { NextRequest, NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/lib/types/database";

export const dynamic = "force-dynamic";

type AccountRole = "coach" | "gym" | "admin";
type AccessStatus = "approved" | "pending" | "rejected";
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type GymRow = Database["public"]["Tables"]["gyms"]["Row"];
type MembershipPlanRow = Database["public"]["Tables"]["membership_plans"]["Row"];

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeRole(value: unknown): AccountRole | null {
  return value === "coach" || value === "gym" || value === "admin" ? value : null;
}

function normalizeAccessStatus(value: unknown): AccessStatus | null {
  return value === "approved" || value === "pending" || value === "rejected" ? value : null;
}

function toSlug(value: string, fallback: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || fallback;
}

async function requireAdminSession() {
  const session = await getAuthSession();

  if (!session?.roles.includes("admin")) {
    return null;
  }

  return session;
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
  metadata: Record<string, Json>
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

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ accountId: string }> }
) {
  try {
    const session = await requireAdminSession();

    if (!session) {
      return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
    }

    const { accountId } = await context.params;
    const payload = await request.json().catch(() => null);
    const displayName = normalizeText(payload?.displayName);
    const role = normalizeRole(payload?.role);
    const accessStatus = normalizeAccessStatus(payload?.accessStatus);
    const gymId = normalizeText(payload?.gymId);
    const gymName = normalizeText(payload?.gymName);
    const manualPremium = Boolean(payload?.manualPremium);

    if (!displayName) {
      return NextResponse.json({ error: "Display name is required." }, { status: 400 });
    }

    if (!role) {
      return NextResponse.json({ error: "A valid account role is required." }, { status: 400 });
    }

    if (!accessStatus) {
      return NextResponse.json({ error: "A valid access status is required." }, { status: 400 });
    }

    if (role === "gym" && !gymName) {
      return NextResponse.json({ error: "Gym organization name is required for Gym accounts." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: existingProfileData, error: profileLookupError } = await admin
      .from("profiles" as never)
      .select("id, email, display_name, role, primary_gym_id, gym_name, membership_type" as never)
      .eq("id", accountId as never)
      .maybeSingle();

    if (profileLookupError) {
      return NextResponse.json({ error: "Unable to load account profile." }, { status: 500 });
    }

    const existingProfile = existingProfileData as Pick<
      ProfileRow,
      "id" | "email" | "display_name" | "role" | "primary_gym_id" | "gym_name" | "membership_type"
    > | null;

    if (!existingProfile?.id) {
      return NextResponse.json({ error: "Account was not found." }, { status: 404 });
    }

    let nextGymId: string | null = null;
    let nextGymName: string | null = null;
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
      nextGymId = linkedGym.id;
      nextGymName = linkedGym.name;
    }

    if (role === "gym") {
      linkedGym = await ensureGymForOwner(admin, accountId, gymName, {
        updatedByProfileId: session.userId,
        source: "admin-account-manage"
      });
      nextGymId = linkedGym.id;
      nextGymName = linkedGym.name;
    }

    const membershipType = role === "coach" && nextGymId ? "gym_assigned" : "independent";
    const profileUpdate: Database["public"]["Tables"]["profiles"]["Update"] = {
      display_name: displayName,
      role,
      beta_access_status: accessStatus,
      beta_reviewed_at: new Date().toISOString(),
      beta_reviewed_by: session.userId,
      primary_gym_id: nextGymId,
      gym_name: nextGymName,
      membership_type: membershipType
    };

    if (role === "admin") {
      profileUpdate.primary_gym_id = null;
      profileUpdate.gym_name = null;
    }

    const { error: profileUpdateError } = await admin
      .from("profiles" as never)
      .update(profileUpdate as never)
      .eq("id", accountId as never);

    if (profileUpdateError) {
      return NextResponse.json({ error: "Account profile could not be updated." }, { status: 500 });
    }

    await admin.auth.admin.updateUserById(accountId, {
      user_metadata: {
        display_name: displayName,
        role,
        primary_gym_id: nextGymId,
        gym_name: nextGymName
      }
    });

    const { error: deactivateLicensesError } = await admin
      .from("gym_coach_licenses" as never)
      .update({ status: "inactive" } as never)
      .eq("coach_profile_id", accountId as never);

    if (deactivateLicensesError) {
      return NextResponse.json({ error: "Account profile was updated, but Gym licenses could not be updated." }, { status: 500 });
    }

    if (role === "coach" && linkedGym?.id) {
      const { error: licenseError } = await admin
        .from("gym_coach_licenses" as never)
        .upsert({
          gym_id: linkedGym.id,
          coach_profile_id: accountId,
          status: "active",
          license_seat_name: displayName,
          seat_role: "coach",
          invited_by_profile_id: session.userId
        } as never, { onConflict: "gym_id,coach_profile_id" });

      if (licenseError) {
        return NextResponse.json({ error: "Account profile was updated, but Gym access could not be assigned." }, { status: 500 });
      }

      await admin.rpc("planner_adopt_coach_workspace_into_gym" as never, {
        p_coach_profile_id: accountId,
        p_gym_id: linkedGym.id
      } as never);
    }

    if (manualPremium) {
      const premiumPlanId = await getPremiumPlanId(admin);

      if (!premiumPlanId) {
        return NextResponse.json({ error: "Premium plan is not configured." }, { status: 500 });
      }

      const reviewedAt = new Date().toISOString();
      const { error: membershipError } = await admin
        .from("user_memberships" as never)
        .upsert({
          user_id: accountId,
          membership_plan_id: premiumPlanId,
          provider: "manual",
          provider_membership_id: `manual:${accountId}:premium`,
          status: "active",
          current_period_start: reviewedAt,
          current_period_end: null,
          cancel_at_period_end: false,
          metadata: {
            grantedByProfileId: session.userId,
            source: "admin-account-manage"
          }
        } as never, { onConflict: "provider_membership_id" });

      if (membershipError) {
        return NextResponse.json({ error: "Account was updated, but manual Premium could not be granted." }, { status: 500 });
      }
    } else {
      const { error: membershipError } = await admin
        .from("user_memberships" as never)
        .update({
          status: "canceled",
          cancel_at_period_end: false,
          current_period_end: new Date().toISOString()
        } as never)
        .eq("provider", "manual" as never)
        .eq("provider_membership_id", `manual:${accountId}:premium` as never);

      if (membershipError) {
        return NextResponse.json({ error: "Account was updated, but manual Premium could not be removed." }, { status: 500 });
      }
    }

    return NextResponse.json({ message: "Account updated." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected account update failure.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
