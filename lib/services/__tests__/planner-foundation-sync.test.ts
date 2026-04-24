import { describe, expect, it } from "vitest";

import { evaluateFoundationSnapshotDecision } from "@/lib/services/planner-foundation-sync";
import { buildDefaultPlannerProject } from "@/lib/services/planner-workspace";

const scope = {
  scope: "coach" as const,
  scopeType: "coach" as const,
  projectId: "planner-project:coach:test-user",
  workspaceId: "workspace:coach:test-user",
  ownerProfileId: "test-user",
  gymId: null
};

const workspaceRoot = {
  id: "root-1",
  scopeType: "coach" as const,
  ownerProfileId: "test-user",
  gymId: null,
  status: "active" as const,
  createdAt: "2026-04-23T10:00:00.000Z",
  updatedAt: "2026-04-23T10:00:00.000Z"
};

function buildSnapshot(updatedAt: string, lastChangeSetId: string | null) {
  const plannerProject = {
    ...buildDefaultPlannerProject(scope),
    workspaceRootId: workspaceRoot.id,
    updatedAt,
    lastChangeSetId
  };

  return {
    workspaceRoot,
    plannerProject,
    assignments: [],
    athletes: [],
    tryoutRecords: [],
    teams: [],
    skillPlans: [],
    routinePlans: [],
    seasonPlans: [],
    syncMetadata: {
      lastChangeSetId,
      lastBackupAt: null
    }
  };
}

describe("evaluateFoundationSnapshotDecision", () => {
  it("discards superseded requests without refetching", () => {
    const decision = evaluateFoundationSnapshotDecision(
      buildSnapshot("2026-04-23T11:00:00.000Z", "remote-change"),
      {
        requestId: 1,
        mutationVersionAtStart: 0,
        startedAt: Date.now(),
        source: "test"
      },
      {
        latestRequestId: 2,
        currentMutationVersion: 0,
        localState: {
          updatedAt: "2026-04-23T10:00:00.000Z",
          lastChangeSetId: null
        }
      }
    );

    expect(decision).toEqual({
      discard: true,
      reason: "superseded-request",
      shouldRefetch: false
    });
  });

  it("discards snapshots when a local mutation happened after the request started", () => {
    const decision = evaluateFoundationSnapshotDecision(
      buildSnapshot("2026-04-23T11:00:00.000Z", "remote-change"),
      {
        requestId: 2,
        mutationVersionAtStart: 0,
        startedAt: Date.now(),
        source: "test"
      },
      {
        latestRequestId: 2,
        currentMutationVersion: 1,
        localState: {
          updatedAt: "2026-04-23T10:30:00.000Z",
          lastChangeSetId: "local-change"
        }
      }
    );

    expect(decision).toEqual({
      discard: true,
      reason: "local-mutation-after-request",
      shouldRefetch: true
    });
  });

  it("discards older remote snapshots when the local change set is newer", () => {
    const decision = evaluateFoundationSnapshotDecision(
      buildSnapshot("2026-04-23T10:00:00.000Z", "remote-change"),
      {
        requestId: 3,
        mutationVersionAtStart: 1,
        startedAt: Date.now(),
        source: "test"
      },
      {
        latestRequestId: 3,
        currentMutationVersion: 1,
        localState: {
          updatedAt: "2026-04-23T10:30:00.000Z",
          lastChangeSetId: "local-change"
        }
      }
    );

    expect(decision).toEqual({
      discard: true,
      reason: "local-change-set-newer",
      shouldRefetch: true
    });
  });

  it("applies fresh snapshots", () => {
    const decision = evaluateFoundationSnapshotDecision(
      buildSnapshot("2026-04-23T12:00:00.000Z", "remote-change"),
      {
        requestId: 4,
        mutationVersionAtStart: 1,
        startedAt: Date.now(),
        source: "test"
      },
      {
        latestRequestId: 4,
        currentMutationVersion: 1,
        localState: {
          updatedAt: "2026-04-23T10:30:00.000Z",
          lastChangeSetId: "older-local-change"
        }
      }
    );

    expect(decision).toEqual({ discard: false });
  });
});
