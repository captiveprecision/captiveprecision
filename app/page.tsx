import { LandingAuthShell } from "@/components/auth/landing-auth-shell";
import { getAuthSession } from "@/lib/auth/mock-auth";

export default async function HomePage() {
  const session = await getAuthSession();

  return <LandingAuthShell session={session} />;
}
