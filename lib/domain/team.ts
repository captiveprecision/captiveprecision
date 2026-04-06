import type { DomainEntityStatus, TimestampedEntity } from "@/lib/domain/base";
import type { PlannerLevelLabel } from "@/lib/domain/planner-levels";

export type TeamStatus = DomainEntityStatus;

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
  status: TeamStatus;
};
