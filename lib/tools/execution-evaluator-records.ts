export const EXECUTION_EVALUATOR_RECORDS_STORAGE_KEY = "cp-execution-evaluator-records";

export type ExecutionSectionSnapshot = {
  id: string;
  name: string;
  maxPoints: number;
  earnedPoints?: number;
  deductions: number;
  step: number;
  mode?: "execution" | "manual";
};

export type ExecutionTotalsSnapshot = {
  startScore: number;
  executionDeductions: number;
  executionSubtotal: number;
  generalDeductions: number;
  illegalityDeductions: number;
  finalScore: number;
  totalLossPct: number;
};

export type ExecutionEvaluatorRecord = {
  id: string;
  teamName: string;
  routineName: string;
  level: number;
  systemId: string;
  systemName: string;
  versionId: string;
  versionLabel: string;
  savedAt: string;
  generalStep: number;
  sections: ExecutionSectionSnapshot[];
  totals: ExecutionTotalsSnapshot;
};

export type TeamExecutionRecordGroup = {
  key: string;
  teamName: string;
  count: number;
  latestRecord: ExecutionEvaluatorRecord;
};

export function normalizeTeamName(teamName: string) {
  return teamName.trim().toLowerCase();
}

export function readExecutionEvaluatorRecords() {
  if (typeof window === "undefined") {
    return [] as ExecutionEvaluatorRecord[];
  }

  try {
    const raw = window.localStorage.getItem(EXECUTION_EVALUATOR_RECORDS_STORAGE_KEY);

    if (!raw) {
      return [] as ExecutionEvaluatorRecord[];
    }

    const parsed = JSON.parse(raw) as ExecutionEvaluatorRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [] as ExecutionEvaluatorRecord[];
  }
}

export function writeExecutionEvaluatorRecords(records: ExecutionEvaluatorRecord[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(EXECUTION_EVALUATOR_RECORDS_STORAGE_KEY, JSON.stringify(records));
}

export function groupExecutionRecordsByTeam(records: ExecutionEvaluatorRecord[]) {
  const groups = new Map<string, TeamExecutionRecordGroup>();

  records.forEach((record) => {
    const key = normalizeTeamName(record.teamName);
    const existing = groups.get(key);

    if (!existing) {
      groups.set(key, {
        key,
        teamName: record.teamName,
        count: 1,
        latestRecord: record
      });
      return;
    }

    const isNewer = new Date(record.savedAt).getTime() > new Date(existing.latestRecord.savedAt).getTime();
    groups.set(key, {
      key,
      teamName: existing.teamName,
      count: existing.count + 1,
      latestRecord: isNewer ? record : existing.latestRecord
    });
  });

  return [...groups.values()].sort((left, right) => (
    new Date(right.latestRecord.savedAt).getTime() - new Date(left.latestRecord.savedAt).getTime()
  ));
}
