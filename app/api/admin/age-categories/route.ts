import { NextRequest, NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth/session";
import {
  createAgeCategoryGrid,
  listAgeCategoryGrids,
  updateAgeCategoryGrid
} from "@/lib/services/age-category-eligibility";

export const dynamic = "force-dynamic";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

async function requireAdminSession() {
  const session = await getAuthSession();

  if (!session?.roles.includes("admin")) {
    return {
      session: null,
      error: NextResponse.json({ error: "Admin access is required." }, { status: 403 })
    };
  }

  return { session, error: null };
}

function mapAgeCategoryError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unable to manage age category grid.";
  const status = message.includes("required")
    || message.includes("Invalid")
    || message.includes("Duplicate")
    || message.includes("needs")
    ? 400
    : 500;

  return { message, status };
}

export async function GET() {
  try {
    const { error } = await requireAdminSession();

    if (error) {
      return error;
    }

    return NextResponse.json({ grids: await listAgeCategoryGrids() });
  } catch (error) {
    const mapped = mapAgeCategoryError(error);
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session, error } = await requireAdminSession();

    if (error || !session) {
      return error!;
    }

    const payload = asRecord(await request.json().catch(() => null));
    const result = await createAgeCategoryGrid({
      seasonLabel: typeof payload.seasonLabel === "string" ? payload.seasonLabel : "",
      label: typeof payload.label === "string" ? payload.label : "",
      status: payload.status === "active" || payload.status === "archived" ? payload.status : "draft",
      sourceName: typeof payload.sourceName === "string" ? payload.sourceName : null,
      notes: typeof payload.notes === "string" ? payload.notes : null,
      rules: Array.isArray(payload.rules) ? payload.rules as never : []
    }, session.userId);

    return NextResponse.json({ ...result, message: result.grids.find((grid) => grid.id === result.gridId)?.status === "active" ? "Age category grid published." : "Age category grid saved." });
  } catch (error) {
    const mapped = mapAgeCategoryError(error);
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { session, error } = await requireAdminSession();

    if (error || !session) {
      return error!;
    }

    const payload = asRecord(await request.json().catch(() => null));
    const result = await updateAgeCategoryGrid({
      gridId: typeof payload.gridId === "string" ? payload.gridId : "",
      seasonLabel: typeof payload.seasonLabel === "string" ? payload.seasonLabel : "",
      label: typeof payload.label === "string" ? payload.label : "",
      status: payload.status === "active" || payload.status === "archived" ? payload.status : "draft",
      sourceName: typeof payload.sourceName === "string" ? payload.sourceName : null,
      notes: typeof payload.notes === "string" ? payload.notes : null,
      rules: Array.isArray(payload.rules) ? payload.rules as never : []
    }, session.userId);

    return NextResponse.json({ ...result, message: result.grids.find((grid) => grid.id === result.gridId)?.status === "active" ? "Age category grid published." : "Age category grid saved." });
  } catch (error) {
    const mapped = mapAgeCategoryError(error);
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
