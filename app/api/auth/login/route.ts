import { NextRequest, NextResponse } from "next/server";

import { getEffectiveRoles, getNextPathForSession, type AppRole } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/types/database";

function parseAppRole(value: unknown): AppRole | null {
  return value === "admin" || value === "coach" || value === "gym" ? value : null;
}

function parseBetaAccessStatus(value: unknown): Database["public"]["Tables"]["profiles"]["Row"]["beta_access_status"] | null {
  return value === "pending" || value === "approved" || value === "rejected" ? value : null;
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
      .select("role, beta_access_status" as never)
      .eq("id", data.user.id as never)
      .maybeSingle();

    const profile = profileData as Pick<ProfileRow, "role" | "beta_access_status"> | null;
    const role = parseAppRole(profile?.role);
    const betaAccessStatus = parseBetaAccessStatus(profile?.beta_access_status);

    if (profileError || !profile || !role || !betaAccessStatus) {
      await supabase.auth.signOut();
      return NextResponse.json({ error: "This account is missing a valid application profile." }, { status: 409 });
    }

    if (betaAccessStatus === "pending") {
      await supabase.auth.signOut();
      return NextResponse.json(
        { error: "Your beta access request is still pending admin approval." },
        { status: 403 }
      );
    }

    if (betaAccessStatus === "rejected") {
      await supabase.auth.signOut();
      return NextResponse.json(
        { error: "Your beta access request was not approved. Please contact an administrator." },
        { status: 403 }
      );
    }

    return NextResponse.json({ nextPath: getNextPathForSession({ roles: getEffectiveRoles(role) }) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected login failure.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
