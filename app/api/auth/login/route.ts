import { NextRequest, NextResponse } from "next/server";

import {
  SESSION_COOKIE_NAME,
  USERS_COOKIE_NAME,
  buildSessionCookie,
  findUserByCredentials,
  getMergedUsers
} from "@/lib/auth/mock-auth";

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null);

  if (!payload?.email || !payload?.password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const users = await getMergedUsers();
  const user = findUserByCredentials(users, payload.email, payload.password);

  if (!user) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  const response = NextResponse.json({ nextPath: user.roles.length === 1 ? `/${user.roles[0]}` : "/select-workspace" });
  response.cookies.set(SESSION_COOKIE_NAME, buildSessionCookie({
    email: user.email,
    displayName: user.displayName,
    roles: user.roles
  }), {
    httpOnly: true,
    sameSite: "lax",
    path: "/"
  });

  if (!request.cookies.get(USERS_COOKIE_NAME)) {
    response.cookies.set(USERS_COOKIE_NAME, request.cookies.get(USERS_COOKIE_NAME)?.value ?? "", {
      httpOnly: true,
      sameSite: "lax",
      path: "/"
    });
  }

  return response;
}
