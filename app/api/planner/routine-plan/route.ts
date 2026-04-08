import { NextRequest, NextResponse } from "next/server";

import type { TeamRoutinePlanStatus } from "@/lib/domain/routine-plan";
import { normalizeTeamRoutinePlan } from "@/lib/services/planner-domain-mappers";
import { deriveRoutineItemsFromDocument, normalizeRoutineDocument } from "@/lib/services/planner-routine-builder";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerScopeContext, requirePlannerSession, canEditTeamForSession } from "@/lib/services/planner-api-access";
import { ensurePlannerProjectRow } from "@/lib/services/planner-supabase-foundation";

type RoutinePlanPayload = {
  teamId?: string;
  status?: "draft" | "approved" | "archived";
  notes?: string;
  document?: unknown;
  scope?: "coach" | "gym";
};

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isRoutinePlanStatus(value: unknown): value is "draft" | "approved" | "archived" {
  return value === "draft" || value === "approved" || value === "archived";
}

export async function POST(request: NextRequest) {
  try {
    const { session, error } = await requirePlannerSession();

    if (error || !session) {
      return error!;
    }

    const payload = await request.json().catch(() => null) as RoutinePlanPayload | null;
    const scope = getPlannerScopeContext(request, session, payload?.scope ?? null);
    const currentProject = await ensurePlannerProjectRow(scope);

    if (!currentProject) {
      return NextResponse.json({ error: "Supabase planner tables are missing. Run migration 006_planner_remote_persistence.sql first." }, { status: 409 });
    }

    const teamId = asString(payload?.teamId);
    const notes = asString(payload?.notes);
    const status = isRoutinePlanStatus(payload?.status) ? payload.status : "draft";

    if (!teamId) {
      return NextResponse.json({ error: "A team id is required to save a routine plan." }, { status: 400 });
    }

    if (!(await canEditTeamForSession(teamId, session, scope))) {
      return NextResponse.json({ error: "You do not have access to edit this routine plan." }, { status: 403 });
    }

    const document = normalizeRoutineDocument(payload?.document as Parameters<typeof normalizeRoutineDocument>[0], "Untitled routine");
    const admin = createAdminClient();
    const { data, error: upsertError } = await admin
      .from("team_routine_plans" as never)
      .upsert({
        team_id: teamId,
        planner_project_id: scope.projectId,
        status,
        notes,
        document
      } as never, { onConflict: "planner_project_id,team_id" as never })
      .select("*" as never)
      .single();

    if (upsertError || !data) {
      if (upsertError?.code === "42P01") {
        return NextResponse.json({ error: "Supabase routine plans table is missing. Run migrations 005_team_routine_plans.sql and 007_planner_plan_scope_indexes.sql first." }, { status: 409 });
      }

      return NextResponse.json({ error: upsertError?.message ?? "Unable to save the routine plan." }, { status: 500 });
    }

    const row = data as {
      id: string;
      planner_project_id: string;
      team_id: string;
      status: TeamRoutinePlanStatus;
      notes: string;
      created_at: string;
      updated_at: string;
    };

    const normalizedPlan = normalizeTeamRoutinePlan({
      id: row.id,
      workspaceId: scope.workspaceId,
      plannerProjectId: row.planner_project_id,
      teamId: row.team_id,
      status: row.status,
      notes: row.notes,
      document,
      items: deriveRoutineItemsFromDocument(document),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });

    return NextResponse.json({ routinePlan: normalizedPlan });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save routine plan.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
