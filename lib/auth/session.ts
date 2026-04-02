import { redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/types/database";

export type AppRole = "admin" | "coach" | "gym";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type GymRow = Database["public"]["Tables"]["gyms"]["Row"];

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

function parseAppRole(value: unknown): AppRole | null {
  return value === "admin" || value === "coach" || value === "gym" ? value : null;
}

function isApprovedBetaAccessStatus(value: unknown): value is "approved" {
  return value === "approved";
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

export async function getAuthSession(): Promise<AuthSession | null> {
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

  if (profileError || !profile) {
    return null;
  }

  const role = parseAppRole(profile.role);

  if (!role || !isApprovedBetaAccessStatus(profile.beta_access_status)) {
    return null;
  }

  let linkedGymName: string | null = null;

  if (profile.primary_gym_id) {
    const { data: gymData } = await admin
      .from("gyms" as never)
      .select("name" as never)
      .eq("id", profile.primary_gym_id as never)
      .maybeSingle();

    linkedGymName = (gymData as Pick<GymRow, "name"> | null)?.name ?? null;
  }

  return {
    userId: user.id,
    email: profile.email ?? user.email ?? "",
    displayName: profile.display_name ?? user.user_metadata.display_name ?? user.email ?? "User",
    role,
    roles: getEffectiveRoles(role),
    primaryGymId: profile.primary_gym_id ?? null,
    primaryGymName: profile.gym_name ?? linkedGymName,
    city: profile.city ?? null,
    state: profile.state ?? null,
    roleLabel: profile.role_label ?? null,
    headline: profile.headline ?? null,
    bio: profile.bio ?? null,
    teamsSummary: profile.teams_summary ?? null,
    avatarUrl: profile.avatar_url ?? null
  };
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
