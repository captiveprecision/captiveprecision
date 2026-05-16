import { NextRequest, NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth/session";
import { getServerEnv } from "@/lib/config/env";
import { canManageGymAdministration, normalizeGymSeatRole, resolveGymAccessContext } from "@/lib/services/gym-access";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/types/database";

export const dynamic = "force-dynamic";

type StaffSeatRole = "program_director" | "coach" | "staff" | "assistant";
type GymRow = Pick<Database["public"]["Tables"]["gyms"]["Row"], "id" | "name" | "owner_profile_id">;
type ProfileRow = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "id" | "email" | "display_name" | "role" | "beta_access_status" | "primary_gym_id" | "membership_type" | "gym_name"
>;
type LicenseRow = Pick<Database["public"]["Tables"]["gym_coach_licenses"]["Row"], "id" | "status" | "seat_role">;
type WorkspaceRootRow = {
  id: string;
  scope_type: "coach" | "gym";
  gym_id: string | null;
  owner_profile_id: string | null;
};

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSeatRole(value: unknown): StaffSeatRole | null {
  return normalizeGymSeatRole(value);
}

function normalizeCredentialLevels(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(new Set(value
    .flatMap((item) => typeof item === "string" ? [item.trim()] : [])
    .filter(Boolean)))
    .slice(0, 20);
}

function normalizeIdArray(value: unknown) {
  return Array.isArray(value)
    ? Array.from(new Set(value.flatMap((item) => typeof item === "string" && item.trim() ? [item.trim()] : [])))
    : [];
}

function isMissingCredentialLevelsColumn(error: { message?: string; code?: string } | null | undefined) {
  return error?.code === "42703" || /credential_levels/i.test(error?.message ?? "");
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

async function resolveGymTeamIds(admin: ReturnType<typeof createAdminClient>, gym: GymRow) {
  const { data: roots } = await admin
    .from("workspace_roots" as never)
    .select("id, scope_type, gym_id, owner_profile_id" as never)
    .or(`gym_id.eq.${gym.id},owner_profile_id.eq.${gym.owner_profile_id}` as never);
  const relatedRootIds = ((roots ?? []) as WorkspaceRootRow[])
    .filter((root) => (
      (root.scope_type === "gym" && root.gym_id === gym.id)
      || (root.scope_type === "coach" && root.owner_profile_id === gym.owner_profile_id)
    ))
    .map((root) => root.id);
  const { data: gymTeams, error: gymError } = await admin
    .from("teams" as never)
    .select("id" as never)
    .eq("gym_id", gym.id as never);

  if (gymError) {
    throw new Error("Unable to load Gym teams.");
  }

  const { data: rootTeams, error: rootError } = relatedRootIds.length
    ? await admin
      .from("teams" as never)
      .select("id" as never)
      .in("workspace_root_id", relatedRootIds as never)
    : { data: [], error: null };

  if (rootError) {
    throw new Error("Unable to load Gym teams.");
  }

  return Array.from(new Set([
    ...((gymTeams ?? []) as Array<{ id: string }>).map((team) => team.id),
    ...((rootTeams ?? []) as Array<{ id: string }>).map((team) => team.id)
  ]));
}

async function requireGymAdminAccess(session: NonNullable<Awaited<ReturnType<typeof getAuthSession>>>) {
  const access = await resolveGymAccessContext(session, { ensureOwnerSeat: true });

  if (!access || !canManageGymAdministration(access)) {
    return {
      gym: null,
      error: NextResponse.json({ error: "Program Director access is required." }, { status: 403 })
    };
  }

  return { gym: access.gym, error: null };
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
    const access = await requireGymAdminAccess(session);

    if (access.error || !access.gym) {
      return access.error!;
    }

    const gym = access.gym;

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
        alreadyLinked: Boolean(license?.id && license.status !== "inactive")
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
    const access = await requireGymAdminAccess(session);

    if (access.error || !access.gym) {
      return access.error!;
    }

    const gym = access.gym;

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

    await admin.rpc("planner_adopt_coach_workspace_into_gym" as never, {
      p_coach_profile_id: accountId,
      p_gym_id: gym.id
    } as never);

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

export async function PATCH(request: NextRequest) {
  try {
    const session = await getAuthSession();

    if (!session?.roles.includes("gym")) {
      return NextResponse.json({ error: "Gym access is required." }, { status: 403 });
    }

    const payload = await request.json().catch(() => null);
    const profileId = normalizeText(payload?.profileId);
    const seatRole = normalizeSeatRole(payload?.seatRole);
    const credentialLevels = normalizeCredentialLevels(payload?.credentialLevels);
    const teamIds = normalizeIdArray(payload?.teamIds);
    const membershipAssigned = typeof payload?.membershipAssigned === "boolean" ? payload.membershipAssigned : true;

    if (!profileId) {
      return NextResponse.json({ error: "Profile id is required." }, { status: 400 });
    }

    if (!seatRole) {
      return NextResponse.json({ error: "A valid staff role is required." }, { status: 400 });
    }

    const admin = createAdminClient();
    const access = await requireGymAdminAccess(session);

    if (access.error || !access.gym) {
      return access.error!;
    }

    const gym = access.gym;

    const updatePayload = {
      seat_role: seatRole,
      credential_levels: credentialLevels,
      status: membershipAssigned ? "active" : "pending"
    };
    let responseCredentialLevels = credentialLevels;
    let responseMessage = "Staff details updated.";

    const { error } = await admin
      .from("gym_coach_licenses" as never)
      .update(updatePayload as never)
      .eq("gym_id", gym.id as never)
      .eq("coach_profile_id", profileId as never);

    if (error && isMissingCredentialLevelsColumn(error)) {
      const { error: fallbackError } = await admin
        .from("gym_coach_licenses" as never)
        .update({
          seat_role: seatRole,
          status: membershipAssigned ? "active" : "pending"
        } as never)
        .eq("gym_id", gym.id as never)
        .eq("coach_profile_id", profileId as never);

      if (fallbackError) {
        return NextResponse.json({ error: "Unable to update staff details." }, { status: 500 });
      }

      responseCredentialLevels = [];
      responseMessage = "Staff details updated. Credentials will be available after the credentials migration is applied.";
    }

    if (error && !isMissingCredentialLevelsColumn(error)) {
      return NextResponse.json({ error: "Unable to update staff details." }, { status: 500 });
    }

    if (membershipAssigned) {
      await admin.rpc("planner_adopt_coach_workspace_into_gym" as never, {
        p_coach_profile_id: profileId,
        p_gym_id: gym.id
      } as never);
    }

    const gymTeamIds = await resolveGymTeamIds(admin, gym);
    const allowedTeamIds = new Set(gymTeamIds);
    const selectedTeamIds = teamIds.filter((teamId) => allowedTeamIds.has(teamId));

    if (gymTeamIds.length) {
      await admin
        .from("team_coaches" as never)
        .delete()
        .eq("coach_profile_id", profileId as never)
        .in("team_id", gymTeamIds as never);

      await admin
        .from("teams" as never)
        .update({ primary_coach_profile_id: null } as never)
        .eq("primary_coach_profile_id", profileId as never)
        .in("id", gymTeamIds as never);
    }

    if (selectedTeamIds.length) {
      await admin
        .from("team_coaches" as never)
        .insert(selectedTeamIds.map((teamId, index) => ({
          team_id: teamId,
          coach_profile_id: profileId,
          role: index === 0 ? "head" : "assistant"
        })) as never);

      await admin
        .from("teams" as never)
        .update({ primary_coach_profile_id: profileId } as never)
        .in("id", selectedTeamIds as never)
        .is("primary_coach_profile_id", null);
    }

    return NextResponse.json({
      profileId,
      seatRole,
      credentialLevels: responseCredentialLevels,
      teamIds: selectedTeamIds,
      membershipAssigned,
      message: responseMessage
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected staff update failure.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getAuthSession();

    if (!session?.roles.includes("gym")) {
      return NextResponse.json({ error: "Gym access is required." }, { status: 403 });
    }

    const payload = await request.json().catch(() => null);
    const profileId = normalizeText(payload?.profileId);

    if (!profileId) {
      return NextResponse.json({ error: "Profile id is required." }, { status: 400 });
    }

    if (profileId === session.userId) {
      return NextResponse.json({ error: "The Gym owner account cannot be unlinked from its own organization." }, { status: 409 });
    }

    const admin = createAdminClient();
    const access = await requireGymAdminAccess(session);

    if (access.error || !access.gym) {
      return access.error!;
    }

    const gym = access.gym;

    if (gym.owner_profile_id === profileId) {
      return NextResponse.json({ error: "The Gym owner account cannot be unlinked from this organization." }, { status: 409 });
    }

    const { data: linkedProfile } = await admin
      .from("profiles" as never)
      .select("primary_gym_id" as never)
      .eq("id", profileId as never)
      .maybeSingle();

    const { error: licenseError } = await admin
      .from("gym_coach_licenses" as never)
      .update({ status: "inactive" } as never)
      .eq("gym_id", gym.id as never)
      .eq("coach_profile_id", profileId as never);

    if (licenseError) {
      return NextResponse.json({ error: "Unable to unlink this account from the Gym." }, { status: 500 });
    }

    const gymTeamIds = await resolveGymTeamIds(admin, gym);

    if (gymTeamIds.length) {
      await admin
        .from("team_coaches" as never)
        .delete()
        .eq("coach_profile_id", profileId as never)
        .in("team_id", gymTeamIds as never);
    }

    await admin
      .from("teams" as never)
      .update({ primary_coach_profile_id: null } as never)
      .eq("gym_id", gym.id as never)
      .eq("primary_coach_profile_id", profileId as never);

    const profile = linkedProfile as Pick<ProfileRow, "primary_gym_id"> | null;
    if (profile?.primary_gym_id === gym.id) {
      await admin
        .from("profiles" as never)
        .update({
          primary_gym_id: null,
          membership_type: "independent",
          gym_name: null
        } as never)
        .eq("id", profileId as never);
    }

    return NextResponse.json({
      profileId,
      message: "Account unlinked from this Gym."
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected staff unlink failure.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
