import type { Route } from "next";

import { ToolsListingShell } from "@/components/tools/tools-listing-shell";

export default function GymToolsPage() {
  return (
    <ToolsListingShell
      title="All gym tools"
      description="Gym memberships have access to all current tools and future shared modules."
      heroBadges={["Gym workspace", "3 live tools"]}
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
        },
        {
          id: "cheer-planner",
          label: "Live",
          title: "Cheer Planner",
          description: "Step 1 of the planner is now live with tryout evaluations, local templates, and athlete records prepared for later planner phases.",
          href: "/gym/tools/cheer-planner" as Route,
          actionLabel: "Open tool",
          statusVariant: "accent"
        }
      ]}
      sideTitle="Gym access"
      sideDescription="Gym memberships centralize shared tool access for roster, scoring, and planning work across the organization."
      sideItems={[
        { label: "Current lineup", value: "Score, Execution, Planner" },
        { label: "Audience", value: "Gym-wide shared usage" },
        { label: "Roadmap", value: "Additional shared modules ahead" }
      ]}
    />
  );
}
