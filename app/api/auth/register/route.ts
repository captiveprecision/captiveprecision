import { NextRequest, NextResponse } from "next/server";

import {
  SESSION_COOKIE_NAME,
  USERS_COOKIE_NAME,
  buildSessionCookie,
  buildUsersCookie,
  findUserByEmail,
  getMergedUsers,
  readStoredUsers,
  type AppRole
} from "@/lib/auth/mock-auth";

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null);

  if (!payload?.email || !payload?.password || !payload?.displayName || !payload?.role) {
    return NextResponse.json({ error: "Name, email, password, and role are required." }, { status: 400 });
  }

  if (!["coach", "gym"].includes(payload.role)) {
    return NextResponse.json({ error: "Only coach or gym registrations are allowed." }, { status: 400 });
  }

  const users = await getMergedUsers();

  if (findUserByEmail(users, payload.email)) {
    return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
  }

  const storedUsers = readStoredUsers(request.cookies.get(USERS_COOKIE_NAME)?.value);
  const nextUser = {
    email: payload.email,
    password: payload.password,
    displayName: payload.displayName,
    roles: [payload.role as AppRole]
  };

  const response = NextResponse.json({ nextPath: `/${payload.role}` });
  response.cookies.set(USERS_COOKIE_NAME, buildUsersCookie([...storedUsers, nextUser]), {
    httpOnly: true,
    sameSite: "lax",
    path: "/"
  });
  response.cookies.set(SESSION_COOKIE_NAME, buildSessionCookie({
    email: nextUser.email,
    displayName: nextUser.displayName,
    roles: nextUser.roles
  }), {
    httpOnly: true,
    sameSite: "lax",
    path: "/"
  });

  return response;
}
