import { NextResponse } from "next/server";

import type { AuthSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PlannerScopeContext, PlannerWorkspaceScope } from "@/lib/services/planner-workspace";

export const PREMIUM_REQUIRED_CODE = "PREMIUM_REQUIRED";
export const PREMIUM_REQUIRED_MESSAGE = "Esta es una funcion premium. Actualiza tu plan hoy para seguir editando, guardar registros por equipo y desbloquear Cheer Planner completo.";

export async function hasPremiumAccess(userId: string, toolSlug: string, scope?: PlannerWorkspaceScope | string | null, gymId?: string | null) {
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("user_has_tool_access" as never, {
    p_user_id: userId,
    p_tool_slug: toolSlug,
    p_scope_type: scope ?? null,
    p_gym_id: gymId ?? null
  } as never);

  if (error) {
    return false;
  }

  return Boolean(data);
}

export async function hasCheerPlannerPremiumAccess(session: Pick<AuthSession, "userId" | "role">, scope: Pick<PlannerScopeContext, "scopeType" | "gymId">) {
  if (session.role === "admin") {
    return true;
  }

  return hasPremiumAccess(session.userId, "cheer-planner", scope.scopeType, scope.gymId ?? null);
}

export function premiumRequiredResponse() {
  return NextResponse.json({ code: PREMIUM_REQUIRED_CODE, error: PREMIUM_REQUIRED_MESSAGE }, { status: 403 });
}

export async function requireCheerPlannerPremium(session: AuthSession, scope: PlannerScopeContext) {
  if (await hasCheerPlannerPremiumAccess(session, scope)) {
    return null;
  }

  return premiumRequiredResponse();
}
