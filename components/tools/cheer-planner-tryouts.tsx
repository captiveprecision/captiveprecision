"use client";

import { useEffect, useMemo, useState } from "react";

import { Badge, Button, Card, CardContent, EmptyState, Input, SectionHeader, Select, Tabs, Textarea } from "@/components/ui";

import {
  LEVEL_KEYS,
  LEVEL_LABELS,
  cloneCheerPlannerState,
  defaultCheerPlannerState,
  defaultSkillLibrary,
  defaultTryoutTemplate,
  getNextRegistrationNumber,
  levelLabels,
  readCheerPlannerState,
  type CheerPlannerState,
  type PlannerAthleteRecord,
  type PlannerLevelEvaluation,
  type PlannerLevelKey,
  type PlannerLevelLabel,
  type PlannerSkillEvaluation,
  type PlannerTeamRecord,
  type PlannerQualifiedLevel,
  type PlannerTopLevel,
  type PlannerTryoutEvaluation,
  type PlannerTryoutTemplate,
  canAssignQualifiedLevelToTeam,
  getHighestQualifiedLevelFromEvaluation,
  writeCheerPlannerState
} from "@/lib/tools/cheer-planner-tryouts";

type PlannerSportTab = "tumbling" | "dance" | "jumps" | "stunts";
type PlannerWorkspaceTab = "tryouts" | "team-builder";

type AthleteDraftState = {
  registrationNumber: string;
  name: string;
  dateOfBirth: string;
  sourceTeamName: string;
  athleteNotes: string;
};

type AthletePoolItem = PlannerAthleteRecord & {
  age: number | null;
  displayLevel: PlannerQualifiedLevel;
  displayScore: number;
  extraScore: number;
  levelScores: Record<PlannerLevelLabel, { baseScore: number; extraScore: number }>;
  assignedTeamId: string | null;
  assignedTeamName: string;
  latestEvaluation: PlannerTryoutEvaluation | null;
};

type TeamDraftState = {
  name: string;
  teamLevel: PlannerLevelLabel;
  teamType: string;
};

type TeamEditState = {
  teamId: string;
  name: string;
  teamLevel: PlannerLevelLabel;
  teamType: string;
} | null;

type AthleteFilters = {
  search: string;
  level: "all" | PlannerLevelLabel | "Unqualified";
  availability: "all" | "available" | "assigned";
  sort: "score-desc" | "age-asc" | "age-desc" | "name-asc";
};

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function formatScore(value: number) {
  return round(value).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

function buildSkillRow(name: string, isExtra = false): PlannerSkillEvaluation {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    optionId: null,
    isExtra
  };
}

function buildLevelEvaluations(template: PlannerTryoutTemplate): PlannerLevelEvaluation[] {
  return LEVEL_KEYS.map((levelKey) => {
    const desiredCount = template.defaultSkillCounts[levelKey] || 3;
    const defaults = defaultSkillLibrary[levelKey] || [];

    return {
      levelKey,
      skills: Array.from({ length: desiredCount }, (_, index) => buildSkillRow(defaults[index] || "", false))
    };
  });
}

function buildEmptyAthleteDraft(): AthleteDraftState {
  return {
    registrationNumber: "",
    name: "",
    dateOfBirth: "",
    sourceTeamName: "",
    athleteNotes: ""
  };
}

function calculateSummary(template: PlannerTryoutTemplate, evaluations: PlannerLevelEvaluation[]) {
  const optionMap = new Map(template.options.map((option) => [option.id, option]));

  const levelScores: PlannerTopLevel[] = evaluations.map((level) => {
    const baseScore = level.skills
      .filter((skill) => !skill.isExtra)
      .reduce((sum, skill) => sum + (skill.optionId ? optionMap.get(skill.optionId)?.value ?? 0 : 0), 0);

    const extraScore = level.skills
      .filter((skill) => skill.isExtra)
      .reduce((sum, skill) => sum + (skill.optionId ? optionMap.get(skill.optionId)?.value ?? 0 : 0), 0);

    return {
      levelKey: level.levelKey,
      levelLabel: levelLabels[level.levelKey],
      baseScore: round(baseScore),
      extraScore: round(extraScore)
    };
  });

  const totalBaseScore = round(levelScores.reduce((sum, item) => sum + item.baseScore, 0));
  const totalExtraScore = round(levelScores.reduce((sum, item) => sum + item.extraScore, 0));
  const topLevels = [...levelScores]
    .sort((left, right) => {
      if (right.baseScore !== left.baseScore) {
        return right.baseScore - left.baseScore;
      }

      const rightRank = right.levelKey === "beginner" ? 0 : Number(right.levelKey);
      const leftRank = left.levelKey === "beginner" ? 0 : Number(left.levelKey);
      return rightRank - leftRank;
    })
    .slice(0, 3);

  return {
    totalBaseScore,
    totalExtraScore,
    levelScores,
    topLevels
  };
}

function calculateAge(dateOfBirth: string, referenceDate: string) {
  if (!dateOfBirth) {
    return null;
  }

  const dobDate = new Date(`${dateOfBirth}T00:00:00`);
  const refDate = new Date(referenceDate);

  if (Number.isNaN(dobDate.getTime()) || Number.isNaN(refDate.getTime())) {
    return null;
  }

  let age = refDate.getFullYear() - dobDate.getFullYear();
  const monthDiff = refDate.getMonth() - dobDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && refDate.getDate() < dobDate.getDate())) {
    age -= 1;
  }

  return age;
}

function getLatestEvaluations(evaluations: PlannerTryoutEvaluation[]) {
  const sorted = [...evaluations].sort((left, right) => new Date(right.savedAt).getTime() - new Date(left.savedAt).getTime());
  const map = new Map<string, PlannerTryoutEvaluation>();

  sorted.forEach((evaluation) => {
    if (!map.has(evaluation.athleteRegistrationNumber)) {
      map.set(evaluation.athleteRegistrationNumber, evaluation);
    }
  });

  return map;
}

function buildAthletePool(state: CheerPlannerState): AthletePoolItem[] {
  const latestEvaluations = getLatestEvaluations(state.evaluations);

  return state.athletes.map((athlete) => {
    const latestEvaluation = latestEvaluations.get(athlete.registrationNumber) ?? null;
    const levelScores = Object.fromEntries(
      LEVEL_LABELS.map((levelLabel) => {
        const match = latestEvaluation?.summary.levelScores.find((item) => item.levelLabel === levelLabel);
        return [levelLabel, {
          baseScore: match?.baseScore ?? 0,
          extraScore: match?.extraScore ?? 0
        }];
      })
    ) as Record<PlannerLevelLabel, { baseScore: number; extraScore: number }>;
    const displayLevel = getHighestQualifiedLevelFromEvaluation(latestEvaluation, state.qualificationRules);
    const displayScore = displayLevel === "Unqualified"
      ? levelScores.Beginner.baseScore
      : levelScores[displayLevel].baseScore;
    const extraScore = displayLevel === "Unqualified"
      ? levelScores.Beginner.extraScore
      : levelScores[displayLevel].extraScore;
    const assignedTeam = state.teams.find((team) => team.memberRegistrationNumbers.includes(athlete.registrationNumber)) ?? null;

    return {
      ...athlete,
      age: latestEvaluation ? calculateAge(athlete.dateOfBirth, latestEvaluation.savedAt) : calculateAge(athlete.dateOfBirth, new Date().toISOString()),
      displayLevel,
      displayScore,
      extraScore,
      levelScores,
      assignedTeamId: assignedTeam?.id ?? null,
      assignedTeamName: assignedTeam?.name ?? "No Team",
      latestEvaluation
    };
  });
}

function sortAthletePool(items: AthletePoolItem[], filters: AthleteFilters) {
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

function getRecentAthleteLabel(evaluation: PlannerTryoutEvaluation) {
  return evaluation.athleteSnapshot.name || "Unnamed athlete";
}

export function CheerPlannerTryouts() {
  const [plannerState, setPlannerState] = useState<CheerPlannerState>(cloneCheerPlannerState(defaultCheerPlannerState));
  const [workspaceTab, setWorkspaceTab] = useState<PlannerWorkspaceTab>("tryouts");
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
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    const state = readCheerPlannerState();
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

  const summary = useMemo(() => calculateSummary(plannerState.template, levelsDraft), [plannerState.template, levelsDraft]);
  const athletePool = useMemo(() => buildAthletePool(plannerState), [plannerState]);
  const filteredAthletePool = useMemo(() => {
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
  }, [athletePool, filters]);

  const sortedEvaluations = useMemo(
    () => [...plannerState.evaluations].sort((left, right) => new Date(right.savedAt).getTime() - new Date(left.savedAt).getTime()),
    [plannerState.evaluations]
  );
  const recentEvaluations = sortedEvaluations.slice(0, 8);

  const persistState = (updater: (current: CheerPlannerState) => CheerPlannerState) => {
    setPlannerState((current) => {
      const next = updater(current);
      writeCheerPlannerState(next);
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
            skills: [...level.skills, buildSkillRow("", true)]
          }
        : level
    )));
  };

  const saveEvaluation = () => {
    const trimmedName = athleteDraft.name.trim();

    if (!trimmedName) {
      setSaveMessage("Add athlete name before saving.");
      return;
    }

    const now = new Date().toISOString();
    const currentRegistrationNumber = athleteDraft.registrationNumber || getNextRegistrationNumber(plannerState.athletes);
    const athleteRecord: PlannerAthleteRecord = {
      registrationNumber: currentRegistrationNumber,
      name: trimmedName,
      dateOfBirth: athleteDraft.dateOfBirth,
      sourceTeamName: athleteDraft.sourceTeamName.trim(),
      athleteNotes: athleteDraft.athleteNotes.trim(),
      createdAt: plannerState.athletes.find((item) => item.registrationNumber === currentRegistrationNumber)?.createdAt || now,
      updatedAt: now
    };

    const nextEvaluation: PlannerTryoutEvaluation = {
      id: `${Date.now()}`,
      plannerStage: "tryouts",
      sport: "tumbling",
      athleteRegistrationNumber: currentRegistrationNumber,
      athleteSnapshot: {
        registrationNumber: currentRegistrationNumber,
        name: athleteRecord.name,
        dateOfBirth: athleteRecord.dateOfBirth,
        evaluationTeamName: athleteRecord.sourceTeamName,
        athleteNotes: athleteRecord.athleteNotes
      },
      templateId: plannerState.template.id,
      templateName: plannerState.template.name,
      templateUpdatedAt: plannerState.template.updatedAt,
      evaluations: levelsDraft.map((level) => ({
        ...level,
        skills: level.skills.map((skill) => ({ ...skill }))
      })),
      summary,
      savedAt: now
    };

    persistState((current) => ({
      ...current,
      athletes: current.athletes.some((athlete) => athlete.registrationNumber === currentRegistrationNumber)
        ? current.athletes.map((athlete) => athlete.registrationNumber === currentRegistrationNumber ? athleteRecord : athlete)
        : [athleteRecord, ...current.athletes],
      evaluations: [nextEvaluation, ...current.evaluations].slice(0, 200)
    }));

    setAthleteDraft((current) => ({ ...current, registrationNumber: currentRegistrationNumber }));
    setSaveMessage(`Saved evaluation for ${athleteRecord.name}. Registration ${currentRegistrationNumber}.`);
  };

  const loadEvaluation = (evaluation: PlannerTryoutEvaluation) => {
    setWorkspaceTab("tryouts");
    setActiveSport("tumbling");
    setAthleteDraft({
      registrationNumber: evaluation.athleteSnapshot.registrationNumber,
      name: evaluation.athleteSnapshot.name,
      dateOfBirth: evaluation.athleteSnapshot.dateOfBirth,
      sourceTeamName: evaluation.athleteSnapshot.evaluationTeamName,
      athleteNotes: evaluation.athleteSnapshot.athleteNotes
    });
    setLevelsDraft(evaluation.evaluations.map((level) => ({
      ...level,
      skills: level.skills.map((skill) => ({ ...skill }))
    })));
    setOpenLevels(evaluation.evaluations.map((level) => level.levelKey));
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
    const trimmedName = teamDraft.name.trim() || `Team ${plannerState.teams.length + 1}`;
    const now = new Date().toISOString();
    const nextTeam: PlannerTeamRecord = {
      id: `team-${Date.now()}`,
      name: trimmedName,
      teamLevel: teamDraft.teamLevel,
      teamType: teamDraft.teamType,
      memberRegistrationNumbers: [],
      createdAt: now,
      updatedAt: now
    };

    persistState((current) => ({
      ...current,
      teams: [...current.teams, nextTeam]
    }));
    setCreateTeamOpen(false);
    setTeamDraft({ name: "", teamLevel: "Beginner", teamType: "Youth" });
    setWorkspaceTab("team-builder");
    setSaveMessage(`Created ${trimmedName}.`);
  };

  const assignToTeam = (registrationNumber: string, teamId: string) => {
    const athlete = athleteMap.get(registrationNumber);
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

    persistState((current) => ({
      ...current,
      teams: current.teams.map((currentTeam) => ({
        ...currentTeam,
        memberRegistrationNumbers: currentTeam.id === teamId
          ? Array.from(new Set([...currentTeam.memberRegistrationNumbers.filter((id) => id !== registrationNumber), registrationNumber]))
          : currentTeam.memberRegistrationNumbers.filter((id) => id !== registrationNumber),
        updatedAt: new Date().toISOString()
      }))
    }));
    setSaveMessage(`Assigned ${athlete.name} to ${team.name}.`);
  };

  const removeFromTeam = (registrationNumber: string, teamId: string) => {
    persistState((current) => ({
      ...current,
      teams: current.teams.map((team) => (
        team.id === teamId
          ? {
              ...team,
              memberRegistrationNumbers: team.memberRegistrationNumbers.filter((id) => id !== registrationNumber),
              updatedAt: new Date().toISOString()
            }
          : team
      ))
    }));
  };

  const clearTeam = (teamId: string) => {
    persistState((current) => ({
      ...current,
      teams: current.teams.map((team) => (
        team.id === teamId
          ? { ...team, memberRegistrationNumbers: [], updatedAt: new Date().toISOString() }
          : team
      ))
    }));
  };

  const deleteTeam = (teamId: string) => {
    persistState((current) => ({
      ...current,
      teams: current.teams.filter((team) => team.id !== teamId)
    }));
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

    const invalidMembers = currentTeam.memberRegistrationNumbers
      .map((registrationNumber) => athleteMap.get(registrationNumber))
      .filter((member): member is AthletePoolItem => Boolean(member))
      .filter((member) => !canAssignQualifiedLevelToTeam(member.displayLevel, teamEdit.teamLevel));

    if (invalidMembers.length) {
      const preview = invalidMembers.slice(0, 3).map((member) => member.name).join(", ");
      const suffix = invalidMembers.length > 3 ? ` and ${invalidMembers.length - 3} more` : "";
      setSaveMessage(
        `Cannot change ${currentTeam.name} to ${teamEdit.teamLevel}. ${preview}${suffix} no longer meet that team level.`
      );
      return;
    }

    persistState((current) => ({
      ...current,
      teams: current.teams.map((team) => (
        team.id === teamEdit.teamId
          ? {
              ...team,
              name: teamEdit.name.trim() || team.name,
              teamLevel: teamEdit.teamLevel,
              teamType: teamEdit.teamType,
              updatedAt: new Date().toISOString()
            }
          : team
      ))
    }));
    setSaveMessage(`Updated ${teamEdit.name.trim() || currentTeam.name}.`);
    setTeamEdit(null);
  };

  const stats = useMemo(() => {
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
      { label: "Average score", value: formatScore(averageScore), note: "Main skill total only" }
    ];
  }, [athletePool]);

  const athleteMap = useMemo(
    () => new Map(athletePool.map((athlete) => [athlete.registrationNumber, athlete] as const)),
    [athletePool]
  );

  const teamMap = useMemo(
    () => new Map(plannerState.teams.map((team) => [team.id, team] as const)),
    [plannerState.teams]
  );

  const teamsWithMembers = useMemo(
    () => plannerState.teams.map((team) => ({
      ...team,
      members: team.memberRegistrationNumbers
        .map((registrationNumber) => athleteMap.get(registrationNumber))
        .filter((member): member is AthletePoolItem => Boolean(member))
    })),
    [athleteMap, plannerState.teams]
  );

  return (
    <main className="workspace-shell page-stack planner-shell">
      <Card radius="panel" variant="subtle">
        <CardContent className="planner-hero-card planner-panel-stack">
          <SectionHeader
            eyebrow="Cheer Planner"
            title="Build your roster from live tryout data."
            description="Step 1 captures athlete records and tumbling evaluations. Team Builder consumes the latest saved tryout for each athlete and turns it into assignable roster data."
            actions={
              <div className="planner-hero-actions">
                <Tabs
                  className="planner-workspace-switch"
                  items={[
                    { value: "tryouts", label: "Step 1 / Tryouts" },
                    { value: "team-builder", label: "Step 2 / Team Builder" }
                  ]}
                  value={workspaceTab}
                  onValueChange={setWorkspaceTab}
                  ariaLabel="Cheer planner workspace"
                />
                {saveMessage ? <Badge variant="accent">{saveMessage}</Badge> : null}
              </div>
            }
          />
        </CardContent>
      </Card>

      {workspaceTab === "tryouts" ? (
        <div className="planner-layout-grid">
          <div className="planner-main-column">
            <Card radius="panel" className="planner-panel-stack">
              <CardContent className="planner-panel-stack">
                <SectionHeader
                  eyebrow="Athlete intake"
                  title="Tryout record"
                  actions={<Button variant="ghost" size="sm" onClick={startNewAthlete}>New athlete</Button>}
                />
                <div className="planner-athlete-grid">
                  <Input label="Registration #" value={athleteDraft.registrationNumber || "Auto-assigned on save"} readOnly />
                  <Input label="Athlete name" value={athleteDraft.name} onChange={(event) => updateAthleteDraft("name", event.target.value)} />
                  <Input type="date" label="Date of birth" value={athleteDraft.dateOfBirth} onChange={(event) => updateAthleteDraft("dateOfBirth", event.target.value)} />
                  <Input label="Source team" value={athleteDraft.sourceTeamName} onChange={(event) => updateAthleteDraft("sourceTeamName", event.target.value)} />
                  <Textarea
                    label="Notes"
                    rows={3}
                    containerClassName="planner-athlete-grid-wide"
                    value={athleteDraft.athleteNotes}
                    onChange={(event) => updateAthleteDraft("athleteNotes", event.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card radius="panel" className="planner-panel-stack">
              <CardContent className="planner-panel-stack">
                <SectionHeader eyebrow="Sport" title="Tryout track" />
                <Tabs
                  className="planner-sport-tabs"
                  items={[
                    { value: "tumbling", label: "Tumbling" },
                    { value: "dance", label: "Dance / Coming soon" },
                    { value: "jumps", label: "Jumps / Coming soon" },
                    { value: "stunts", label: "Stunts / Coming soon" }
                  ]}
                  value={activeSport}
                  onValueChange={setActiveSport}
                  ariaLabel="Planner sport"
                />
                {activeSport !== "tumbling" ? (
                  <EmptyState
                    title="Tumbling is the active track"
                    description="This step is wired for tumbling first. The other tryout lanes will connect next."
                  />
                ) : null}
              </CardContent>
            </Card>

            {activeSport === "tumbling" ? (
              <>
                <Card radius="panel" className="planner-panel-stack">
                  <CardContent className="planner-panel-stack">
                    <SectionHeader
                      eyebrow="Template"
                      title="Tryout settings"
                      actions={
                        <Button variant="ghost" size="sm" onClick={() => setSettingsOpen((current) => !current)}>
                          {settingsOpen ? "Hide" : "Edit"}
                        </Button>
                      }
                    />

                    {settingsOpen ? (
                      <div className="planner-settings-stack">
                        <div className="planner-option-grid">
                          {plannerState.template.options.map((option, index) => (
                            <Card key={option.id} variant="subtle" className="planner-option-card">
                              <CardContent className="planner-panel-stack">
                                <Input
                                  label="Label"
                                  value={option.label}
                                  onChange={(event) => updateTemplateOption(index, "label", event.target.value)}
                                />
                                <Input
                                  type="number"
                                  step="0.1"
                                  label="Value"
                                  value={option.value}
                                  onChange={(event) => updateTemplateOption(index, "value", event.target.value)}
                                />
                              </CardContent>
                            </Card>
                          ))}
                        </div>

                        <div className="planner-count-grid">
                          {LEVEL_KEYS.map((levelKey) => (
                            <Input
                              key={levelKey}
                              type="number"
                              min={1}
                              max={20}
                              label={`${levelLabels[levelKey]} skills`}
                              value={plannerState.template.defaultSkillCounts[levelKey]}
                              onChange={(event) => updateSkillCount(levelKey, event.target.value)}
                            />
                          ))}
                        </div>

                        <div className="planner-inline-actions">
                          <Button onClick={saveTemplate}>Save template</Button>
                          <Button variant="secondary" onClick={resetTemplate}>Reset template</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="planner-chip-row">
                        {plannerState.template.options.map((option) => (
                          <Badge key={option.id} variant="accent">
                            {option.label} / {formatScore(option.value)}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card radius="panel" className="planner-panel-stack">
                  <CardContent className="planner-panel-stack">
                    <SectionHeader
                      eyebrow="Evaluation"
                      title="Tumbling levels"
                      actions={
                        <div className="planner-summary-chip-group">
                          <Badge variant="accent">Main {formatScore(summary.totalBaseScore)}</Badge>
                          <Badge variant="subtle">Extra {formatScore(summary.totalExtraScore)}</Badge>
                        </div>
                      }
                    />

                    <div className="planner-level-stack">
                      {levelsDraft.map((level) => {
                        const levelSummary = summary.levelScores.find((item) => item.levelKey === level.levelKey);
                        const isOpen = openLevels.includes(level.levelKey);

                        return (
                          <Card key={level.levelKey} variant="subtle" className="planner-level-card">
                            <CardContent className="planner-level-card__content">
                              <Button
                                type="button"
                                variant="ghost"
                                className="planner-level-head"
                                onClick={() => toggleLevel(level.levelKey)}
                              >
                                <div>
                                  <strong>{levelLabels[level.levelKey]}</strong>
                                  <span>{level.skills.length} skills</span>
                                </div>
                                <div className="planner-level-meta">
                                  <span>Main {formatScore(levelSummary?.baseScore ?? 0)}</span>
                                  <span>Extra {formatScore(levelSummary?.extraScore ?? 0)}</span>
                                </div>
                              </Button>

                              {isOpen ? (
                                <div className="planner-skill-list">
                                  {level.skills.map((skill) => (
                                    <div key={skill.id} className="planner-skill-row">
                                      <Input
                                        label={skill.isExtra ? "Extra skill" : "Skill"}
                                        containerClassName="planner-skill-name-field"
                                        value={skill.name}
                                        onChange={(event) => updateSkillName(level.levelKey, skill.id, event.target.value)}
                                      />
                                      <Select
                                        label="Evaluation"
                                        containerClassName="planner-skill-option-field"
                                        value={skill.optionId ?? ""}
                                        onChange={(event) => updateSkillOption(level.levelKey, skill.id, event.target.value)}
                                        placeholder="Select"
                                      >
                                        {plannerState.template.options.map((option) => (
                                          <option key={option.id} value={option.id}>
                                            {option.label}
                                          </option>
                                        ))}
                                      </Select>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                       
                                        onClick={() => removeSkill(level.levelKey, skill.id)}
                                      >
                                        Remove
                                      </Button>
                                    </div>
                                  ))}
                                  <Button type="button" variant="secondary" size="sm" onClick={() => addExtraSkill(level.levelKey)}>
                                    Add extra skill
                                  </Button>
                                </div>
                              ) : null}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : null}
          </div>

          <aside className="planner-side-column">
            <Card radius="panel" className="planner-panel-stack">
              <CardContent className="planner-panel-stack">
                <SectionHeader eyebrow="Live summary" title="Top levels" />
                <div className="planner-summary-list">
                  {summary.topLevels.map((item) => (
                    <div key={item.levelKey} className="planner-summary-row">
                      <strong>{item.levelLabel}</strong>
                      <span>Main {formatScore(item.baseScore)} / Extra {formatScore(item.extraScore)}</span>
                    </div>
                  ))}
                </div>
                <Button onClick={saveEvaluation}>Save athlete record</Button>
              </CardContent>
            </Card>

            <Card radius="panel" className="planner-panel-stack">
              <CardContent className="planner-panel-stack">
                <SectionHeader eyebrow="Recent" title="Latest evaluations" />
                <div className="planner-recent-list">
                  {recentEvaluations.length ? recentEvaluations.map((evaluation) => (
                    <Button
                      key={evaluation.id}
                      type="button"
                      variant="ghost"
                      className="planner-recent-card"
                      onClick={() => loadEvaluation(evaluation)}
                    >
                      <strong>{getRecentAthleteLabel(evaluation)}</strong>
                      <span>{evaluation.athleteSnapshot.registrationNumber}</span>
                      <span>{new Date(evaluation.savedAt).toLocaleDateString("en-US")}</span>
                    </Button>
                  )) : (
                    <EmptyState title="No tryout records saved yet." description="Saved evaluations will appear here for quick reload." />
                  )}
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      ) : (
        <div className="planner-team-builder-stack">
          <section className="planner-team-stats-grid">
            {stats.map((stat) => (
              <Card key={stat.label} radius="panel" className="planner-team-stat-card">
                <CardContent className="planner-team-stat-card__content">
                  <span>{stat.label}</span>
                  <strong>{stat.value}</strong>
                  <p>{stat.note}</p>
                </CardContent>
              </Card>
            ))}
          </section>

          <div className="planner-layout-grid">
            <div className="planner-main-column">
              <Card radius="panel" className="planner-panel-stack">
                <CardContent className="planner-panel-stack">
                  <SectionHeader
                    eyebrow="Qualification rules"
                    title="Current thresholds"
                    actions={
                      <Button variant="ghost" size="sm" onClick={() => setQualificationOpen((current) => !current)}>
                        {qualificationOpen ? "Hide" : "Edit"}
                      </Button>
                    }
                  />
                  <div className={qualificationOpen ? "planner-team-rules-grid is-open" : "planner-team-rules-grid"}>
                    {LEVEL_LABELS.map((levelLabel) => (
                      <Input
                        key={levelLabel}
                        type="number"
                        step="0.1"
                        label={levelLabel}
                        value={plannerState.qualificationRules[levelLabel]}
                        onChange={(event) => updateQualificationRule(levelLabel, event.target.value)}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card radius="panel" className="planner-panel-stack">
                <CardContent className="planner-panel-stack">
                  <SectionHeader
                    eyebrow="Athlete pool"
                    title="Latest saved tryouts"
                    actions={
                      <Button onClick={() => setCreateTeamOpen((current) => !current)}>
                        {createTeamOpen ? "Close" : "Create team"}
                      </Button>
                    }
                  />

                  {createTeamOpen ? (
                    <Card variant="subtle" className="planner-create-team-card">
                      <CardContent className="planner-panel-stack">
                        <Input label="Team name" value={teamDraft.name} onChange={(event) => setTeamDraft((current) => ({ ...current, name: event.target.value }))} />
                        <Select
                          label="Team level"
                          value={teamDraft.teamLevel}
                          onChange={(event) => setTeamDraft((current) => ({ ...current, teamLevel: event.target.value as PlannerLevelLabel }))}
                        >
                          {LEVEL_LABELS.map((levelLabel) => (
                            <option key={levelLabel} value={levelLabel}>{levelLabel}</option>
                          ))}
                        </Select>
                        <Input label="Team type" value={teamDraft.teamType} onChange={(event) => setTeamDraft((current) => ({ ...current, teamType: event.target.value }))} />
                        <Button onClick={createTeam}>Save team</Button>
                      </CardContent>
                    </Card>
                  ) : null}

                  <div className="planner-team-filters">
                    <Input
                      label="Search"
                      containerClassName="planner-athlete-grid-wide"
                      value={filters.search}
                      onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                    />
                    <Select
                      label="Level"
                      value={filters.level}
                      onChange={(event) => setFilters((current) => ({ ...current, level: event.target.value as AthleteFilters["level"] }))}
                    >
                      <option value="all">All</option>
                      <option value="Unqualified">Unqualified</option>
                      {LEVEL_LABELS.map((levelLabel) => (
                        <option key={levelLabel} value={levelLabel}>{levelLabel}</option>
                      ))}
                    </Select>
                    <Select
                      label="Availability"
                      value={filters.availability}
                      onChange={(event) => setFilters((current) => ({ ...current, availability: event.target.value as AthleteFilters["availability"] }))}
                    >
                      <option value="all">All</option>
                      <option value="available">Available</option>
                      <option value="assigned">Assigned</option>
                    </Select>
                    <Select
                      label="Sort"
                      value={filters.sort}
                      onChange={(event) => setFilters((current) => ({ ...current, sort: event.target.value as AthleteFilters["sort"] }))}
                    >
                      <option value="score-desc">Score</option>
                      <option value="name-asc">Name</option>
                      <option value="age-asc">Age low to high</option>
                      <option value="age-desc">Age high to low</option>
                    </Select>
                  </div>

                  <div className="planner-athlete-pool-list">
                    {filteredAthletePool.length ? filteredAthletePool.map((athlete) => (
                      <Card key={athlete.registrationNumber} variant="subtle" className="planner-athlete-pool-row">
                        <CardContent className="planner-athlete-pool-row__content">
                          <div className="planner-athlete-pool-copy">
                            <div className="planner-athlete-pool-title-row">
                              <strong>{athlete.name}</strong>
                              <Badge variant={athlete.displayLevel === "Unqualified" ? "subtle" : "dark"}>{athlete.displayLevel}</Badge>
                            </div>
                            <p>
                              {athlete.registrationNumber} / Age {athlete.age ?? "-"} / Source {athlete.sourceTeamName || "No source team"}
                            </p>
                            <p>
                              Score {formatScore(athlete.displayScore)} / Extra {formatScore(athlete.extraScore)} / Builder team {athlete.assignedTeamName}
                            </p>
                          </div>
                          <Select
                            label="Assign to builder team"
                            containerClassName="planner-athlete-assign-field"
                            value={athlete.assignedTeamId ?? ""}
                            onChange={(event) => {
                              const nextTeamId = event.target.value;
                              if (!nextTeamId) {
                                if (athlete.assignedTeamId) {
                                  removeFromTeam(athlete.registrationNumber, athlete.assignedTeamId);
                                }
                                return;
                              }
                              assignToTeam(athlete.registrationNumber, nextTeamId);
                            }}
                          >
                            <option value="">No team</option>
                            {plannerState.teams.map((team) => (
                              <option
                                key={team.id}
                                value={team.id}
                                disabled={athlete.assignedTeamId !== team.id && !canAssignQualifiedLevelToTeam(athlete.displayLevel, team.teamLevel)}
                              >
                                {team.name} ({team.teamLevel})
                              </option>
                            ))}
                          </Select>
                        </CardContent>
                      </Card>
                    )) : (
                      <EmptyState title="No athletes match the current filters." description="Adjust filters or save more tryout evaluations." />
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <aside className="planner-side-column">
              <Card radius="panel" className="planner-panel-stack">
                <CardContent className="planner-panel-stack">
                  <SectionHeader eyebrow="Teams" title="Saved rosters" />

                  {teamEdit ? (
                    <Card variant="subtle" className="planner-team-edit-card">
                      <CardContent className="planner-panel-stack">
                        <Input label="Team name" value={teamEdit.name} onChange={(event) => setTeamEdit((current) => current ? { ...current, name: event.target.value } : current)} />
                        <Select
                          label="Team level"
                          value={teamEdit.teamLevel}
                          onChange={(event) => setTeamEdit((current) => current ? { ...current, teamLevel: event.target.value as PlannerLevelLabel } : current)}
                        >
                          {LEVEL_LABELS.map((levelLabel) => (
                            <option key={levelLabel} value={levelLabel}>{levelLabel}</option>
                          ))}
                        </Select>
                        <Input label="Team type" value={teamEdit.teamType} onChange={(event) => setTeamEdit((current) => current ? { ...current, teamType: event.target.value } : current)} />
                        <div className="planner-inline-actions">
                          <Button onClick={confirmTeamEdit}>Save edits</Button>
                          <Button variant="secondary" onClick={() => setTeamEdit(null)}>Cancel</Button>
                        </div>
                      </CardContent>
                    </Card>
                  ) : null}

                  <div className="planner-team-card-list">
                    {teamsWithMembers.length ? teamsWithMembers.map((team) => (
                      <Card key={team.id} variant="subtle" className="planner-team-card">
                        <CardContent className="planner-panel-stack">
                          <div className="planner-team-card-head">
                            <div>
                              <strong>{team.name}</strong>
                              <p>{team.teamLevel} / {team.teamType}</p>
                            </div>
                            <div className="planner-team-card-actions">
                              <Button variant="ghost" size="sm" onClick={() => openTeamEdit(team)}>Edit</Button>
                              <Button variant="ghost" size="sm" onClick={() => clearTeam(team.id)}>Clear</Button>
                              <Button variant="danger" size="sm" onClick={() => deleteTeam(team.id)}>Delete</Button>
                            </div>
                          </div>
                          <div className="planner-team-summary-row">
                            <span>{team.members.length} athletes</span>
                            <span>Updated {new Date(team.updatedAt).toLocaleDateString("en-US")}</span>
                          </div>
                          <div className="planner-team-members-list">
                            {team.members.length ? team.members.map((member) => (
                              <div key={member.registrationNumber} className="planner-team-member-row">
                                <div>
                                  <strong>{member.name}</strong>
                                  <p>{member.registrationNumber} / {member.displayLevel} / {formatScore(member.displayScore)}</p>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => removeFromTeam(member.registrationNumber, team.id)}>
                                  Remove
                                </Button>
                              </div>
                            )) : (
                              <EmptyState title="No athletes assigned yet." description="Assign athletes from the pool to start building this roster." />
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )) : (
                      <EmptyState title="Create your first team to start assigning athletes." description="Team Builder will keep rosters as persistent planner objects." />
                    )}
                  </div>
                </CardContent>
              </Card>
            </aside>
          </div>
        </div>
      )}
    </main>
  );
}
