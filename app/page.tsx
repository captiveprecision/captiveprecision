import { redirect } from "next/navigation";

import { LandingAuthShell } from "@/components/auth/landing-auth-shell";
import { getAuthSession } from "@/lib/auth/mock-auth";

export default async function HomePage() {
  const session = await getAuthSession();

  if (session) {
    redirect(session.roles.length === 1 ? `/${session.roles[0]}` : "/select-workspace");
  }

  return <LandingAuthShell />;
}
