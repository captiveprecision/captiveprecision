import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/types/database";

type AthleteRegistrationLookupRow = Pick<
  Database["public"]["Tables"]["athletes"]["Row"],
  "id" | "registration_number" | "metadata"
>;

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function normalizeAthleteRegistrationNumber(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeRegistrationLookup(value: unknown) {
  return normalizeAthleteRegistrationNumber(value).toLowerCase();
}

function hasRegistrationNumberMatch(row: AthleteRegistrationLookupRow, normalizedRegistrationNumber: string) {
  return (
    normalizeRegistrationLookup(row.registration_number) === normalizedRegistrationNumber
    || normalizeRegistrationLookup(asRecord(row.metadata).registrationNumber) === normalizedRegistrationNumber
  );
}

function findDuplicateRegistrationRow(
  rows: AthleteRegistrationLookupRow[],
  registrationNumber: string,
  excludeAthleteId: string | null
) {
  const normalizedRegistrationNumber = normalizeRegistrationLookup(registrationNumber);

  if (!normalizedRegistrationNumber) {
    return null;
  }

  return rows.find((row) => (
    row.id !== excludeAthleteId
    && hasRegistrationNumberMatch(row, normalizedRegistrationNumber)
  )) ?? null;
}

export async function findDuplicateAthleteRegistrationNumberByIds(
  admin: ReturnType<typeof createAdminClient>,
  athleteIds: string[],
  registrationNumber: string,
  excludeAthleteId: string | null
) {
  const normalizedRegistrationNumber = normalizeAthleteRegistrationNumber(registrationNumber);

  if (!normalizedRegistrationNumber || athleteIds.length === 0) {
    return null;
  }

  const { data, error } = await admin
    .from("athletes" as never)
    .select("id, registration_number, metadata" as never)
    .in("id" as never, athleteIds as never)
    .is("deleted_at" as never, null);

  if (error) {
    throw new Error("Unable to validate registration number.");
  }

  return findDuplicateRegistrationRow(
    (data ?? []) as AthleteRegistrationLookupRow[],
    normalizedRegistrationNumber,
    excludeAthleteId
  );
}

export async function findDuplicateAthleteRegistrationNumberByWorkspaceRoot(
  admin: ReturnType<typeof createAdminClient>,
  workspaceRootId: string,
  registrationNumber: string,
  excludeAthleteId: string | null
) {
  const normalizedRegistrationNumber = normalizeAthleteRegistrationNumber(registrationNumber);

  if (!normalizedRegistrationNumber) {
    return null;
  }

  const { data, error } = await admin
    .from("athletes" as never)
    .select("id, registration_number, metadata" as never)
    .eq("workspace_root_id" as never, workspaceRootId as never)
    .is("deleted_at" as never, null);

  if (error) {
    throw new Error("Unable to validate registration number.");
  }

  return findDuplicateRegistrationRow(
    (data ?? []) as AthleteRegistrationLookupRow[],
    normalizedRegistrationNumber,
    excludeAthleteId
  );
}
