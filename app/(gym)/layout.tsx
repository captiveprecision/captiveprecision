import { GymSidebar } from "@/components/navigation/gym-sidebar";
import { requireAuthSession } from "@/lib/auth/session";

export default async function GymLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await requireAuthSession("gym");

  return (
    <div className="app-frame">
      <GymSidebar availableWorkspaces={session.roles} />
      <div className="app-main">{children}</div>
    </div>
  );
}
