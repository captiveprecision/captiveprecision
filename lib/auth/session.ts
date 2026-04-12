import { redirect } from "next/navigation";

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

export function getNextPathForRole(role: AppRole) {
  return `/${role}`;
}

export function getNextPathForSession(session: Pick<AuthSession, "roles">) {
  return session.roles.length === 1 ? getNextPathForRole(session.roles[0]) : "/select-workspace";
}

function isNextDynamicServerError(error: unknown) {
  return typeof error === "object" && error !== null && "digest" in error && (error as { digest?: unknown }).digest === "DYNAMIC_SERVER_USAGE";
}

export async function getAuthSession(): Promise<AuthSession | null> {
  try {
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
    let linkedGymName: string | null = null;

    if (authorizedProfile.primary_gym_id) {
      const { data: gymData } = await admin
        .from("gyms" as never)
        .select("name" as never)
        .eq("id", authorizedProfile.primary_gym_id as never)
        .maybeSingle();

      linkedGymName = (gymData as Pick<GymRow, "name"> | null)?.name ?? null;
    }

    return {
      userId: user.id,
      email: authorizedProfile.email ?? user.email ?? "",
      displayName: authorizedProfile.display_name ?? user.user_metadata.display_name ?? user.email ?? "User",
      role: access.role,
      roles: getEffectiveRoles(access.role),
      primaryGymId: authorizedProfile.primary_gym_id ?? null,
      primaryGymName: authorizedProfile.gym_name ?? linkedGymName,
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



