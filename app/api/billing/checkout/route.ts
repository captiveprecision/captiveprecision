import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth/session";
import { createPremiumCheckoutSession } from "@/lib/billing/stripe";

export async function POST(request: Request) {
  try {
    const session = await getAuthSession();

    if (!session) {
      return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
    }

    const payload = await request.json().catch(() => null) as { scope?: "coach" | "gym"; gymId?: string | null } | null;
    const checkout = await createPremiumCheckoutSession(session, payload?.scope ?? "coach", payload?.gymId ?? null);

    return NextResponse.json({ url: checkout.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start checkout.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
