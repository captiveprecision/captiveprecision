import { buildRoutineBuilderTeamInputs } from "@/lib/services/planner-routine-builder";
import { buildSeasonPlannerTeamInputs } from "@/lib/services/planner-season-planner";
import { buildSkillPlannerTeamInputs, type SkillPlannerAthleteSkillOption } from "@/lib/services/planner-skill-planner";
import type { TeamRoutineItem } from "@/lib/domain/routine-plan";
import type { TeamSeasonCheckpoint } from "@/lib/domain/season-plan";
import type { TeamSkillSelection } from "@/lib/domain/skill-plan";

type SkillPlannerTeamInput = ReturnType<typeof buildSkillPlannerTeamInputs>[number];
type RoutineBuilderTeamInput = ReturnType<typeof buildRoutineBuilderTeamInputs>[number];
type SeasonPlannerTeamInput = ReturnType<typeof buildSeasonPlannerTeamInputs>[number];
export type SeasonPlannerTeamWithAvailableCheckpoints = SeasonPlannerTeamInput & {
  availableCheckpoints: ReturnType<typeof buildSeasonPlannerAvailableCheckpoints>;
};

function buildSkillPlannerOptionKey(option: SkillPlannerAthleteSkillOption) {
  return [
    option.athleteId,
    option.sourceEvaluationId ?? "",
    option.levelKey,
    option.skillName,
    option.sourceOptionId ?? "",
    option.isExtra ? "extra" : "base"
  ].join("::");
}

function buildSkillPlannerSelectionKey(selection: TeamSkillSelection) {
  return [
    selection.athleteId,
    selection.sourceEvaluationId ?? "",
    selection.levelKey,
    selection.skillName,
    selection.sourceOptionId ?? "",
    selection.isExtra ? "extra" : "base"
  ].join("::");
}

export function buildSkillPlannerDraftSelectionOptionIds(team: SkillPlannerTeamInput) {
  const persistedSelections = new Map((team.existingPlan?.selections ?? []).map((selection) => [buildSkillPlannerSelectionKey(selection), selection] as const));

  return team.members
    .flatMap((member) => member.availableSkillOptions)
    .filter((option) => persistedSelections.has(buildSkillPlannerOptionKey(option)))
    .map((option) => option.id);
}

export function buildSkillPlannerPersistedSelections(team: SkillPlannerTeamInput, selectionOptionIds: string[]) {
  const selectedOptionIds = new Set(selectionOptionIds);
  const existingSelections = new Map((team.existingPlan?.selections ?? []).map((selection) => [buildSkillPlannerSelectionKey(selection), selection] as const));

  return team.members
    .flatMap((member) => member.availableSkillOptions)
    .filter((option) => selectedOptionIds.has(option.id))
    .map((option) => {
      const existingSelection = existingSelections.get(buildSkillPlannerOptionKey(option));

      return {
        id: existingSelection?.id ?? `team-skill-selection-${option.id}`,
        athleteId: option.athleteId,
        sourceEvaluationId: option.sourceEvaluationId,
        levelKey: option.levelKey,
        skillName: option.skillName,
        sourceOptionId: option.sourceOptionId,
        isExtra: option.isExtra,
        status: existingSelection?.status ?? "selected",
        notes: existingSelection?.notes ?? ""
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
        athleteId: skill.athleteId,
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
