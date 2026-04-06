import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth/session";
import { listRemotePlannerFoundation } from "@/lib/services/planner-supabase-foundation";

export async function GET() {
  try {
    const session = await getAuthSession();

    if (!session || !session.roles.includes("coach")) {
      return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
    }

    const snapshot = await listRemotePlannerFoundation(session);
    return NextResponse.json(snapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load planner foundation data.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
