"use client";

import { CheerPlannerShell } from "@/components/features/cheer-planner/shared/cheer-planner-shell";
import { useCheerPlannerIntegration } from "@/lib/services/planner-integration";

export function CheerPlannerTryouts() {
  const integration = useCheerPlannerIntegration();
  return <CheerPlannerShell integration={integration} />;
}
