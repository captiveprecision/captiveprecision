import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth/session";
import { getServerEnv } from "@/lib/config/env";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/types/database";

export const dynamic = "force-dynamic";

type ProfileRow = Pick<Database["public"]["Tables"]["profiles"]["Row"], "email">;

export async function POST(
  _request: Request,
  context: { params: Promise<{ accountId: string }> }
) {
  try {
    const session = await getAuthSession();

    if (!session?.roles.includes("admin")) {
      return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
    }

    const { accountId } = await context.params;
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("profiles" as never)
      .select("email" as never)
      .eq("id", accountId as never)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: "Unable to load account profile." }, { status: 500 });
    }

    const profile = data as ProfileRow | null;

    if (!profile?.email) {
      return NextResponse.json({ error: "Account email was not found." }, { status: 404 });
    }

    const env = getServerEnv();
    const { error: resetError } = await admin.auth.resetPasswordForEmail(profile.email, {
      redirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/reset-password`
    });

    if (resetError) {
      return NextResponse.json({ error: resetError.message }, { status: 400 });
    }

    return NextResponse.json({ message: "Password reset email sent." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected password reset failure.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
