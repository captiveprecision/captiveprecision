import { NextRequest, NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth/session";
import { LEVEL_LABELS } from "@/lib/domain/planner-levels";
import { canManageGymAdministration, resolveGymAccessContext } from "@/lib/services/gym-access";
import {
  loadActiveGymTeamSeasonState,
  markActiveGymTeamSeasonProfileInactive,
  replaceActiveGymTeamSeasonCoaches,
  upsertActiveGymTeamSeasonProfile
} from "@/lib/services/gym-team-seasons";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/types/database";

export const dynamic = "force-dynamic";

type GymRow = Pick<Database["public"]["Tables"]["gyms"]["Row"], "id" | "name" | "owner_profile_id">;
type TeamRow = Pick<Database["public"]["Tables"]["teams"]["Row"], "id" | "metadata" | "name">;
type ProfileRow = Pick<Database["public"]["Tables"]["profiles"]["Row"], "id" | "display_name" | "email">;
type WorkspaceRootRow = {
  id: string;
  scope_type: "coach" | "gym";
  gym_id: string | null;
  owner_profile_id: string | null;
};
type GymLicenseProfileRow = Pick<Database["public"]["Tables"]["gym_coach_licenses"]["Row"], "coach_profile_id">;

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeIdArray(value: unknown) {
  return Array.isArray(value)
    ? Array.from(new Set(value.flatMap((item) => typeof item === "string" && item.trim() ? [item.trim()] : [])))
    : [];
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

async function resolveGymTeamIds(admin: ReturnType<typeof createAdminClient>, gym: GymRow) {
  const { data: licenseRows } = await admin
    .from("gym_coach_licenses" as never)
    .select("coach_profile_id" as never)
    .eq("gym_id", gym.id as never)
    .eq("status", "active" as never);
  const ownerProfileIds = Array.from(new Set([
    gym.owner_profile_id,
    ...((licenseRows ?? []) as GymLicenseProfileRow[]).map((row) => row.coach_profile_id)
  ].filter((value): value is string => Boolean(value))));
  const { data: gymRoots } = await admin
    .from("workspace_roots" as never)
    .select("id, scope_type, gym_id, owner_profile_id" as never)
    .eq("gym_id", gym.id as never);
  const { data: coachRoots } = ownerProfileIds.length
    ? await admin
      .from("workspace_roots" as never)
      .select("id, scope_type, gym_id, owner_profile_id" as never)
      .in("owner_profile_id", ownerProfileIds as never)
    : { data: [] as unknown[] };
  const relatedRootIds = ([...(gymRoots ?? []), ...(coachRoots ?? [])] as WorkspaceRootRow[])
    .filter((root) => (
      (root.scope_type === "gym" && root.gym_id === gym.id)
      || (root.scope_type === "coach" && typeof root.owner_profile_id === "string" && ownerProfileIds.includes(root.owner_profile_id))
    ))
    .map((root) => root.id);
  const { data: gymTeams, error: gymError } = await admin
    .from("teams" as never)
    .select("id" as never)
    .eq("gym_id", gym.id as never);

  if (gymError) {
    throw new Error("Unable to load Gym teams.");
  }

  const { data: rootTeams, error: rootError } = relatedRootIds.length
    ? await admin
      .from("teams" as never)
      .select("id" as never)
      .in("workspace_root_id", relatedRootIds as never)
    : { data: [], error: null };

  if (rootError) {
    throw new Error("Unable to load Gym teams.");
  }

  return Array.from(new Set([
    ...((gymTeams ?? []) as Array<{ id: string }>).map((team) => team.id),
    ...((rootTeams ?? []) as Array<{ id: string }>).map((team) => team.id)
  ]));
}

async function requireGymAdminAccess(session: NonNullable<Awaited<ReturnType<typeof getAuthSession>>>) {
  const access = await resolveGymAccessContext(session, { ensureOwnerSeat: true });

  if (!access || !canManageGymAdministration(access)) {
    return {
      gym: null,
      error: NextResponse.json({ error: "Program Director access is required." }, { status: 403 })
    };
  }

  return { gym: access.gym, error: null };
}

async function assertManageableTeam(admin: ReturnType<typeof createAdminClient>, gym: GymRow, teamId: string) {
  const gymTeamIds = await resolveGymTeamIds(admin, gym);

  if (!gymTeamIds.includes(teamId)) {
    throw new Error("TEAM_NOT_FOUND");
  }

  const { data, error } = await admin
    .from("teams" as never)
    .select("id, metadata, name" as never)
    .eq("id", teamId as never)
    .maybeSingle();

  if (error || !data) {
    throw new Error("TEAM_NOT_FOUND");
  }

  return data as TeamRow;
}

async function getActiveCoachOptions(admin: ReturnType<typeof createAdminClient>, gymId: string, coachIds: string[]) {
  if (!coachIds.length) {
    return [];
  }

  const { data: licenses, error: licenseError } = await admin
    .from("gym_coach_licenses" as never)
    .select("coach_profile_id, seat_role" as never)
    .eq("gym_id", gymId as never)
    .eq("status", "active" as never)
    .in("coach_profile_id", coachIds as never);

  if (licenseError) {
    throw new Error("Unable to validate selected coaches.");
  }

  const validCoachIds = ((licenses ?? []) as Array<{ coach_profile_id: string; seat_role: string }>)
    .filter((license) => license.seat_role !== "staff")
    .map((license) => license.coach_profile_id);

  if (!validCoachIds.length) {
    return [];
  }

  const { data: profiles } = await admin
    .from("profiles" as never)
    .select("id, display_name, email" as never)
    .in("id", validCoachIds as never);
  const profileById = new Map(((profiles ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]));

  return validCoachIds.map((coachId) => {
    const profile = profileById.get(coachId);

    return {
      id: coachId,
      name: profile?.display_name || profile?.email || "Coach"
    };
  });
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getAuthSession();

    if (!session?.roles.includes("gym")) {
      return NextResponse.json({ error: "Gym access is required." }, { status: 403 });
    }

    const payload = await request.json().catch(() => null);
    const teamId = normalizeText(payload?.teamId);
    const name = normalizeText(payload?.name);
    const level = normalizeText(payload?.level);
    const category = normalizeText(payload?.category);
    const coachIds = normalizeIdArray(payload?.coachIds);

    if (!teamId) {
      return NextResponse.json({ error: "Team id is required." }, { status: 400 });
    }

    if (!name) {
      return NextResponse.json({ error: "Team name is required." }, { status: 400 });
    }

    if (level && !LEVEL_LABELS.includes(level as typeof LEVEL_LABELS[number])) {
      return NextResponse.json({ error: "A valid team level is required." }, { status: 400 });
    }

    const admin = createAdminClient();
    const access = await requireGymAdminAccess(session);

    if (access.error || !access.gym) {
      return access.error!;
    }

    const gym = access.gym;
    const currentTeam = await assertManageableTeam(admin, gym, teamId);
    const coaches = await getActiveCoachOptions(admin, gym.id, coachIds);
    const validCoachIds = coaches.map((coach) => coach.id);
    const activeSeasonState = await loadActiveGymTeamSeasonState(admin, gym.id, session.userId);
    const metadata = {
      ...asRecord(currentTeam.metadata),
      teamLevel: level,
      ageCategory: category,
      linkedCoachIds: validCoachIds,
      assignedCoachNames: coaches.map((coach) => coach.name)
    };

    const { error: teamError } = await admin
      .from("teams" as never)
      .update({
        name,
        gym_id: gym.id,
        visibility_scope: "gym",
        primary_coach_profile_id: validCoachIds[0] ?? null,
        metadata
      } as never)
      .eq("id", teamId as never);

    if (teamError) {
      return NextResponse.json({ error: "Unable to update team." }, { status: 500 });
    }

    await admin
      .from("team_coaches" as never)
      .delete()
      .eq("team_id", teamId as never);

    if (validCoachIds.length) {
      const { error: coachError } = await admin
        .from("team_coaches" as never)
        .insert(validCoachIds.map((coachId, index) => ({
          team_id: teamId,
          coach_profile_id: coachId,
          role: index === 0 ? "head" : "assistant"
        })) as never);

      if (coachError) {
        return NextResponse.json({ error: "Team was updated, but coaches could not be assigned." }, { status: 500 });
      }
    }

    if (activeSeasonState) {
      await upsertActiveGymTeamSeasonProfile(admin, {
        gymId: gym.id,
        seasonId: activeSeasonState.season.id,
        teamId,
        name,
        level: level || null,
        category: category || null,
        actorProfileId: session.userId,
        metadata: { source: "manage-my-gym-team-edit" }
      });
      await replaceActiveGymTeamSeasonCoaches(admin, {
        gymId: gym.id,
        seasonId: activeSeasonState.season.id,
        teamId,
        coachIds: validCoachIds
      });
    }

    return NextResponse.json({
      teamId,
      name,
      level,
      category,
      coachIds: validCoachIds,
      coachNames: coaches.map((coach) => coach.name),
      message: "Team updated."
    });
  } catch (error) {
    const message = error instanceof Error && error.message === "TEAM_NOT_FOUND"
      ? "Team was not found for this Gym."
      : error instanceof Error ? error.message : "Unexpected team update failure.";
    const status = error instanceof Error && error.message === "TEAM_NOT_FOUND" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getAuthSession();

    if (!session?.roles.includes("gym")) {
      return NextResponse.json({ error: "Gym access is required." }, { status: 403 });
    }

    const payload = await request.json().catch(() => null);
    const teamId = normalizeText(payload?.teamId);

    if (!teamId) {
      return NextResponse.json({ error: "Team id is required." }, { status: 400 });
    }

    const admin = createAdminClient();
    const access = await requireGymAdminAccess(session);

    if (access.error || !access.gym) {
      return access.error!;
    }

    const gym = access.gym;
    await assertManageableTeam(admin, gym, teamId);
    const activeSeasonState = await loadActiveGymTeamSeasonState(admin, gym.id, session.userId);

    if (activeSeasonState) {
      await markActiveGymTeamSeasonProfileInactive(admin, {
        gymId: gym.id,
        seasonId: activeSeasonState.season.id,
        teamId
      });
    } else {
      const { error } = await admin
        .from("teams" as never)
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by_profile_id: session.userId
        } as never)
        .eq("id", teamId as never);

      if (error) {
        return NextResponse.json({ error: "Unable to remove team." }, { status: 500 });
      }

      await admin
        .from("team_coaches" as never)
        .delete()
        .eq("team_id", teamId as never);
    }

    return NextResponse.json({
      teamId,
      message: "Team removed from the active season."
    });
  } catch (error) {
    const message = error instanceof Error && error.message === "TEAM_NOT_FOUND"
      ? "Team was not found for this Gym."
      : error instanceof Error ? error.message : "Unexpected team removal failure.";
    const status = error instanceof Error && error.message === "TEAM_NOT_FOUND" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
