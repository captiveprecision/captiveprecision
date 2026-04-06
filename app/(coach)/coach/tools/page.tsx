import { ToolsListingShell } from "@/components/tools/tools-listing-shell";

export default function CoachToolsPage() {
  return (
    <ToolsListingShell
      title="Tools"
      description="Available tools and upcoming releases for the coach workspace."
      heroBadges={["Coach workspace", "2 live tools"]}
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
        }
      ]}
      sideTitle="Coach access"
      sideDescription="This workspace focuses on live evaluation tools, while Cheer Planner now lives as a primary module in the main workspace navigation."
      sideItems={[
        { label: "Current lineup", value: "Score, Execution" },
        { label: "Primary use", value: "Evaluation workflows" },
        { label: "Core module", value: "Cheer Planner" }
      ]}
    />
  );
}
