import { describe, expect, it } from "vitest";

import { normalizeCommandTeam } from "@/lib/services/planner-remote-client";
import { buildDefaultTeamSelectionProfile } from "@/lib/domain/team";

describe("normalizeCommandTeam", () => {
  it("returns a fully normalized TeamRecord with remote sync metadata and roster fallback", () => {
    const selectionProfile = buildDefaultTeamSelectionProfile();
    selectionProfile.sports.tumbling.enabled = true;
    selectionProfile.sports.tumbling.minLevel = "Level 2";
    selectionProfile.sports.tumbling.minScore = 1.7;

    const team = normalizeCommandTeam(
      "workspace:coach:test-user",
      {
        id: "11111111-1111-1111-1111-111111111111",
        workspace_root_id: "root-1",
        name: "Sharks",
        division: "Elite",
        created_at: "2026-04-23T10:00:00.000Z",
        updated_at: "2026-04-23T11:00:00.000Z",
        archived_at: null,
        deleted_at: null,
        restored_from_version_id: "restore-team",
        metadata: {
          teamLevel: "Level 2",
          ageCategory: "Senior",
          trainingDays: "Tue Thu",
          trainingHours: "5:00 PM - 7:00 PM",
          assignedCoachNames: ["Coach Lee"],
          linkedCoachIds: ["coach-1"],
          selectionProfile
        }
      },
      {
        lockVersion: 4,
        changeSetId: "change-team"
      },
      {
        memberAthleteIds: ["athlete-1"],
        memberRegistrationNumbers: ["REG-001"],
        status: "active"
      }
    );

    expect(team.id).toBe("11111111-1111-1111-1111-111111111111");
    expect(team.remoteTeamId).toBe("11111111-1111-1111-1111-111111111111");
    expect(team.workspaceRootId).toBe("root-1");
    expect(team.lockVersion).toBe(4);
    expect(team.lastChangeSetId).toBe("change-team");
    expect(team.restoredFromVersionId).toBe("restore-team");
    expect(team.memberAthleteIds).toEqual(["athlete-1"]);
    expect(team.memberRegistrationNumbers).toEqual(["REG-001"]);
    expect(team.selectionProfile.sports.tumbling.minLevel).toBe("Level 2");
    expect(team.selectionProfile.sports.tumbling.minScore).toBe(1.7);
  });
});
