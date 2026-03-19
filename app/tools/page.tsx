import { ToolsListingShell } from "@/components/tools/tools-listing-shell";

export default function ToolsPage() {
  return (
    <ToolsListingShell
      title="Tools"
      description="A central view of live workflow tools and the modules that are already planned into the platform."
      heroBadges={["2 live tools", "Planner phase active"]}
      tools={[
        {
          id: "cheer-score",
          label: "Available now",
          title: "Cheer Score",
          description: "The first active tool in the platform.",
          href: "/coach/tools/cheer-score-calculator",
          actionLabel: "Open tool",
          statusVariant: "accent"
        },
        {
          id: "full-out-evaluator",
          label: "Coming soon",
          title: "Full Out Evaluator",
          description: "Placeholder for a future performance review workflow.",
          statusVariant: "subtle"
        },
        {
          id: "cheer-planner",
          label: "Live",
          title: "Cheer Planner",
          description: "Step 1 of the planner is now live with tryout evaluations, local templates, and athlete records prepared for later planner phases.",
          href: "/tools/cheer-planner",
          actionLabel: "Open tool",
          statusVariant: "accent"
        }
      ]}
      sideTitle="Platform rollout"
      sideDescription="This surface stays intentionally simple while tools continue to move into the shared product system."
      sideItems={[
        { label: "Live now", value: "Cheer Score, Cheer Planner" },
        { label: "Next in queue", value: "Full Out Evaluator" },
        { label: "Access path", value: "Coach workspace default" }
      ]}
    />
  );
}
