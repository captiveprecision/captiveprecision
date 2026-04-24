import { NextRequest, NextResponse } from "next/server";

import { getPlannerScopeContext, requirePlannerSession } from "@/lib/services/planner-api-access";
import { requireCheerPlannerPremium } from "@/lib/access/membership";
import { getPlannerCommandError, savePlannerTryoutRecordCommand } from "@/lib/services/planner-command-service";
import { normalizePlannerTryoutRecord } from "@/lib/services/planner-domain-mappers";
import { isUuidString } from "@/lib/services/planner-workspace";

function asObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asNullableString(value: unknown) {
  const normalized = asString(value);
  return normalized || null;
}

function asOptionalString(value: unknown) {
  return asNullableString(value) ?? undefined;
}

export async function POST(request: NextRequest) {
  try {
    const { session, error } = await requirePlannerSession();

    if (error || !session) {
      return error!;
    }

    const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
    const scope = getPlannerScopeContext(request, session, typeof payload?.scope === "string" ? payload.scope : null);
    const premiumError = await requireCheerPlannerPremium(session, scope);

    if (premiumError) {
      return premiumError;
    }

    const tryoutRecord = asObject(payload?.tryoutRecord);
    const tryoutRecordId = asString(tryoutRecord?.id);
    const athleteId = asString(tryoutRecord?.athleteId);

    if (!tryoutRecord || !tryoutRecordId || !isUuidString(athleteId)) {
      return NextResponse.json({ error: "A valid tryout record payload with a persisted athlete id is required." }, { status: 400 });
    }

    const result = await savePlannerTryoutRecordCommand(session, scope.scope, {
      workspaceRootId: typeof payload?.workspaceRootId === "string" ? payload.workspaceRootId : null,
      expectedLockVersion: typeof tryoutRecord.lockVersion === "number" ? tryoutRecord.lockVersion : null,
      tryoutRecordId,
      athleteId,
      occurredAt: asString(tryoutRecord.occurredAt) || null,
      record: tryoutRecord
    });

    const entity = (result.entity ?? {}) as Record<string, unknown>;
    const record = asObject(entity.record) ?? {};
    const normalizedTryoutRecord = normalizePlannerTryoutRecord({
      ...(record as Record<string, unknown>),
      id: asString(entity.id) || tryoutRecordId,
      athleteId,
      athleteRegistrationNumber: asNullableString(entity.athlete_registration_number) ?? asNullableString(tryoutRecord.athleteRegistrationNumber),
      plannerProjectId: asString(entity.planner_project_id),
      occurredAt: asNullableString(entity.occurred_at) ?? asNullableString(tryoutRecord.occurredAt),
      createdAt: asString(entity.created_at) || new Date().toISOString(),
      updatedAt: asString(entity.updated_at) || new Date().toISOString(),
      workspaceRootId: asOptionalString(entity.workspace_root_id),
      lockVersion: typeof result.lockVersion === "number" ? result.lockVersion : (typeof entity.lock_version === "number" ? entity.lock_version : undefined),
      lastChangeSetId: typeof result.changeSetId === "string" ? result.changeSetId : asOptionalString(entity.last_change_set_id),
      archivedAt: asOptionalString(entity.archived_at),
      deletedAt: asOptionalString(entity.deleted_at),
      restoredFromVersionId: asOptionalString(entity.restored_from_version_id)
    });

    return NextResponse.json({
      tryoutRecord: normalizedTryoutRecord,
      lockVersion: result.lockVersion,
      changeSetId: result.changeSetId,
      latestVersionNumber: result.latestVersionNumber
    });
  } catch (error) {
    const plannerError = getPlannerCommandError(error);
    return NextResponse.json({ error: plannerError.message, code: plannerError.code }, { status: plannerError.code ? 409 : 500 });
  }
}
