import { NextRequest, NextResponse } from "next/server";

import { listRemotePlannerFoundation } from "@/lib/services/planner-supabase-foundation";
import { getPlannerScopeContext, requirePlannerSession } from "@/lib/services/planner-api-access";

export async function GET(request: NextRequest) {
  try {
    const { session, error } = await requirePlannerSession();

    if (error || !session) {
      return error!;
    }

    const scope = getPlannerScopeContext(request, session);
    const snapshot = await listRemotePlannerFoundation(session, scope.scope);
    return NextResponse.json(snapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load planner foundation data.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
