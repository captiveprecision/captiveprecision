import { NextRequest, NextResponse } from "next/server";

import { getAuthSession, type AuthSession } from "@/lib/auth/session";
import { parsePlannerWorkspaceScope, resolvePlannerScopeContext, type PlannerScopeContext, type PlannerWorkspaceScope } from "@/lib/services/planner-workspace";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/types/database";

type AthleteRow = Database["public"]["Tables"]["athletes"]["Row"];
type TeamRow = Database["public"]["Tables"]["teams"]["Row"];

export async function requirePlannerSession() {
  const session = await getAuthSession();

  if (!session || !session.roles.includes("coach")) {
    return { session: null, error: NextResponse.json({ error: "Authentication is required." }, { status: 401 }) };
  }

  return { session, error: null };
}

export function getPlannerScopeContext(
  request: NextRequest,
  session: Pick<AuthSession, "userId" | "primaryGymId">,
  scopeValue?: PlannerWorkspaceScope | string | null
): PlannerScopeContext {
  const urlScope = request.nextUrl.searchParams.get("scope");
  return resolvePlannerScopeContext(session, parsePlannerWorkspaceScope(scopeValue ?? urlScope));
}

export async function canEditTeamForSession(teamId: string, session: AuthSession, scope: PlannerScopeContext) {
  if (session.role === "admin") {
    return true;
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("teams" as never)
    .select("id, gym_id, primary_coach_profile_id" as never)
    .eq("id", teamId as never)
    .maybeSingle();

  const team = data as Pick<TeamRow, "id" | "gym_id" | "primary_coach_profile_id"> | null;

  if (!team) {
    return false;
  }

  if (scope.scopeType === "gym") {
    return Boolean(team.gym_id && team.gym_id === (scope.gymId ?? session.primaryGymId ?? null));
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

export async function getEditableAthleteRow(athleteId: string, session: AuthSession, scope: PlannerScopeContext) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("athletes" as never)
    .select("*" as never)
    .eq("id", athleteId as never)
    .maybeSingle();

  const athlete = data as AthleteRow | null;

  if (!athlete) {
    return null;
  }

  if (session.role === "admin") {
    return athlete;
  }

  if (scope.scopeType === "gym") {
    return athlete.gym_id && athlete.gym_id === (scope.gymId ?? session.primaryGymId ?? null) ? athlete : null;
  }

  return athlete.created_by_profile_id === session.userId ? athlete : null;
}
