import { NextResponse } from "next/server";

import { SESSION_COOKIE_NAME } from "@/lib/auth/mock-auth";

export async function GET() {
  const response = NextResponse.redirect(new URL("/", "http://localhost"));
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
