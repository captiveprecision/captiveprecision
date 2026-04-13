"use client";

import type { Route } from "next";
import {
  Building2,
  Calculator,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  LayoutDashboard,
  MessageSquare,
  Settings,
  UserRound
} from "lucide-react";

import { WorkspaceSidebar } from "@/components/navigation/workspace-sidebar";
import type { AppRole } from "@/lib/auth/session";

const gymNavItems = [
  { href: "/gym" as Route, title: "Dashboard", icon: LayoutDashboard },
  { href: "/gym/cheer-planner" as Route, title: "Cheer Planner", icon: ClipboardList },
  { href: "/gym/manage-my-gym" as Route, title: "Manage My Gym", icon: Building2 },
  { href: "/gym/profile" as Route, title: "Profile", icon: UserRound },
  { href: "/gym/messages" as Route, title: "Messages", icon: MessageSquare },
  { href: "/gym/events" as Route, title: "Events", icon: CalendarDays },
  { href: "/gym/settings" as Route, title: "Settings", icon: Settings }
];

const gymToolItems = [
  { href: "/gym/tools/cheer-score-calculator" as Route, title: "Cheer Score", icon: Calculator },
  { href: "/gym/tools/full-out-evaluator" as Route, title: "Execution Evaluator", icon: ClipboardCheck }
];

function getGymReleaseLabel() {
  const rawValue =
    process.env.APP_DEPLOYED_AT ??
    process.env.NEXT_PUBLIC_APP_DEPLOYED_AT ??
    process.env.VERCEL_GIT_COMMIT_DATE ??
    process.env.COMMIT_DATE;

  if (!rawValue) {
    return "Last update: Recent release";
  }

  const parsed = new Date(rawValue);

  if (Number.isNaN(parsed.getTime())) {
    return "Last update: Recent release";
  }

  return `Last update: ${new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric"
  }).format(parsed)}`;
}

export function GymSidebar({ availableWorkspaces }: { availableWorkspaces: AppRole[] }) {
  return (
    <WorkspaceSidebar
      currentWorkspace="gym"
      availableWorkspaces={availableWorkspaces}
      brandSubtitle="Gym workspace"
      navItems={gymNavItems}
      toolItems={gymToolItems}
      footerTitle="Early Access"
      footerCopy="Features are still being tested, refined, and improved across releases."
      footerMeta={getGymReleaseLabel()}
      logoutHref="/api/auth/logout"
    />
  );
}

