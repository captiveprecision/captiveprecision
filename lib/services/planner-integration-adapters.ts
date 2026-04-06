import { buildRoutineBuilderTeamInputs } from "@/lib/services/planner-routine-builder";
import { buildSeasonPlannerTeamInputs } from "@/lib/services/planner-season-planner";
import { buildSkillPlannerDraftSelections, type SkillPlannerTeamInput } from "@/lib/services/planner-skill-planner";
import type { TeamRoutineItem } from "@/lib/domain/routine-plan";
import type { TeamSeasonCheckpoint } from "@/lib/domain/season-plan";
import type { TeamSkillSelection } from "@/lib/domain/skill-plan";

type RoutineBuilderTeamInput = ReturnType<typeof buildRoutineBuilderTeamInputs>[number];
type SeasonPlannerTeamInput = ReturnType<typeof buildSeasonPlannerTeamInputs>[number];
export type SeasonPlannerTeamWithAvailableCheckpoints = SeasonPlannerTeamInput & {
  availableCheckpoints: ReturnType<typeof buildSeasonPlannerAvailableCheckpoints>;
};

export function buildSkillPlannerDraftSelectionRows(team: SkillPlannerTeamInput) {
  return buildSkillPlannerDraftSelections(team.teamId, team.existingPlan?.selections ?? []).map((selection) => ({ ...selection }));
}

export function buildSkillPlannerPersistedSelections(team: SkillPlannerTeamInput, selections: TeamSkillSelection[]) {
  const existingSelections = new Map((team.existingPlan?.selections ?? []).map((selection) => [selection.id, selection] as const));

  return selections
    .filter((selection) => selection.skillName.trim().length > 0 || selection.levelLabel.trim().length > 0)
    .map((selection, index) => {
      const existingSelection = existingSelections.get(selection.id);

      return {
        ...selection,
        athleteId: selection.athleteId ?? existingSelection?.athleteId ?? null,
        sourceEvaluationId: selection.sourceEvaluationId ?? existingSelection?.sourceEvaluationId ?? null,
        sourceOptionId: selection.sourceOptionId ?? existingSelection?.sourceOptionId ?? null,
        levelKey: selection.levelKey ?? existingSelection?.levelKey ?? null,
        isExtra: typeof selection.isExtra === "boolean" ? selection.isExtra : (existingSelection?.isExtra ?? false),
        sortOrder: typeof selection.sortOrder === "number" ? selection.sortOrder : index,
        status: existingSelection?.status ?? selection.status ?? "selected",
        notes: existingSelection?.notes ?? selection.notes ?? ""
      } satisfies TeamSkillSelection;
    });
}

export function buildRoutineBuilderDraftSkillSelectionIds(team: RoutineBuilderTeamInput) {
  const persistedItems = new Set((team.routinePlan?.items ?? []).map((item) => item.skillSelectionId));

  return team.availableSkills
    .filter((skill) => persistedItems.has(skill.skillSelectionId))
    .map((skill) => skill.skillSelectionId);
}

export function buildRoutineBuilderPersistedItems(team: RoutineBuilderTeamInput, skillSelectionIds: string[]) {
  const selectedSkillSelectionIds = new Set(skillSelectionIds);
  const existingItems = new Map((team.routinePlan?.items ?? []).map((item) => [item.skillSelectionId, item] as const));

  return team.availableSkills
    .filter((skill) => selectedSkillSelectionIds.has(skill.skillSelectionId))
    .map((skill, index) => {
      const existingItem = existingItems.get(skill.skillSelectionId);

      return {
        id: existingItem?.id ?? `team-routine-item-${team.teamId}-${skill.skillSelectionId}`,
        skillSelectionId: skill.skillSelectionId,
        athleteId: skill.athleteId ?? existingItem?.athleteId ?? null,
        sortOrder: index,
        status: existingItem?.status ?? "planned",
        notes: existingItem?.notes ?? ""
      } satisfies TeamRoutineItem;
    });
}

export function buildSeasonPlannerAvailableCheckpoints(team: SeasonPlannerTeamInput) {
  const existingCheckpoints = [...(team.seasonPlan?.checkpoints ?? [])]
    .sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id));
  const totalOptionCount = existingCheckpoints.length
    ? Math.max(4, existingCheckpoints.length)
    : (team.routinePlan ? 4 : 0);

  return Array.from({ length: totalOptionCount }, (_, index) => {
    const existingCheckpoint = existingCheckpoints[index];

    if (existingCheckpoint) {
      return {
        id: existingCheckpoint.id,
        name: existingCheckpoint.name || `Checkpoint ${index + 1}`,
        targetDate: existingCheckpoint.targetDate,
        sourceRoutinePlanId: existingCheckpoint.sourceRoutinePlanId
      };
    }

    return {
      id: `team-season-checkpoint-${team.teamId}-${index + 1}`,
      name: `Checkpoint ${index + 1}`,
      targetDate: null,
      sourceRoutinePlanId: team.routinePlan?.id ?? null
    };
  });
}

export function buildSeasonPlannerDraftCheckpointIds(team: SeasonPlannerTeamWithAvailableCheckpoints) {
  return (team.seasonPlan?.checkpoints ?? [])
    .map((checkpoint) => checkpoint.id)
    .filter((checkpointId) => team.availableCheckpoints.some((option) => option.id === checkpointId));
}

export function buildSeasonPlannerPersistedCheckpoints(team: SeasonPlannerTeamWithAvailableCheckpoints, checkpointIds: string[]) {
  const selectedCheckpointIds = new Set(checkpointIds);
  const existingCheckpoints = new Map((team.seasonPlan?.checkpoints ?? []).map((checkpoint) => [checkpoint.id, checkpoint] as const));

  return team.availableCheckpoints
    .filter((checkpoint) => selectedCheckpointIds.has(checkpoint.id))
    .map((checkpoint, index) => {
      const existingCheckpoint = existingCheckpoints.get(checkpoint.id);

      return {
        id: checkpoint.id,
        name: existingCheckpoint?.name ?? checkpoint.name,
        targetDate: existingCheckpoint?.targetDate ?? checkpoint.targetDate,
        sourceRoutinePlanId: existingCheckpoint?.sourceRoutinePlanId ?? checkpoint.sourceRoutinePlanId,
        sortOrder: index,
        status: existingCheckpoint?.status ?? "planned",
        notes: existingCheckpoint?.notes ?? ""
      } satisfies TeamSeasonCheckpoint;
    });
}
