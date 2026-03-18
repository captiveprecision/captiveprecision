"use client";

import { useEffect, useMemo, useState } from "react";

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
  type PlannerTopLevel,
  type PlannerTryoutEvaluation,
  type PlannerTryoutTemplate,
  writeCheerPlannerState
} from "@/lib/tools/cheer-planner-tryouts";

type PlannerSportTab = "tumbling" | "dance" | "jumps" | "stunts";
type PlannerWorkspaceTab = "tryouts" | "team-builder";

type AthleteDraftState = {
  registrationNumber: string;
  name: string;
  dateOfBirth: string;
  teamName: string;
  athleteNotes: string;
};

type AthletePoolItem = PlannerAthleteRecord & {
  age: number | null;
  displayLevel: PlannerLevelLabel | "Unqualified";
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
    teamName: "",
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

function getHighestQualifiedLevel(
  evaluation: PlannerTryoutEvaluation | null,
  qualificationRules: CheerPlannerState["qualificationRules"]
): PlannerLevelLabel | "Unqualified" {
  if (!evaluation) {
    return "Unqualified";
  }

  const qualified = LEVEL_LABELS.filter((levelLabel) => {
    const levelScore = evaluation.summary.levelScores.find((item) => item.levelLabel === levelLabel);
    return levelScore ? levelScore.baseScore >= qualificationRules[levelLabel] : false;
  });

  return qualified.length ? qualified[qualified.length - 1] : "Unqualified";
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
    const displayLevel = getHighestQualifiedLevel(latestEvaluation, state.qualificationRules);
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
      sourceTeamName: athleteDraft.teamName.trim(),
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
        teamName: athleteRecord.sourceTeamName,
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
      teamName: evaluation.athleteSnapshot.teamName,
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
    persistState((current) => ({
      ...current,
      teams: current.teams.map((team) => ({
        ...team,
        memberRegistrationNumbers: team.id === teamId
          ? Array.from(new Set([...team.memberRegistrationNumbers.filter((id) => id !== registrationNumber), registrationNumber]))
          : team.memberRegistrationNumbers.filter((id) => id !== registrationNumber),
        updatedAt: new Date().toISOString()
      }))
    }));
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
    setTeamEdit(null);
  };

  const stats = useMemo(() => {
    const beginnerQualified = athletePool.filter((athlete) => athlete.displayLevel === "Beginner").length;
    const available = athletePool.filter((athlete) => !athlete.assignedTeamId).length;
    const averageScore = athletePool.length
      ? athletePool.reduce((sum, athlete) => sum + athlete.displayScore, 0) / athletePool.length
      : 0;

    return [
      { label: "Total athletes", value: athletePool.length, note: "Saved athlete records" },
      { label: "Beginner qualified", value: beginnerQualified, note: `Requirement ${plannerState.qualificationRules.Beginner.toFixed(1)}` },
      { label: "Unqualified", value: athletePool.length - beginnerQualified, note: "Below current requirement" },
      { label: "Available", value: available, note: "Not assigned to a team" },
      { label: "Average score", value: formatScore(averageScore), note: "Main skill total only" }
    ];
  }, [athletePool, plannerState.qualificationRules.Beginner]);

  const athleteMap = useMemo(
    () => new Map(athletePool.map((athlete) => [athlete.registrationNumber, athlete] as const)),
    [athletePool]
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
      <section className="surface-card panel-pad planner-hero-card">
        <div className="planner-hero-copy">
          <span className="metric-label">Cheer Planner</span>
          <h1 className="page-title planner-page-title">Build your roster from live tryout data.</h1>
          <p className="page-copy">
            Step 1 captures athlete records and tumbling evaluations. Team Builder consumes the latest saved tryout
            for each athlete and turns it into assignable roster data.
          </p>
        </div>
        <div className="planner-hero-actions">
          <div className="planner-workspace-switch" role="tablist" aria-label="Cheer planner workspace">
            <button
              type="button"
              className={workspaceTab === "tryouts" ? "planner-toggle-button is-active" : "planner-toggle-button"}
              onClick={() => setWorkspaceTab("tryouts")}
            >
              Step 1 / Tryouts
            </button>
            <button
              type="button"
              className={workspaceTab === "team-builder" ? "planner-toggle-button is-active" : "planner-toggle-button"}
              onClick={() => setWorkspaceTab("team-builder")}
            >
              Step 2 / Team Builder
            </button>
          </div>
          {saveMessage ? <p className="planner-save-message">{saveMessage}</p> : null}
        </div>
      </section>

      {workspaceTab === "tryouts" ? (
        <div className="planner-layout-grid">
          <div className="planner-main-column">
            <section className="surface-card panel-pad planner-panel-stack">
              <div className="planner-section-head">
                <div>
                  <span className="metric-label">Athlete intake</span>
                  <h2>Tryout record</h2>
                </div>
                <button type="button" className="planner-text-button" onClick={startNewAthlete}>
                  New athlete
                </button>
              </div>

              <div className="planner-athlete-grid">
                <label className="profile-form-field">
                  <span>Registration #</span>
                  <input value={athleteDraft.registrationNumber || "Auto-assigned on save"} readOnly />
                </label>
                <label className="profile-form-field">
                  <span>Athlete name</span>
                  <input value={athleteDraft.name} onChange={(event) => updateAthleteDraft("name", event.target.value)} />
                </label>
                <label className="profile-form-field">
                  <span>Date of birth</span>
                  <input
                    type="date"
                    value={athleteDraft.dateOfBirth}
                    onChange={(event) => updateAthleteDraft("dateOfBirth", event.target.value)}
                  />
                </label>
                <label className="profile-form-field">
                  <span>Current team</span>
                  <input value={athleteDraft.teamName} onChange={(event) => updateAthleteDraft("teamName", event.target.value)} />
                </label>
                <label className="profile-form-field planner-athlete-grid-wide">
                  <span>Notes</span>
                  <textarea
                    rows={3}
                    value={athleteDraft.athleteNotes}
                    onChange={(event) => updateAthleteDraft("athleteNotes", event.target.value)}
                  />
                </label>
              </div>
            </section>

            <section className="surface-card panel-pad planner-panel-stack">
              <div className="planner-section-head">
                <div>
                  <span className="metric-label">Sport</span>
                  <h2>Tryout track</h2>
                </div>
              </div>
              <div className="planner-sport-tabs">
                {(["tumbling", "dance", "jumps", "stunts"] as PlannerSportTab[]).map((sport) => (
                  <button
                    key={sport}
                    type="button"
                    className={activeSport === sport ? "planner-tab-button is-active" : "planner-tab-button"}
                    onClick={() => setActiveSport(sport)}
                  >
                    {sport === "tumbling" ? "Tumbling" : `${sport.charAt(0).toUpperCase()}${sport.slice(1)} / Coming soon`}
                  </button>
                ))}
              </div>
              {activeSport !== "tumbling" ? (
                <p className="planner-inline-note">This step is wired for tumbling first. The other tryout lanes will connect next.</p>
              ) : null}
            </section>

            {activeSport === "tumbling" ? (
              <>
                <section className="surface-card panel-pad planner-panel-stack">
                  <div className="planner-section-head">
                    <div>
                      <span className="metric-label">Template</span>
                      <h2>Tryout settings</h2>
                    </div>
                    <button
                      type="button"
                      className="planner-text-button"
                      onClick={() => setSettingsOpen((current) => !current)}
                    >
                      {settingsOpen ? "Hide" : "Edit"}
                    </button>
                  </div>

                  {settingsOpen ? (
                    <div className="planner-settings-stack">
                      <div className="planner-option-grid">
                        {plannerState.template.options.map((option, index) => (
                          <div key={option.id} className="planner-option-card">
                            <label className="profile-form-field">
                              <span>Label</span>
                              <input
                                value={option.label}
                                onChange={(event) => updateTemplateOption(index, "label", event.target.value)}
                              />
                            </label>
                            <label className="profile-form-field">
                              <span>Value</span>
                              <input
                                type="number"
                                step="0.1"
                                value={option.value}
                                onChange={(event) => updateTemplateOption(index, "value", event.target.value)}
                              />
                            </label>
                          </div>
                        ))}
                      </div>

                      <div className="planner-count-grid">
                        {LEVEL_KEYS.map((levelKey) => (
                          <label key={levelKey} className="profile-form-field">
                            <span>{levelLabels[levelKey]} skills</span>
                            <input
                              type="number"
                              min={1}
                              max={20}
                              value={plannerState.template.defaultSkillCounts[levelKey]}
                              onChange={(event) => updateSkillCount(levelKey, event.target.value)}
                            />
                          </label>
                        ))}
                      </div>

                      <div className="planner-inline-actions">
                        <button type="button" className="planner-primary-button" onClick={saveTemplate}>
                          Save template
                        </button>
                        <button type="button" className="planner-secondary-button" onClick={resetTemplate}>
                          Reset template
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="planner-chip-row">
                      {plannerState.template.options.map((option) => (
                        <span key={option.id} className="planner-value-chip">
                          {option.label} / {formatScore(option.value)}
                        </span>
                      ))}
                    </div>
                  )}
                </section>

                <section className="surface-card panel-pad planner-panel-stack">
                  <div className="planner-section-head">
                    <div>
                      <span className="metric-label">Evaluation</span>
                      <h2>Tumbling levels</h2>
                    </div>
                    <div className="planner-summary-chip-group">
                      <span className="planner-value-chip">Main {formatScore(summary.totalBaseScore)}</span>
                      <span className="planner-value-chip">Extra {formatScore(summary.totalExtraScore)}</span>
                    </div>
                  </div>

                  <div className="planner-level-stack">
                    {levelsDraft.map((level) => {
                      const levelSummary = summary.levelScores.find((item) => item.levelKey === level.levelKey);
                      const isOpen = openLevels.includes(level.levelKey);

                      return (
                        <article key={level.levelKey} className="planner-level-card">
                          <button
                            type="button"
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
                          </button>

                          {isOpen ? (
                            <div className="planner-skill-list">
                              {level.skills.map((skill) => (
                                <div key={skill.id} className="planner-skill-row">
                                  <label className="profile-form-field planner-skill-name-field">
                                    <span>{skill.isExtra ? "Extra skill" : "Skill"}</span>
                                    <input
                                      value={skill.name}
                                      onChange={(event) => updateSkillName(level.levelKey, skill.id, event.target.value)}
                                    />
                                  </label>
                                  <label className="profile-form-field planner-skill-option-field">
                                    <span>Evaluation</span>
                                    <select
                                      value={skill.optionId ?? ""}
                                      onChange={(event) => updateSkillOption(level.levelKey, skill.id, event.target.value)}
                                    >
                                      <option value="">Select</option>
                                      {plannerState.template.options.map((option) => (
                                        <option key={option.id} value={option.id}>
                                          {option.label}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <button
                                    type="button"
                                    className="planner-remove-button"
                                    onClick={() => removeSkill(level.levelKey, skill.id)}
                                  >
                                    Remove
                                  </button>
                                </div>
                              ))}
                              <button type="button" className="planner-secondary-button" onClick={() => addExtraSkill(level.levelKey)}>
                                Add extra skill
                              </button>
                            </div>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                </section>
              </>
            ) : null}
          </div>

          <aside className="planner-side-column">
            <section className="surface-card panel-pad planner-panel-stack">
              <div className="planner-section-head">
                <div>
                  <span className="metric-label">Live summary</span>
                  <h2>Top levels</h2>
                </div>
              </div>
              <div className="planner-summary-list">
                {summary.topLevels.map((item) => (
                  <div key={item.levelKey} className="planner-summary-row">
                    <strong>{item.levelLabel}</strong>
                    <span>Main {formatScore(item.baseScore)} / Extra {formatScore(item.extraScore)}</span>
                  </div>
                ))}
              </div>
              <button type="button" className="planner-primary-button" onClick={saveEvaluation}>
                Save athlete record
              </button>
            </section>

            <section className="surface-card panel-pad planner-panel-stack">
              <div className="planner-section-head">
                <div>
                  <span className="metric-label">Recent</span>
                  <h2>Latest evaluations</h2>
                </div>
              </div>
              <div className="planner-recent-list">
                {recentEvaluations.length ? recentEvaluations.map((evaluation) => (
                  <button
                    key={evaluation.id}
                    type="button"
                    className="planner-recent-card"
                    onClick={() => loadEvaluation(evaluation)}
                  >
                    <strong>{getRecentAthleteLabel(evaluation)}</strong>
                    <span>{evaluation.athleteSnapshot.registrationNumber}</span>
                    <span>{new Date(evaluation.savedAt).toLocaleDateString("en-US")}</span>
                  </button>
                )) : <p className="planner-inline-note">No tryout records saved yet.</p>}
              </div>
            </section>
          </aside>
        </div>
      ) : (
        <div className="planner-team-builder-stack">
          <section className="planner-team-stats-grid">
            {stats.map((stat) => (
              <article key={stat.label} className="surface-card panel-pad planner-team-stat-card">
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
                <p>{stat.note}</p>
              </article>
            ))}
          </section>

          <div className="planner-layout-grid">
            <div className="planner-main-column">
              <section className="surface-card panel-pad planner-panel-stack">
                <div className="planner-section-head">
                  <div>
                    <span className="metric-label">Qualification rules</span>
                    <h2>Current thresholds</h2>
                  </div>
                  <button
                    type="button"
                    className="planner-text-button"
                    onClick={() => setQualificationOpen((current) => !current)}
                  >
                    {qualificationOpen ? "Hide" : "Edit"}
                  </button>
                </div>
                <div className={qualificationOpen ? "planner-team-rules-grid is-open" : "planner-team-rules-grid"}>
                  {LEVEL_LABELS.map((levelLabel) => (
                    <label key={levelLabel} className="profile-form-field">
                      <span>{levelLabel}</span>
                      <input
                        type="number"
                        step="0.1"
                        value={plannerState.qualificationRules[levelLabel]}
                        onChange={(event) => updateQualificationRule(levelLabel, event.target.value)}
                      />
                    </label>
                  ))}
                </div>
              </section>

              <section className="surface-card panel-pad planner-panel-stack">
                <div className="planner-section-head">
                  <div>
                    <span className="metric-label">Athlete pool</span>
                    <h2>Latest saved tryouts</h2>
                  </div>
                  <button
                    type="button"
                    className="planner-primary-button"
                    onClick={() => setCreateTeamOpen((current) => !current)}
                  >
                    {createTeamOpen ? "Close" : "Create team"}
                  </button>
                </div>

                {createTeamOpen ? (
                  <div className="planner-create-team-card">
                    <label className="profile-form-field">
                      <span>Team name</span>
                      <input value={teamDraft.name} onChange={(event) => setTeamDraft((current) => ({ ...current, name: event.target.value }))} />
                    </label>
                    <label className="profile-form-field">
                      <span>Team level</span>
                      <select
                        value={teamDraft.teamLevel}
                        onChange={(event) => setTeamDraft((current) => ({ ...current, teamLevel: event.target.value as PlannerLevelLabel }))}
                      >
                        {LEVEL_LABELS.map((levelLabel) => (
                          <option key={levelLabel} value={levelLabel}>{levelLabel}</option>
                        ))}
                      </select>
                    </label>
                    <label className="profile-form-field">
                      <span>Team type</span>
                      <input value={teamDraft.teamType} onChange={(event) => setTeamDraft((current) => ({ ...current, teamType: event.target.value }))} />
                    </label>
                    <button type="button" className="planner-primary-button" onClick={createTeam}>
                      Save team
                    </button>
                  </div>
                ) : null}

                <div className="planner-team-filters">
                  <label className="profile-form-field planner-athlete-grid-wide">
                    <span>Search</span>
                    <input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} />
                  </label>
                  <label className="profile-form-field">
                    <span>Level</span>
                    <select
                      value={filters.level}
                      onChange={(event) => setFilters((current) => ({ ...current, level: event.target.value as AthleteFilters["level"] }))}
                    >
                      <option value="all">All</option>
                      <option value="Unqualified">Unqualified</option>
                      {LEVEL_LABELS.map((levelLabel) => (
                        <option key={levelLabel} value={levelLabel}>{levelLabel}</option>
                      ))}
                    </select>
                  </label>
                  <label className="profile-form-field">
                    <span>Availability</span>
                    <select
                      value={filters.availability}
                      onChange={(event) => setFilters((current) => ({ ...current, availability: event.target.value as AthleteFilters["availability"] }))}
                    >
                      <option value="all">All</option>
                      <option value="available">Available</option>
                      <option value="assigned">Assigned</option>
                    </select>
                  </label>
                  <label className="profile-form-field">
                    <span>Sort</span>
                    <select
                      value={filters.sort}
                      onChange={(event) => setFilters((current) => ({ ...current, sort: event.target.value as AthleteFilters["sort"] }))}
                    >
                      <option value="score-desc">Score</option>
                      <option value="name-asc">Name</option>
                      <option value="age-asc">Age low to high</option>
                      <option value="age-desc">Age high to low</option>
                    </select>
                  </label>
                </div>

                <div className="planner-athlete-pool-list">
                  {filteredAthletePool.length ? filteredAthletePool.map((athlete) => (
                    <article key={athlete.registrationNumber} className="planner-athlete-pool-row">
                      <div className="planner-athlete-pool-copy">
                        <div className="planner-athlete-pool-title-row">
                          <strong>{athlete.name}</strong>
                          <span className="planner-athlete-pool-badge">{athlete.displayLevel}</span>
                        </div>
                        <p>
                          {athlete.registrationNumber} / Age {athlete.age ?? "-"} / Source {athlete.sourceTeamName || "No source team"}
                        </p>
                        <p>
                          Score {formatScore(athlete.displayScore)} / Extra {formatScore(athlete.extraScore)} / Assigned to {athlete.assignedTeamName}
                        </p>
                      </div>
                      <label className="profile-form-field planner-athlete-assign-field">
                        <span>Assign to team</span>
                        <select
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
                            <option key={team.id} value={team.id}>{team.name}</option>
                          ))}
                        </select>
                      </label>
                    </article>
                  )) : <p className="planner-inline-note">No athletes match the current filters.</p>}
                </div>
              </section>
            </div>

            <aside className="planner-side-column">
              <section className="surface-card panel-pad planner-panel-stack">
                <div className="planner-section-head">
                  <div>
                    <span className="metric-label">Teams</span>
                    <h2>Saved rosters</h2>
                  </div>
                </div>

                {teamEdit ? (
                  <div className="planner-create-team-card planner-team-edit-card">
                    <label className="profile-form-field">
                      <span>Team name</span>
                      <input value={teamEdit.name} onChange={(event) => setTeamEdit((current) => current ? { ...current, name: event.target.value } : current)} />
                    </label>
                    <label className="profile-form-field">
                      <span>Team level</span>
                      <select
                        value={teamEdit.teamLevel}
                        onChange={(event) => setTeamEdit((current) => current ? { ...current, teamLevel: event.target.value as PlannerLevelLabel } : current)}
                      >
                        {LEVEL_LABELS.map((levelLabel) => (
                          <option key={levelLabel} value={levelLabel}>{levelLabel}</option>
                        ))}
                      </select>
                    </label>
                    <label className="profile-form-field">
                      <span>Team type</span>
                      <input value={teamEdit.teamType} onChange={(event) => setTeamEdit((current) => current ? { ...current, teamType: event.target.value } : current)} />
                    </label>
                    <div className="planner-inline-actions">
                      <button type="button" className="planner-primary-button" onClick={confirmTeamEdit}>Save edits</button>
                      <button type="button" className="planner-secondary-button" onClick={() => setTeamEdit(null)}>Cancel</button>
                    </div>
                  </div>
                ) : null}

                <div className="planner-team-card-list">
                  {teamsWithMembers.length ? teamsWithMembers.map((team) => (
                    <article key={team.id} className="planner-team-card">
                      <div className="planner-team-card-head">
                        <div>
                          <strong>{team.name}</strong>
                          <p>{team.teamLevel} / {team.teamType}</p>
                        </div>
                        <div className="planner-team-card-actions">
                          <button type="button" className="planner-text-button" onClick={() => openTeamEdit(team)}>Edit</button>
                          <button type="button" className="planner-text-button" onClick={() => clearTeam(team.id)}>Clear</button>
                          <button type="button" className="planner-danger-button" onClick={() => deleteTeam(team.id)}>Delete</button>
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
                            <button type="button" className="planner-text-button" onClick={() => removeFromTeam(member.registrationNumber, team.id)}>
                              Remove
                            </button>
                          </div>
                        )) : <p className="planner-inline-note">No athletes assigned yet.</p>}
                      </div>
                    </article>
                  )) : <p className="planner-inline-note">Create your first team to start assigning athletes.</p>}
                </div>
              </section>
            </aside>
          </div>
        </div>
      )}
    </main>
  );
}
