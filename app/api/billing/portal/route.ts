import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth/session";
import { createBillingPortalSession } from "@/lib/billing/stripe";

export async function POST() {
  try {
    const session = await getAuthSession();

    if (!session) {
      return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
    }

    const portal = await createBillingPortalSession(session);
    return NextResponse.json({ url: portal.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to open billing portal.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
