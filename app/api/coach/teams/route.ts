import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { findCoachOptionByText, listAvailableCoachOptionsForSession } from "@/lib/services/team-coach-directory";
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
    const resolved = await resolveTeamPayload(payload, profile, user.email ?? "");

    if (resolved.error || !resolved.data) {
      return NextResponse.json({ error: resolved.error }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: createdTeamData, error: insertError } = await admin
      .from("teams" as never)
      .insert({
        name: resolved.data.name,
        gym_id: profile.primary_gym_id ?? null,
        primary_coach_profile_id: resolved.data.linkedCoachIds[0] ?? profile.id,
        division: resolved.data.teamDivision,
        visibility_scope: profile.primary_gym_id ? "gym" : "private",
        metadata: {
          teamLevel: resolved.data.teamLevel,
          ageCategory: resolved.data.teamType,
          trainingDays: resolved.data.trainingDays,
          trainingHours: resolved.data.trainingHours,
          assignedCoachNames: resolved.data.assignedCoachNames,
          linkedCoachIds: resolved.data.linkedCoachIds
        }
      } as never)
      .select("id" as never)
      .single();

    const createdTeam = createdTeamData as { id: string } | null;

    if (insertError || !createdTeam) {
      return NextResponse.json({ error: insertError?.message ?? "Unable to create team." }, { status: 500 });
    }

    if (resolved.data.linkedCoachIds.length) {
      const coachRows = resolved.data.linkedCoachIds.map((coachId, index) => ({
        team_id: createdTeam.id,
        coach_profile_id: coachId,
        role: index === 0 ? "head" : "assistant"
      }));

      const { error: teamCoachError } = await admin.from("team_coaches" as never).insert(coachRows as never);

      if (teamCoachError) {
        return NextResponse.json({ error: teamCoachError.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      teamId: createdTeam.id,
      assignedCoachNames: resolved.data.assignedCoachNames,
      linkedCoachIds: resolved.data.linkedCoachIds
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected team creation failure.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { error, user, profile } = await getApprovedProfile();

    if (error || !user || !profile) {
      return error!;
    }

    const payload = await request.json().catch(() => null) as ({ teamId?: string } & Record<string, unknown>) | null;
    const remoteTeamId = normalizeText(payload?.teamId);

    if (!remoteTeamId) {
      return NextResponse.json({ error: "A linked team id is required to edit this team." }, { status: 400 });
    }

    const resolved = await resolveTeamPayload(payload, profile, user.email ?? "");

    if (resolved.error || !resolved.data) {
      return NextResponse.json({ error: resolved.error }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: currentTeamData, error: currentTeamError } = await admin
      .from("teams" as never)
      .select("id, gym_id, primary_coach_profile_id" as never)
      .eq("id", remoteTeamId as never)
      .maybeSingle();

    const currentTeam = currentTeamData as { id: string; gym_id: string | null; primary_coach_profile_id: string | null } | null;

    if (currentTeamError || !currentTeam) {
      return NextResponse.json({ error: "The linked workspace team could not be found." }, { status: 404 });
    }

    const canEdit = currentTeam.gym_id
      ? currentTeam.gym_id === (profile.primary_gym_id ?? null)
      : currentTeam.primary_coach_profile_id === profile.id;

    if (!canEdit) {
      return NextResponse.json({ error: "You do not have access to edit this team." }, { status: 403 });
    }

    const { error: updateError } = await admin
      .from("teams" as never)
      .update({
        name: resolved.data.name,
        primary_coach_profile_id: resolved.data.linkedCoachIds[0] ?? currentTeam.primary_coach_profile_id ?? profile.id,
        division: resolved.data.teamDivision,
        metadata: {
          teamLevel: resolved.data.teamLevel,
          ageCategory: resolved.data.teamType,
          trainingDays: resolved.data.trainingDays,
          trainingHours: resolved.data.trainingHours,
          assignedCoachNames: resolved.data.assignedCoachNames,
          linkedCoachIds: resolved.data.linkedCoachIds
        }
      } as never)
      .eq("id", remoteTeamId as never);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    const { error: deleteLinksError } = await admin
      .from("team_coaches" as never)
      .delete()
      .eq("team_id", remoteTeamId as never);

    if (deleteLinksError) {
      return NextResponse.json({ error: deleteLinksError.message }, { status: 500 });
    }

    if (resolved.data.linkedCoachIds.length) {
      const coachRows = resolved.data.linkedCoachIds.map((coachId, index) => ({
        team_id: remoteTeamId,
        coach_profile_id: coachId,
        role: index === 0 ? "head" : "assistant"
      }));

      const { error: insertLinksError } = await admin.from("team_coaches" as never).insert(coachRows as never);

      if (insertLinksError) {
        return NextResponse.json({ error: insertLinksError.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      teamId: remoteTeamId,
      assignedCoachNames: resolved.data.assignedCoachNames,
      linkedCoachIds: resolved.data.linkedCoachIds
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected team update failure.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}




export async function DELETE(request: NextRequest) {
  try {
    const { error, user, profile } = await getApprovedProfile();

    if (error || !user || !profile) {
      return error!;
    }

    const payload = await request.json().catch(() => null) as ({ teamId?: string } & Record<string, unknown>) | null;
    const remoteTeamId = normalizeText(payload?.teamId);

    if (!remoteTeamId) {
      return NextResponse.json({ error: "A linked team id is required to delete this team." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: currentTeamData, error: currentTeamError } = await admin
      .from("teams" as never)
      .select("id, gym_id, primary_coach_profile_id" as never)
      .eq("id", remoteTeamId as never)
      .maybeSingle();

    const currentTeam = currentTeamData as { id: string; gym_id: string | null; primary_coach_profile_id: string | null } | null;

    if (currentTeamError || !currentTeam) {
      return NextResponse.json({ error: "The linked workspace team could not be found." }, { status: 404 });
    }

    const canDelete = currentTeam.gym_id
      ? currentTeam.gym_id === (profile.primary_gym_id ?? null)
      : currentTeam.primary_coach_profile_id === profile.id;

    if (!canDelete) {
      return NextResponse.json({ error: "You do not have access to delete this team." }, { status: 403 });
    }

    const { error: deleteError } = await admin
      .from("teams" as never)
      .delete()
      .eq("id", remoteTeamId as never);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected team delete failure.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
