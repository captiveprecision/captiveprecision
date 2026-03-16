import type { Route } from "next";

import { WorkspaceSidebar } from "@/components/navigation/workspace-sidebar";

const coachNavItems = [
  { href: "/coach" as Route, title: "Dashboard", shortLabel: "D" },
  { href: "/coach/my-teams" as Route, title: "My Teams", shortLabel: "T" },
  { href: "/coach/profile" as Route, title: "Profile", shortLabel: "P" },
  { href: "/coach/messages" as Route, title: "Messages", shortLabel: "M" },
  { href: "/coach/events" as Route, title: "Events", shortLabel: "E" },
  { href: "/coach/settings" as Route, title: "Settings", shortLabel: "S" }
];

const coachToolItems = [
  { href: "/coach/tools/cheer-score-calculator" as Route, title: "Cheer Score", shortLabel: "C" },
  { href: "/coach/tools/full-out-evaluator" as Route, title: "Full Out Evaluator", shortLabel: "F" },
  { href: "/coach/tools/cheer-planner" as Route, title: "Cheer Planner", shortLabel: "P" }
];

export function CoachSidebar() {
  return (
    <WorkspaceSidebar
      brandSubtitle="Coach workspace"
      navItems={coachNavItems}
      toolItems={coachToolItems}
      footerTitle="Coach release"
      footerCopy="The coach workspace now contains the live dashboard, profile flow, settings shell, and the first premium tool set."
      logoutHref="/api/auth/logout"
    />
  );
}
