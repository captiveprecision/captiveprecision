import type { AuthSession } from "@/lib/auth/session";
import type { GymSeason, GymSeasonStatus } from "@/lib/domain/gym-season";
import { canManageGymAdministration, resolveGymAccessContext } from "@/lib/services/gym-access";
import { seedActiveGymSeasonStructure } from "@/lib/services/gym-team-seasons";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/lib/types/database";

type GymSeasonRow = Database["public"]["Tables"]["gym_seasons"]["Row"];

type GymSeasonInput = {
  id?: string | null;
  seasonNumber: number;
  label?: string | null;
  startDate: string;
  endDate: string;
  status: GymSeasonStatus;
};

export type GymSeasonAccessResult =
  | { ok: true; gymId: string }
  | { ok: false; error: "GYM_NOT_FOUND" | "GYM_SEASON_ACCESS_DENIED" };

export type ActiveGymSeasonResult = {
  season: GymSeason;
  autoCreated: boolean;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function asRecord(value: Json): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function addOneYear(dateValue: string) {
  const date = new Date(`${dateValue}T00:00:00.000Z`);
  date.setUTCFullYear(date.getUTCFullYear() + 1);
  return date.toISOString().slice(0, 10);
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeSeasonLabel(seasonNumber: number, label?: string | null) {
  const trimmed = typeof label === "string" ? label.trim() : "";
  return trimmed || `Season ${seasonNumber}`;
}

export function normalizeGymSeasonStatus(value: unknown): GymSeasonStatus | null {
  return value === "upcoming" || value === "active" || value === "closed" ? value : null;
}

export function assertGymSeasonInput(input: GymSeasonInput) {
  if (!Number.isInteger(input.seasonNumber) || input.seasonNumber < 1) {
    throw new Error("A valid season number is required.");
  }

  if (!DATE_PATTERN.test(input.startDate) || !DATE_PATTERN.test(input.endDate)) {
    throw new Error("Valid start and end dates are required.");
  }

  if (input.endDate < input.startDate) {
    throw new Error("Season end date must be after the start date.");
  }
}

export function buildGymSeasonFromRow(row: GymSeasonRow): GymSeason {
  return {
    id: row.id,
    gymId: row.gym_id,
    seasonNumber: row.season_number,
    label: row.label,
    startDate: row.start_date,
    endDate: row.end_date,
    status: normalizeGymSeasonStatus(row.status) ?? "upcoming",
    metadata: asRecord(row.metadata),
    createdByProfileId: row.created_by_profile_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function resolveGymSeasonAdminAccess(session: AuthSession): Promise<GymSeasonAccessResult> {
  const access = await resolveGymAccessContext(session, { ensureOwnerSeat: true });

  if (!access) {
    return { ok: false, error: "GYM_NOT_FOUND" };
  }

  if (!canManageGymAdministration(access)) {
    return { ok: false, error: "GYM_SEASON_ACCESS_DENIED" };
  }

  return { ok: true, gymId: access.gym.id };
}

export async function listGymSeasons(gymId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("gym_seasons" as never)
    .select("*" as never)
    .eq("gym_id", gymId as never)
    .order("season_number" as never, { ascending: false })
    .order("start_date" as never, { ascending: false });

  if (error) {
    throw new Error("Unable to load Gym seasons.");
  }

  return ((data ?? []) as GymSeasonRow[]).map(buildGymSeasonFromRow);
}

export async function getActiveGymSeasonForGym(gymId: string | null | undefined) {
  if (!gymId) {
    return null;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("gym_seasons" as never)
    .select("*" as never)
    .eq("gym_id", gymId as never)
    .eq("status", "active" as never)
    .order("season_number" as never, { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (error.code === "42P01" || error.code === "42703") {
      return null;
    }

    throw new Error("Unable to load active Gym season.");
  }

  return data ? buildGymSeasonFromRow(data as GymSeasonRow) : null;
}

async function closeOtherActiveSeasons(gymId: string, activeSeasonId?: string | null) {
  const admin = createAdminClient();
  let query = admin
    .from("gym_seasons" as never)
    .update({ status: "closed" } as never)
    .eq("gym_id", gymId as never)
    .eq("status", "active" as never);

  if (activeSeasonId) {
    query = query.neq("id", activeSeasonId as never);
  }

  const { error } = await query;

  if (error) {
    throw new Error("Unable to close the previous active season.");
  }
}

export async function createGymSeason(session: AuthSession, input: GymSeasonInput) {
  const access = await resolveGymSeasonAdminAccess(session);

  if (!access.ok) {
    throw new Error(access.error);
  }

  assertGymSeasonInput(input);

  if (input.status === "active") {
    await closeOtherActiveSeasons(access.gymId);
  }

  const admin = createAdminClient();
  const { data: createdSeason, error } = await admin
    .from("gym_seasons" as never)
    .insert({
      gym_id: access.gymId,
      season_number: input.seasonNumber,
      label: normalizeSeasonLabel(input.seasonNumber, input.label),
      start_date: input.startDate,
      end_date: input.endDate,
      status: input.status,
      created_by_profile_id: session.userId
    } as never)
    .select("*" as never)
    .single();

  if (error) {
    throw new Error(error.code === "23505" ? "A season with this number already exists." : "Unable to create Gym season.");
  }

  if (input.status === "active" && createdSeason) {
    await seedActiveGymSeasonStructure(admin, access.gymId, (createdSeason as GymSeasonRow).id, session.userId);
  }

  return listGymSeasons(access.gymId);
}

export async function updateGymSeason(session: AuthSession, input: GymSeasonInput & { id: string }) {
  const access = await resolveGymSeasonAdminAccess(session);

  if (!access.ok) {
    throw new Error(access.error);
  }

  if (!input.id) {
    throw new Error("A season id is required.");
  }

  assertGymSeasonInput(input);

  if (input.status === "active") {
    await closeOtherActiveSeasons(access.gymId, input.id);
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("gym_seasons" as never)
    .update({
      season_number: input.seasonNumber,
      label: normalizeSeasonLabel(input.seasonNumber, input.label),
      start_date: input.startDate,
      end_date: input.endDate,
      status: input.status
    } as never)
    .eq("id", input.id as never)
    .eq("gym_id", access.gymId as never);

  if (error) {
    throw new Error(error.code === "23505" ? "A season with this number already exists." : "Unable to update Gym season.");
  }

  if (input.status === "active") {
    await seedActiveGymSeasonStructure(admin, access.gymId, input.id, session.userId);
  }

  return listGymSeasons(access.gymId);
}

export async function ensureActiveGymSeasonForTryout(session: AuthSession): Promise<ActiveGymSeasonResult | null> {
  const access = await resolveGymAccessContext(session);

  if (!access || (access.accessLevel !== "full" && access.accessLevel !== "team-write")) {
    return null;
  }

  const admin = createAdminClient();
  const { data: activeSeason, error: activeError } = await admin
    .from("gym_seasons" as never)
    .select("*" as never)
    .eq("gym_id", access.gym.id as never)
    .eq("status", "active" as never)
    .order("season_number" as never, { ascending: false })
    .limit(1)
    .maybeSingle();

  if (activeError) {
    return null;
  }

  if (activeSeason) {
    return {
      season: buildGymSeasonFromRow(activeSeason as GymSeasonRow),
      autoCreated: false
    };
  }

  const { data: latestSeason } = await admin
    .from("gym_seasons" as never)
    .select("season_number" as never)
    .eq("gym_id", access.gym.id as never)
    .order("season_number" as never, { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSeasonNumber = (((latestSeason as { season_number?: number } | null)?.season_number ?? 0) + 1);
  const startDate = todayDate();
  const endDate = addOneYear(startDate);

  const { data: insertedSeason, error: insertError } = await admin
    .from("gym_seasons" as never)
    .insert({
      gym_id: access.gym.id,
      season_number: nextSeasonNumber,
      label: normalizeSeasonLabel(nextSeasonNumber),
      start_date: startDate,
      end_date: endDate,
      status: "active",
      created_by_profile_id: session.userId
    } as never)
    .select("*" as never)
    .single();

  if (insertError || !insertedSeason) {
    const { data: recoveredSeason } = await admin
      .from("gym_seasons" as never)
      .select("*" as never)
      .eq("gym_id", access.gym.id as never)
      .eq("status", "active" as never)
      .limit(1)
      .maybeSingle();

    return recoveredSeason
      ? { season: buildGymSeasonFromRow(recoveredSeason as GymSeasonRow), autoCreated: false }
      : null;
  }

  return {
    season: buildGymSeasonFromRow(insertedSeason as GymSeasonRow),
    autoCreated: true
  };
}
