import type { AuthSession } from "@/lib/auth/session";
import type { PlannerProject } from "@/lib/domain/planner-project";
import { defaultQualificationRules, defaultTryoutTemplate } from "@/lib/tools/cheer-planner-tryouts";

export type PlannerWorkspaceScope = "coach" | "gym";

type PlannerScopeType = PlannerWorkspaceScope;

export type PlannerScopeContext = {
  scope: PlannerWorkspaceScope;
  scopeType: PlannerScopeType;
  projectId: string;
  workspaceId: string;
  ownerProfileId: string | null;
  gymId: string | null;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuidString(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value.trim());
}

export function parsePlannerWorkspaceScope(value: unknown): PlannerWorkspaceScope {
  return value === "gym" ? "gym" : "coach";
}

export function buildPlannerProjectId(session: Pick<AuthSession, "userId" | "primaryGymId">, scope: PlannerWorkspaceScope) {
  return scope === "gym"
    ? `planner-project:gym:${session.primaryGymId ?? session.userId}`
    : `planner-project:coach:${session.userId}`;
}

export function buildPlannerWorkspaceId(session: Pick<AuthSession, "userId" | "primaryGymId">, scope: PlannerWorkspaceScope) {
  return scope === "gym"
    ? `workspace:gym:${session.primaryGymId ?? session.userId}`
    : `workspace:coach:${session.userId}`;
}

export function resolvePlannerScopeContext(
  session: Pick<AuthSession, "userId" | "primaryGymId">,
  scope: PlannerWorkspaceScope
): PlannerScopeContext {
  return {
    scope,
    scopeType: scope,
    projectId: buildPlannerProjectId(session, scope),
    workspaceId: buildPlannerWorkspaceId(session, scope),
    ownerProfileId: scope === "coach" ? session.userId : null,
    gymId: scope === "gym" ? (session.primaryGymId ?? null) : null
  };
}

export function buildDefaultPlannerProject(scope: PlannerScopeContext): PlannerProject {
  const now = new Date().toISOString();

  return {
    id: scope.projectId,
    workspaceId: scope.workspaceId,
    name: "Cheer Planner",
    status: "active",
    pipelineStage: "tryouts",
    template: {
      ...defaultTryoutTemplate,
      options: defaultTryoutTemplate.options.map((option) => ({ ...option })),
      defaultSkillCounts: { ...defaultTryoutTemplate.defaultSkillCounts }
    },
    athletes: [],
    evaluations: [],
    teams: [],
    skillPlans: [],
    routinePlans: [],
    seasonPlans: [],
    qualificationRules: { ...defaultQualificationRules },
    createdAt: now,
    updatedAt: now
  };
}
