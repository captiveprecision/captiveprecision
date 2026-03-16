import { redirect } from "next/navigation";

import { WorkspaceSelectionShell } from "@/components/auth/workspace-selection-shell";
import { getAuthSession } from "@/lib/auth/mock-auth";

export default async function WorkspaceSelectionPage() {
  const session = await getAuthSession();

  if (!session) {
    redirect("/");
  }

  if (session.roles.length === 1) {
    redirect(`/${session.roles[0]}`);
  }

  return <WorkspaceSelectionShell session={session} />;
}
