"use client";

import { CheerPlannerShell } from "@/components/features/cheer-planner/shared/cheer-planner-shell";
import { useCheerPlannerIntegration } from "@/lib/services/planner-integration";
import { buildCheerPlannerCapabilities } from "@/lib/services/planner-capabilities";
import type { GymRegistrationNumberMode } from "@/lib/services/gym-registration-settings";
import type { PlannerWorkspaceScope } from "@/lib/services/planner-workspace";

export function CheerPlannerTryouts({
  scope,
  registrationNumberMode = "auto"
}: {
  scope: PlannerWorkspaceScope;
  registrationNumberMode?: GymRegistrationNumberMode;
}) {
  const integration = useCheerPlannerIntegration(scope);
  return (
    <CheerPlannerShell
      integration={integration}
      capabilities={buildCheerPlannerCapabilities(scope)}
      registrationNumberMode={registrationNumberMode}
    />
  );
}
