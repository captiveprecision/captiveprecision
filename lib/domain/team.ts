import type { DomainEntityStatus, TimestampedEntity } from "@/lib/domain/base";
import type { PlannerLevelLabel } from "@/lib/domain/planner-levels";

export type TeamStatus = DomainEntityStatus;

export type TeamRecord = TimestampedEntity & {
  // Team rosters should link to athlete entity ids. Registration-number membership is transitional compatibility only.
  workspaceId: string;
  name: string;
  teamLevel: PlannerLevelLabel;
  teamType: string;
  memberAthleteIds: string[];
  memberRegistrationNumbers?: string[];
  status: TeamStatus;
};


