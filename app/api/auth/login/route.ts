import { NextRequest, NextResponse } from "next/server";

import { getEffectiveRoles, getNextPathForSession, type AppRole } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/types/database";

function parseAppRole(value: unknown): AppRole | null {
  return value === "admin" || value === "coach" || value === "gym" ? value : null;
}

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json().catch(() => null);

    if (!payload?.email || !payload?.password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: String(payload.email).trim().toLowerCase(),
      password: String(payload.password)
    });

    if (error || !data.user) {
      return NextResponse.json({ error: error?.message ?? "Invalid credentials." }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data: profileData, error: profileError } = await admin
      .from("profiles" as never)
      .select("role" as never)
      .eq("id", data.user.id as never)
      .maybeSingle();

    const profile = profileData as Pick<ProfileRow, "role"> | null;
    const role = parseAppRole(profile?.role);

    if (profileError || !profile || !role) {
      await supabase.auth.signOut();
      return NextResponse.json({ error: "This account is missing a valid application profile." }, { status: 409 });
    }

    return NextResponse.json({ nextPath: getNextPathForSession({ roles: getEffectiveRoles(role) }) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected login failure.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
