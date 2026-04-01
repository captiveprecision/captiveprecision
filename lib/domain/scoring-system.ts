import type { IsoDateString } from "@/lib/domain/base";

export type CanonicalScoringSystemStatus = "draft" | "active" | "archived";
export type LegacyScoringSystemStatus = "Draft" | "Active" | "Archived";
export type ScoringSystemStatus = CanonicalScoringSystemStatus | LegacyScoringSystemStatus;
export type ScoringSystemVersionStatus = CanonicalScoringSystemStatus | LegacyScoringSystemStatus;

export type ScoringSystemSection = {
  id: string;
  key?: string;
  name: string;
  maxPoints: number;
  guidance?: string | null;
  sortOrder?: number;
  createdAt?: IsoDateString;
  updatedAt?: IsoDateString;
};

export type ScoringSystemVersion = {
  id: string;
  label: string;
  season: string;
  seasonLabel?: string;
  status: ScoringSystemVersionStatus;
  comments: string;
  isActive?: boolean;
  sections: ScoringSystemSection[];
  createdAt?: IsoDateString;
  updatedAt?: IsoDateString;
};

export type ScoringSystem = {
  id: string;
  name: string;
  slug: string;
  status: ScoringSystemStatus;
  activeVersionId: string;
  versions: ScoringSystemVersion[];
  createdAt?: IsoDateString;
  updatedAt?: IsoDateString;
};

export type ScoringSystemsConfig = {
  activeSystemId: string;
  systems: ScoringSystem[];
};
