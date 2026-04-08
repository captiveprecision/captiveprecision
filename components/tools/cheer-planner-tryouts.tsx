"use client";

import { CheerPlannerShell } from "@/components/features/cheer-planner/shared/cheer-planner-shell";
import { useCheerPlannerIntegration } from "@/lib/services/planner-integration";
import type { PlannerWorkspaceScope } from "@/lib/services/planner-workspace";

export function CheerPlannerTryouts({ scope }: { scope: PlannerWorkspaceScope }) {
  const integration = useCheerPlannerIntegration(scope);
  return <CheerPlannerShell integration={integration} />;
}
