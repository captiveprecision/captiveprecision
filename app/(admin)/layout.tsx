import { AdminSidebar } from "@/components/navigation/admin-sidebar";
import { requireAuthSession } from "@/lib/auth/session";

export default async function AdminLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await requireAuthSession("admin");

  return (
    <div className="app-frame">
      <AdminSidebar availableWorkspaces={session.roles} />
      <div className="app-main">{children}</div>
    </div>
  );
}
