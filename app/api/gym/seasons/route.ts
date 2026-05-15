import { NextRequest, NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth/session";
import {
  createGymSeason,
  listGymSeasons,
  normalizeGymSeasonStatus,
  resolveGymSeasonAdminAccess,
  updateGymSeason
} from "@/lib/services/gym-seasons";

export const dynamic = "force-dynamic";

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    return Number(value);
  }

  return NaN;
}

function mapSeasonError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unable to manage Gym seasons.";

  if (message === "GYM_SEASON_ACCESS_DENIED") {
    return { message: "Program Director access is required.", status: 403 };
  }

  if (message === "GYM_NOT_FOUND") {
    return { message: "Gym organization was not found.", status: 404 };
  }

  return { message, status: message.includes("required") || message.includes("date") ? 400 : 500 };
}

async function requireSeasonSession() {
  const session = await getAuthSession();

  if (!session?.roles.includes("gym")) {
    return {
      session: null,
      error: NextResponse.json({ error: "Gym access is required." }, { status: 403 })
    };
  }

  return { session, error: null };
}

export async function GET() {
  try {
    const { session, error } = await requireSeasonSession();

    if (error || !session) {
      return error!;
    }

    const access = await resolveGymSeasonAdminAccess(session);

    if (!access.ok) {
      const mapped = mapSeasonError(new Error(access.error));
      return NextResponse.json({ error: mapped.message }, { status: mapped.status });
    }

    return NextResponse.json({ seasons: await listGymSeasons(access.gymId) });
  } catch (error) {
    const mapped = mapSeasonError(error);
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session, error } = await requireSeasonSession();

    if (error || !session) {
      return error!;
    }

    const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
    const status = normalizeGymSeasonStatus(payload?.status) ?? "upcoming";
    const seasons = await createGymSeason(session, {
      seasonNumber: asNumber(payload?.seasonNumber),
      label: asString(payload?.label) || null,
      startDate: asString(payload?.startDate),
      endDate: asString(payload?.endDate),
      status
    });

    return NextResponse.json({ seasons, message: "Season created." });
  } catch (error) {
    const mapped = mapSeasonError(error);
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { session, error } = await requireSeasonSession();

    if (error || !session) {
      return error!;
    }

    const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
    const status = normalizeGymSeasonStatus(payload?.status);

    if (!status) {
      return NextResponse.json({ error: "A valid season status is required." }, { status: 400 });
    }

    const seasons = await updateGymSeason(session, {
      id: asString(payload?.seasonId),
      seasonNumber: asNumber(payload?.seasonNumber),
      label: asString(payload?.label) || null,
      startDate: asString(payload?.startDate),
      endDate: asString(payload?.endDate),
      status
    });

    return NextResponse.json({ seasons, message: "Season updated." });
  } catch (error) {
    const mapped = mapSeasonError(error);
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
