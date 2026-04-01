import { redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/types/database";

export type AppRole = "admin" | "coach" | "gym";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export type AuthSession = {
  userId: string;
  email: string;
  displayName: string;
  role: AppRole;
  roles: AppRole[];
  primaryGymId: string | null;
};

function parseAppRole(value: unknown): AppRole | null {
  return value === "admin" || value === "coach" || value === "gym" ? value : null;
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
    .select("display_name, email, role, primary_gym_id" as never)
    .eq("id", user.id as never)
    .maybeSingle();

  const profile = data as ProfileRow | null;

  if (profileError || !profile) {
    return null;
  }

  const role = parseAppRole(profile.role);

  if (!role) {
    return null;
  }

  return {
    userId: user.id,
    email: profile.email ?? user.email ?? "",
    displayName: profile.display_name ?? user.user_metadata.display_name ?? user.email ?? "User",
    role,
    roles: getEffectiveRoles(role),
    primaryGymId: profile.primary_gym_id ?? null
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
