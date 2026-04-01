import { redirect } from "next/navigation";

import { WorkspaceSelectionShell } from "@/components/auth/workspace-selection-shell";
import { getAuthSession, getNextPathForSession } from "@/lib/auth/session";

export default async function WorkspaceSelectionPage() {
  const session = await getAuthSession();

  if (!session) {
    redirect("/");
  }

  if (session.roles.length === 1) {
    redirect(getNextPathForSession(session));
  }

  return <WorkspaceSelectionShell session={session} />;
}
