import type { AuthSession } from "@/lib/auth/session";
import { resolveGymForUser } from "@/lib/services/gym-access";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/types/database";

export type GymRegistrationNumberMode = "auto" | "manual";

type GymRegistrationSettingsRow = Pick<Database["public"]["Tables"]["gyms"]["Row"], "metadata">;

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function normalizeGymRegistrationNumberMode(value: unknown): GymRegistrationNumberMode {
  return value === "manual" ? "manual" : "auto";
}

export function getGymRegistrationNumberModeFromMetadata(metadata: unknown): GymRegistrationNumberMode {
  return normalizeGymRegistrationNumberMode(asRecord(metadata).registrationNumberMode);
}

export async function getGymRegistrationNumberModeByGymId(gymId: string | null | undefined): Promise<GymRegistrationNumberMode> {
  if (!gymId) {
    return "auto";
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("gyms" as never)
    .select("metadata" as never)
    .eq("id", gymId as never)
    .maybeSingle();

  if (error || !data) {
    return "auto";
  }

  return getGymRegistrationNumberModeFromMetadata((data as GymRegistrationSettingsRow).metadata);
}

export async function getGymRegistrationNumberModeForSession(
  session: Pick<AuthSession, "userId" | "primaryGymId"> | null | undefined
): Promise<GymRegistrationNumberMode> {
  if (!session) {
    return "auto";
  }

  const admin = createAdminClient();
  try {
    const gym = await resolveGymForUser(admin, session.userId, session.primaryGymId);
    return getGymRegistrationNumberModeByGymId(gym?.id ?? null);
  } catch {
    return "auto";
  }
}

export async function saveGymRegistrationNumberMode(gymId: string, mode: GymRegistrationNumberMode) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("gyms" as never)
    .select("metadata" as never)
    .eq("id", gymId as never)
    .maybeSingle();
  const metadata = {
    ...asRecord((data as GymRegistrationSettingsRow | null)?.metadata),
    registrationNumberMode: mode
  };

  const { error } = await admin
    .from("gyms" as never)
    .update({ metadata } as never)
    .eq("id", gymId as never);

  if (error) {
    throw new Error("Unable to update registration number settings.");
  }
}
