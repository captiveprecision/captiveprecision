import type { PlannerLevelLabel } from "@/lib/domain/planner-levels";
import type { PlannerProject } from "@/lib/domain/planner-project";
import {
  ROUTINE_BUILDER_COLUMN_COUNT,
  ROUTINE_BUILDER_DEFAULT_ROW_COUNT,
  ROUTINE_BUILDER_MAX_ROW_COUNT,
  ROUTINE_BUILDER_MIN_ROW_COUNT,
  type RoutineDocument,
  type TeamRoutineItem,
  type TeamRoutinePlacement,
  type TeamRoutinePlan,
  type TeamRoutinePlanStatus
} from "@/lib/domain/routine-plan";
import type { TeamSkillPlan, TeamSkillSelection } from "@/lib/domain/skill-plan";
import { getSkillPlannerCategoryLabel } from "@/lib/services/planner-skill-planner";

const DEFAULT_SKILL_DURATION = 8;
const TRANSITION_COLOR = "#ffffff";
const RECOVERED_COLOR = "#1f1f1f";

const ROUTINE_BUILDER_CATEGORY_COLORS: Record<TeamSkillSelection["category"], string> = {
  stunts: "#0f0f0f",
  "running-tumbling": "#ffc800",
  "standing-tumbling": "#6b7280",
  jumps: "#9ca3af",
  pyramid: "#1f1f1f"
};

export type RoutineBuilderSkillInput = {
  skillSelectionId: string;
  athleteId: string | null;
  category: TeamSkillSelection["category"];
  categoryLabel: string;
  groupLabel: string | null;
  levelLabel: string;
  skillName: string;
  selectionStatus: TeamSkillSelection["status"];
};

export type RoutineBuilderSkillDefinition = {
  id: string;
  skillSelectionId: string | null;
  athleteId: string | null;
  kind: TeamRoutinePlacement["kind"];
  name: string;
  category: string;
  description: string;
  defaultDuration: number;
  color: string;
  tags: string[];
};

export type RoutineBuilderTeamInput = {
  teamId: string;
  remoteTeamId: string | null;
  teamName: string;
  teamLevel: PlannerLevelLabel;
  teamType: string;
  availableSkills: RoutineBuilderSkillInput[];
  skillPlan: TeamSkillPlan | null;
  routinePlan: TeamRoutinePlan | null;
};

function clampRowCount(value: number) {
  if (!Number.isFinite(value)) {
    return ROUTINE_BUILDER_DEFAULT_ROW_COUNT;
  }

  return Math.max(ROUTINE_BUILDER_MIN_ROW_COUNT, Math.min(ROUTINE_BUILDER_MAX_ROW_COUNT, Math.floor(value)));
}

function cloneRoutineItem(item: TeamRoutineItem): TeamRoutineItem {
  return { ...item };
}

function clonePlacement(placement: TeamRoutinePlacement): TeamRoutinePlacement {
  return { ...placement };
}

function buildRoutineDocumentName(teamName: string) {
  return `${teamName.trim() || "Team"} Routine`;
}

function getPlacementLinearIndex(placement: Pick<TeamRoutinePlacement, "startRow" | "startCol">) {
  return placement.startRow * ROUTINE_BUILDER_COLUMN_COUNT + placement.startCol;
}

function getCellFromLinearIndex(index: number) {
  return {
    row: Math.floor(index / ROUTINE_BUILDER_COLUMN_COUNT),
    col: index % ROUTINE_BUILDER_COLUMN_COUNT
  };
}

function sortPlacements(placements: TeamRoutinePlacement[]) {
  return [...placements].sort((left, right) => {
    if (left.startRow !== right.startRow) {
      return left.startRow - right.startRow;
    }

    if (left.startCol !== right.startCol) {
      return left.startCol - right.startCol;
    }

    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }

    return left.id.localeCompare(right.id);
  });
}

function normalizeCueNotes(cueNotes: RoutineDocument["cueNotes"]) {
  return Object.fromEntries(
    Object.entries(cueNotes).filter(([key, value]) => key.trim().length > 0 && typeof value === "string")
  );
}

function normalizeDocumentPlacements(placements: TeamRoutinePlacement[]) {
  return sortPlacements(
    placements.map((placement, index) => ({
      ...placement,
      skillSelectionId: placement.skillSelectionId ?? null,
      athleteId: placement.athleteId ?? null,
      kind: placement.kind ?? "skill",
      title: placement.title ?? "Untitled section",
      category: placement.category ?? "Routine",
      color: placement.kind === "transition" ? TRANSITION_COLOR : (placement.color ?? RECOVERED_COLOR),
      startRow: Math.max(0, Math.floor(placement.startRow ?? 0)),
      startCol: Math.max(0, Math.min(ROUTINE_BUILDER_COLUMN_COUNT - 1, Math.floor(placement.startCol ?? 0))),
      duration: Math.max(1, Math.floor(placement.duration ?? DEFAULT_SKILL_DURATION)),
      sortOrder: typeof placement.sortOrder === "number" ? placement.sortOrder : index,
      status: placement.status ?? "planned",
      notes: placement.notes ?? ""
    }))
  );
}

export function getRoutineBuilderCategoryColor(category: TeamSkillSelection["category"] | string) {
  return category in ROUTINE_BUILDER_CATEGORY_COLORS
    ? ROUTINE_BUILDER_CATEGORY_COLORS[category as TeamSkillSelection["category"]]
    : RECOVERED_COLOR;
}

export function createEmptyRoutineDocument(name: string, rowCount = ROUTINE_BUILDER_DEFAULT_ROW_COUNT): RoutineDocument {
  return {
    config: {
      name: name.trim() || "Untitled routine",
      rowCount: clampRowCount(rowCount),
      columnCount: ROUTINE_BUILDER_COLUMN_COUNT
    },
    placements: [],
    cueNotes: {}
  };
}

export function normalizeRoutineDocument(document: RoutineDocument | null | undefined, fallbackName: string): RoutineDocument {
  if (!document) {
    return createEmptyRoutineDocument(fallbackName);
  }

  return {
    config: {
      name: document.config?.name?.trim() || fallbackName,
      rowCount: clampRowCount(document.config?.rowCount ?? ROUTINE_BUILDER_DEFAULT_ROW_COUNT),
      columnCount: ROUTINE_BUILDER_COLUMN_COUNT
    },
    placements: normalizeDocumentPlacements(Array.isArray(document.placements) ? document.placements : []),
    cueNotes: normalizeCueNotes(document.cueNotes ?? {})
  };
}

function buildLegacyPlacement(team: RoutineBuilderTeamInput, item: TeamRoutineItem, index: number) {
  const skill = team.availableSkills.find((currentSkill) => currentSkill.skillSelectionId === item.skillSelectionId) ?? null;
  const startIndex = index * DEFAULT_SKILL_DURATION;
  const startCell = getCellFromLinearIndex(startIndex);
  const isTransition = !item.skillSelectionId;

  return {
    id: item.id,
    skillSelectionId: item.skillSelectionId ?? null,
    athleteId: item.athleteId ?? skill?.athleteId ?? null,
    kind: isTransition ? "transition" : (skill ? "skill" : "recovered"),
    title: skill?.skillName || (isTransition ? `Transition ${index + 1}` : "Recovered section"),
    category: skill?.categoryLabel || (isTransition ? "Transitions" : "Recovered"),
    color: isTransition ? TRANSITION_COLOR : (skill ? getRoutineBuilderCategoryColor(skill.category) : RECOVERED_COLOR),
    startRow: startCell.row,
    startCol: startCell.col,
    duration: DEFAULT_SKILL_DURATION,
    sortOrder: index,
    status: item.status,
    notes: item.notes ?? ""
  } satisfies TeamRoutinePlacement;
}

export function buildLegacyRoutineDocument(team: RoutineBuilderTeamInput): RoutineDocument {
  const placements = (team.routinePlan?.items ?? [])
    .sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id))
    .map((item, index) => buildLegacyPlacement(team, item, index));

  const rowsNeeded = placements.length
    ? Math.max(...placements.map((placement) => placement.startRow + Math.ceil((placement.startCol + placement.duration) / ROUTINE_BUILDER_COLUMN_COUNT)))
    : ROUTINE_BUILDER_DEFAULT_ROW_COUNT;

  return {
    config: {
      name: buildRoutineDocumentName(team.teamName),
      rowCount: Math.max(ROUTINE_BUILDER_DEFAULT_ROW_COUNT, rowsNeeded),
      columnCount: ROUTINE_BUILDER_COLUMN_COUNT
    },
    placements,
    cueNotes: {}
  };
}

export function resolveRoutineBuilderDocument(team: RoutineBuilderTeamInput): RoutineDocument {
  if (team.routinePlan?.document) {
    return normalizeRoutineDocument(team.routinePlan.document, buildRoutineDocumentName(team.teamName));
  }

  if (team.routinePlan?.items.length) {
    return buildLegacyRoutineDocument(team);
  }

  return createEmptyRoutineDocument(buildRoutineDocumentName(team.teamName));
}
export function deriveRoutineItemsFromDocument(document: RoutineDocument): TeamRoutineItem[] {
  return sortPlacements(document.placements).map((placement, index) => ({
    id: placement.id,
    skillSelectionId: placement.skillSelectionId ?? null,
    athleteId: placement.athleteId ?? null,
    sortOrder: index,
    status: placement.status,
    notes: placement.notes ?? ""
  }));
}

function buildSkillDefinitionFromInput(skill: RoutineBuilderSkillInput): RoutineBuilderSkillDefinition {
  return {
    id: skill.skillSelectionId,
    skillSelectionId: skill.skillSelectionId,
    athleteId: skill.athleteId ?? null,
    kind: "skill",
    name: skill.skillName,
    category: skill.categoryLabel,
    description: [skill.categoryLabel, skill.groupLabel, skill.levelLabel].filter(Boolean).join(" / "),
    defaultDuration: DEFAULT_SKILL_DURATION,
    color: getRoutineBuilderCategoryColor(skill.category),
    tags: [skill.selectionStatus, skill.levelLabel, skill.categoryLabel].filter(Boolean)
  };
}

function buildRecoveredSkillDefinition(placement: TeamRoutinePlacement): RoutineBuilderSkillDefinition {
  const skillSelectionId = placement.skillSelectionId ?? `recovered:${placement.id}`;

  return {
    id: skillSelectionId,
    skillSelectionId: placement.skillSelectionId ?? skillSelectionId,
    athleteId: placement.athleteId ?? null,
    kind: placement.kind,
    name: placement.title || (placement.kind === "transition" ? "Recovered Transition" : "Recovered Section"),
    category: placement.category || (placement.kind === "transition" ? "Transitions" : "Recovered"),
    description: placement.kind === "transition"
      ? "Coach transition marker restored from a saved routine plan."
      : "Recovered section restored from a saved routine plan.",
    defaultDuration: Math.max(1, placement.duration || DEFAULT_SKILL_DURATION),
    color: placement.kind === "transition" ? TRANSITION_COLOR : (placement.color || RECOVERED_COLOR),
    tags: placement.kind === "transition" ? ["__transition__", "__recovered__"] : ["__recovered__"]
  };
}

export function buildRoutineBuilderSkillDefinitions(team: RoutineBuilderTeamInput, document: RoutineDocument): RoutineBuilderSkillDefinition[] {
  const baseSkills = team.availableSkills.map(buildSkillDefinitionFromInput);
  const knownIds = new Set(baseSkills.map((skill) => skill.id));
  const recoveredSkills: RoutineBuilderSkillDefinition[] = [];

  document.placements.forEach((placement) => {
    if (placement.kind === "transition") {
      return;
    }

    const recoveredDefinition = buildRecoveredSkillDefinition(placement);

    if (knownIds.has(recoveredDefinition.id)) {
      return;
    }

    knownIds.add(recoveredDefinition.id);
    recoveredSkills.push(recoveredDefinition);
  });

  return [...baseSkills, ...recoveredSkills];
}

export function buildRoutineBuilderTeamInputs(project: PlannerProject): RoutineBuilderTeamInput[] {
  const skillPlanMap = new Map(project.skillPlans.map((plan) => [plan.teamId, plan] as const));
  const routinePlanMap = new Map(project.routinePlans.map((plan) => [plan.teamId, plan] as const));

  return project.teams.map((team) => {
    const skillPlan = skillPlanMap.get(team.id) ?? null;
    const routinePlan = routinePlanMap.get(team.id) ?? null;

    return {
      teamId: team.id,
      remoteTeamId: team.remoteTeamId ?? null,
      teamName: team.name,
      teamLevel: team.teamLevel,
      teamType: team.teamType,
      skillPlan,
      routinePlan,
      availableSkills: (skillPlan?.selections ?? [])
        .filter((selection) => selection.skillName.trim().length > 0)
        .sort((left, right) => left.category.localeCompare(right.category) || (left.groupIndex ?? 0) - (right.groupIndex ?? 0) || left.sortOrder - right.sortOrder || left.id.localeCompare(right.id))
        .map((selection) => ({
          skillSelectionId: selection.id,
          athleteId: selection.athleteId ?? null,
          category: selection.category,
          categoryLabel: getSkillPlannerCategoryLabel(selection.category),
          groupLabel: selection.groupIndex ? `${getSkillPlannerCategoryLabel(selection.category)} ${selection.groupIndex}` : null,
          levelLabel: selection.levelLabel,
          skillName: selection.skillName,
          selectionStatus: selection.status
        }))
    };
  });
}

export function buildTeamRoutinePlanDraft(project: PlannerProject, team: RoutineBuilderTeamInput, occurredAt: string): TeamRoutinePlan {
  const existingPlan = team.routinePlan;
  const document = existingPlan?.document
    ? normalizeRoutineDocument(existingPlan.document, buildRoutineDocumentName(team.teamName))
    : (existingPlan?.items.length ? buildLegacyRoutineDocument(team) : createEmptyRoutineDocument(buildRoutineDocumentName(team.teamName)));

  return {
    id: existingPlan?.id ?? `team-routine-plan-${team.teamId}`,
    workspaceId: project.workspaceId,
    plannerProjectId: project.id,
    teamId: team.teamId,
    status: existingPlan?.status ?? "draft",
    notes: existingPlan?.notes ?? "",
    document,
    items: deriveRoutineItemsFromDocument(document),
    createdAt: existingPlan?.createdAt ?? occurredAt,
    updatedAt: occurredAt
  };
}

export function createTeamRoutinePlanRecord(project: PlannerProject, teamId: string, occurredAt: string, document?: RoutineDocument): TeamRoutinePlan {
  const normalizedDocument = normalizeRoutineDocument(document ?? createEmptyRoutineDocument("Untitled routine"), document?.config?.name ?? "Untitled routine");

  return {
    id: `team-routine-plan-${teamId}`,
    workspaceId: project.workspaceId,
    plannerProjectId: project.id,
    teamId,
    status: "draft",
    notes: "",
    document: normalizedDocument,
    items: deriveRoutineItemsFromDocument(normalizedDocument),
    createdAt: occurredAt,
    updatedAt: occurredAt
  };
}

export function normalizeTeamRoutineItems(items: TeamRoutineItem[]): TeamRoutineItem[] {
  const byId = new Map<string, TeamRoutineItem>();

  items.forEach((item) => {
    byId.set(item.id, cloneRoutineItem({
      ...item,
      skillSelectionId: item.skillSelectionId ?? null,
      athleteId: item.athleteId ?? null,
      notes: item.notes ?? ""
    }));
  });

  return [...byId.values()].sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id));
}

export function upsertTeamRoutinePlan(project: PlannerProject, nextPlan: TeamRoutinePlan, occurredAt: string): PlannerProject {
  const normalizedDocument = nextPlan.document
    ? normalizeRoutineDocument(nextPlan.document, nextPlan.document.config.name)
    : null;
  const normalizedPlan: TeamRoutinePlan = {
    ...nextPlan,
    document: normalizedDocument,
    items: normalizedDocument ? deriveRoutineItemsFromDocument(normalizedDocument) : normalizeTeamRoutineItems(nextPlan.items),
    updatedAt: occurredAt
  };

  return {
    ...project,
    routinePlans: project.routinePlans.some((plan) => plan.id === normalizedPlan.id)
      ? project.routinePlans.map((plan) => (plan.id === normalizedPlan.id ? normalizedPlan : plan))
      : [...project.routinePlans, normalizedPlan]
  };
}

export function replaceTeamRoutinePlanDocument(
  project: PlannerProject,
  input: {
    teamId: string;
    document: RoutineDocument;
    notes?: string;
    status?: TeamRoutinePlanStatus;
    occurredAt: string;
  }
): PlannerProject {
  const existingPlan = project.routinePlans.find((plan) => plan.teamId === input.teamId) ?? createTeamRoutinePlanRecord(project, input.teamId, input.occurredAt, input.document);

  return upsertTeamRoutinePlan(project, {
    ...existingPlan,
    notes: input.notes ?? existingPlan.notes,
    status: input.status ?? existingPlan.status,
    document: normalizeRoutineDocument(input.document, input.document.config.name),
    updatedAt: input.occurredAt
  }, input.occurredAt);
}

export function replaceTeamRoutinePlanItems(
  project: PlannerProject,
  input: {
    teamId: string;
    items: TeamRoutineItem[];
    notes?: string;
    status?: TeamRoutinePlanStatus;
    occurredAt: string;
  }
): PlannerProject {
  const existingPlan = project.routinePlans.find((plan) => plan.teamId === input.teamId) ?? {
    ...createTeamRoutinePlanRecord(project, input.teamId, input.occurredAt),
    document: null
  };

  return upsertTeamRoutinePlan(project, {
    ...existingPlan,
    notes: input.notes ?? existingPlan.notes,
    status: input.status ?? existingPlan.status,
    items: input.items,
    document: existingPlan.document,
    updatedAt: input.occurredAt
  }, input.occurredAt);
}

export function getTeamRoutineBuilderInput(project: PlannerProject, teamId: string) {
  return buildRoutineBuilderTeamInputs(project).find((team) => team.teamId === teamId) ?? null;
}

