import { NextRequest, NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth/session";
import { getEligibleAgeCategoriesForBirthDate } from "@/lib/services/age-category-eligibility";
import { resolveGymAccessContext } from "@/lib/services/gym-access";
import { getActiveGymSeasonForGym } from "@/lib/services/gym-seasons";

export const dynamic = "force-dynamic";

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(request: NextRequest) {
  const session = await getAuthSession();

  if (!session) {
    return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  }

  const dateOfBirth = normalizeText(request.nextUrl.searchParams.get("dateOfBirth"));
  let seasonLabel = normalizeText(request.nextUrl.searchParams.get("seasonLabel"));

  if (!seasonLabel) {
    const access = await resolveGymAccessContext(session);
    const activeSeason = access?.gym ? await getActiveGymSeasonForGym(access.gym.id) : null;
    seasonLabel = activeSeason?.label ?? "";
  }

  const eligibility = await getEligibleAgeCategoriesForBirthDate(dateOfBirth, seasonLabel);

  return NextResponse.json({ eligibility });
}
