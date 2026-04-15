import { NextRequest, NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth/session";
import { requireCheerPlannerPremium } from "@/lib/access/membership";
import { parsePlannerWorkspaceScope, resolvePlannerScopeContext } from "@/lib/services/planner-workspace";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { findCoachOptionByText, listAvailableCoachOptionsForSession } from "@/lib/services/team-coach-directory";
import { getPlannerCommandError, savePlannerTeamCommand, softDeletePlannerTeamCommand } from "@/lib/services/planner-command-service";
import type { Database } from "@/lib/types/database";

const TEAM_LEVEL_OPTIONS = new Set(["Level 1", "Level 2", "Level 3", "Level 4", "Level 5", "Level 6", "Level 7"]);
const TEAM_DIVISION_OPTIONS = new Set(["Prep", "Elite", "Rec", "Novice"]);
const AGE_CATEGORY_OPTIONS = new Set(["Tiny", "Mini", "Youth", "Junior", "Senior", "Open"]);

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

type CoachAssignmentPayload = {
  selectedCoachId?: string;
  manualName?: string;
};

type SessionProfile = Pick<ProfileRow, "id" | "display_name" | "email" | "role" | "beta_access_status" | "primary_gym_id">;

type ResolvedTeamPayload = {
  name: string;
  teamLevel: string;
  teamType: string;
  teamDivision: string;
  trainingDays: string;
  trainingHours: string;
  linkedCoachIds: string[];
  assignedCoachNames: string[];
};

function parseAppRole(value: unknown) {
  return value === "admin" || value === "coach" || value === "gym" ? value : null;
}

function parseBetaAccessStatus(value: unknown) {
  return value === "approved" ? value : null;
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

async function getApprovedProfile() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: NextResponse.json({ error: "Authentication is required." }, { status: 401 }), user: null, profile: null as SessionProfile | null };
  }

  const admin = createAdminClient();
  const { data: profileData, error: profileError } = await admin
    .from("profiles" as never)
    .select("id, display_name, email, role, beta_access_status, primary_gym_id" as never)
    .eq("id", user.id as never)
    .maybeSingle();

  const profile = profileData as SessionProfile | null;
  const role = parseAppRole(profile?.role);
  const betaStatus = parseBetaAccessStatus(profile?.beta_access_status);

  if (profileError || !profile || !role || !betaStatus || (role !== "admin" && role !== "coach" && role !== "gym")) {
    return { error: NextResponse.json({ error: "This account is missing a valid application profile." }, { status: 403 }), user: null, profile: null as SessionProfile | null };
  }

  return { error: null, user, profile };
}

async function resolveTeamPayload(payload: unknown, profile: SessionProfile, userEmail: string) {
  const name = normalizeText((payload as Record<string, unknown> | null)?.name);
  const teamLevel = normalizeText((payload as Record<string, unknown> | null)?.teamLevel);
  const teamType = normalizeText((payload as Record<string, unknown> | null)?.teamType);
  const teamDivision = normalizeText((payload as Record<string, unknown> | null)?.teamDivision);
  const trainingDays = normalizeText((payload as Record<string, unknown> | null)?.trainingDays);
  const trainingHours = normalizeText((payload as Record<string, unknown> | null)?.trainingHours);
  const coachAssignments = Array.isArray((payload as Record<string, unknown> | null)?.coachAssignments)
    ? (payload as { coachAssignments: CoachAssignmentPayload[] }).coachAssignments
    : [];

  if (!name || !TEAM_LEVEL_OPTIONS.has(teamLevel) || !teamType || !AGE_CATEGORY_OPTIONS.has(teamType) || !TEAM_DIVISION_OPTIONS.has(teamDivision)) {
    return { error: "Team name, level, age category, and division are required.", data: null as ResolvedTeamPayload | null };
  }

  const availableCoachOptions = await listAvailableCoachOptionsForSession({
    userId: profile.id,
    displayName: profile.display_name ?? profile.email ?? "Coach",
    email: profile.email ?? userEmail,
    primaryGymId: profile.primary_gym_id ?? null
  });

  const coachOptionMap = new Map(availableCoachOptions.map((option) => [option.id, option] as const));
  const linkedCoachIds: string[] = [];
  const assignedCoachNames: string[] = [];

  coachAssignments.forEach((assignment) => {
    const selectedCoachId = normalizeText(assignment.selectedCoachId);
    const manualName = normalizeText(assignment.manualName);
    const selectedOption = selectedCoachId ? coachOptionMap.get(selectedCoachId) ?? null : null;
    const matchedManualOption = !selectedOption && manualName ? findCoachOptionByText(availableCoachOptions, manualName) : null;
    const resolvedOption = selectedOption ?? matchedManualOption;

    if (resolvedOption) {
      linkedCoachIds.push(resolvedOption.id);
      assignedCoachNames.push(resolvedOption.label);
      return;
    }

    if (manualName) {
      assignedCoachNames.push(manualName);
    }
  });

  return {
    error: null,
    data: {
      name,
      teamLevel,
      teamType,
      teamDivision,
      trainingDays,
      trainingHours,
      linkedCoachIds: uniqueStrings(linkedCoachIds),
      assignedCoachNames: uniqueStrings(assignedCoachNames)
    } satisfies ResolvedTeamPayload
  };
}

export async function POST(request: NextRequest) {
  try {
    const { error, user, profile } = await getApprovedProfile();

    if (error || !user || !profile) {
      return error!;
    }

    const payload = await request.json().catch(() => null);
    const session = await getAuthSession();

    if (!session) {
      return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
    }

    const scope = resolvePlannerScopeContext(session, parsePlannerWorkspaceScope((payload as Record<string, unknown> | null)?.scope));
    const premiumError = await requireCheerPlannerPremium(session, scope);

    if (premiumError) {
      return premiumError;
    }
    const resolved = await resolveTeamPayload(payload, profile, user.email ?? "");

    if (resolved.error || !resolved.data) {
      return NextResponse.json({ error: resolved.error }, { status: 400 });
    }

    const result = await savePlannerTeamCommand(session, scope.scope, {
      workspaceRootId: typeof (payload as Record<string, unknown> | null)?.workspaceRootId === "string"
        ? (payload as Record<string, unknown>).workspaceRootId as string
        : null,
      expectedLockVersion: null,
      name: resolved.data.name,
      teamLevel: resolved.data.teamLevel,
      teamType: resolved.data.teamType,
      teamDivision: resolved.data.teamDivision,
      trainingDays: resolved.data.trainingDays,
      trainingHours: resolved.data.trainingHours,
      linkedCoachIds: resolved.data.linkedCoachIds,
      assignedCoachNames: resolved.data.assignedCoachNames
    });

    return NextResponse.json({
      teamId: result.entity.id,
      team: result.entity,
      assignedCoachNames: resolved.data.assignedCoachNames,
      linkedCoachIds: resolved.data.linkedCoachIds,
      lockVersion: result.lockVersion,
      changeSetId: result.changeSetId,
      latestVersionNumber: result.latestVersionNumber
    });
  } catch (error) {
    const plannerError = getPlannerCommandError(error);
    return NextResponse.json({ error: plannerError.message, code: plannerError.code }, { status: plannerError.code ? 409 : 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { error, user, profile } = await getApprovedProfile();

    if (error || !user || !profile) {
      return error!;
    }

    const payload = await request.json().catch(() => null) as ({ teamId?: string } & Record<string, unknown>) | null;
    const session = await getAuthSession();

    if (!session) {
      return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
    }

    const scope = resolvePlannerScopeContext(session, parsePlannerWorkspaceScope(payload?.scope));
    const premiumError = await requireCheerPlannerPremium(session, scope);

    if (premiumError) {
      return premiumError;
    }
    const remoteTeamId = normalizeText(payload?.teamId);

    if (!remoteTeamId) {
      return NextResponse.json({ error: "A linked team id is required to edit this team." }, { status: 400 });
    }

    const resolved = await resolveTeamPayload(payload, profile, user.email ?? "");

    if (resolved.error || !resolved.data) {
      return NextResponse.json({ error: resolved.error }, { status: 400 });
    }

    const result = await savePlannerTeamCommand(session, scope.scope, {
      workspaceRootId: typeof payload?.workspaceRootId === "string" ? payload.workspaceRootId : null,
      expectedLockVersion: typeof payload?.expectedLockVersion === "number" ? payload.expectedLockVersion : null,
      teamId: remoteTeamId,
      name: resolved.data.name,
      teamLevel: resolved.data.teamLevel,
      teamType: resolved.data.teamType,
      teamDivision: resolved.data.teamDivision,
      trainingDays: resolved.data.trainingDays,
      trainingHours: resolved.data.trainingHours,
      linkedCoachIds: resolved.data.linkedCoachIds,
      assignedCoachNames: resolved.data.assignedCoachNames
    });

    return NextResponse.json({
      teamId: result.entity.id,
      team: result.entity,
      assignedCoachNames: resolved.data.assignedCoachNames,
      linkedCoachIds: resolved.data.linkedCoachIds,
      lockVersion: result.lockVersion,
      changeSetId: result.changeSetId,
      latestVersionNumber: result.latestVersionNumber
    });
  } catch (error) {
    const plannerError = getPlannerCommandError(error);
    return NextResponse.json({ error: plannerError.message, code: plannerError.code }, { status: plannerError.code ? 409 : 500 });
  }
}




export async function DELETE(request: NextRequest) {
  try {
    const { error, user, profile } = await getApprovedProfile();

    if (error || !user || !profile) {
      return error!;
    }

    const payload = await request.json().catch(() => null) as ({ teamId?: string } & Record<string, unknown>) | null;
    const session = await getAuthSession();

    if (!session) {
      return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
    }

    const scope = resolvePlannerScopeContext(session, parsePlannerWorkspaceScope(payload?.scope));
    const premiumError = await requireCheerPlannerPremium(session, scope);

    if (premiumError) {
      return premiumError;
    }
    const remoteTeamId = normalizeText(payload?.teamId);

    if (!remoteTeamId) {
      return NextResponse.json({ error: "A linked team id is required to delete this team." }, { status: 400 });
    }

    const result = await softDeletePlannerTeamCommand(session, scope.scope, {
      workspaceRootId: typeof payload?.workspaceRootId === "string" ? payload.workspaceRootId : null,
      teamId: remoteTeamId,
      expectedLockVersion: typeof payload?.expectedLockVersion === "number" ? payload.expectedLockVersion : null
    });

    return NextResponse.json({
      ok: true,
      team: result.entity,
      lockVersion: result.lockVersion,
      changeSetId: result.changeSetId,
      latestVersionNumber: result.latestVersionNumber
    });
  } catch (error) {
    const plannerError = getPlannerCommandError(error);
    return NextResponse.json({ error: plannerError.message, code: plannerError.code }, { status: plannerError.code ? 409 : 500 });
  }
}


