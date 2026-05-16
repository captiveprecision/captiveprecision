import { NextRequest, NextResponse } from "next/server";

import { PASSWORD_RECOVERY_SESSION_COOKIE, PASSWORD_RECOVERY_SESSION_COOKIE_VALUE } from "@/lib/auth/password-recovery";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function buildClearedRecoveryCookie(response: NextResponse) {
  response.cookies.set(PASSWORD_RECOVERY_SESSION_COOKIE, "", {
    path: "/",
    maxAge: 0,
    sameSite: "lax"
  });
  return response;
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json().catch(() => null);
    const password = typeof payload?.password === "string" ? payload.password : "";
    const accessToken = typeof payload?.accessToken === "string" ? payload.accessToken : "";
    const hasRecoveryGuard = request.cookies.get(PASSWORD_RECOVERY_SESSION_COOKIE)?.value === PASSWORD_RECOVERY_SESSION_COOKIE_VALUE;

    if (!hasRecoveryGuard) {
      return NextResponse.json(
        { error: "This password reset session is no longer active. Request a new reset link." },
        { status: 401 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }

    if (!accessToken) {
      return NextResponse.json(
        { error: "This password reset session is invalid or expired. Request a new reset link." },
        { status: 401 }
      );
    }

    const admin = createAdminClient();
    const {
      data: { user },
      error: userError
    } = await admin.auth.getUser(accessToken);

    if (userError || !user) {
      return NextResponse.json(
        { error: "This password reset session is invalid or expired. Request a new reset link." },
        { status: 401 }
      );
    }

    const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
      password
    });

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return buildClearedRecoveryCookie(NextResponse.json({ message: "Password updated." }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected password reset failure.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
