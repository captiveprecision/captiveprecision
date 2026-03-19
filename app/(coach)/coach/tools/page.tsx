import { ToolsListingShell } from "@/components/tools/tools-listing-shell";

export default function CoachToolsPage() {
  return (
    <ToolsListingShell
      title="Tools"
      description="Available tools and upcoming releases for the coach workspace."
      heroBadges={["Coach workspace", "3 live tools"]}
      tools={[
        {
          id: "cheer-score",
          label: "Live",
          title: "Cheer Score",
          description: "The first active premium tool in the coach workspace.",
          href: "/coach/tools/cheer-score-calculator",
          actionLabel: "Open tool",
          statusVariant: "accent"
        },
        {
          id: "execution-evaluator",
          label: "Live",
          title: "Execution Evaluator",
          description: "Routine execution scoring with central admin-controlled scoring values and local records saved by team.",
          href: "/coach/tools/full-out-evaluator",
          actionLabel: "Open tool",
          statusVariant: "accent"
        },
        {
          id: "cheer-planner",
          label: "Live",
          title: "Cheer Planner",
          description: "Step 1 of the planner is now live with tryout evaluations, local templates, and athlete records prepared for later planner phases.",
          href: "/coach/tools/cheer-planner",
          actionLabel: "Open tool",
          statusVariant: "accent"
        }
      ]}
      sideTitle="Coach access"
      sideDescription="This workspace focuses on live evaluation and planning tools that support team-level operational work."
      sideItems={[
        { label: "Current lineup", value: "Score, Execution, Planner" },
        { label: "Primary use", value: "Evaluation and planning" },
        { label: "Future modules", value: "Shared through Tools" }
      ]}
    />
  );
}
