import type { PlannerLevelLabel } from "@/lib/domain/planner-levels";
import type { PlannerProject } from "@/lib/domain/planner-project";
import type { TeamSkillCategory, TeamSkillPlan, TeamSkillPlanStatus, TeamSkillSelection } from "@/lib/domain/skill-plan";
import { buildTeamBuilderCandidates, buildTeamBuilderTeamsWithMembers } from "@/lib/services/planner-team-builder";

export const SKILL_PLANNER_CATEGORY_CONFIG: Array<{
  key: TeamSkillCategory;
  label: string;
  defaultRows: number;
  groupCount?: number;
}> = [
  { key: "stunts", label: "Stunts", defaultRows: 1 },
  { key: "running-tumbling", label: "Running Tumbling", defaultRows: 1 },
  { key: "standing-tumbling", label: "Standing Tumbling", defaultRows: 1 },
  { key: "jumps", label: "Jumps", defaultRows: 1 },
  { key: "pyramid", label: "Pyramid", defaultRows: 1, groupCount: 2 }
];

export function getSkillPlannerCategoryLabel(category: TeamSkillCategory) {
  return SKILL_PLANNER_CATEGORY_CONFIG.find((item) => item.key === category)?.label ?? category;
}

function cloneSelection(selection: TeamSkillSelection): TeamSkillSelection {
  return { ...selection };
}

function buildSelectionId(teamId: string, category: TeamSkillCategory, groupIndex: number | null, slotIndex: number) {
  return ["team-skill-selection", teamId, category, groupIndex ?? "base", slotIndex].join("-");
}

function buildBlankSelection(
  teamId: string,
  category: TeamSkillCategory,
  slotIndex: number,
  groupIndex: number | null = null
): TeamSkillSelection {
  return {
    id: buildSelectionId(teamId, category, groupIndex, slotIndex),
    athleteId: null,
    category,
    groupIndex,
    sortOrder: slotIndex,
    sourceEvaluationId: null,
    levelKey: null,
    levelLabel: "",
    skillName: "",
    sourceOptionId: null,
    isExtra: false,
    status: "selected",
    notes: ""
  };
}

function normalizeExistingSelection(selection: TeamSkillSelection, index: number): TeamSkillSelection {
  return {
    ...selection,
    athleteId: selection.athleteId ?? null,
    category: selection.category ?? "stunts",
    groupIndex: selection.groupIndex ?? null,
    sortOrder: typeof selection.sortOrder === "number" ? selection.sortOrder : index,
    levelKey: selection.levelKey ?? null,
    levelLabel: selection.levelLabel ?? "",
    skillName: selection.skillName ?? "",
    sourceEvaluationId: selection.sourceEvaluationId ?? null,
    sourceOptionId: selection.sourceOptionId ?? null,
    isExtra: Boolean(selection.isExtra),
    status: selection.status ?? "selected",
    notes: selection.notes ?? ""
  };
}

export type SkillPlannerCategorySection = {
  key: TeamSkillCategory;
  label: string;
  groups: Array<{
    groupIndex: number | null;
    groupLabel: string | null;
    selections: TeamSkillSelection[];
  }>;
};

export type SkillPlannerTeamInput = {
  teamId: string;
  teamName: string;
  teamLevel: PlannerLevelLabel;
  teamType: string;
  existingPlan: TeamSkillPlan | null;
  sections: SkillPlannerCategorySection[];
};

export function buildDefaultSkillPlannerSelections(teamId: string) {
  return SKILL_PLANNER_CATEGORY_CONFIG.flatMap((category) => {
    if (category.groupCount) {
      return Array.from({ length: category.groupCount }, (_, groupOffset) => (
        Array.from({ length: category.defaultRows }, (_, rowIndex) => buildBlankSelection(teamId, category.key, rowIndex, groupOffset + 1))
      )).flat();
    }

    return Array.from({ length: category.defaultRows }, (_, rowIndex) => buildBlankSelection(teamId, category.key, rowIndex));
  });
}

export function buildSkillPlannerDraftSelections(teamId: string, existingSelections: TeamSkillSelection[]) {
  const normalizedExistingSelections = existingSelections.map(normalizeExistingSelection);
  const byId = new Map(normalizedExistingSelections.map((selection) => [selection.id, selection] as const));
  const baseSelections = buildDefaultSkillPlannerSelections(teamId).map((selection) => byId.get(selection.id) ?? selection);
  const knownIds = new Set(baseSelections.map((selection) => selection.id));
  const extraSelections = normalizedExistingSelections.filter((selection) => !knownIds.has(selection.id));

  return [...baseSelections, ...extraSelections];
}

function buildSkillPlannerSections(teamId: string, existingSelections: TeamSkillSelection[]) {
  const draftSelections = buildSkillPlannerDraftSelections(teamId, existingSelections);

  return SKILL_PLANNER_CATEGORY_CONFIG.map((category) => {
    const categorySelections = draftSelections.filter((selection) => selection.category === category.key);
    const groups = category.groupCount
      ? Array.from({ length: category.groupCount }, (_, groupOffset) => {
          const groupIndex = groupOffset + 1;
          return {
            groupIndex,
            groupLabel: `Structure ${groupIndex}`,
            selections: categorySelections
              .filter((selection) => selection.groupIndex === groupIndex)
              .sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id))
          };
        })
      : [{
          groupIndex: null,
          groupLabel: null,
          selections: categorySelections
            .filter((selection) => selection.groupIndex === null)
            .sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id))
        }];

    return {
      key: category.key,
      label: category.label,
      groups
    } satisfies SkillPlannerCategorySection;
  });
}

export function buildSkillPlannerTeamInputs(
  project: PlannerProject,
  levelLabelsList: readonly PlannerLevelLabel[]
): SkillPlannerTeamInput[] {
  const candidates = buildTeamBuilderCandidates(project, levelLabelsList);
  const teamsWithMembers = buildTeamBuilderTeamsWithMembers(project, candidates);
  const skillPlanMap = new Map(project.skillPlans.map((plan) => [plan.teamId, plan] as const));

  return teamsWithMembers.map((team) => ({
    teamId: team.id,
    teamName: team.name,
    teamLevel: team.teamLevel,
    teamType: team.teamType,
    existingPlan: skillPlanMap.get(team.id) ?? null,
    sections: buildSkillPlannerSections(team.id, skillPlanMap.get(team.id)?.selections ?? [])
  }));
}

export function createTeamSkillPlanRecord(project: PlannerProject, teamId: string, occurredAt: string): TeamSkillPlan {
  return {
    id: `team-skill-plan-${teamId}`,
    workspaceId: project.workspaceId,
    plannerProjectId: project.id,
    teamId,
    status: "draft",
    notes: "",
    selections: [],
    createdAt: occurredAt,
    updatedAt: occurredAt
  };
}

export function normalizeTeamSkillSelections(selections: TeamSkillSelection[]): TeamSkillSelection[] {
  const byId = new Map<string, TeamSkillSelection>();

  selections.forEach((selection, index) => {
    byId.set(selection.id, normalizeExistingSelection(cloneSelection(selection), index));
  });

  return [...byId.values()].sort((left, right) => left.category.localeCompare(right.category) || (left.groupIndex ?? 0) - (right.groupIndex ?? 0) || left.sortOrder - right.sortOrder || left.id.localeCompare(right.id));
}

export function upsertTeamSkillPlan(project: PlannerProject, nextPlan: TeamSkillPlan, occurredAt: string): PlannerProject {
  const normalizedPlan: TeamSkillPlan = {
    ...nextPlan,
    selections: normalizeTeamSkillSelections(nextPlan.selections),
    updatedAt: occurredAt
  };

  return {
    ...project,
    skillPlans: project.skillPlans.some((plan) => plan.id === normalizedPlan.id)
      ? project.skillPlans.map((plan) => (plan.id === normalizedPlan.id ? normalizedPlan : plan))
      : [...project.skillPlans, normalizedPlan]
  };
}

export function replaceTeamSkillPlanSelections(
  project: PlannerProject,
  input: {
    teamId: string;
    selections: TeamSkillSelection[];
    notes?: string;
    status?: TeamSkillPlanStatus;
    occurredAt: string;
  }
): PlannerProject {
  const existingPlan = project.skillPlans.find((plan) => plan.teamId === input.teamId) ?? createTeamSkillPlanRecord(project, input.teamId, input.occurredAt);

  return upsertTeamSkillPlan(project, {
    ...existingPlan,
    notes: input.notes ?? existingPlan.notes,
    status: input.status ?? existingPlan.status,
    selections: input.selections,
    updatedAt: input.occurredAt
  }, input.occurredAt);
}

export function getTeamSkillPlannerInput(project: PlannerProject, teamId: string, levelLabelsList: readonly PlannerLevelLabel[]) {
  return buildSkillPlannerTeamInputs(project, levelLabelsList).find((team) => team.teamId === teamId) ?? null;
}
