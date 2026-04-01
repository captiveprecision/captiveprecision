import { CoachSidebar } from "@/components/navigation/coach-sidebar";
import { requireAuthSession } from "@/lib/auth/session";

export default async function CoachLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await requireAuthSession("coach");

  return (
    <div className="app-frame">
      <CoachSidebar availableWorkspaces={session.roles} />
      <div className="app-main">{children}</div>
    </div>
  );
}
