import type { AthleteRecord } from "@/lib/domain/athlete";
import type { EvaluationRecord } from "@/lib/domain/evaluation-record";
import type { PlannerProject } from "@/lib/domain/planner-project";
import type { TeamRoutinePlan } from "@/lib/domain/routine-plan";
import type { TeamSeasonPlan } from "@/lib/domain/season-plan";
import type { TeamSkillPlan } from "@/lib/domain/skill-plan";
import type { PlannerRemoteFoundationSnapshot } from "@/lib/services/planner-supabase-foundation";
import type { PlannerWorkspaceScope } from "@/lib/services/planner-workspace";

function buildPlannerUrl(path: string, scope: PlannerWorkspaceScope) {
  const url = new URL(path, window.location.origin);
  url.searchParams.set("scope", scope);
  return url.toString();
}

async function parseResponse<T>(response: Response): Promise<T | null> {
  return response.json().catch(() => null) as Promise<T | null>;
}

export async function fetchPlannerFoundation(scope: PlannerWorkspaceScope) {
  const response = await fetch(buildPlannerUrl("/api/planner/foundation", scope), {
    credentials: "include"
  });
  const result = await parseResponse<PlannerRemoteFoundationSnapshot & { error?: string }>(response);

  if (!response.ok || !result) {
    throw new Error(result?.error ?? "Unable to load Supabase planner data.");
  }

  return result;
}

export async function savePlannerProjectConfig(
  scope: PlannerWorkspaceScope,
  payload: Pick<PlannerProject, "name" | "status" | "pipelineStage" | "template" | "qualificationRules">
) {
  const response = await fetch(buildPlannerUrl("/api/planner/project-config", scope), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ scope, ...payload })
  });
  const result = await parseResponse<{ plannerProject?: PlannerProject; error?: string }>(response);

  if (!response.ok || !result?.plannerProject) {
    throw new Error(result?.error ?? "Unable to save planner configuration.");
  }

  return result.plannerProject;
}

export async function savePlannerAthlete(
  scope: PlannerWorkspaceScope,
  payload: {
    athleteId?: string | null;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    registrationNumber: string;
    notes: string;
    parentContacts: AthleteRecord["parentContacts"];
  }
) {
  const response = await fetch("/api/coach/athletes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ scope, ...payload })
  });
  const result = await parseResponse<{ athlete?: AthleteRecord; athleteId?: string; error?: string }>(response);

  if (!response.ok || !result?.athlete) {
    throw new Error(result?.error ?? "Unable to save athlete to Supabase.");
  }

  return result.athlete;
}

export async function savePlannerEvaluation(scope: PlannerWorkspaceScope, evaluation: EvaluationRecord) {
  const response = await fetch(buildPlannerUrl("/api/planner/evaluations", scope), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ scope, evaluation })
  });
  const result = await parseResponse<{ evaluation?: EvaluationRecord; error?: string }>(response);

  if (!response.ok || !result?.evaluation) {
    throw new Error(result?.error ?? "Unable to save evaluation to Supabase.");
  }

  return result.evaluation;
}

export async function savePlannerSkillPlan(scope: PlannerWorkspaceScope, plan: TeamSkillPlan) {
  const response = await fetch(buildPlannerUrl("/api/planner/skill-plan", scope), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      scope,
      teamId: plan.teamId,
      status: plan.status,
      notes: plan.notes,
      selections: plan.selections
    })
  });
  const result = await parseResponse<{ skillPlan?: TeamSkillPlan; error?: string }>(response);

  if (!response.ok || !result?.skillPlan) {
    throw new Error(result?.error ?? "Unable to save skill plan to Supabase.");
  }

  return result.skillPlan;
}

export async function savePlannerRoutinePlan(scope: PlannerWorkspaceScope, plan: TeamRoutinePlan, remoteTeamId: string) {
  const response = await fetch(buildPlannerUrl("/api/planner/routine-plan", scope), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      scope,
      teamId: remoteTeamId,
      status: plan.status,
      notes: plan.notes,
      document: plan.document
    })
  });
  const result = await parseResponse<{ routinePlan?: TeamRoutinePlan; error?: string }>(response);

  if (!response.ok || !result?.routinePlan) {
    throw new Error(result?.error ?? "Unable to save routine plan to Supabase.");
  }

  return result.routinePlan;
}

export async function savePlannerSeasonPlan(scope: PlannerWorkspaceScope, plan: TeamSeasonPlan) {
  const response = await fetch(buildPlannerUrl("/api/planner/season-plan", scope), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      scope,
      teamId: plan.teamId,
      status: plan.status,
      notes: plan.notes,
      checkpoints: plan.checkpoints
    })
  });
  const result = await parseResponse<{ seasonPlan?: TeamSeasonPlan; error?: string }>(response);

  if (!response.ok || !result?.seasonPlan) {
    throw new Error(result?.error ?? "Unable to save season plan to Supabase.");
  }

  return result.seasonPlan;
}
