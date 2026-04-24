import type { PlannerRemoteFoundationSnapshot } from "@/lib/services/planner-supabase-foundation";

export type FoundationRequestContext = {
  requestId: number;
  mutationVersionAtStart: number;
  startedAt: number;
  source: string;
};

export type FoundationSnapshotDiscardReason =
  | "superseded-request"
  | "local-mutation-after-request"
  | "local-change-set-newer";

export type FoundationSnapshotDecision = {
  discard: boolean;
  reason?: FoundationSnapshotDiscardReason;
  shouldRefetch?: boolean;
};

export type FoundationSyncLocalState = {
  updatedAt: string;
  lastChangeSetId?: string | null;
};

function parseIsoTime(value: string | null | undefined) {
  if (!value) {
    return 0;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function evaluateFoundationSnapshotDecision(
  snapshot: PlannerRemoteFoundationSnapshot,
  context: FoundationRequestContext,
  options: {
    latestRequestId: number;
    currentMutationVersion: number;
    localState: FoundationSyncLocalState;
  }
): FoundationSnapshotDecision {
  if (context.requestId !== options.latestRequestId) {
    return {
      discard: true,
      reason: "superseded-request",
      shouldRefetch: false
    };
  }

  if (options.currentMutationVersion !== context.mutationVersionAtStart) {
    return {
      discard: true,
      reason: "local-mutation-after-request",
      shouldRefetch: true
    };
  }

  const localUpdatedAt = parseIsoTime(options.localState.updatedAt);
  const remoteUpdatedAt = parseIsoTime(snapshot.plannerProject.updatedAt);
  const localLastChangeSetId = options.localState.lastChangeSetId ?? null;
  const remoteLastChangeSetId = snapshot.syncMetadata.lastChangeSetId ?? snapshot.plannerProject.lastChangeSetId ?? null;

  if (
    localLastChangeSetId
    && remoteLastChangeSetId
    && localLastChangeSetId !== remoteLastChangeSetId
    && localUpdatedAt >= remoteUpdatedAt
  ) {
    return {
      discard: true,
      reason: "local-change-set-newer",
      shouldRefetch: true
    };
  }

  return { discard: false };
}
