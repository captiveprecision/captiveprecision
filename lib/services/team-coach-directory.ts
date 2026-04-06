import type { AuthSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

type CoachProfileRow = {
  id: string;
  display_name: string | null;
  email: string | null;
};

type GymCoachLicenseRow = {
  coach_profile_id: string;
  license_seat_name: string | null;
};

export type LinkedCoachOption = {
  id: string;
  label: string;
  email: string | null;
  source: "self" | "gym";
};

function normalizeLookupValue(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function findCoachOptionByText(options: LinkedCoachOption[], value: string) {
  const normalizedValue = normalizeLookupValue(value);

  if (!normalizedValue) {
    return null;
  }

  return options.find((option) => (
    normalizeLookupValue(option.label) === normalizedValue
    || (option.email ? normalizeLookupValue(option.email) === normalizedValue : false)
  )) ?? null;
}

export async function listAvailableCoachOptionsForSession(
  session: Pick<AuthSession, "userId" | "displayName" | "email" | "primaryGymId">
): Promise<LinkedCoachOption[]> {
  const admin = createAdminClient();
  const optionMap = new Map<string, LinkedCoachOption>();

  optionMap.set(session.userId, {
    id: session.userId,
    label: session.displayName || session.email || "Coach",
    email: session.email || null,
    source: "self"
  });

  if (!session.primaryGymId) {
    return [...optionMap.values()].sort((left, right) => left.label.localeCompare(right.label));
  }

  const { data: licenseRows } = await admin
    .from("gym_coach_licenses" as never)
    .select("coach_profile_id, license_seat_name" as never)
    .eq("gym_id", session.primaryGymId as never)
    .eq("status", "active" as never);

  const licenses = (licenseRows ?? []) as GymCoachLicenseRow[];
  const coachIds = Array.from(new Set(licenses.map((row) => row.coach_profile_id).filter(Boolean)));

  if (!coachIds.length) {
    return [...optionMap.values()].sort((left, right) => left.label.localeCompare(right.label));
  }

  const { data: profileRows } = await admin
    .from("profiles" as never)
    .select("id, display_name, email" as never)
    .in("id", coachIds as never);

  const profiles = (profileRows ?? []) as CoachProfileRow[];
  const profileMap = new Map<string, CoachProfileRow>(profiles.map((row) => [row.id, row]));

  licenses.forEach((license) => {
    const profile = profileMap.get(license.coach_profile_id);
    const label = profile?.display_name || license.license_seat_name || profile?.email || "Coach";

    optionMap.set(license.coach_profile_id, {
      id: license.coach_profile_id,
      label,
      email: profile?.email ?? null,
      source: license.coach_profile_id === session.userId ? "self" : "gym"
    });
  });

  return [...optionMap.values()].sort((left, right) => left.label.localeCompare(right.label));
}

