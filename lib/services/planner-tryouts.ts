import type { AthleteRecord } from "@/lib/domain/athlete";
import type { EvaluationRecord, PlannerLevelEvaluation, PlannerSkillEvaluation, PlannerTryoutSummary, PlannerTryoutTemplate } from "@/lib/domain/evaluation-record";
import type { PlannerLevelKey, PlannerLevelLabel, PlannerQualifiedLevel, PlannerSportKey } from "@/lib/domain/planner-levels";
import type { PlannerProject } from "@/lib/domain/planner-project";
import { canAssignQualifiedLevelToTeam, getHighestQualifiedLevelFromEvaluation, getNextRegistrationNumber } from "@/lib/services/planner-domain-mappers";

export type TryoutParentContactDraftInput = {
  id: string;
  name: string;
  email: string;
  phone: string;
};

export type TryoutAthleteDraftInput = {
  athleteId?: string | null;
  registrationNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  notes: string;
  parentContacts: TryoutParentContactDraftInput[];
};

export type TryoutScoringContext = {
  scoringSystemId: string;
  scoringSystemVersionId: string;
  createdById: string | null;
};

export type TryoutAthletePoolItem = AthleteRecord & {
  age: number | null;
  displayLevel: PlannerQualifiedLevel;
  displayScore: number;
  extraScore: number;
  levelScores: Record<PlannerLevelLabel, { baseScore: number; extraScore: number }>;
  assignedTeamId: string | null;
  assignedTeamName: string;
  latestEvaluation: EvaluationRecord | null;
};

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function buildAthleteName(firstName: string, lastName: string) {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(" ").trim();
}

export function buildTryoutSkillRow(name: string, isExtra = false): PlannerSkillEvaluation {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    optionId: null,
    isExtra
  };
}

export function buildTryoutLevelEvaluations(
  template: PlannerTryoutTemplate,
  levelKeys: readonly PlannerLevelKey[],
  skillLibrary: Record<PlannerLevelKey, string[]>
): PlannerLevelEvaluation[] {
  return levelKeys.map((levelKey) => {
    const desiredCount = template.defaultSkillCounts[levelKey] || 3;
    const defaults = skillLibrary[levelKey] || [];

    return {
      levelKey,
      skills: Array.from({ length: desiredCount }, (_, index) => buildTryoutSkillRow(defaults[index] || "", false))
    };
  });
}

export function buildTryoutEvaluationSummary(template: PlannerTryoutTemplate, evaluations: PlannerLevelEvaluation[], levelLabels: Record<PlannerLevelKey, PlannerLevelLabel>): PlannerTryoutSummary {
  const optionMap = new Map(template.options.map((option) => [option.id, option]));

  const levelScores = evaluations.map((level) => {
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
    totalBaseScore: round(levelScores.reduce((sum, item) => sum + item.baseScore, 0)),
    totalExtraScore: round(levelScores.reduce((sum, item) => sum + item.extraScore, 0)),
    levelScores,
    topLevels
  };
}

export function getTryoutEvaluationDate(evaluation: EvaluationRecord) {
  return evaluation.occurredAt ?? evaluation.createdAt;
}

export function getLatestTryoutEvaluations(evaluations: EvaluationRecord[]) {
  const sorted = [...evaluations].sort((left, right) => new Date(getTryoutEvaluationDate(right)).getTime() - new Date(getTryoutEvaluationDate(left)).getTime());
  const map = new Map<string, EvaluationRecord>();

  sorted.forEach((evaluation) => {
    if (!map.has(evaluation.athleteId)) {
      map.set(evaluation.athleteId, evaluation);
    }
  });

  return map;
}

export function calculateTryoutAthleteAge(dateOfBirth: string, referenceDate: string) {
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

export function buildPlannerTryoutAthletePool(
  project: PlannerProject,
  levelLabelsList: readonly PlannerLevelLabel[]
): TryoutAthletePoolItem[] {
  const latestEvaluations = getLatestTryoutEvaluations(project.evaluations);

  return project.athletes.map((athlete) => {
    const latestEvaluation = latestEvaluations.get(athlete.id) ?? null;
    const levelScores = Object.fromEntries(
      levelLabelsList.map((levelLabel) => {
        const match = latestEvaluation?.resultSummary.levelScores.find((item) => item.levelLabel === levelLabel);
        return [levelLabel, {
          baseScore: match?.baseScore ?? 0,
          extraScore: match?.extraScore ?? 0
        }];
      })
    ) as Record<PlannerLevelLabel, { baseScore: number; extraScore: number }>;
    const displayLevel = getHighestQualifiedLevelFromEvaluation(latestEvaluation, project.qualificationRules);
    const displayScore = displayLevel === "Unqualified" ? levelScores.Beginner.baseScore : levelScores[displayLevel].baseScore;
    const extraScore = displayLevel === "Unqualified" ? levelScores.Beginner.extraScore : levelScores[displayLevel].extraScore;
    const assignedTeam = project.teams.find((team) => team.memberAthleteIds.includes(athlete.id) || (team.memberRegistrationNumbers ?? []).includes(athlete.registrationNumber)) ?? null;

    return {
      ...athlete,
      age: latestEvaluation
        ? calculateTryoutAthleteAge(athlete.dateOfBirth, getTryoutEvaluationDate(latestEvaluation))
        : calculateTryoutAthleteAge(athlete.dateOfBirth, new Date().toISOString()),
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

export function buildTryoutAthleteRecord(project: PlannerProject, athleteDraft: TryoutAthleteDraftInput, occurredAt: string) {
  const currentRegistrationNumber = athleteDraft.registrationNumber || getNextRegistrationNumber(project.athletes);
  const existingAthlete = athleteDraft.athleteId
    ? project.athletes.find((item) => item.id === athleteDraft.athleteId) ?? null
    : project.athletes.find((item) => item.registrationNumber === currentRegistrationNumber) ?? null;
  const firstName = athleteDraft.firstName.trim();
  const lastName = athleteDraft.lastName.trim();
  const name = buildAthleteName(firstName, lastName);

  return {
    athlete: {
      id: existingAthlete?.id ?? `athlete-${Date.now()}`,
      workspaceId: project.workspaceId,
      registrationNumber: currentRegistrationNumber,
      firstName,
      lastName,
      name,
      dateOfBirth: athleteDraft.dateOfBirth,
      notes: athleteDraft.notes.trim(),
      parentContacts: athleteDraft.parentContacts.map((contact, index) => ({
        id: contact.id || `parent-contact-${index + 1}`,
        name: contact.name.trim(),
        email: contact.email.trim(),
        phone: contact.phone.trim()
      })),
      status: "active" as const,
      createdAt: existingAthlete?.createdAt ?? occurredAt,
      updatedAt: occurredAt,
      athleteNotes: athleteDraft.notes.trim()
    },
    registrationNumber: currentRegistrationNumber
  };
}

export function buildTryoutEvaluationRecord(input: {
  project: PlannerProject;
  athlete: AthleteRecord;
  sport: PlannerSportKey;
  levels: PlannerLevelEvaluation[];
  resultSummary: PlannerTryoutSummary;
  scoringContext: TryoutScoringContext;
  occurredAt: string;
}): EvaluationRecord {
  const { athlete, occurredAt, project, levels, resultSummary, scoringContext, sport } = input;

  return {
    id: `${Date.now()}`,
    workspaceId: project.workspaceId,
    recordType: "planner-tryout",
    status: "active",
    athleteId: athlete.id,
    athleteRegistrationNumber: athlete.registrationNumber,
    plannerProjectId: project.id,
    plannerStage: "tryouts",
    athleteSnapshot: {
      athleteId: athlete.id,
      registrationNumber: athlete.registrationNumber,
      firstName: athlete.firstName,
      lastName: athlete.lastName,
      name: athlete.name,
      dateOfBirth: athlete.dateOfBirth,
      notes: athlete.notes,
      parentContacts: athlete.parentContacts.map((contact) => ({ ...contact })),
      capturedAt: occurredAt,
      athleteNotes: athlete.notes
    },
    scoringSystemId: scoringContext.scoringSystemId,
    scoringSystemVersionId: scoringContext.scoringSystemVersionId,
    occurredAt,
    rawData: {
      sport,
      template: {
        id: project.template.id,
        name: project.template.name,
        updatedAt: project.template.updatedAt
      },
      levels: levels.map((level) => ({
        ...level,
        skills: level.skills.map((skill) => ({ ...skill }))
      }))
    },
    resultSummary: {
      ...resultSummary,
      levelScores: resultSummary.levelScores.map((item) => ({ ...item })),
      topLevels: resultSummary.topLevels.map((item) => ({ ...item }))
    },
    createdById: scoringContext.createdById,
    createdAt: occurredAt,
    updatedAt: occurredAt
  };
}

export function applyTryoutSaveToPlannerProject(project: PlannerProject, athlete: AthleteRecord, evaluation: EvaluationRecord, maxEvaluations = 200): PlannerProject {
  return {
    ...project,
    athletes: project.athletes.some((currentAthlete) => currentAthlete.id === athlete.id)
      ? project.athletes.map((currentAthlete) => currentAthlete.id === athlete.id ? athlete : currentAthlete)
      : [athlete, ...project.athletes],
    evaluations: [evaluation, ...project.evaluations].slice(0, maxEvaluations)
  };
}

export function hydrateTryoutScoringContext(project: PlannerProject, scoringContext: Pick<TryoutScoringContext, "scoringSystemId" | "scoringSystemVersionId">) {
  let changed = false;

  const evaluations = project.evaluations.map((evaluation) => {
    if (evaluation.recordType !== "planner-tryout") {
      return evaluation;
    }

    const nextScoringSystemId = evaluation.scoringSystemId ?? scoringContext.scoringSystemId;
    const nextScoringSystemVersionId = evaluation.scoringSystemVersionId ?? scoringContext.scoringSystemVersionId;

    if (nextScoringSystemId === evaluation.scoringSystemId && nextScoringSystemVersionId === evaluation.scoringSystemVersionId) {
      return evaluation;
    }

    changed = true;
    return {
      ...evaluation,
      scoringSystemId: nextScoringSystemId,
      scoringSystemVersionId: nextScoringSystemVersionId,
      updatedAt: new Date().toISOString()
    };
  });

  return changed ? { ...project, evaluations } : project;
}

