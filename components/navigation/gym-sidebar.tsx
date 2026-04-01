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

export function GymSidebar({ availableWorkspaces }: { availableWorkspaces: AppRole[] }) {
  return (
    <WorkspaceSidebar
      currentWorkspace="gym"
      availableWorkspaces={availableWorkspaces}
      brandSubtitle="Gym workspace"
      navItems={gymNavItems}
      toolItems={gymToolItems}
      footerTitle="Gym release"
      footerCopy="The gym workspace manages coach licenses, shared teams, athletes, and organization-wide visibility across tools."
      logoutHref="/api/auth/logout"
    />
  );
}
