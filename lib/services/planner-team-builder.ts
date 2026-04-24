import type { AthleteRecord } from "@/lib/domain/athlete";
import type { TryoutRecord } from "@/lib/domain/evaluation-record";
import type { PlannerLevelLabel, PlannerQualifiedLevel, PlannerSportKey } from "@/lib/domain/planner-levels";
import type { PlannerProject } from "@/lib/domain/planner-project";
import { buildDefaultTeamSelectionProfile, type TeamRecord, type TeamSelectionJumpsGroup, type TeamSelectionProfile } from "@/lib/domain/team";
import { getPlannerLevelRank } from "@/lib/services/planner-domain-mappers";
import { calculateTryoutAthleteAge, getTryoutRecordDate } from "@/lib/services/planner-tryouts";

type LevelScore = {
  baseScore: number;
  extraScore: number;
};

export type TeamBuilderSportCapability = {
  sport: PlannerSportKey;
  latestTryoutRecord: TryoutRecord | null;
  bestTryoutRecord: TryoutRecord | null;
  bestLevel: PlannerLevelLabel | null;
  bestLevelScore: number;
  bestExtraScore: number;
  levelScores: Partial<Record<PlannerLevelLabel, LevelScore>>;
  bestGroupScores: Record<string, number>;
  bestItemScores: Record<string, number>;
  bestTotalScore: number;
};

export type AthleteCapabilityProfile = {
  latestBySport: Record<PlannerSportKey, TryoutRecord | null>;
  bestBySport: Record<PlannerSportKey, TryoutRecord | null>;
  capabilitiesBySport: Record<PlannerSportKey, TeamBuilderSportCapability>;
};

export type TeamSelectionWarning = {
  sport: PlannerSportKey;
  message: string;
};

export type TeamSportAverage = {
  sport: PlannerSportKey;
  averageScore: number;
  coverageCount: number;
  rosterSize: number;
};

export type TeamSportAverages = Record<PlannerSportKey, TeamSportAverage>;

export type TeamBuilderCandidate = AthleteRecord & {
  age: number | null;
  displayLevel: PlannerQualifiedLevel;
  displayScore: number;
  extraScore: number;
  levelScores: Record<PlannerLevelLabel, LevelScore>;
  assignedTeamId: string | null;
  assignedTeamName: string;
  latestTryoutRecord: TryoutRecord | null;
  capabilitiesBySport: AthleteCapabilityProfile["capabilitiesBySport"];
  latestBySport: AthleteCapabilityProfile["latestBySport"];
  bestBySport: AthleteCapabilityProfile["bestBySport"];
  selectionWarnings: TeamSelectionWarning[];
  teamFitSummary: string;
};

export type TeamBuilderTeamDraftInput = {
  name: string;
  teamLevel: PlannerLevelLabel;
  teamType: string;
  teamDivision?: string;
  trainingDays?: string;
  trainingHours?: string;
  trainingSchedule?: string;
  assignedCoachNames?: string[];
  linkedCoachIds?: string[];
  remoteTeamId?: string;
  selectionProfile?: TeamSelectionProfile;
};

export type TeamBuilderTeamEditInput = {
  teamId: string;
  name: string;
  teamLevel: PlannerLevelLabel;
  teamType: string;
  selectionProfile: TeamSelectionProfile;
};

export type MyTeamsTeamProfileUpdateInput = TeamBuilderTeamDraftInput & {
  teamId: string;
};

export type TeamRemoteSyncSource = {
  id?: string;
  remoteTeamId?: string;
  workspaceRootId?: string;
  lockVersion?: number | null;
  lastChangeSetId?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  archivedAt?: string | null;
  deletedAt?: string | null;
  restoredFromVersionId?: string | null;
};

export type TeamBuilderTeamWithMembers = TeamRecord & {
  members: TeamBuilderCandidate[];
  sportAverages: TeamSportAverages;
};

const SPORT_KEYS: readonly PlannerSportKey[] = ["tumbling", "stunts", "jumps", "dance"];

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function createEmptyCapability(sport: PlannerSportKey): TeamBuilderSportCapability {
  return {
    sport,
    latestTryoutRecord: null,
    bestTryoutRecord: null,
    bestLevel: null,
    bestLevelScore: 0,
    bestExtraScore: 0,
    levelScores: {},
    bestGroupScores: {},
    bestItemScores: {},
    bestTotalScore: 0
  };
}

function createEmptySportAverages(): TeamSportAverages {
  return {
    tumbling: { sport: "tumbling", averageScore: 0, coverageCount: 0, rosterSize: 0 },
    stunts: { sport: "stunts", averageScore: 0, coverageCount: 0, rosterSize: 0 },
    jumps: { sport: "jumps", averageScore: 0, coverageCount: 0, rosterSize: 0 },
    dance: { sport: "dance", averageScore: 0, coverageCount: 0, rosterSize: 0 }
  };
}

function getTryoutRecordTime(tryoutRecord: TryoutRecord | null) {
  if (!tryoutRecord) {
    return 0;
  }

  return new Date(getTryoutRecordDate(tryoutRecord)).getTime();
}

function getTryoutRecordLevelBuckets(tryoutRecord: TryoutRecord) {
  return tryoutRecord.resultSummary.bucketScores.filter((bucket) => (
    bucket.bucketKind === "level" && bucket.levelLabel
  ));
}

function getBestLevelMetric(tryoutRecord: TryoutRecord | null) {
  if (!tryoutRecord) {
    return null;
  }

  return getTryoutRecordLevelBuckets(tryoutRecord)
    .filter((bucket) => bucket.baseScore > 0 || bucket.extraScore > 0)
    .sort((left, right) => {
      const levelDelta = getPlannerLevelRank((right.levelLabel ?? "Beginner") as PlannerLevelLabel) - getPlannerLevelRank((left.levelLabel ?? "Beginner") as PlannerLevelLabel);
      if (levelDelta !== 0) {
        return levelDelta;
      }
      if (right.baseScore !== left.baseScore) {
        return right.baseScore - left.baseScore;
      }
      return right.extraScore - left.extraScore;
    })[0] ?? null;
}

function compareLevelTryoutRecords(left: TryoutRecord | null, right: TryoutRecord | null) {
  const leftMetric = getBestLevelMetric(left);
  const rightMetric = getBestLevelMetric(right);
  const levelDelta = getPlannerLevelRank((leftMetric?.levelLabel ?? "Beginner") as PlannerLevelLabel) - getPlannerLevelRank((rightMetric?.levelLabel ?? "Beginner") as PlannerLevelLabel);

  if (levelDelta !== 0) {
    return levelDelta;
  }

  const baseDelta = (leftMetric?.baseScore ?? 0) - (rightMetric?.baseScore ?? 0);
  if (baseDelta !== 0) {
    return baseDelta;
  }

  const extraDelta = (leftMetric?.extraScore ?? 0) - (rightMetric?.extraScore ?? 0);
  if (extraDelta !== 0) {
    return extraDelta;
  }

  return getTryoutRecordTime(left) - getTryoutRecordTime(right);
}

function getAverageItemScore(tryoutRecord: TryoutRecord | null) {
  if (!tryoutRecord) {
    return 0;
  }

  const itemBuckets = tryoutRecord.resultSummary.bucketScores.filter((bucket) => bucket.bucketKind === "item");
  if (!itemBuckets.length) {
    return 0;
  }

  return itemBuckets.reduce((sum, bucket) => sum + bucket.baseScore, 0) / itemBuckets.length;
}

function compareTotalScoreTryoutRecords(left: TryoutRecord | null, right: TryoutRecord | null, useAverageTieBreak = false) {
  const totalDelta = (left?.resultSummary.totalBaseScore ?? 0) - (right?.resultSummary.totalBaseScore ?? 0);
  if (totalDelta !== 0) {
    return totalDelta;
  }

  if (useAverageTieBreak) {
    const averageDelta = getAverageItemScore(left) - getAverageItemScore(right);
    if (averageDelta !== 0) {
      return averageDelta;
    }
  }

  return getTryoutRecordTime(left) - getTryoutRecordTime(right);
}

function buildSportCapability(
  sport: PlannerSportKey,
  tryoutRecords: TryoutRecord[]
): TeamBuilderSportCapability {
  if (!tryoutRecords.length) {
    return createEmptyCapability(sport);
  }

  const sortedByTime = [...tryoutRecords].sort((left, right) => getTryoutRecordTime(right) - getTryoutRecordTime(left));
  const latestTryoutRecord = sortedByTime[0] ?? null;
  const capability = createEmptyCapability(sport);
  capability.latestTryoutRecord = latestTryoutRecord;

  if (sport === "tumbling" || sport === "stunts") {
    for (const tryoutRecord of tryoutRecords) {
      for (const bucket of getTryoutRecordLevelBuckets(tryoutRecord)) {
        if (!bucket.levelLabel) {
          continue;
        }

        const current = capability.levelScores[bucket.levelLabel];
        if (
          !current
          || bucket.baseScore > current.baseScore
          || (bucket.baseScore === current.baseScore && bucket.extraScore > current.extraScore)
        ) {
          capability.levelScores[bucket.levelLabel] = {
            baseScore: bucket.baseScore,
            extraScore: bucket.extraScore
          };
        }
      }

      if (!capability.bestTryoutRecord || compareLevelTryoutRecords(tryoutRecord, capability.bestTryoutRecord) > 0) {
        capability.bestTryoutRecord = tryoutRecord;
      }
    }

    const bestMetric = getBestLevelMetric(capability.bestTryoutRecord);
    capability.bestLevel = bestMetric?.levelLabel ?? null;
    capability.bestLevelScore = bestMetric?.baseScore ?? 0;
    capability.bestExtraScore = bestMetric?.extraScore ?? 0;
    capability.bestTotalScore = capability.bestLevelScore;
    return capability;
  }

  if (sport === "jumps") {
    for (const tryoutRecord of tryoutRecords) {
      for (const bucket of tryoutRecord.resultSummary.bucketScores.filter((item) => item.bucketKind === "group")) {
        const key = bucket.bucketKey.toLowerCase();
        capability.bestGroupScores[key] = Math.max(capability.bestGroupScores[key] ?? 0, bucket.baseScore);
      }

      if (!capability.bestTryoutRecord || compareTotalScoreTryoutRecords(tryoutRecord, capability.bestTryoutRecord) > 0) {
        capability.bestTryoutRecord = tryoutRecord;
      }
    }

    capability.bestTotalScore = capability.bestTryoutRecord?.resultSummary.totalBaseScore ?? 0;
    return capability;
  }

  for (const tryoutRecord of tryoutRecords) {
    for (const bucket of tryoutRecord.resultSummary.bucketScores.filter((item) => item.bucketKind === "item")) {
      capability.bestItemScores[bucket.bucketKey] = Math.max(capability.bestItemScores[bucket.bucketKey] ?? 0, bucket.baseScore);
    }

    if (!capability.bestTryoutRecord || compareTotalScoreTryoutRecords(tryoutRecord, capability.bestTryoutRecord, true) > 0) {
      capability.bestTryoutRecord = tryoutRecord;
    }
  }

  capability.bestTotalScore = capability.bestTryoutRecord?.resultSummary.totalBaseScore ?? 0;
  return capability;
}

function buildAthleteCapabilityProfile(project: PlannerProject, athlete: AthleteRecord): AthleteCapabilityProfile {
  const tryoutRecordsBySport = {
    tumbling: [] as TryoutRecord[],
    stunts: [] as TryoutRecord[],
    jumps: [] as TryoutRecord[],
    dance: [] as TryoutRecord[]
  };

  project.tryoutRecords.forEach((tryoutRecord) => {
    if (tryoutRecord.athleteId !== athlete.id) {
      return;
    }

    tryoutRecordsBySport[tryoutRecord.rawData.sport].push(tryoutRecord);
  });

  const capabilitiesBySport = {
    tumbling: buildSportCapability("tumbling", tryoutRecordsBySport.tumbling),
    stunts: buildSportCapability("stunts", tryoutRecordsBySport.stunts),
    jumps: buildSportCapability("jumps", tryoutRecordsBySport.jumps),
    dance: buildSportCapability("dance", tryoutRecordsBySport.dance)
  };

  return {
    latestBySport: {
      tumbling: capabilitiesBySport.tumbling.latestTryoutRecord,
      stunts: capabilitiesBySport.stunts.latestTryoutRecord,
      jumps: capabilitiesBySport.jumps.latestTryoutRecord,
      dance: capabilitiesBySport.dance.latestTryoutRecord
    },
    bestBySport: {
      tumbling: capabilitiesBySport.tumbling.bestTryoutRecord,
      stunts: capabilitiesBySport.stunts.bestTryoutRecord,
      jumps: capabilitiesBySport.jumps.bestTryoutRecord,
      dance: capabilitiesBySport.dance.bestTryoutRecord
    },
    capabilitiesBySport
  };
}

function getCandidateRelevantLevelScore(
  candidate: TeamBuilderCandidate,
  sport: "tumbling" | "stunts",
  minLevel: PlannerLevelLabel
) {
  const scores = candidate.capabilitiesBySport[sport].levelScores;

  return Object.entries(scores).reduce<LevelScore | null>((best, [levelLabel, score]) => {
    if (getPlannerLevelRank(levelLabel as PlannerLevelLabel) < getPlannerLevelRank(minLevel)) {
      return best;
    }

    if (!best || score.baseScore > best.baseScore || (score.baseScore === best.baseScore && score.extraScore > best.extraScore)) {
      return score;
    }

    return best;
  }, null);
}

export function buildTeamSelectionWarnings(candidate: TeamBuilderCandidate, team: TeamRecord): TeamSelectionWarning[] {
  const profile = team.selectionProfile ?? buildDefaultTeamSelectionProfile();
  const warnings: TeamSelectionWarning[] = [];

  if (profile.sports.tumbling.enabled) {
    const score = getCandidateRelevantLevelScore(candidate, "tumbling", profile.sports.tumbling.minLevel);
    if (!score || score.baseScore < profile.sports.tumbling.minScore) {
      warnings.push({
        sport: "tumbling",
        message: `Tumbling needs ${profile.sports.tumbling.minLevel} with ${profile.sports.tumbling.minScore}+`
      });
    }
  }

  if (profile.sports.stunts.enabled) {
    const score = getCandidateRelevantLevelScore(candidate, "stunts", profile.sports.stunts.minLevel);
    if (!score || score.baseScore < profile.sports.stunts.minScore) {
      warnings.push({
        sport: "stunts",
        message: `Stunts needs ${profile.sports.stunts.minLevel} with ${profile.sports.stunts.minScore}+`
      });
    }
  }

  if (profile.sports.jumps.enabled) {
    const currentScore = candidate.capabilitiesBySport.jumps.bestGroupScores[profile.sports.jumps.group] ?? 0;
    if (currentScore < profile.sports.jumps.minScore) {
      warnings.push({
        sport: "jumps",
        message: `Jumps needs ${profile.sports.jumps.group === "advanced" ? "Advanced" : "Basic"} with ${profile.sports.jumps.minScore}+`
      });
    }
  }

  if (profile.sports.dance.enabled) {
    const currentScore = candidate.capabilitiesBySport.dance.bestTotalScore ?? 0;
    if (currentScore < profile.sports.dance.minTotalScore) {
      warnings.push({
        sport: "dance",
        message: `Dance needs total ${profile.sports.dance.minTotalScore}+`
      });
    }
  }

  return warnings;
}

export function buildTeamFitSummary(warnings: TeamSelectionWarning[]) {
  if (!warnings.length) {
    return "Meets current team criteria";
  }

  return warnings.length === 1
    ? warnings[0].message
    : `${warnings.length} criteria warnings`;
}

export function formatTeamBuilderSportCapability(capability: TeamBuilderSportCapability) {
  if (capability.sport === "tumbling" || capability.sport === "stunts") {
    if (!capability.bestLevel) {
      return "No result";
    }

    return `${capability.bestLevel} / ${round(capability.bestLevelScore)} main / ${round(capability.bestExtraScore)} extra`;
  }

  if (capability.sport === "jumps") {
    const basic = capability.bestGroupScores.basic ?? 0;
    const advanced = capability.bestGroupScores.advanced ?? 0;
    if (!basic && !advanced) {
      return "No result";
    }

    return `Basic ${round(basic)} / Advanced ${round(advanced)}`;
  }

  if (!capability.bestTotalScore) {
    return "No result";
  }

  return `Total ${round(capability.bestTotalScore)}`;
}

export function buildTeamBuilderCandidates(
  project: PlannerProject,
  levelLabels: readonly PlannerLevelLabel[]
): TeamBuilderCandidate[] {
  return project.athletes.map((athlete) => {
    const capabilityProfile = buildAthleteCapabilityProfile(project, athlete);
    const tumblingCapability = capabilityProfile.capabilitiesBySport.tumbling;
    const assignedTeam = project.teams.find((team) => team.memberAthleteIds.includes(athlete.id) || (team.memberRegistrationNumbers ?? []).includes(athlete.registrationNumber)) ?? null;
    const displayLevel = tumblingCapability.bestLevel ?? "Unqualified";
    const referenceTryoutRecord = capabilityProfile.latestBySport.tumbling
      ?? capabilityProfile.latestBySport.stunts
      ?? capabilityProfile.latestBySport.jumps
      ?? capabilityProfile.latestBySport.dance
      ?? null;
    const levelScores = Object.fromEntries(
      levelLabels.map((levelLabel) => [levelLabel, tumblingCapability.levelScores[levelLabel] ?? { baseScore: 0, extraScore: 0 }])
    ) as Record<PlannerLevelLabel, LevelScore>;
    const selectionWarnings = assignedTeam ? buildTeamSelectionWarnings({
      ...athlete,
      age: null,
      displayLevel,
      displayScore: tumblingCapability.bestLevelScore,
      extraScore: tumblingCapability.bestExtraScore,
      levelScores,
      assignedTeamId: assignedTeam.id,
      assignedTeamName: assignedTeam.name,
      latestTryoutRecord: tumblingCapability.latestTryoutRecord,
      capabilitiesBySport: capabilityProfile.capabilitiesBySport,
      latestBySport: capabilityProfile.latestBySport,
      bestBySport: capabilityProfile.bestBySport,
      selectionWarnings: [],
      teamFitSummary: ""
    }, assignedTeam) : [];

    return {
      ...athlete,
      age: calculateTryoutAthleteAge(
        athlete.dateOfBirth,
        referenceTryoutRecord ? getTryoutRecordDate(referenceTryoutRecord) : new Date().toISOString()
      ),
      displayLevel,
      displayScore: tumblingCapability.bestLevelScore,
      extraScore: tumblingCapability.bestExtraScore,
      levelScores,
      assignedTeamId: assignedTeam?.id ?? null,
      assignedTeamName: assignedTeam?.name ?? "No Team",
      latestTryoutRecord: tumblingCapability.latestTryoutRecord,
      capabilitiesBySport: capabilityProfile.capabilitiesBySport,
      latestBySport: capabilityProfile.latestBySport,
      bestBySport: capabilityProfile.bestBySport,
      selectionWarnings,
      teamFitSummary: buildTeamFitSummary(selectionWarnings)
    };
  });
}

function getCandidateSportScore(candidate: TeamBuilderCandidate, sport: PlannerSportKey) {
  const capability = candidate.capabilitiesBySport[sport];

  if (sport === "tumbling" || sport === "stunts") {
    return capability.bestLevelScore;
  }

  return capability.bestTotalScore;
}

function buildTeamSportAverages(members: TeamBuilderCandidate[]): TeamSportAverages {
  const averages = createEmptySportAverages();

  SPORT_KEYS.forEach((sport) => {
    const scoredMembers = members
      .map((member) => getCandidateSportScore(member, sport))
      .filter((score) => score > 0);
    averages[sport] = {
      sport,
      averageScore: scoredMembers.length ? round(scoredMembers.reduce((sum, score) => sum + score, 0) / scoredMembers.length) : 0,
      coverageCount: scoredMembers.length,
      rosterSize: members.length
    };
  });

  return averages;
}

export function buildTeamBuilderTeamsWithMembers(
  project: PlannerProject,
  candidates: TeamBuilderCandidate[]
): TeamBuilderTeamWithMembers[] {
  const candidateMapById = new Map(candidates.map((candidate) => [candidate.id, candidate] as const));
  const candidateMapByRegistration = new Map(candidates.map((candidate) => [candidate.registrationNumber, candidate] as const));

  return project.teams.map((team) => {
    const members = team.memberAthleteIds.length
      ? team.memberAthleteIds
          .map((athleteId) => candidateMapById.get(athleteId))
          .filter((member): member is TeamBuilderCandidate => Boolean(member))
      : (team.memberRegistrationNumbers ?? [])
          .map((registrationNumber) => candidateMapByRegistration.get(registrationNumber))
          .filter((member): member is TeamBuilderCandidate => Boolean(member));

    return {
      ...team,
      members,
      sportAverages: buildTeamSportAverages(members)
    };
  });
}

export function createPlannerTeamRecord(
  project: PlannerProject,
  draft: TeamBuilderTeamDraftInput,
  occurredAt: string,
  syncSource?: TeamRemoteSyncSource
): TeamRecord {
  const trainingDays = draft.trainingDays?.trim() ?? "";
  const trainingHours = draft.trainingHours?.trim() ?? "";
  const legacyTrainingSchedule = draft.trainingSchedule?.trim() ?? [trainingDays, trainingHours].filter(Boolean).join(" / ");
  const createdAt = syncSource?.createdAt?.trim() || occurredAt;
  const updatedAt = syncSource?.updatedAt?.trim() || occurredAt;
  const remoteTeamId = syncSource?.remoteTeamId?.trim() || draft.remoteTeamId?.trim() || "";
  const nextId = syncSource?.id?.trim() || remoteTeamId || `team-${Date.now()}`;

  return {
    id: nextId,
    workspaceId: project.workspaceId,
    workspaceRootId: syncSource?.workspaceRootId?.trim() || project.workspaceRootId,
    remoteTeamId,
    name: draft.name.trim() || `Team ${project.teams.length + 1}`,
    teamLevel: draft.teamLevel,
    teamType: draft.teamType.trim(),
    teamDivision: draft.teamDivision?.trim() ?? "",
    trainingDays,
    trainingHours,
    trainingSchedule: legacyTrainingSchedule,
    assignedCoachNames: (draft.assignedCoachNames ?? []).map((name) => name.trim()).filter(Boolean),
    linkedCoachIds: (draft.linkedCoachIds ?? []).map((id) => id.trim()).filter(Boolean),
    memberAthleteIds: [],
    memberRegistrationNumbers: [],
    selectionProfile: draft.selectionProfile ?? buildDefaultTeamSelectionProfile(),
    status: "draft",
    createdAt,
    updatedAt,
    lockVersion: typeof syncSource?.lockVersion === "number" ? syncSource.lockVersion : undefined,
    lastChangeSetId: syncSource?.lastChangeSetId ?? null,
    archivedAt: syncSource?.archivedAt ?? null,
    deletedAt: syncSource?.deletedAt ?? null,
    restoredFromVersionId: syncSource?.restoredFromVersionId ?? null
  };
}

export function updateMyTeamsTeamProfile(
  project: PlannerProject,
  draft: MyTeamsTeamProfileUpdateInput,
  occurredAt: string,
  syncSource?: TeamRemoteSyncSource
): PlannerProject {
  const trainingDays = draft.trainingDays?.trim() ?? "";
  const trainingHours = draft.trainingHours?.trim() ?? "";
  const trainingSchedule = draft.trainingSchedule?.trim() ?? [trainingDays, trainingHours].filter(Boolean).join(" / ");

  return {
    ...project,
    teams: project.teams.map((team) => (
      team.id === draft.teamId
        ? {
            ...team,
            workspaceRootId: syncSource?.workspaceRootId?.trim() || team.workspaceRootId,
            remoteTeamId: syncSource?.remoteTeamId?.trim() || draft.remoteTeamId?.trim() || team.remoteTeamId || "",
            name: draft.name.trim() || team.name,
            teamLevel: draft.teamLevel,
            teamType: draft.teamType.trim(),
            teamDivision: draft.teamDivision?.trim() ?? "",
            trainingDays,
            trainingHours,
            trainingSchedule,
            assignedCoachNames: (draft.assignedCoachNames ?? []).map((name) => name.trim()).filter(Boolean),
            linkedCoachIds: (draft.linkedCoachIds ?? []).map((id) => id.trim()).filter(Boolean),
            selectionProfile: draft.selectionProfile ?? team.selectionProfile,
            updatedAt: syncSource?.updatedAt?.trim() || occurredAt,
            lockVersion: typeof syncSource?.lockVersion === "number" ? syncSource.lockVersion : team.lockVersion,
            lastChangeSetId: syncSource?.lastChangeSetId ?? team.lastChangeSetId ?? null,
            archivedAt: syncSource?.archivedAt ?? team.archivedAt ?? null,
            deletedAt: syncSource?.deletedAt ?? team.deletedAt ?? null,
            restoredFromVersionId: syncSource?.restoredFromVersionId ?? team.restoredFromVersionId ?? null
          }
        : team
    ))
  };
}

export function assignAthleteToPlannerTeam(
  project: PlannerProject,
  athlete: AthleteRecord,
  teamId: string,
  occurredAt: string
): PlannerProject {
  return {
    ...project,
    teams: project.teams.map((team) => ({
      ...team,
      memberAthleteIds: team.id === teamId
        ? Array.from(new Set([...team.memberAthleteIds.filter((id) => id !== athlete.id), athlete.id]))
        : team.memberAthleteIds.filter((id) => id !== athlete.id),
      memberRegistrationNumbers: team.id === teamId
        ? Array.from(new Set([...(team.memberRegistrationNumbers ?? []).filter((registrationNumber) => registrationNumber !== athlete.registrationNumber), athlete.registrationNumber]))
        : (team.memberRegistrationNumbers ?? []).filter((registrationNumber) => registrationNumber !== athlete.registrationNumber),
      updatedAt: occurredAt
    }))
  };
}

export function removeAthleteFromPlannerTeam(
  project: PlannerProject,
  athlete: AthleteRecord,
  teamId: string,
  occurredAt: string
): PlannerProject {
  return {
    ...project,
    teams: project.teams.map((team) => (
      team.id === teamId
        ? {
            ...team,
            memberAthleteIds: team.memberAthleteIds.filter((id) => id !== athlete.id),
            memberRegistrationNumbers: (team.memberRegistrationNumbers ?? []).filter((registrationNumber) => registrationNumber !== athlete.registrationNumber),
            updatedAt: occurredAt
          }
        : team
    ))
  };
}

export function clearPlannerTeamRoster(project: PlannerProject, teamId: string, occurredAt: string): PlannerProject {
  return {
    ...project,
    teams: project.teams.map((team) => (
      team.id === teamId
        ? { ...team, memberAthleteIds: [], memberRegistrationNumbers: [], updatedAt: occurredAt }
        : team
    ))
  };
}

export function deletePlannerTeamRecord(project: PlannerProject, teamId: string): PlannerProject {
  return {
    ...project,
    teams: project.teams.filter((team) => team.id !== teamId)
  };
}

export function updatePlannerTeamDefinition(
  project: PlannerProject,
  edit: TeamBuilderTeamEditInput,
  occurredAt: string
): PlannerProject {
  return {
    ...project,
    teams: project.teams.map((team) => (
      team.id === edit.teamId
        ? {
            ...team,
            name: edit.name.trim() || team.name,
            teamLevel: edit.teamLevel,
            teamType: edit.teamType,
            selectionProfile: edit.selectionProfile,
            updatedAt: occurredAt
          }
        : team
    ))
  };
}

export function buildTeamSelectionProfileForDraft(selectionProfile?: TeamSelectionProfile) {
  return selectionProfile ?? buildDefaultTeamSelectionProfile();
}

export function getTeamSelectionGroupLabel(group: TeamSelectionJumpsGroup) {
  return group === "advanced" ? "Advanced" : "Basic";
}
