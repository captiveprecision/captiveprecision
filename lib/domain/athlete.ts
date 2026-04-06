import type { DomainEntityStatus, TimestampedEntity } from "@/lib/domain/base";

export type AthleteStatus = Extract<DomainEntityStatus, "active" | "archived">;

export type AthleteParentContact = {
  id: string;
  name: string;
  email: string;
  phone: string;
};

export type AthleteRecord = TimestampedEntity & {
  // Canonical system identity lives in `id`. `registrationNumber` remains an operational reference only.
  workspaceId: string;
  registrationNumber: string;
  firstName: string;
  lastName: string;
  name: string;
  dateOfBirth: string;
  notes: string;
  parentContacts: AthleteParentContact[];
  status: AthleteStatus;
  // Deprecated compatibility fields kept only so older local records can still hydrate safely.
  sourceTeamName?: string;
  athleteNotes?: string;
};

export type AthleteSnapshot = {
  // Snapshots preserve evaluation-time context without redefining the canonical athlete entity.
  athleteId: string;
  registrationNumber: string;
  firstName: string;
  lastName: string;
  name: string;
  dateOfBirth: string;
  notes: string;
  parentContacts: AthleteParentContact[];
  capturedAt: string;
  // Deprecated compatibility fields kept for historical tryout records.
  sourceTeamName?: string;
  evaluationTeamName?: string;
  athleteNotes?: string;
};
