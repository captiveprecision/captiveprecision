import type { DomainEntityStatus, TimestampedEntity } from "@/lib/domain/base";
import type { PlannerLevelLabel } from "@/lib/domain/planner-levels";

export type TeamStatus = DomainEntityStatus;

export type TeamSelectionMode = "warn-only";
export type TeamSelectionJumpsGroup = "basic" | "advanced";

export type TeamSelectionLevelCriteria = {
  enabled: boolean;
  minLevel: PlannerLevelLabel;
  minScore: number;
};

export type TeamSelectionJumpsCriteria = {
  enabled: boolean;
  group: TeamSelectionJumpsGroup;
  minScore: number;
};

export type TeamSelectionDanceCriteria = {
  enabled: boolean;
  minTotalScore: number;
};

export type TeamSelectionProfile = {
  mode: TeamSelectionMode;
  sports: {
    tumbling: TeamSelectionLevelCriteria;
    stunts: TeamSelectionLevelCriteria;
    jumps: TeamSelectionJumpsCriteria;
    dance: TeamSelectionDanceCriteria;
  };
};

export function buildDefaultTeamSelectionProfile(): TeamSelectionProfile {
  return {
    mode: "warn-only",
    sports: {
      tumbling: {
        enabled: false,
        minLevel: "Beginner",
        minScore: 0
      },
      stunts: {
        enabled: false,
        minLevel: "Level 1",
        minScore: 0
      },
      jumps: {
        enabled: false,
        group: "basic",
        minScore: 0
      },
      dance: {
        enabled: false,
        minTotalScore: 0
      }
    }
  };
}

export type TeamRecord = TimestampedEntity & {
  // Team rosters should link to athlete entity ids. Registration-number membership is transitional compatibility only.
  workspaceId: string;
  remoteTeamId?: string;
  name: string;
  teamLevel: PlannerLevelLabel;
  // teamType remains the persisted age-category field for compatibility with the current planner flow.
  teamType: string;
  teamDivision?: string;
  trainingDays?: string;
  trainingHours?: string;
  // Legacy fallback from the earlier single-field schedule model.
  trainingSchedule?: string;
  assignedCoachNames?: string[];
  linkedCoachIds?: string[];
  memberAthleteIds: string[];
  memberRegistrationNumbers?: string[];
  selectionProfile: TeamSelectionProfile;
  status: TeamStatus;
};
