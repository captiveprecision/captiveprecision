import { useEffect, useMemo, useState } from "react";

import { getSystemById, getVersionById } from "@/lib/scoring/scoring-systems";
import { useScoringSystems } from "@/lib/scoring/use-scoring-systems";
import { buildMyTeamsTeamSummaries } from "@/lib/services/planner-my-teams";
import { buildRoutineBuilderTeamInputs, replaceTeamRoutinePlanItems } from "@/lib/services/planner-routine-builder";
import { buildSeasonPlannerTeamInputs, replaceTeamSeasonPlanCheckpoints } from "@/lib/services/planner-season-planner";
import { buildSkillPlannerTeamInputs, replaceTeamSkillPlanSelections } from "@/lib/services/planner-skill-planner";
import {
  buildRoutineBuilderDraftSkillSelectionIds,
  buildRoutineBuilderPersistedItems,
  buildSeasonPlannerAvailableCheckpoints,
  buildSeasonPlannerDraftCheckpointIds,
  buildSeasonPlannerPersistedCheckpoints,
  buildSkillPlannerDraftSelectionOptionIds,
  buildSkillPlannerPersistedSelections
} from "@/lib/services/planner-integration-adapters";
import {
  applyTryoutSaveToPlannerProject,
  buildTryoutAthleteRecord,
  buildTryoutEvaluationRecord,
  buildTryoutEvaluationSummary,
  buildTryoutLevelEvaluations,
  buildTryoutSkillRow,
  getTryoutEvaluationDate,
  hydrateTryoutScoringContext
} from "@/lib/services/planner-tryouts";
import {
  assignAthleteToPlannerTeam,
  buildTeamBuilderCandidates,
  buildTeamBuilderTeamsWithMembers,
  clearPlannerTeamRoster,
  createPlannerTeamRecord,
  deletePlannerTeamRecord,
  removeAthleteFromPlannerTeam,
  updatePlannerTeamDefinition
} from "@/lib/services/planner-team-builder";
import {
  LEVEL_KEYS,
  LEVEL_LABELS,
  cloneCheerPlannerState,
  defaultCheerPlannerState,
  defaultSkillLibrary,
  defaultTryoutTemplate,
  levelLabels,
  readCheerPlannerState,
  type CheerPlannerState,
  type PlannerLevelEvaluation,
  type PlannerLevelKey,
  type PlannerLevelLabel,
  type PlannerTeamRecord,
  type PlannerTryoutEvaluation,
  type PlannerTryoutTemplate,
  canAssignQualifiedLevelToTeam,
  writeCheerPlannerState
} from "@/lib/tools/cheer-planner-tryouts";
export {
  applyTryoutSaveToPlannerProject,
  assignAthleteToPlannerTeam,
  removeAthleteFromPlannerTeam,
  updatePlannerTeamDefinition
};

export type PlannerSportTab = "tumbling" | "dance" | "jumps" | "stunts";

export type AthleteDraftState = {
  athleteId: string | null;
  registrationNumber: string;
  name: string;
  dateOfBirth: string;
  sourceTeamName: string;
  athleteNotes: string;
};

export type TeamDraftState = {
  name: string;
  teamLevel: PlannerLevelLabel;
  teamType: string;
};

export type TeamEditState = {
  teamId: string;
  name: string;
  teamLevel: PlannerLevelLabel;
  teamType: string;
} | null;

export type AthleteFilters = {
  search: string;
  level: "all" | PlannerLevelLabel | "Unqualified";
  availability: "all" | "available" | "assigned";
  sort: "score-desc" | "age-asc" | "age-desc" | "name-asc";
};

export type PlannerStatItem = {
  label: string;
  value: number | string;
  note: string;
};

type SkillPlannerDraftState = {
  teamId: string;
  selectionOptionIds: string[];
} | null;

type RoutineBuilderDraftState = {
  teamId: string;
  skillSelectionIds: string[];
} | null;

type SeasonPlannerDraftState = {
  teamId: string;
  checkpointIds: string[];
} | null;

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function formatPlannerScore(value: number) {
  return round(value).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

function buildLevelEvaluations(template: PlannerTryoutTemplate): PlannerLevelEvaluation[] {
  return buildTryoutLevelEvaluations(template, LEVEL_KEYS, defaultSkillLibrary);
}

function buildEmptyAthleteDraft(): AthleteDraftState {
  return {
    athleteId: null,
    registrationNumber: "",
    name: "",
    dateOfBirth: "",
    sourceTeamName: "",
    athleteNotes: ""
  };
}

function sortAthletePool(items: ReturnType<typeof buildTeamBuilderCandidates>, filters: AthleteFilters) {
  const sorted = [...items];

  switch (filters.sort) {
    case "age-asc":
      sorted.sort((left, right) => (left.age ?? 999) - (right.age ?? 999) || left.name.localeCompare(right.name));
      break;
    case "age-desc":
      sorted.sort((left, right) => (right.age ?? -1) - (left.age ?? -1) || left.name.localeCompare(right.name));
      break;
    case "name-asc":
      sorted.sort((left, right) => left.name.localeCompare(right.name));
      break;
    case "score-desc":
    default:
      sorted.sort((left, right) => right.displayScore - left.displayScore || left.name.localeCompare(right.name));
      break;
  }

  return sorted;
}

export function getRecentAthleteLabel(evaluation: PlannerTryoutEvaluation) {
  return evaluation.athleteSnapshot?.name || "Unnamed athlete";
}

export function buildFilteredAthletePool(
  athletePool: ReturnType<typeof buildTeamBuilderCandidates>,
  filters: AthleteFilters
) {
  let nextItems = athletePool;
  const search = filters.search.trim().toLowerCase();

  if (search) {
    nextItems = nextItems.filter((athlete) => (
      athlete.name.toLowerCase().includes(search)
      || athlete.registrationNumber.toLowerCase().includes(search)
      || athlete.sourceTeamName.toLowerCase().includes(search)
      || athlete.assignedTeamName.toLowerCase().includes(search)
    ));
  }

  if (filters.level !== "all") {
    nextItems = nextItems.filter((athlete) => athlete.displayLevel === filters.level);
  }

  if (filters.availability === "available") {
    nextItems = nextItems.filter((athlete) => !athlete.assignedTeamId);
  }

  if (filters.availability === "assigned") {
    nextItems = nextItems.filter((athlete) => Boolean(athlete.assignedTeamId));
  }

  return sortAthletePool(nextItems, filters);
}

export function buildPlannerStats(athletePool: ReturnType<typeof buildTeamBuilderCandidates>): PlannerStatItem[] {
  const qualifiedCount = athletePool.filter((athlete) => athlete.displayLevel !== "Unqualified").length;
  const unqualifiedCount = athletePool.filter((athlete) => athlete.displayLevel === "Unqualified").length;
  const available = athletePool.filter((athlete) => !athlete.assignedTeamId).length;
  const averageScore = athletePool.length
    ? athletePool.reduce((sum, athlete) => sum + athlete.displayScore, 0) / athletePool.length
    : 0;

  return [
    { label: "Total athletes", value: athletePool.length, note: "Saved athlete records" },
    { label: "Qualified", value: qualifiedCount, note: "Meets at least one active qualification rule" },
    { label: "Unqualified", value: unqualifiedCount, note: "Below every active qualification threshold" },
    { label: "Available", value: available, note: "Not assigned to a team" },
    { label: "Average score", value: formatPlannerScore(averageScore), note: "Main skill total only" }
  ];
}

export function readPlannerProject() {
  return readCheerPlannerState();
}

export function writePlannerProject(state: CheerPlannerState) {
  writeCheerPlannerState(state);
}

export function hydratePlannerProjectScoringContext(
  project: CheerPlannerState,
  scoringContext: { scoringSystemId: string; scoringSystemVersionId: string }
) {
  return hydrateTryoutScoringContext(project, scoringContext);
}

export function useCheerPlannerIntegration() {
  const [plannerState, setPlannerState] = useState<CheerPlannerState>(cloneCheerPlannerState(defaultCheerPlannerState));
  const [activeSport, setActiveSport] = useState<PlannerSportTab>("tumbling");
  const [athleteDraft, setAthleteDraft] = useState<AthleteDraftState>(buildEmptyAthleteDraft());
  const [levelsDraft, setLevelsDraft] = useState<PlannerLevelEvaluation[]>(() => buildLevelEvaluations(defaultTryoutTemplate));
  const [openLevels, setOpenLevels] = useState<PlannerLevelKey[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [qualificationOpen, setQualificationOpen] = useState(false);
  const [filters, setFilters] = useState<AthleteFilters>({
    search: "",
    level: "all",
    availability: "all",
    sort: "score-desc"
  });
  const [createTeamOpen, setCreateTeamOpen] = useState(false);
  const [teamDraft, setTeamDraft] = useState<TeamDraftState>({
    name: "",
    teamLevel: "Beginner",
    teamType: "Youth"
  });
  const [teamEdit, setTeamEdit] = useState<TeamEditState>(null);
  const [skillPlannerDraft, setSkillPlannerDraft] = useState<SkillPlannerDraftState>(null);
  const [routineBuilderDraft, setRoutineBuilderDraft] = useState<RoutineBuilderDraftState>(null);
  const [seasonPlannerDraft, setSeasonPlannerDraft] = useState<SeasonPlannerDraftState>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const { config: scoringConfig, isReady: isScoringReady } = useScoringSystems();

  useEffect(() => {
    const state = readPlannerProject();
    setPlannerState(state);
    setLevelsDraft(buildLevelEvaluations(state.template));
  }, []);

  useEffect(() => {
    if (!saveMessage) {
      return;
    }

    const timeout = window.setTimeout(() => setSaveMessage(null), 2600);
    return () => window.clearTimeout(timeout);
  }, [saveMessage]);

  const activeScoringSystem = useMemo(
    () => getSystemById(scoringConfig, scoringConfig.activeSystemId),
    [scoringConfig]
  );
  const activeScoringVersion = useMemo(
    () => getVersionById(activeScoringSystem, activeScoringSystem.activeVersionId),
    [activeScoringSystem]
  );

  useEffect(() => {
    if (!isScoringReady) {
      return;
    }

    setPlannerState((current) => {
      const next = hydratePlannerProjectScoringContext(current, {
        scoringSystemId: activeScoringSystem.id,
        scoringSystemVersionId: activeScoringVersion.id
      });

      if (next === current) {
        return current;
      }

      writePlannerProject(next);
      return next;
    });
  }, [activeScoringSystem.id, activeScoringVersion.id, isScoringReady]);

  const summary = useMemo(
    () => buildTryoutEvaluationSummary(plannerState.template, levelsDraft, levelLabels),
    [plannerState.template, levelsDraft]
  );
  const athletePool = useMemo(() => buildTeamBuilderCandidates(plannerState, LEVEL_LABELS), [plannerState]);
  const filteredAthletePool = useMemo(() => buildFilteredAthletePool(athletePool, filters), [athletePool, filters]);
  const sortedEvaluations = useMemo(
    () => [...plannerState.evaluations].sort((left, right) => new Date(getTryoutEvaluationDate(right)).getTime() - new Date(getTryoutEvaluationDate(left)).getTime()),
    [plannerState.evaluations]
  );
  const recentEvaluations = useMemo(() => sortedEvaluations.slice(0, 8), [sortedEvaluations]);
  const stats = useMemo(() => buildPlannerStats(athletePool), [athletePool]);
  const skillPlannerTeams = useMemo(() => buildSkillPlannerTeamInputs(plannerState, LEVEL_LABELS), [plannerState]);
  const routineBuilderTeams = useMemo(() => buildRoutineBuilderTeamInputs(plannerState), [plannerState]);
  const seasonPlannerTeams = useMemo(
    () => buildSeasonPlannerTeamInputs(plannerState).map((team) => ({
      ...team,
      availableCheckpoints: buildSeasonPlannerAvailableCheckpoints(team)
    })),
    [plannerState]
  );
  const myTeamsSummaries = useMemo(() => buildMyTeamsTeamSummaries(plannerState), [plannerState]);
  const skillPlannerEditingTeam = useMemo(
    () => skillPlannerDraft ? skillPlannerTeams.find((team) => team.teamId === skillPlannerDraft.teamId) ?? null : null,
    [skillPlannerDraft, skillPlannerTeams]
  );
  const routineBuilderEditingTeam = useMemo(
    () => routineBuilderDraft ? routineBuilderTeams.find((team) => team.teamId === routineBuilderDraft.teamId) ?? null : null,
    [routineBuilderDraft, routineBuilderTeams]
  );
  const seasonPlannerEditingTeam = useMemo(
    () => seasonPlannerDraft ? seasonPlannerTeams.find((team) => team.teamId === seasonPlannerDraft.teamId) ?? null : null,
    [seasonPlannerDraft, seasonPlannerTeams]
  );
  const athleteMapById = useMemo(
    () => new Map(athletePool.map((athlete) => [athlete.id, athlete] as const)),
    [athletePool]
  );
  const teamMap = useMemo(
    () => new Map(plannerState.teams.map((team) => [team.id, team] as const)),
    [plannerState.teams]
  );
  const teamsWithMembers = useMemo(
    () => buildTeamBuilderTeamsWithMembers(plannerState, athletePool),
    [athletePool, plannerState]
  );
  const teamWithMembersMap = useMemo(
    () => new Map(teamsWithMembers.map((team) => [team.id, team] as const)),
    [teamsWithMembers]
  );

  const persistState = (updater: (current: CheerPlannerState) => CheerPlannerState) => {
    setPlannerState((current) => {
      const next = {
        ...updater(current),
        updatedAt: new Date().toISOString()
      };
      writePlannerProject(next);
      return next;
    });
  };

  const updateAthleteDraft = (field: keyof AthleteDraftState, value: string) => {
    setAthleteDraft((current) => ({ ...current, [field]: value }));
  };

  const startNewAthlete = () => {
    setAthleteDraft(buildEmptyAthleteDraft());
    setLevelsDraft(buildLevelEvaluations(plannerState.template));
    setOpenLevels([]);
    setSaveMessage("Ready for a new athlete.");
  };

  const updateTemplateOption = (index: number, field: "label" | "value", value: string) => {
    setPlannerState((current) => ({
      ...current,
      template: {
        ...current.template,
        options: current.template.options.map((option, optionIndex) => {
          if (optionIndex !== index) {
            return option;
          }

          return {
            ...option,
            [field]: field === "value" ? Number(value) || 0 : value
          };
        })
      }
    }));
  };

  const updateSkillCount = (levelKey: PlannerLevelKey, value: string) => {
    const nextCount = Math.max(1, Math.min(20, Number(value) || 1));
    setPlannerState((current) => ({
      ...current,
      template: {
        ...current.template,
        defaultSkillCounts: {
          ...current.template.defaultSkillCounts,
          [levelKey]: nextCount
        }
      }
    }));
  };

  const saveTemplate = () => {
    const nextTemplate = {
      ...plannerState.template,
      updatedAt: new Date().toISOString()
    };

    persistState((current) => ({
      ...current,
      template: nextTemplate
    }));
    setLevelsDraft(buildLevelEvaluations(nextTemplate));
    setOpenLevels([]);
    setSaveMessage("Template saved.");
  };

  const resetTemplate = () => {
    const nextTemplate = cloneCheerPlannerState(defaultCheerPlannerState).template;
    persistState((current) => ({
      ...current,
      template: nextTemplate
    }));
    setLevelsDraft(buildLevelEvaluations(nextTemplate));
    setOpenLevels([]);
    setSaveMessage("Template reset.");
  };

  const toggleLevel = (levelKey: PlannerLevelKey) => {
    setOpenLevels((current) => (
      current.includes(levelKey) ? current.filter((item) => item !== levelKey) : [...current, levelKey]
    ));
  };

  const updateSkillName = (levelKey: PlannerLevelKey, skillId: string, value: string) => {
    setLevelsDraft((current) => current.map((level) => (
      level.levelKey === levelKey
        ? {
            ...level,
            skills: level.skills.map((skill) => skill.id === skillId ? { ...skill, name: value } : skill)
          }
        : level
    )));
  };

  const updateSkillOption = (levelKey: PlannerLevelKey, skillId: string, optionId: string) => {
    setLevelsDraft((current) => current.map((level) => (
      level.levelKey === levelKey
        ? {
            ...level,
            skills: level.skills.map((skill) => skill.id === skillId ? { ...skill, optionId } : skill)
          }
        : level
    )));
  };

  const removeSkill = (levelKey: PlannerLevelKey, skillId: string) => {
    setLevelsDraft((current) => current.map((level) => (
      level.levelKey === levelKey
        ? {
            ...level,
            skills: level.skills.filter((skill) => skill.id !== skillId)
          }
        : level
    )));
  };

  const addExtraSkill = (levelKey: PlannerLevelKey) => {
    setLevelsDraft((current) => current.map((level) => (
      level.levelKey === levelKey
        ? {
            ...level,
            skills: [...level.skills, buildTryoutSkillRow("", true)]
          }
        : level
    )));
  };

  const saveEvaluation = () => {
    if (activeSport !== "tumbling") {
      setSaveMessage("Tumbling is the only active tryout track right now.");
      return;
    }

    const trimmedName = athleteDraft.name.trim();

    if (!trimmedName) {
      setSaveMessage("Add athlete name before saving.");
      return;
    }

    const occurredAt = new Date().toISOString();
    const { athlete: athleteRecord, registrationNumber } = buildTryoutAthleteRecord(plannerState, athleteDraft, occurredAt);
    const nextEvaluation = buildTryoutEvaluationRecord({
      project: plannerState,
      athlete: athleteRecord,
      sport: "tumbling",
      levels: levelsDraft,
      resultSummary: summary,
      scoringContext: {
        scoringSystemId: activeScoringSystem.id,
        scoringSystemVersionId: activeScoringVersion.id,
        createdById: null
      },
      occurredAt
    });

    persistState((current) => applyTryoutSaveToPlannerProject(current, athleteRecord, nextEvaluation));
    setAthleteDraft((current) => ({ ...current, athleteId: athleteRecord.id, registrationNumber }));
    setSaveMessage(`Saved evaluation for ${athleteRecord.name}. Registration ${registrationNumber}.`);
  };

  const loadEvaluation = (evaluation: PlannerTryoutEvaluation) => {
    setActiveSport("tumbling");
    setAthleteDraft({
      athleteId: evaluation.athleteId,
      registrationNumber: evaluation.athleteSnapshot?.registrationNumber ?? "",
      name: evaluation.athleteSnapshot?.name ?? "",
      dateOfBirth: evaluation.athleteSnapshot?.dateOfBirth ?? "",
      sourceTeamName: evaluation.athleteSnapshot?.sourceTeamName ?? evaluation.athleteSnapshot?.evaluationTeamName ?? "",
      athleteNotes: evaluation.athleteSnapshot?.athleteNotes ?? ""
    });
    setLevelsDraft(evaluation.rawData.levels.map((level) => ({
      ...level,
      skills: level.skills.map((skill) => ({ ...skill }))
    })));
    setOpenLevels(evaluation.rawData.levels.map((level) => level.levelKey));
    setSaveMessage(`Loaded ${getRecentAthleteLabel(evaluation)}.`);
  };

  const updateQualificationRule = (levelLabel: PlannerLevelLabel, value: string) => {
    const nextValue = Math.max(0, Math.min(6, Number(value) || 0));
    persistState((current) => ({
      ...current,
      qualificationRules: {
        ...current.qualificationRules,
        [levelLabel]: nextValue
      }
    }));
  };

  const createTeam = () => {
    const now = new Date().toISOString();
    const nextTeam = createPlannerTeamRecord(plannerState, teamDraft, now);

    persistState((current) => ({
      ...current,
      teams: [...current.teams, nextTeam]
    }));
    setCreateTeamOpen(false);
    setTeamDraft({ name: "", teamLevel: "Beginner", teamType: "Youth" });
    setSaveMessage(`Created ${nextTeam.name}.`);
  };

  const assignToTeam = (athleteId: string, teamId: string) => {
    const athlete = athleteMapById.get(athleteId);
    const team = teamMap.get(teamId);

    if (!athlete || !team) {
      setSaveMessage("Athlete or team record was not found.");
      return;
    }

    if (!canAssignQualifiedLevelToTeam(athlete.displayLevel, team.teamLevel)) {
      setSaveMessage(
        `${athlete.name} is qualified for ${athlete.displayLevel}, which does not meet ${team.name} (${team.teamLevel}).`
      );
      return;
    }

    persistState((current) => assignAthleteToPlannerTeam(current, athlete, teamId, new Date().toISOString()));
    setSaveMessage(`Assigned ${athlete.name} to ${team.name}.`);
  };

  const removeFromTeam = (athleteId: string, teamId: string) => {
    const athlete = athleteMapById.get(athleteId);

    if (!athlete) {
      setSaveMessage("Athlete record was not found.");
      return;
    }

    persistState((current) => removeAthleteFromPlannerTeam(current, athlete, teamId, new Date().toISOString()));
  };

  const clearTeam = (teamId: string) => {
    persistState((current) => clearPlannerTeamRoster(current, teamId, new Date().toISOString()));
  };

  const deleteTeam = (teamId: string) => {
    persistState((current) => deletePlannerTeamRecord(current, teamId));
  };

  const openTeamEdit = (team: PlannerTeamRecord) => {
    setTeamEdit({
      teamId: team.id,
      name: team.name,
      teamLevel: team.teamLevel,
      teamType: team.teamType
    });
  };

  const confirmTeamEdit = () => {
    if (!teamEdit) {
      return;
    }

    const currentTeam = teamMap.get(teamEdit.teamId);

    if (!currentTeam) {
      setSaveMessage("Team record was not found.");
      setTeamEdit(null);
      return;
    }

    const currentTeamWithMembers = teamWithMembersMap.get(teamEdit.teamId);
    const invalidMembers = (currentTeamWithMembers?.members ?? [])
      .filter((member) => !canAssignQualifiedLevelToTeam(member.displayLevel, teamEdit.teamLevel));

    if (invalidMembers.length) {
      const preview = invalidMembers.slice(0, 3).map((member) => member.name).join(", ");
      const suffix = invalidMembers.length > 3 ? ` and ${invalidMembers.length - 3} more` : "";
      setSaveMessage(
        `Cannot change ${currentTeam.name} to ${teamEdit.teamLevel}. ${preview}${suffix} no longer meet that team level.`
      );
      return;
    }

    persistState((current) => updatePlannerTeamDefinition(current, teamEdit, new Date().toISOString()));
    setSaveMessage(`Updated ${teamEdit.name.trim() || currentTeam.name}.`);
    setTeamEdit(null);
  };


  const openSkillPlannerTeam = (teamId: string) => {
    const team = skillPlannerTeams.find((item) => item.teamId === teamId) ?? null;

    if (!team) {
      setSaveMessage("Skill Planner team input was not found.");
      return;
    }

    setSkillPlannerDraft({
      teamId,
      selectionOptionIds: buildSkillPlannerDraftSelectionOptionIds(team)
    });
  };

  const cancelSkillPlannerEdit = () => {
    setSkillPlannerDraft(null);
  };

  const toggleSkillPlannerOption = (optionId: string) => {
    setSkillPlannerDraft((current) => {
      if (!current) {
        return current;
      }

      const selectionOptionIds = current.selectionOptionIds.includes(optionId)
        ? current.selectionOptionIds.filter((currentOptionId) => currentOptionId !== optionId)
        : [...current.selectionOptionIds, optionId];

      return {
        ...current,
        selectionOptionIds
      };
    });
  };

  const saveSkillPlannerEdit = () => {
    if (!skillPlannerDraft || !skillPlannerEditingTeam) {
      setSaveMessage("No Skill Planner draft is open.");
      return;
    }

    const occurredAt = new Date().toISOString();
    const selections = buildSkillPlannerPersistedSelections(skillPlannerEditingTeam, skillPlannerDraft.selectionOptionIds);

    persistState((current) => replaceTeamSkillPlanSelections(current, {
      teamId: skillPlannerEditingTeam.teamId,
      selections,
      occurredAt
    }));
    setSkillPlannerDraft(null);
    setSaveMessage(`Saved Skill Planner selections for ${skillPlannerEditingTeam.teamName}.`);
  };

  const openRoutineBuilderTeam = (teamId: string) => {
    const team = routineBuilderTeams.find((item) => item.teamId === teamId) ?? null;

    if (!team) {
      setSaveMessage("Routine Builder team input was not found.");
      return;
    }

    setRoutineBuilderDraft({
      teamId,
      skillSelectionIds: buildRoutineBuilderDraftSkillSelectionIds(team)
    });
  };

  const cancelRoutineBuilderEdit = () => {
    setRoutineBuilderDraft(null);
  };

  const toggleRoutineBuilderSkill = (skillSelectionId: string) => {
    setRoutineBuilderDraft((current) => {
      if (!current) {
        return current;
      }

      const skillSelectionIds = current.skillSelectionIds.includes(skillSelectionId)
        ? current.skillSelectionIds.filter((currentSkillSelectionId) => currentSkillSelectionId !== skillSelectionId)
        : [...current.skillSelectionIds, skillSelectionId];

      return {
        ...current,
        skillSelectionIds
      };
    });
  };

  const saveRoutineBuilderEdit = () => {
    if (!routineBuilderDraft || !routineBuilderEditingTeam) {
      setSaveMessage("No Routine Builder draft is open.");
      return;
    }

    const occurredAt = new Date().toISOString();
    const items = buildRoutineBuilderPersistedItems(routineBuilderEditingTeam, routineBuilderDraft.skillSelectionIds);

    persistState((current) => replaceTeamRoutinePlanItems(current, {
      teamId: routineBuilderEditingTeam.teamId,
      items,
      occurredAt
    }));
    setRoutineBuilderDraft(null);
    setSaveMessage(`Saved Routine Builder items for ${routineBuilderEditingTeam.teamName}.`);
  };

  const openSeasonPlannerTeam = (teamId: string) => {
    const team = seasonPlannerTeams.find((item) => item.teamId === teamId) ?? null;

    if (!team) {
      setSaveMessage("Season Planner team input was not found.");
      return;
    }

    setSeasonPlannerDraft({
      teamId,
      checkpointIds: buildSeasonPlannerDraftCheckpointIds(team)
    });
  };

  const cancelSeasonPlannerEdit = () => {
    setSeasonPlannerDraft(null);
  };

  const toggleSeasonPlannerCheckpoint = (checkpointId: string) => {
    setSeasonPlannerDraft((current) => {
      if (!current) {
        return current;
      }

      const checkpointIds = current.checkpointIds.includes(checkpointId)
        ? current.checkpointIds.filter((currentCheckpointId) => currentCheckpointId !== checkpointId)
        : [...current.checkpointIds, checkpointId];

      return {
        ...current,
        checkpointIds
      };
    });
  };

  const saveSeasonPlannerEdit = () => {
    if (!seasonPlannerDraft || !seasonPlannerEditingTeam) {
      setSaveMessage("No Season Planner draft is open.");
      return;
    }

    const occurredAt = new Date().toISOString();
    const checkpoints = buildSeasonPlannerPersistedCheckpoints(seasonPlannerEditingTeam, seasonPlannerDraft.checkpointIds);

    persistState((current) => replaceTeamSeasonPlanCheckpoints(current, {
      teamId: seasonPlannerEditingTeam.teamId,
      checkpoints,
      occurredAt
    }));
    setSeasonPlannerDraft(null);
    setSaveMessage(`Saved Season Planner checkpoints for ${seasonPlannerEditingTeam.teamName}.`);
  };

  return {
    plannerState,
    saveMessage,
    activeSport,
    setActiveSport,
    athleteDraft,
    updateAthleteDraft,
    startNewAthlete,
    levelsDraft,
    openLevels,
    toggleLevel,
    settingsOpen,
    setSettingsOpen,
    summary,
    recentEvaluations,
    saveEvaluation,
    loadEvaluation,
    updateTemplateOption,
    updateSkillCount,
    saveTemplate,
    resetTemplate,
    updateSkillName,
    updateSkillOption,
    removeSkill,
    addExtraSkill,
    qualificationOpen,
    setQualificationOpen,
    updateQualificationRule,
    filters,
    setFilters,
    createTeamOpen,
    setCreateTeamOpen,
    teamDraft,
    setTeamDraft,
    createTeam,
    filteredAthletePool,
    teamsWithMembers,
    skillPlannerDraft,
    skillPlannerEditingTeam,
    openSkillPlannerTeam,
    cancelSkillPlannerEdit,
    toggleSkillPlannerOption,
    saveSkillPlannerEdit,
    skillPlannerTeams,
    routineBuilderDraft,
    routineBuilderEditingTeam,
    openRoutineBuilderTeam,
    cancelRoutineBuilderEdit,
    toggleRoutineBuilderSkill,
    saveRoutineBuilderEdit,
    routineBuilderTeams,
    seasonPlannerDraft,
    seasonPlannerEditingTeam,
    openSeasonPlannerTeam,
    cancelSeasonPlannerEdit,
    toggleSeasonPlannerCheckpoint,
    saveSeasonPlannerEdit,
    seasonPlannerTeams,
    myTeamsSummaries,
    assignToTeam,
    removeFromTeam,
    clearTeam,
    deleteTeam,
    teamEdit,
    setTeamEdit,
    openTeamEdit,
    confirmTeamEdit,
    stats,
    levelLabels,
    levelKeys: LEVEL_KEYS,
    levelLabelsList: LEVEL_LABELS,
    canAssignQualifiedLevelToTeam,
    formatScore: formatPlannerScore,
    getEvaluationDate: getTryoutEvaluationDate,
    getRecentAthleteLabel
  };
}

export type CheerPlannerIntegration = ReturnType<typeof useCheerPlannerIntegration>;












