import type { AthleteRecord } from "@/lib/domain/athlete";
import type {
  PlannerTryoutSummaryBucket,
  PlannerTryoutTemplate,
  PlannerTryoutTemplateBucket,
  PlannerTryoutBucketEvaluation,
  PlannerTryoutSummary,
  TryoutRecord
} from "@/lib/domain/evaluation-record";
import type { PlannerLevelLabel, PlannerQualifiedLevel, PlannerSportKey } from "@/lib/domain/planner-levels";
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
  season?: string | null;
  seasonLabel?: string | null;
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
  latestTryoutRecord: TryoutRecord | null;
};

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function buildAthleteName(firstName: string, lastName: string) {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(" ").trim();
}

function createTryoutRecordId(prefix: string) {
  if (typeof globalThis !== "undefined" && globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function buildTryoutSkillRow(name: string, isExtra = false) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    optionId: null,
    isExtra
  };
}

export function buildTryoutBucketEvaluations(template: PlannerTryoutTemplate): PlannerTryoutBucketEvaluation[] {
  return template.buckets.map((bucket) => ({
    bucketKey: bucket.key,
    bucketLabel: bucket.label,
    bucketKind: bucket.kind,
    allowsExtra: bucket.allowsExtra,
    levelKey: bucket.levelKey ?? null,
    levelLabel: bucket.levelLabel ?? null,
    skills: bucket.skills.map((skill) => buildTryoutSkillRow(skill.name, false))
  }));
}

function sortSummaryBuckets(
  sport: PlannerSportKey,
  buckets: PlannerTryoutSummaryBucket[]
) {
  return [...buckets].sort((left, right) => {
    if (right.baseScore !== left.baseScore) {
      return right.baseScore - left.baseScore;
    }

    if (right.extraScore !== left.extraScore) {
      return right.extraScore - left.extraScore;
    }

    if (sport === "tumbling" || sport === "stunts") {
      const leftRank = left.levelKey === "beginner" ? 0 : Number(left.levelKey ?? 0);
      const rightRank = right.levelKey === "beginner" ? 0 : Number(right.levelKey ?? 0);
      return rightRank - leftRank;
    }

    return left.bucketLabel.localeCompare(right.bucketLabel);
  });
}

export function buildTryoutEvaluationSummary(template: PlannerTryoutTemplate, evaluations: PlannerTryoutBucketEvaluation[]): PlannerTryoutSummary {
  const optionMap = new Map(template.options.map((option) => [option.id, option]));

  const bucketScores = evaluations.map((bucket) => {
    const baseScore = bucket.skills
      .filter((skill) => !skill.isExtra)
      .reduce((sum, skill) => sum + (skill.optionId ? optionMap.get(skill.optionId)?.value ?? 0 : 0), 0);

    const extraScore = bucket.allowsExtra
      ? bucket.skills
          .filter((skill) => skill.isExtra)
          .reduce((sum, skill) => sum + (skill.optionId ? optionMap.get(skill.optionId)?.value ?? 0 : 0), 0)
      : 0;

    return {
      bucketKey: bucket.bucketKey,
      bucketLabel: bucket.bucketLabel,
      bucketKind: bucket.bucketKind,
      baseScore: round(baseScore),
      extraScore: round(extraScore),
      levelKey: bucket.levelKey ?? null,
      levelLabel: bucket.levelLabel ?? null
    } satisfies PlannerTryoutSummaryBucket;
  });

  const evaluatedBuckets = bucketScores.filter((bucket) => bucket.baseScore > 0 || bucket.extraScore > 0);

  return {
    totalBaseScore: round(bucketScores.reduce((sum, item) => sum + item.baseScore, 0)),
    totalExtraScore: round(bucketScores.reduce((sum, item) => sum + item.extraScore, 0)),
    bucketScores,
    highlights: sortSummaryBuckets(template.sport, evaluatedBuckets).slice(0, 3)
  };
}

export function getTryoutRecordDate(tryoutRecord: TryoutRecord) {
  return tryoutRecord.occurredAt ?? tryoutRecord.createdAt;
}

export function getLatestTryoutRecords(tryoutRecords: TryoutRecord[]) {
  const sorted = [...tryoutRecords].sort((left, right) => new Date(getTryoutRecordDate(right)).getTime() - new Date(getTryoutRecordDate(left)).getTime());
  const map = new Map<string, TryoutRecord>();

  sorted.forEach((tryoutRecord) => {
    if (!map.has(tryoutRecord.athleteId)) {
      map.set(tryoutRecord.athleteId, tryoutRecord);
    }
  });

  return map;
}

function getLatestQualifiedTryoutRecords(tryoutRecords: TryoutRecord[]) {
  const sorted = [...tryoutRecords]
    .filter((tryoutRecord) => tryoutRecord.rawData.mode === "levels")
    .sort((left, right) => new Date(getTryoutRecordDate(right)).getTime() - new Date(getTryoutRecordDate(left)).getTime());
  const map = new Map<string, TryoutRecord>();

  sorted.forEach((tryoutRecord) => {
    if (!map.has(tryoutRecord.athleteId)) {
      map.set(tryoutRecord.athleteId, tryoutRecord);
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
  const latestQualifiedTryoutRecords = getLatestQualifiedTryoutRecords(project.tryoutRecords);

  return project.athletes.map((athlete) => {
    const latestTryoutRecord = latestQualifiedTryoutRecords.get(athlete.id) ?? null;
    const levelScores = Object.fromEntries(
      levelLabelsList.map((levelLabel) => {
        const match = latestTryoutRecord?.resultSummary.bucketScores.find((item) => item.levelLabel === levelLabel);
        return [levelLabel, {
          baseScore: match?.baseScore ?? 0,
          extraScore: match?.extraScore ?? 0
        }];
      })
    ) as Record<PlannerLevelLabel, { baseScore: number; extraScore: number }>;
    const displayLevel = getHighestQualifiedLevelFromEvaluation(latestTryoutRecord, project.qualificationRules);
    const displayScore = displayLevel === "Unqualified" ? levelScores.Beginner.baseScore : levelScores[displayLevel].baseScore;
    const extraScore = displayLevel === "Unqualified" ? levelScores.Beginner.extraScore : levelScores[displayLevel].extraScore;
    const assignedTeam = project.teams.find((team) => team.memberAthleteIds.includes(athlete.id) || (team.memberRegistrationNumbers ?? []).includes(athlete.registrationNumber)) ?? null;

    return {
      ...athlete,
      age: latestTryoutRecord
        ? calculateTryoutAthleteAge(athlete.dateOfBirth, getTryoutRecordDate(latestTryoutRecord))
        : calculateTryoutAthleteAge(athlete.dateOfBirth, new Date().toISOString()),
      displayLevel,
      displayScore,
      extraScore,
      levelScores,
      assignedTeamId: assignedTeam?.id ?? null,
      assignedTeamName: assignedTeam?.name ?? "No Team",
      latestTryoutRecord
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

export function buildTryoutRecord(input: {
  project: PlannerProject;
  athlete: AthleteRecord;
  sport: PlannerSportKey;
  template: PlannerTryoutTemplate;
  buckets: PlannerTryoutBucketEvaluation[];
  resultSummary: PlannerTryoutSummary;
  scoringContext: TryoutScoringContext;
  occurredAt: string;
}): TryoutRecord {
  const { athlete, occurredAt, project, buckets, resultSummary, scoringContext, sport, template } = input;

  return {
    id: createTryoutRecordId("tryout-record"),
    workspaceId: project.workspaceId,
    workspaceRootId: athlete.workspaceRootId ?? project.workspaceRootId,
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
    season: scoringContext.season ?? null,
    seasonLabel: scoringContext.seasonLabel ?? null,
    occurredAt,
    rawData: {
      sport,
      mode: template.mode,
      template: {
        id: template.id,
        name: template.name,
        updatedAt: template.updatedAt
      },
      buckets: buckets.map((bucket) => ({
        ...bucket,
        skills: bucket.skills.map((skill) => ({ ...skill }))
      }))
    },
    resultSummary: {
      ...resultSummary,
      bucketScores: resultSummary.bucketScores.map((item) => ({ ...item })),
      highlights: resultSummary.highlights.map((item) => ({ ...item }))
    },
    createdById: scoringContext.createdById,
    createdAt: occurredAt,
    updatedAt: occurredAt
  };
}

export function applyTryoutSaveToPlannerProject(project: PlannerProject, athlete: AthleteRecord, tryoutRecord: TryoutRecord, maxTryoutRecords = 200): PlannerProject {
  return {
    ...project,
    athletes: project.athletes.some((currentAthlete) => currentAthlete.id === athlete.id)
      ? project.athletes.map((currentAthlete) => currentAthlete.id === athlete.id ? athlete : currentAthlete)
      : [athlete, ...project.athletes],
    tryoutRecords: [tryoutRecord, ...project.tryoutRecords].slice(0, maxTryoutRecords)
  };
}

export function hydrateTryoutScoringContext(project: PlannerProject, scoringContext: Pick<TryoutScoringContext, "scoringSystemId" | "scoringSystemVersionId">) {
  let changed = false;

  const tryoutRecords = project.tryoutRecords.map((tryoutRecord) => {
    if (tryoutRecord.recordType !== "planner-tryout") {
      return tryoutRecord;
    }

    const nextScoringSystemId = tryoutRecord.scoringSystemId ?? scoringContext.scoringSystemId;
    const nextScoringSystemVersionId = tryoutRecord.scoringSystemVersionId ?? scoringContext.scoringSystemVersionId;

    if (nextScoringSystemId === tryoutRecord.scoringSystemId && nextScoringSystemVersionId === tryoutRecord.scoringSystemVersionId) {
      return tryoutRecord;
    }

    changed = true;
    return {
      ...tryoutRecord,
      scoringSystemId: nextScoringSystemId,
      scoringSystemVersionId: nextScoringSystemVersionId,
      updatedAt: new Date().toISOString()
    };
  });

  return changed ? { ...project, tryoutRecords } : project;
}
