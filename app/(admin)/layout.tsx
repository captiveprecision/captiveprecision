import { AdminSidebar } from "@/components/navigation/admin-sidebar";

export default function AdminLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="app-frame">
      <AdminSidebar />
      <div className="app-main">{children}</div>
    </div>
  );
}
