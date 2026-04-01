import type { DomainEntityStatus, TimestampedEntity } from "@/lib/domain/base";

export type AthleteStatus = Extract<DomainEntityStatus, "active" | "archived">;

export type AthleteRecord = TimestampedEntity & {
  // Canonical system identity lives in `id`. `registrationNumber` remains an operational reference only.
  workspaceId: string;
  registrationNumber: string;
  name: string;
  dateOfBirth: string;
  sourceTeamName: string;
  athleteNotes: string;
  status: AthleteStatus;
};

export type AthleteSnapshot = {
  // Snapshots preserve evaluation-time context without redefining the canonical athlete entity.
  athleteId: string;
  registrationNumber: string;
  name: string;
  dateOfBirth: string;
  sourceTeamName: string;
  evaluationTeamName: string;
  athleteNotes: string;
  capturedAt: string;
};


