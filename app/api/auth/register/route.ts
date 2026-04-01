import { NextRequest, NextResponse } from "next/server";

import { getEffectiveRoles, getNextPathForSession, type AppRole } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/types/database";

function isPublicRole(value: unknown): value is Extract<AppRole, "coach" | "gym"> {
  return value === "coach" || value === "gym";
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json().catch(() => null);

    if (!payload?.email || !payload?.password || !payload?.displayName || !payload?.role) {
      return NextResponse.json({ error: "Name, email, password, and role are required." }, { status: 400 });
    }

    if (!isPublicRole(payload.role)) {
      return NextResponse.json({ error: "Only coach or gym registrations are allowed." }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    const email = normalizeEmail(payload.email);
    const password = String(payload.password);
    const displayName = String(payload.displayName).trim();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
          role: payload.role
        }
      }
    });

    if (error) {
      const status = /already registered|already exists|already been registered/i.test(error.message) ? 409 : 400;
      return NextResponse.json({ error: error.message }, { status });
    }

    if (!data.user) {
      return NextResponse.json({ error: "Unable to create account." }, { status: 500 });
    }

    const admin = createAdminClient();
    const profileInsert: Database["public"]["Tables"]["profiles"]["Insert"] = {
      id: data.user.id,
      email,
      display_name: displayName,
      role: payload.role,
      primary_gym_id: null
    };

    const { error: profileError } = await admin
      .from("profiles" as never)
      .upsert(profileInsert as never, { onConflict: "id" });

    if (profileError) {
      return NextResponse.json({ error: "Account created, but the profile could not be initialized." }, { status: 500 });
    }

    if (!data.session) {
      return NextResponse.json({ error: "Account created, but email confirmation is required before signing in." }, { status: 409 });
    }

    return NextResponse.json({ nextPath: getNextPathForSession({ roles: getEffectiveRoles(payload.role) }) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected registration failure.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
