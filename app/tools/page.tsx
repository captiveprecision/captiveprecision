import type { Route } from "next";

import { ToolsListingShell } from "@/components/tools/tools-listing-shell";

export default function ToolsPage() {
  return (
    <ToolsListingShell
      title="Tools"
      description="A central view of live workflow tools that remain inside the shared tools area."
      heroBadges={["2 live tools", "Planner moved to workspace"]}
      tools={[
        {
          id: "cheer-score",
          label: "Live",
          title: "Cheer Score",
          description: "The first active tool in the platform.",
          href: "/tools/cheer-score-calculator" as Route,
          actionLabel: "Open tool",
          statusVariant: "accent"
        },
        {
          id: "execution-evaluator",
          label: "Live",
          title: "Execution Evaluator",
          description: "Routine execution scoring with central admin-controlled scoring values and local records saved by team.",
          href: "/tools/full-out-evaluator" as Route,
          actionLabel: "Open tool",
          statusVariant: "accent"
        }
      ]}
      sideTitle="Platform rollout"
      sideDescription="This surface now focuses on shared tools, while Cheer Planner has been promoted into the main workspace experience."
      sideItems={[
        { label: "Live now", value: "Score, Execution" },
        { label: "Primary use", value: "Evaluation workflows" },
        { label: "Core module", value: "Cheer Planner" }
      ]}
    />
  );
}
