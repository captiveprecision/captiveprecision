import type { Route } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { PASSWORD_RECOVERY_SESSION_COOKIE, PASSWORD_RECOVERY_SESSION_COOKIE_VALUE } from "@/lib/auth/password-recovery";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/types/database";

export type AppRole = "admin" | "coach" | "gym";
export type AuthAccessRejectionReason = "missing-profile" | "invalid-role" | "pending-beta-access" | "rejected-beta-access";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type GymRow = Database["public"]["Tables"]["gyms"]["Row"];

type ProfileAccessState =
  | { ok: true; role: AppRole; betaAccessStatus: "approved" }
  | { ok: false; reason: AuthAccessRejectionReason };

export type AuthSession = {
  userId: string;
  email: string;
  displayName: string;
  role: AppRole;
  roles: AppRole[];
  primaryGymId: string | null;
  primaryGymName: string | null;
  gymSeatRole: "owner" | "program_director" | "coach" | "assistant" | "staff" | null;
  gymAccessLevel: "none" | "read" | "team-write" | "full" | null;
  canOpenGymWorkspace: boolean;
  city: string | null;
  state: string | null;
  roleLabel: string | null;
  headline: string | null;
  bio: string | null;
  teamsSummary: string | null;
  avatarUrl: string | null;
};

export function parseAppRole(value: unknown): AppRole | null {
  return value === "admin" || value === "coach" || value === "gym" ? value : null;
}

export function parseBetaAccessStatus(value: unknown): ProfileRow["beta_access_status"] | null {
  return value === "pending" || value === "approved" || value === "rejected" ? value : null;
}

export function getProfileAccessState(profile: Pick<ProfileRow, "role" | "beta_access_status"> | null | undefined): ProfileAccessState {
  if (!profile) {
    return { ok: false, reason: "missing-profile" };
  }

  const role = parseAppRole(profile.role);

  if (!role) {
    return { ok: false, reason: "invalid-role" };
  }

  const betaAccessStatus = parseBetaAccessStatus(profile.beta_access_status);

  if (betaAccessStatus === "approved") {
    return { ok: true, role, betaAccessStatus };
  }

  if (betaAccessStatus === "pending") {
    return { ok: false, reason: "pending-beta-access" };
  }

  return { ok: false, reason: "rejected-beta-access" };
}

export function getAccessRejectionMessage(reason: AuthAccessRejectionReason) {
  switch (reason) {
    case "missing-profile":
    case "invalid-role":
      return "This account is missing a valid application profile.";
    case "pending-beta-access":
      return "Your beta access request is still pending admin approval.";
    case "rejected-beta-access":
      return "Your beta access request was not approved. Please contact an administrator.";
    default:
      return "This account is not allowed to access the application.";
  }
}

export function getAccessRejectionStatus(reason: AuthAccessRejectionReason) {
  switch (reason) {
    case "missing-profile":
    case "invalid-role":
      return 409;
    case "pending-beta-access":
    case "rejected-beta-access":
      return 403;
    default:
      return 403;
  }
}

export function getEffectiveRoles(role: AppRole): AppRole[] {
  switch (role) {
    case "admin":
      return ["admin", "gym", "coach"];
    case "gym":
      return ["gym", "coach"];
    case "coach":
    default:
      return ["coach"];
  }
}

export function getNextPathForRole(role: AppRole): Route {
  return `/${role}` as Route;
}

export function getNextPathForSession(session: Pick<AuthSession, "roles">): Route {
  return session.roles.length === 1 ? getNextPathForRole(session.roles[0]) : "/select-workspace";
}

async function hasPendingPasswordRecoverySession() {
  const cookieStore = await cookies();
  return cookieStore.get(PASSWORD_RECOVERY_SESSION_COOKIE)?.value === PASSWORD_RECOVERY_SESSION_COOKIE_VALUE;
}

function isNextDynamicServerError(error: unknown) {
  return typeof error === "object" && error !== null && "digest" in error && (error as { digest?: unknown }).digest === "DYNAMIC_SERVER_USAGE";
}

export async function getAuthSession(): Promise<AuthSession | null> {
  try {
    if (await hasPendingPasswordRecoverySession()) {
      return null;
    }

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error
    } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    const admin = createAdminClient();
    const { data, error: profileError } = await admin
      .from("profiles" as never)
      .select("display_name, email, role, primary_gym_id, beta_access_status, gym_name, city, state, role_label, headline, bio, teams_summary, avatar_url" as never)
      .eq("id", user.id as never)
      .maybeSingle();

    const profile = data as ProfileRow | null;

    if (profileError) {
      console.error("[auth] Failed to load profile for authenticated user.", profileError);
      return null;
    }

    const access = getProfileAccessState(profile);

    if (!access.ok || !profile) {
      return null;
    }

    const authorizedProfile = profile;
    let linkedGymId: string | null = authorizedProfile.primary_gym_id ?? null;
    let linkedGymName: string | null = null;
    let linkedGymOwnerProfileId: string | null = null;
    let linkedGymSeatRole: AuthSession["gymSeatRole"] = null;

    if (linkedGymId) {
      const { data: gymData } = await admin
        .from("gyms" as never)
        .select("name, owner_profile_id" as never)
        .eq("id", linkedGymId as never)
        .maybeSingle();

      const gymRow = gymData as Pick<GymRow, "name" | "owner_profile_id"> | null;
      linkedGymName = gymRow?.name ?? null;
      linkedGymOwnerProfileId = gymRow?.owner_profile_id ?? null;
    }

    if (!linkedGymId) {
      const { data: ownedGym } = await admin
        .from("gyms" as never)
        .select("id, name, owner_profile_id" as never)
        .eq("owner_profile_id", user.id as never)
        .maybeSingle();
      const ownedGymRow = ownedGym as Pick<GymRow, "id" | "name" | "owner_profile_id"> | null;

      if (ownedGymRow?.id) {
        linkedGymId = ownedGymRow.id;
        linkedGymName = ownedGymRow.name;
        linkedGymOwnerProfileId = ownedGymRow.owner_profile_id;
        linkedGymSeatRole = "owner";
      }
    }

    if (!linkedGymId) {
      const { data: license } = await admin
        .from("gym_coach_licenses" as never)
        .select("gym_id" as never)
        .eq("coach_profile_id", user.id as never)
        .eq("status", "active" as never)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      const licensedGymId = (license as { gym_id?: string } | null)?.gym_id ?? null;

      if (licensedGymId) {
        const { data: gymData } = await admin
          .from("gyms" as never)
          .select("id, name, owner_profile_id" as never)
          .eq("id", licensedGymId as never)
          .maybeSingle();
        const gymRow = gymData as Pick<GymRow, "id" | "name" | "owner_profile_id"> | null;

        if (gymRow?.id) {
          linkedGymId = gymRow.id;
          linkedGymName = gymRow.name;
          linkedGymOwnerProfileId = gymRow.owner_profile_id;
        }
      }
    }

    if (linkedGymId && !linkedGymSeatRole) {
      if (linkedGymOwnerProfileId === user.id) {
        linkedGymSeatRole = "owner";
      } else {
        const { data: seatData } = await admin
          .from("gym_coach_licenses" as never)
          .select("seat_role, status" as never)
          .eq("gym_id", linkedGymId as never)
          .eq("coach_profile_id", user.id as never)
          .eq("status", "active" as never)
          .maybeSingle();
        const seatRole = (seatData as { seat_role?: string | null } | null)?.seat_role ?? null;

        linkedGymSeatRole = seatRole === "program_director" || seatRole === "coach" || seatRole === "assistant" || seatRole === "staff"
          ? seatRole
          : null;
      }
    }

    const gymAccessLevel: AuthSession["gymAccessLevel"] = access.role === "admin" || access.role === "gym" || linkedGymSeatRole === "owner" || linkedGymSeatRole === "program_director"
      ? "full"
      : linkedGymSeatRole === "coach"
        ? "team-write"
        : linkedGymSeatRole === "assistant"
          ? "read"
          : linkedGymSeatRole === "staff"
            ? "none"
            : null;
    const canOpenGymWorkspace = Boolean(
      linkedGymId
      && (
        access.role === "admin"
        || access.role === "gym"
        || linkedGymSeatRole === "owner"
        || linkedGymSeatRole === "program_director"
        || linkedGymSeatRole === "coach"
        || linkedGymSeatRole === "assistant"
      )
    );
    const effectiveRoles = Array.from(new Set([
      ...getEffectiveRoles(access.role),
      ...(canOpenGymWorkspace ? ["gym" as AppRole] : [])
    ]));

    return {
      userId: user.id,
      email: authorizedProfile.email ?? user.email ?? "",
      displayName: authorizedProfile.display_name ?? user.user_metadata.display_name ?? user.email ?? "User",
      role: access.role,
      roles: effectiveRoles,
      primaryGymId: linkedGymId,
      primaryGymName: authorizedProfile.gym_name ?? linkedGymName,
      gymSeatRole: linkedGymSeatRole,
      gymAccessLevel,
      canOpenGymWorkspace,
      city: authorizedProfile.city ?? null,
      state: authorizedProfile.state ?? null,
      roleLabel: authorizedProfile.role_label ?? null,
      headline: authorizedProfile.headline ?? null,
      bio: authorizedProfile.bio ?? null,
      teamsSummary: authorizedProfile.teams_summary ?? null,
      avatarUrl: authorizedProfile.avatar_url ?? null
    };
  } catch (error) {
    if (isNextDynamicServerError(error)) {
      throw error;
    }

    console.error("[auth] Failed to resolve authenticated session.", error);
    return null;
  }
}

export async function requireAuthSession(requiredRole?: AppRole) {
  const session = await getAuthSession();

  if (!session) {
    redirect("/");
  }

  if (requiredRole && !session.roles.includes(requiredRole)) {
    redirect("/");
  }

  return session;
}
