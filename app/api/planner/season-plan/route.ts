import { NextRequest, NextResponse } from "next/server";

import { normalizeTeamSeasonPlan } from "@/lib/services/planner-domain-mappers";
import { getPlannerScopeContext, requirePlannerSession, canEditTeamForSession } from "@/lib/services/planner-api-access";
import { ensurePlannerProjectRow } from "@/lib/services/planner-supabase-foundation";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TeamSeasonPlan, TeamSeasonPlanStatus } from "@/lib/domain/season-plan";

type SeasonPlanPayload = {
  teamId?: string;
  status?: TeamSeasonPlan["status"];
  notes?: string;
  checkpoints?: unknown;
  scope?: "coach" | "gym";
};

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isPlanStatus(value: unknown): value is TeamSeasonPlan["status"] {
  return value === "draft" || value === "approved" || value === "archived";
}

export async function POST(request: NextRequest) {
  try {
    const { session, error } = await requirePlannerSession();

    if (error || !session) {
      return error!;
    }

    const payload = await request.json().catch(() => null) as SeasonPlanPayload | null;
    const scope = getPlannerScopeContext(request, session, payload?.scope ?? null);
    const currentProject = await ensurePlannerProjectRow(scope);

    if (!currentProject) {
      return NextResponse.json({ error: "Supabase planner tables are missing. Run migration 006_planner_remote_persistence.sql first." }, { status: 409 });
    }

    const teamId = asString(payload?.teamId);
    const notes = asString(payload?.notes);
    const status = isPlanStatus(payload?.status) ? payload.status : "draft";
    const checkpoints = Array.isArray(payload?.checkpoints) ? payload.checkpoints : [];

    if (!teamId) {
      return NextResponse.json({ error: "A team id is required to save a season plan." }, { status: 400 });
    }

    if (!(await canEditTeamForSession(teamId, session, scope))) {
      return NextResponse.json({ error: "You do not have access to edit this season plan." }, { status: 403 });
    }

    const admin = createAdminClient();
    const { data, error: upsertError } = await admin
      .from("team_season_plans" as never)
      .upsert({
        team_id: teamId,
        planner_project_id: scope.projectId,
        status,
        notes,
        checkpoints
      } as never, { onConflict: "planner_project_id,team_id" as never })
      .select("*" as never)
      .single();

    if (upsertError || !data) {
      if (upsertError?.code === "42P01") {
        return NextResponse.json({ error: "Supabase planner tables are missing. Run migration 006_planner_remote_persistence.sql first." }, { status: 409 });
      }

      return NextResponse.json({ error: upsertError?.message ?? "Unable to save the season plan." }, { status: 500 });
    }

    const row = data as {
      id: string;
      planner_project_id: string;
      team_id: string;
      status: TeamSeasonPlanStatus;
      notes: string;
      selections?: unknown;
      checkpoints?: unknown;
      created_at: string;
      updated_at: string;
    };

    return NextResponse.json({
      seasonPlan: normalizeTeamSeasonPlan({
        id: row.id,
        workspaceId: scope.workspaceId,
        plannerProjectId: row.planner_project_id,
        teamId: row.team_id,
        status: row.status,
        notes: row.notes,
        checkpoints: Array.isArray(row.checkpoints) ? row.checkpoints : [],
        createdAt: row.created_at,
        updatedAt: row.updated_at
      })
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save the season plan.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
