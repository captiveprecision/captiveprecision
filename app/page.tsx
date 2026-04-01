import { redirect } from "next/navigation";

import { LandingAuthShell } from "@/components/auth/landing-auth-shell";
import { getAuthSession, getNextPathForSession } from "@/lib/auth/session";

export default async function HomePage() {
  const session = await getAuthSession();

  if (session) {
    redirect(getNextPathForSession(session));
  }

  return <LandingAuthShell />;
}
