import { NextRequest, NextResponse } from "next/server";

import { buildPlannerEvaluationFromRow, ensurePlannerProjectRow } from "@/lib/services/planner-supabase-foundation";
import { getEditableAthleteRow, getPlannerScopeContext, requirePlannerSession } from "@/lib/services/planner-api-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUuidString } from "@/lib/services/planner-workspace";

function asObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  try {
    const { session, error } = await requirePlannerSession();

    if (error || !session) {
      return error!;
    }

    const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
    const scope = getPlannerScopeContext(request, session, typeof payload?.scope === "string" ? payload.scope : null);
    const evaluation = asObject(payload?.evaluation);
    const evaluationId = asString(evaluation?.id);
    const athleteId = asString(evaluation?.athleteId);

    if (!evaluation || !evaluationId || !isUuidString(athleteId)) {
      return NextResponse.json({ error: "A valid evaluation payload with a persisted athlete id is required." }, { status: 400 });
    }

    const currentProject = await ensurePlannerProjectRow(scope);

    if (!currentProject) {
      return NextResponse.json({ error: "Supabase planner tables are missing. Run migration 006_planner_remote_persistence.sql first." }, { status: 409 });
    }

    const athlete = await getEditableAthleteRow(athleteId, session, scope);

    if (!athlete) {
      return NextResponse.json({ error: "You do not have access to save an evaluation for this athlete." }, { status: 403 });
    }

    const admin = createAdminClient();
    const { data, error: upsertError } = await admin
      .from("planner_evaluations" as never)
      .upsert({
        id: evaluationId,
        planner_project_id: scope.projectId,
        athlete_id: athleteId,
        occurred_at: asString(evaluation.occurredAt) || null,
        record: evaluation
      } as never, { onConflict: "id" as never })
      .select("*" as never)
      .single();

    if (upsertError || !data) {
      if (upsertError?.code === "42P01") {
        return NextResponse.json({ error: "Supabase planner tables are missing. Run migration 006_planner_remote_persistence.sql first." }, { status: 409 });
      }

      return NextResponse.json({ error: upsertError?.message ?? "Unable to save the evaluation." }, { status: 500 });
    }

    return NextResponse.json({ evaluation: buildPlannerEvaluationFromRow(data, scope.workspaceId) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save the evaluation.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
