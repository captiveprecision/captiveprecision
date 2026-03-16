import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null);

  if (!payload) {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const admin = createAdminClient();
  const eventId = payload.id ?? crypto.randomUUID();

  const { error } = await admin.from("whop_webhook_events").insert({
    provider_event_id: eventId,
    event_type: payload.type ?? "unknown",
    payload,
    status: "received"
  } as never);

  if (error) {
    return NextResponse.json(
      { error: "Failed to persist webhook event.", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true, eventId });
}
