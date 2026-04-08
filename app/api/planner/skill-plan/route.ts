import { NextRequest, NextResponse } from "next/server";

import { normalizeTeamSkillPlan } from "@/lib/services/planner-domain-mappers";
import { getPlannerScopeContext, requirePlannerSession, canEditTeamForSession } from "@/lib/services/planner-api-access";
import { ensurePlannerProjectRow } from "@/lib/services/planner-supabase-foundation";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TeamSkillPlan, TeamSkillPlanStatus } from "@/lib/domain/skill-plan";

type SkillPlanPayload = {
  teamId?: string;
  status?: TeamSkillPlan["status"];
  notes?: string;
  selections?: unknown;
  scope?: "coach" | "gym";
};

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isPlanStatus(value: unknown): value is TeamSkillPlan["status"] {
  return value === "draft" || value === "approved" || value === "archived";
}

export async function POST(request: NextRequest) {
  try {
    const { session, error } = await requirePlannerSession();

    if (error || !session) {
      return error!;
    }

    const payload = await request.json().catch(() => null) as SkillPlanPayload | null;
    const scope = getPlannerScopeContext(request, session, payload?.scope ?? null);
    const currentProject = await ensurePlannerProjectRow(scope);

    if (!currentProject) {
      return NextResponse.json({ error: "Supabase planner tables are missing. Run migration 006_planner_remote_persistence.sql first." }, { status: 409 });
    }

    const teamId = asString(payload?.teamId);
    const notes = asString(payload?.notes);
    const status = isPlanStatus(payload?.status) ? payload.status : "draft";
    const selections = Array.isArray(payload?.selections) ? payload.selections : [];

    if (!teamId) {
      return NextResponse.json({ error: "A team id is required to save a skill plan." }, { status: 400 });
    }

    if (!(await canEditTeamForSession(teamId, session, scope))) {
      return NextResponse.json({ error: "You do not have access to edit this skill plan." }, { status: 403 });
    }

    const admin = createAdminClient();
    const { data, error: upsertError } = await admin
      .from("team_skill_plans" as never)
      .upsert({
        team_id: teamId,
        planner_project_id: scope.projectId,
        status,
        notes,
        selections
      } as never, { onConflict: "planner_project_id,team_id" as never })
      .select("*" as never)
      .single();

    if (upsertError || !data) {
      if (upsertError?.code === "42P01") {
        return NextResponse.json({ error: "Supabase planner tables are missing. Run migration 006_planner_remote_persistence.sql first." }, { status: 409 });
      }

      return NextResponse.json({ error: upsertError?.message ?? "Unable to save the skill plan." }, { status: 500 });
    }

    const row = data as {
      id: string;
      planner_project_id: string;
      team_id: string;
      status: TeamSkillPlanStatus;
      notes: string;
      selections?: unknown;
      checkpoints?: unknown;
      created_at: string;
      updated_at: string;
    };

    return NextResponse.json({
      skillPlan: normalizeTeamSkillPlan({
        id: row.id,
        workspaceId: scope.workspaceId,
        plannerProjectId: row.planner_project_id,
        teamId: row.team_id,
        status: row.status,
        notes: row.notes,
        selections: Array.isArray(row.selections) ? row.selections : [],
        createdAt: row.created_at,
        updatedAt: row.updated_at
      })
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save the skill plan.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
