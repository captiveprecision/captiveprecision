import { NextRequest, NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

type RosterAction = "assign" | "remove" | "clear";

type RosterPayload = {
  action?: RosterAction;
  teamId?: string;
  athleteId?: string;
};

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function canEditTeam(teamId: string, session: Awaited<ReturnType<typeof getAuthSession>>) {
  if (!session) {
    return false;
  }

  if (session.role === "admin") {
    return true;
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("teams" as never)
    .select("id, gym_id, primary_coach_profile_id" as never)
    .eq("id", teamId as never)
    .maybeSingle();

  const team = data as { id: string; gym_id: string | null; primary_coach_profile_id: string | null } | null;

  if (!team) {
    return false;
  }

  return team.gym_id
    ? team.gym_id === (session.primaryGymId ?? null)
    : team.primary_coach_profile_id === session.userId;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();

    if (!session || !session.roles.includes("coach")) {
      return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
    }

    const payload = await request.json().catch(() => null) as RosterPayload | null;
    const action = payload?.action;
    const teamId = asString(payload?.teamId);
    const athleteId = asString(payload?.athleteId);

    if (!teamId || !(await canEditTeam(teamId, session))) {
      return NextResponse.json({ error: "You do not have access to edit this roster." }, { status: 403 });
    }

    const admin = createAdminClient();

    if (action === "assign") {
      if (!athleteId) {
        return NextResponse.json({ error: "An athlete id is required to assign roster membership." }, { status: 400 });
      }

      const { error: deleteError } = await admin
        .from("athlete_team_assignments" as never)
        .delete()
        .eq("athlete_id", athleteId as never);

      if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500 });
      }

      const { error: insertError } = await admin
        .from("athlete_team_assignments" as never)
        .insert({ athlete_id: athleteId, team_id: teamId } as never);

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }

      return NextResponse.json({ ok: true });
    }

    if (action === "remove") {
      if (!athleteId) {
        return NextResponse.json({ error: "An athlete id is required to remove roster membership." }, { status: 400 });
      }

      const { error: deleteError } = await admin
        .from("athlete_team_assignments" as never)
        .delete()
        .eq("team_id", teamId as never)
        .eq("athlete_id", athleteId as never);

      if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500 });
      }

      return NextResponse.json({ ok: true });
    }

    if (action === "clear") {
      const { error: deleteError } = await admin
        .from("athlete_team_assignments" as never)
        .delete()
        .eq("team_id", teamId as never);

      if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500 });
      }

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unsupported roster action." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update roster.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
