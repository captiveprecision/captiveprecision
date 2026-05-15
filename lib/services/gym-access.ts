import type { AuthSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/types/database";

export type GymSeatRole = "owner" | "program_director" | "coach" | "assistant" | "staff";
export type GymAccessLevel = "none" | "read" | "team-write" | "full";

type GymRow = Pick<Database["public"]["Tables"]["gyms"]["Row"], "id" | "name" | "owner_profile_id">;
type LicenseRow = Pick<Database["public"]["Tables"]["gym_coach_licenses"]["Row"], "coach_profile_id" | "license_seat_name" | "seat_role" | "status">;

export type GymAccessContext = {
  gym: GymRow;
  seatRole: GymSeatRole;
  accessLevel: GymAccessLevel;
  isOwner: boolean;
  isProgramDirector: boolean;
};

export function normalizeGymSeatRole(value: unknown): Exclude<GymSeatRole, "owner"> | null {
  return value === "program_director" || value === "coach" || value === "assistant" || value === "staff"
    ? value
    : null;
}

export function formatGymSeatRole(value: unknown) {
  switch (value) {
    case "owner":
      return "Owner";
    case "program_director":
      return "Program Director";
    case "coach":
      return "Coach";
    case "assistant":
      return "Assistant";
    case "staff":
      return "Staff";
    default:
      return "";
  }
}

export function getGymSeatAccessLevel(role: GymSeatRole): GymAccessLevel {
  switch (role) {
    case "owner":
    case "program_director":
      return "full";
    case "coach":
      return "team-write";
    case "assistant":
      return "read";
    case "staff":
    default:
      return "none";
  }
}

export async function resolveGymForUser(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  primaryGymId: string | null
) {
  if (primaryGymId) {
    const { data, error } = await admin
      .from("gyms" as never)
      .select("id, name, owner_profile_id" as never)
      .eq("id", primaryGymId as never)
      .maybeSingle();

    if (error) {
      throw new Error("Unable to load Gym organization.");
    }

    const gym = data as GymRow | null;
    if (gym?.id) {
      return gym;
    }
  }

  const { data: ownedGym, error: ownedError } = await admin
    .from("gyms" as never)
    .select("id, name, owner_profile_id" as never)
    .eq("owner_profile_id", userId as never)
    .maybeSingle();

  if (ownedError) {
    throw new Error("Unable to load Gym organization.");
  }

  if (ownedGym) {
    return ownedGym as GymRow;
  }

  const { data: license, error: licenseError } = await admin
    .from("gym_coach_licenses" as never)
    .select("gym_id" as never)
    .eq("coach_profile_id", userId as never)
    .eq("status", "active" as never)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (licenseError) {
    throw new Error("Unable to load Gym organization.");
  }

  const licensedGymId = (license as { gym_id?: string } | null)?.gym_id ?? null;

  if (!licensedGymId) {
    return null;
  }

  const { data: licensedGym, error: gymError } = await admin
    .from("gyms" as never)
    .select("id, name, owner_profile_id" as never)
    .eq("id", licensedGymId as never)
    .maybeSingle();

  if (gymError) {
    throw new Error("Unable to load Gym organization.");
  }

  return licensedGym as GymRow | null;
}

export async function ensureOwnerProgramDirectorSeat(
  admin: ReturnType<typeof createAdminClient>,
  gym: GymRow,
  actorProfileId: string
) {
  if (!gym.owner_profile_id) {
    return;
  }

  const { data: existing } = await admin
    .from("gym_coach_licenses" as never)
    .select("id, status, seat_role" as never)
    .eq("gym_id", gym.id as never)
    .eq("coach_profile_id", gym.owner_profile_id as never)
    .maybeSingle();

  if (existing) {
    await admin
      .from("gym_coach_licenses" as never)
      .update({
        status: "active",
        seat_role: "program_director"
      } as never)
      .eq("gym_id", gym.id as never)
      .eq("coach_profile_id", gym.owner_profile_id as never);
    return;
  }

  await admin
    .from("gym_coach_licenses" as never)
    .upsert({
      gym_id: gym.id,
      coach_profile_id: gym.owner_profile_id,
      status: "active",
      license_seat_name: gym.name ? `${gym.name} Program Director` : "Program Director",
      seat_role: "program_director",
      invited_by_profile_id: actorProfileId
    } as never, { onConflict: "gym_id,coach_profile_id" });
}

export async function resolveGymAccessContext(
  session: Pick<AuthSession, "userId" | "primaryGymId" | "role">,
  options: { ensureOwnerSeat?: boolean } = {}
): Promise<GymAccessContext | null> {
  const admin = createAdminClient();
  const gym = await resolveGymForUser(admin, session.userId, session.primaryGymId);

  if (!gym) {
    return null;
  }

  if (options.ensureOwnerSeat) {
    await ensureOwnerProgramDirectorSeat(admin, gym, session.userId);
  }

  if (session.role === "admin" || gym.owner_profile_id === session.userId) {
    return {
      gym,
      seatRole: gym.owner_profile_id === session.userId ? "owner" : "program_director",
      accessLevel: "full",
      isOwner: gym.owner_profile_id === session.userId,
      isProgramDirector: true
    };
  }

  const { data } = await admin
    .from("gym_coach_licenses" as never)
    .select("coach_profile_id, license_seat_name, seat_role, status" as never)
    .eq("gym_id", gym.id as never)
    .eq("coach_profile_id", session.userId as never)
    .eq("status", "active" as never)
    .maybeSingle();

  const license = data as LicenseRow | null;
  const seatRole = normalizeGymSeatRole(license?.seat_role);

  if (!seatRole) {
    return {
      gym,
      seatRole: "staff",
      accessLevel: "none",
      isOwner: false,
      isProgramDirector: false
    };
  }

  return {
    gym,
    seatRole,
    accessLevel: getGymSeatAccessLevel(seatRole),
    isOwner: false,
    isProgramDirector: seatRole === "program_director"
  };
}

export function canManageGymAdministration(access: GymAccessContext | null) {
  return access?.accessLevel === "full";
}
