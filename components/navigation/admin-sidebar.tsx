"use client";

import type { Route } from "next";
import {
  CalendarDays,
  LayoutDashboard,
  MessageSquare,
  Settings,
  SlidersHorizontal,
  UserRound
} from "lucide-react";

import { WorkspaceSidebar } from "@/components/navigation/workspace-sidebar";
import type { AppRole } from "@/lib/auth/session";

const adminNavItems = [
  { href: "/admin" as Route, title: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/scoring-systems" as Route, title: "Scoring Systems", icon: SlidersHorizontal },
  { href: "/admin/messages" as Route, title: "Messages", icon: MessageSquare },
  { href: "/admin/profile" as Route, title: "Profile", icon: UserRound },
  { href: "/admin/events" as Route, title: "Events", icon: CalendarDays },
  { href: "/admin/settings" as Route, title: "Settings", icon: Settings }
];

export function AdminSidebar({ availableWorkspaces }: { availableWorkspaces: AppRole[] }) {
  return (
    <WorkspaceSidebar
      currentWorkspace="admin"
      availableWorkspaces={availableWorkspaces}
      brandSubtitle="Admin workspace"
      navItems={adminNavItems}
      footerTitle="Admin setup"
      footerCopy="This provisional admin area is ready for us to start building internal tools, controls, and operational views next."
      logoutHref="/api/auth/logout"
    />
  );
}

