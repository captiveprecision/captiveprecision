import type { Route } from "next";

import { WorkspaceSidebar } from "@/components/navigation/workspace-sidebar";
import type { AppRole } from "@/lib/auth/session";

const gymNavItems = [
  { href: "/gym" as Route, title: "Dashboard", shortLabel: "D" },
  { href: "/gym/manage-my-gym" as Route, title: "Manage My Gym", shortLabel: "G" },
  { href: "/gym/profile" as Route, title: "Profile", shortLabel: "P" },
  { href: "/gym/messages" as Route, title: "Messages", shortLabel: "M" },
  { href: "/gym/events" as Route, title: "Events", shortLabel: "E" },
  { href: "/gym/settings" as Route, title: "Settings", shortLabel: "S" }
];

const gymToolItems = [
  { href: "/gym/tools/cheer-score-calculator" as Route, title: "Cheer Score", shortLabel: "C" },
  { href: "/gym/tools/full-out-evaluator" as Route, title: "Execution Evaluator", shortLabel: "F" },
  { href: "/gym/tools/cheer-planner" as Route, title: "Cheer Planner", shortLabel: "P" }
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
