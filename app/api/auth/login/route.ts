import { NextRequest, NextResponse } from "next/server";

import {
  getAccessRejectionMessage,
  getAccessRejectionStatus,
  getEffectiveRoles,
  getNextPathForSession,
  getProfileAccessState
} from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/types/database";

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

    if (profileError) {
      await supabase.auth.signOut();
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    const access = getProfileAccessState(profile);

    if (!access.ok) {
      await supabase.auth.signOut();
      return NextResponse.json(
        { error: getAccessRejectionMessage(access.reason) },
        { status: getAccessRejectionStatus(access.reason) }
      );
    }

    return NextResponse.json({ nextPath: getNextPathForSession({ roles: getEffectiveRoles(access.role) }) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected login failure.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
