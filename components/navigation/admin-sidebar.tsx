import type { Route } from "next";

import { WorkspaceSidebar } from "@/components/navigation/workspace-sidebar";

const adminNavItems = [
  { href: "/admin" as Route, title: "Dashboard", shortLabel: "D" },
  { href: "/admin/scoring-systems" as Route, title: "Scoring Systems", shortLabel: "U" },
  { href: "/admin/messages" as Route, title: "Messages", shortLabel: "M" },
  { href: "/admin/profile" as Route, title: "Profile", shortLabel: "P" },
  { href: "/admin/events" as Route, title: "Events", shortLabel: "E" },
  { href: "/admin/settings" as Route, title: "Settings", shortLabel: "S" }
];

export function AdminSidebar() {
  return (
    <WorkspaceSidebar
      brandSubtitle="Admin workspace"
      navItems={adminNavItems}
      footerTitle="Admin setup"
      footerCopy="This provisional admin area is ready for us to start building internal tools, controls, and operational views next."
      logoutHref="/api/auth/logout"
    />
  );
}
