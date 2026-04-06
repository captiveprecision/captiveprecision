import type { Route } from "next";

import { ToolsListingShell } from "@/components/tools/tools-listing-shell";

export default function GymToolsPage() {
  return (
    <ToolsListingShell
      title="All gym tools"
      description="Gym memberships have access to the current evaluation tools, while Cheer Planner now lives as a primary module in the main workspace navigation."
      heroBadges={["Gym workspace", "2 live tools"]}
      tools={[
        {
          id: "cheer-score",
          label: "Live",
          title: "Cheer Score",
          description: "Scoring access for the full gym workspace.",
          href: "/gym/tools/cheer-score-calculator" as Route,
          actionLabel: "Open tool",
          statusVariant: "accent"
        },
        {
          id: "execution-evaluator",
          label: "Live",
          title: "Execution Evaluator",
          description: "Routine execution scoring with central admin-controlled scoring values and local records saved by team.",
          href: "/gym/tools/full-out-evaluator" as Route,
          actionLabel: "Open tool",
          statusVariant: "accent"
        }
      ]}
      sideTitle="Gym access"
      sideDescription="Gym memberships centralize evaluation tools here, while Cheer Planner now runs as a core module outside the tools group."
      sideItems={[
        { label: "Current lineup", value: "Score, Execution" },
        { label: "Audience", value: "Gym-wide shared usage" },
        { label: "Core module", value: "Cheer Planner" }
      ]}
    />
  );
}
