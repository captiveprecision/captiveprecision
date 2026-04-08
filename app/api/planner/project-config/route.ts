import { NextRequest, NextResponse } from "next/server";

import { getPlannerScopeContext, requirePlannerSession } from "@/lib/services/planner-api-access";
import { buildPlannerProjectFromRow, ensurePlannerProjectRow } from "@/lib/services/planner-supabase-foundation";
import { createAdminClient } from "@/lib/supabase/admin";

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export async function POST(request: NextRequest) {
  try {
    const { session, error } = await requirePlannerSession();

    if (error || !session) {
      return error!;
    }

    const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
    const scope = getPlannerScopeContext(request, session, typeof payload?.scope === "string" ? payload.scope : null);
    const currentRow = await ensurePlannerProjectRow(scope);

    if (!currentRow) {
      return NextResponse.json({ error: "Supabase planner tables are missing. Run migration 006_planner_remote_persistence.sql first." }, { status: 409 });
    }

    const admin = createAdminClient();
    const nextRow = {
      name: asString(payload?.name) || currentRow.name,
      status: asString(payload?.status) || currentRow.status,
      pipeline_stage: asString(payload?.pipelineStage) || currentRow.pipeline_stage,
      template: asObject(payload?.template) ?? currentRow.template,
      qualification_rules: asObject(payload?.qualificationRules) ?? currentRow.qualification_rules
    };

    const { data, error: updateError } = await admin
      .from("planner_projects" as never)
      .update(nextRow as never)
      .eq("id", scope.projectId as never)
      .select("*" as never)
      .single();

    if (updateError || !data) {
      return NextResponse.json({ error: updateError?.message ?? "Unable to save planner configuration." }, { status: 500 });
    }

    return NextResponse.json({ plannerProject: buildPlannerProjectFromRow(data, scope) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save planner configuration.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
