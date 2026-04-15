import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth/session";
import { resolveBillingStatus } from "@/lib/billing/stripe";

export async function GET() {
  try {
    const session = await getAuthSession();

    if (!session) {
      return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
    }

    const { customerId: _customerId, ...status } = await resolveBillingStatus(session);
    return NextResponse.json(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load billing status.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
