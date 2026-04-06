import { NextRequest, NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth/session";
import { normalizeTeamRoutinePlan } from "@/lib/services/planner-domain-mappers";
import { deriveRoutineItemsFromDocument, normalizeRoutineDocument } from "@/lib/services/planner-routine-builder";
import { createAdminClient } from "@/lib/supabase/admin";

type RoutinePlanPayload = {
  teamId?: string;
  plannerProjectId?: string;
  status?: "draft" | "approved" | "archived";
  notes?: string;
  document?: unknown;
};

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isRoutinePlanStatus(value: unknown): value is "draft" | "approved" | "archived" {
  return value === "draft" || value === "approved" || value === "archived";
}

async function canEditTeam(teamId: string, session: Awaited<ReturnType<typeof getAuthSession>>) {
  if (!session) {
    return false;
  }

  if (session.role === "admin") {
    return true;
  }

  const admin = createAdminClient();
  const { data: teamData } = await admin
    .from("teams" as never)
    .select("id, gym_id, primary_coach_profile_id" as never)
    .eq("id", teamId as never)
    .maybeSingle();

  const team = teamData as { id: string; gym_id: string | null; primary_coach_profile_id: string | null } | null;

  if (!team) {
    return false;
  }

  if (team.gym_id) {
    return team.gym_id === (session.primaryGymId ?? null);
  }

  if (team.primary_coach_profile_id === session.userId) {
    return true;
  }

  const { data: linkedCoach } = await admin
    .from("team_coaches" as never)
    .select("id" as never)
    .eq("team_id", teamId as never)
    .eq("coach_profile_id", session.userId as never)
    .maybeSingle();

  return Boolean(linkedCoach);
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();

    if (!session || !session.roles.includes("coach")) {
      return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
    }

    const payload = await request.json().catch(() => null) as RoutinePlanPayload | null;
    const teamId = asString(payload?.teamId);
    const plannerProjectId = asString(payload?.plannerProjectId) || "default-cheer-planner-project";
    const notes = asString(payload?.notes);
    const status = isRoutinePlanStatus(payload?.status) ? payload?.status : "draft";

    if (!teamId) {
      return NextResponse.json({ error: "A team id is required to save a routine plan." }, { status: 400 });
    }

    if (!(await canEditTeam(teamId, session))) {
      return NextResponse.json({ error: "You do not have access to edit this routine plan." }, { status: 403 });
    }

    const document = normalizeRoutineDocument(payload?.document as Parameters<typeof normalizeRoutineDocument>[0], "Untitled routine");
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("team_routine_plans" as never)
      .upsert({
        team_id: teamId,
        planner_project_id: plannerProjectId,
        status,
        notes,
        document
      } as never, { onConflict: "team_id" })
      .select("*" as never)
      .single();

    if (error || !data) {
      if (error?.code === "42P01") {
        return NextResponse.json({ error: "Supabase routine plans table is missing. Run migration 005_team_routine_plans.sql first." }, { status: 409 });
      }

      return NextResponse.json({ error: error?.message ?? "Unable to save the routine plan." }, { status: 500 });
    }

    const record = data as {
      id: string;
      team_id: string;
      planner_project_id: string;
      status: string;
      notes: string;
      document: unknown;
      created_at: string;
      updated_at: string;
    };

    const normalizedPlan = normalizeTeamRoutinePlan({
      id: record.id,
      teamId: record.team_id,
      plannerProjectId: record.planner_project_id,
      status: record.status as "draft" | "approved" | "archived",
      notes: record.notes,
      document,
      items: deriveRoutineItemsFromDocument(document),
      createdAt: record.created_at,
      updatedAt: record.updated_at
    });

    return NextResponse.json({ routinePlan: normalizedPlan });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save routine plan.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
