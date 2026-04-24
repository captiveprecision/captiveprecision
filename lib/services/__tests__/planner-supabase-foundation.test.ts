import { describe, expect, it } from "vitest";

import { mergeRemoteFoundationIntoProject } from "@/lib/services/planner-supabase-foundation";
import { normalizePlannerTeam } from "@/lib/services/planner-domain-mappers";
import { buildDefaultPlannerProject } from "@/lib/services/planner-workspace";
import { buildDefaultTeamSelectionProfile } from "@/lib/domain/team";

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

describe("mergeRemoteFoundationIntoProject", () => {
  it("keeps the local team id for synced teams and preserves local-only unsynced teams", () => {
    const project = {
      ...buildDefaultPlannerProject(scope),
      workspaceRootId: workspaceRoot.id,
      teams: [
        normalizePlannerTeam({
          id: "temp-team-1",
          workspaceId: scope.workspaceId,
          workspaceRootId: workspaceRoot.id,
          remoteTeamId: "11111111-1111-1111-1111-111111111111",
          name: "Sharks",
          teamLevel: "Level 2",
          teamType: "Senior",
          createdAt: "2026-04-23T10:00:00.000Z",
          updatedAt: "2026-04-23T10:00:00.000Z",
          selectionProfile: buildDefaultTeamSelectionProfile()
        }),
        normalizePlannerTeam({
          id: "team-local-only",
          workspaceId: scope.workspaceId,
          workspaceRootId: workspaceRoot.id,
          name: "Wolves",
          teamLevel: "Level 1",
          teamType: "Youth",
          createdAt: "2026-04-23T10:01:00.000Z",
          updatedAt: "2026-04-23T10:01:00.000Z",
          selectionProfile: buildDefaultTeamSelectionProfile()
        })
      ]
    };

    const remoteTeam = normalizePlannerTeam({
      id: "11111111-1111-1111-1111-111111111111",
      workspaceId: scope.workspaceId,
      workspaceRootId: workspaceRoot.id,
      remoteTeamId: "11111111-1111-1111-1111-111111111111",
      name: "Sharks Elite",
      teamLevel: "Level 3",
      teamType: "Senior",
      createdAt: "2026-04-23T10:02:00.000Z",
      updatedAt: "2026-04-23T10:03:00.000Z",
      selectionProfile: buildDefaultTeamSelectionProfile()
    });
    const remoteProject = {
      ...buildDefaultPlannerProject(scope),
      workspaceRootId: workspaceRoot.id,
      updatedAt: "2026-04-23T10:03:00.000Z",
      lastChangeSetId: "remote-change"
    };

    const merged = mergeRemoteFoundationIntoProject(project, {
      workspaceRoot,
      plannerProject: remoteProject,
      assignments: [],
      athletes: [],
      tryoutRecords: [],
      teams: [remoteTeam],
      skillPlans: [],
      routinePlans: [],
      seasonPlans: [],
      syncMetadata: {
        lastChangeSetId: "remote-change",
        lastBackupAt: null
      }
    });

    const syncedTeam = merged.teams.find((team) => team.remoteTeamId === "11111111-1111-1111-1111-111111111111");
    expect(syncedTeam?.id).toBe("temp-team-1");
    expect(syncedTeam?.name).toBe("Sharks Elite");
    expect(merged.teams.some((team) => team.id === "team-local-only")).toBe(true);
    expect(merged.teams).toHaveLength(2);
  });
});
