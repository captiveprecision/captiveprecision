"use client";

import type { Route } from "next";
import {
  Calculator,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  LayoutDashboard,
  MessageSquare,
  Settings,
  UserRound,
  Users
} from "lucide-react";

import { WorkspaceSidebar } from "@/components/navigation/workspace-sidebar";
import type { AppRole, AuthSession } from "@/lib/auth/session";

const coachNavItems = [
  { href: "/coach" as Route, title: "Dashboard", icon: LayoutDashboard },
  { href: "/coach/cheer-planner" as Route, title: "Cheer Planner", icon: ClipboardList },
  { href: "/coach/my-teams" as Route, title: "My Teams", icon: Users },
  { href: "/coach/profile" as Route, title: "Profile", icon: UserRound },
  { href: "/coach/messages" as Route, title: "Messages", icon: MessageSquare },
  { href: "/coach/events" as Route, title: "Events", icon: CalendarDays },
  { href: "/coach/settings" as Route, title: "Settings", icon: Settings }
];

const coachToolItems = [
  { href: "/coach/tools/cheer-score-calculator" as Route, title: "Cheer Score", icon: Calculator },
  { href: "/coach/tools/full-out-evaluator" as Route, title: "Execution Evaluator", icon: ClipboardCheck }
];

function getCoachReleaseLabel() {
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

export function CoachSidebar({
  availableWorkspaces,
  session
}: {
  availableWorkspaces: AppRole[];
  session: AuthSession;
}) {
  return (
    <WorkspaceSidebar
      currentWorkspace="coach"
      availableWorkspaces={availableWorkspaces}
      brandTitle={session.displayName}
      brandSubtitle={session.primaryGymName ?? "Independent"}
      brandLogoSrc="/brand/logo-mark.png"
      brandLogoAlt="Captive Precision mark"
      navItems={coachNavItems}
      toolItems={coachToolItems}
      footerTitle="Early Access"
      footerCopy="Features are still being tested, refined, and improved across releases."
      footerMeta={getCoachReleaseLabel()}
      logoutHref="/api/auth/logout"
    />
  );
}

