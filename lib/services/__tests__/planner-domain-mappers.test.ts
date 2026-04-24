import { describe, expect, it } from "vitest";

import {
  normalizePlannerAthlete,
  normalizePlannerProject,
  normalizePlannerTeam,
  normalizePlannerTryoutRecord,
  normalizeTeamRoutinePlan,
  normalizeTeamSeasonPlan,
  normalizeTeamSkillPlan
} from "@/lib/services/planner-domain-mappers";
import { buildDefaultPlannerProject } from "@/lib/services/planner-workspace";
import { buildDefaultTeamSelectionProfile } from "@/lib/domain/team";
import { defaultQualificationRules, defaultTryoutTemplate, defaultTryoutTemplates } from "@/lib/tools/cheer-planner-tryouts";

const NOW = "2026-04-23T12:00:00.000Z";
const LATER = "2026-04-23T12:05:00.000Z";

const scope = {
  scope: "coach" as const,
  scopeType: "coach" as const,
  projectId: "planner-project:coach:test-user",
  workspaceId: "workspace:coach:test-user",
  ownerProfileId: "test-user",
  gymId: null
};

describe("planner-domain-mappers", () => {
  it("preserves sync metadata for athlete, team, and tryout records", () => {
    const athlete = normalizePlannerAthlete({
      id: "athlete-1",
      workspaceId: scope.workspaceId,
      registrationNumber: "REG-001",
      firstName: "Ava",
      lastName: "Stone",
      createdAt: NOW,
      updatedAt: LATER,
      workspaceRootId: "root-1",
      lockVersion: 3,
      lastChangeSetId: "change-athlete",
      archivedAt: null,
      deletedAt: null,
      restoredFromVersionId: "restore-athlete"
    });
    const team = normalizePlannerTeam({
      id: "team-1",
      workspaceId: scope.workspaceId,
      remoteTeamId: "remote-team-1",
      name: "Sharks",
      teamLevel: "Level 2",
      teamType: "Senior",
      createdAt: NOW,
      updatedAt: LATER,
      workspaceRootId: "root-1",
      lockVersion: 4,
      lastChangeSetId: "change-team",
      archivedAt: null,
      deletedAt: null,
      restoredFromVersionId: "restore-team",
      selectionProfile: buildDefaultTeamSelectionProfile()
    });
    const tryoutRecord = normalizePlannerTryoutRecord({
      id: "tryout-1",
      workspaceId: scope.workspaceId,
      athleteId: athlete.id,
      athleteRegistrationNumber: athlete.registrationNumber,
      plannerProjectId: scope.projectId,
      createdAt: NOW,
      updatedAt: LATER,
      occurredAt: LATER,
      season: "2026",
      seasonLabel: "2026-2027",
      workspaceRootId: "root-1",
      lockVersion: 5,
      lastChangeSetId: "change-tryout",
      archivedAt: null,
      deletedAt: null,
      restoredFromVersionId: "restore-tryout",
      rawData: {
        sport: "tumbling",
        mode: "levels",
        template: {
          id: "template-1",
          name: "Template",
          updatedAt: NOW
        },
        buckets: []
      },
      resultSummary: {
        totalBaseScore: 10,
        totalExtraScore: 2,
        bucketScores: [],
        highlights: []
      }
    });

    expect(athlete.workspaceRootId).toBe("root-1");
    expect(athlete.lockVersion).toBe(3);
    expect(athlete.lastChangeSetId).toBe("change-athlete");
    expect(athlete.restoredFromVersionId).toBe("restore-athlete");

    expect(team.workspaceRootId).toBe("root-1");
    expect(team.lockVersion).toBe(4);
    expect(team.lastChangeSetId).toBe("change-team");
    expect(team.restoredFromVersionId).toBe("restore-team");

    expect(tryoutRecord.workspaceRootId).toBe("root-1");
    expect(tryoutRecord.lockVersion).toBe(5);
    expect(tryoutRecord.lastChangeSetId).toBe("change-tryout");
    expect(tryoutRecord.restoredFromVersionId).toBe("restore-tryout");
    expect(tryoutRecord.season).toBe("2026");
    expect(tryoutRecord.seasonLabel).toBe("2026-2027");
  });

  it("preserves sync metadata for skill, routine, and season plans", () => {
    const skillPlan = normalizeTeamSkillPlan({
      id: "skill-plan-1",
      workspaceId: scope.workspaceId,
      plannerProjectId: scope.projectId,
      teamId: "team-1",
      createdAt: NOW,
      updatedAt: LATER,
      workspaceRootId: "root-1",
      lockVersion: 2,
      lastChangeSetId: "change-skill",
      restoredFromVersionId: "restore-skill"
    });
    const routinePlan = normalizeTeamRoutinePlan({
      id: "routine-plan-1",
      workspaceId: scope.workspaceId,
      plannerProjectId: scope.projectId,
      teamId: "team-1",
      createdAt: NOW,
      updatedAt: LATER,
      workspaceRootId: "root-1",
      lockVersion: 6,
      lastChangeSetId: "change-routine",
      restoredFromVersionId: "restore-routine"
    });
    const seasonPlan = normalizeTeamSeasonPlan({
      id: "season-plan-1",
      workspaceId: scope.workspaceId,
      plannerProjectId: scope.projectId,
      teamId: "team-1",
      createdAt: NOW,
      updatedAt: LATER,
      workspaceRootId: "root-1",
      lockVersion: 7,
      lastChangeSetId: "change-season",
      restoredFromVersionId: "restore-season"
    });

    expect(skillPlan.workspaceRootId).toBe("root-1");
    expect(skillPlan.lastChangeSetId).toBe("change-skill");
    expect(skillPlan.restoredFromVersionId).toBe("restore-skill");

    expect(routinePlan.workspaceRootId).toBe("root-1");
    expect(routinePlan.lastChangeSetId).toBe("change-routine");
    expect(routinePlan.restoredFromVersionId).toBe("restore-routine");

    expect(seasonPlan.workspaceRootId).toBe("root-1");
    expect(seasonPlan.lastChangeSetId).toBe("change-season");
    expect(seasonPlan.restoredFromVersionId).toBe("restore-season");
  });

  it("keeps project sync metadata and drops invalid entity rows instead of collapsing the project", () => {
    const baseProject = buildDefaultPlannerProject(scope);
    const normalizedProject = normalizePlannerProject({
      ...baseProject,
      workspaceRootId: "root-1",
      lockVersion: 9,
      lastChangeSetId: "project-change",
      updatedAt: LATER,
      athletes: [
        {
          id: "athlete-1",
          workspaceId: scope.workspaceId,
          registrationNumber: "REG-001",
          firstName: "Ava",
          lastName: "Stone",
          createdAt: NOW,
          updatedAt: NOW
        },
        null as never
      ],
      teams: [
        {
          id: "team-1",
          workspaceId: scope.workspaceId,
          name: "Sharks",
          teamLevel: "Level 2",
          teamType: "Senior",
          selectionProfile: buildDefaultTeamSelectionProfile(),
          createdAt: NOW,
          updatedAt: NOW
        },
        null as never
      ],
      tryoutRecords: [
        {
          id: "tryout-1",
          workspaceId: scope.workspaceId,
          athleteId: "athlete-1",
          athleteRegistrationNumber: "REG-001",
          plannerProjectId: baseProject.id,
          createdAt: NOW,
          updatedAt: NOW,
          occurredAt: NOW,
          rawData: {
            sport: "tumbling",
            mode: "levels",
            template: {
              id: "template-1",
              name: "Template",
              updatedAt: NOW
            },
            buckets: []
          },
          resultSummary: {
            totalBaseScore: 0,
            totalExtraScore: 0,
            bucketScores: [],
            highlights: []
          }
        },
        null as never
      ]
    }, defaultTryoutTemplate, defaultQualificationRules, defaultTryoutTemplates);

    expect(normalizedProject.workspaceRootId).toBe("root-1");
    expect(normalizedProject.lockVersion).toBe(9);
    expect(normalizedProject.lastChangeSetId).toBe("project-change");
    expect(normalizedProject.athletes).toHaveLength(1);
    expect(normalizedProject.teams).toHaveLength(1);
    expect(normalizedProject.tryoutRecords).toHaveLength(1);
    expect(normalizedProject.name).toBe(baseProject.name);
  });
});
