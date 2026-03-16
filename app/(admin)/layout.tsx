import { redirect } from "next/navigation";

import { AdminSidebar } from "@/components/navigation/admin-sidebar";
import { getAuthSession } from "@/lib/auth/mock-auth";

export default async function AdminLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getAuthSession();

  if (!session || !session.roles.includes("admin")) {
    redirect("/");
  }

  return (
    <div className="app-frame">
      <AdminSidebar />
      <div className="app-main">{children}</div>
    </div>
  );
}
