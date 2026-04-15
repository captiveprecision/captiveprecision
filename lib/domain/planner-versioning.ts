import type { IsoDateString } from "@/lib/domain/base";

export type WorkspaceRootScope = "coach" | "gym";
export type WorkspaceRootStatus = "active" | "archived";
export type PlannerChangeType = "create" | "update" | "archive" | "delete" | "restore" | "reassign";
export type VersionedEntityType =
  | "athlete"
  | "team"
  | "assignment"
  | "planner-project"
  | "evaluation"
  | "skill-plan"
  | "routine-plan"
  | "season-plan";

export type WorkspaceRoot = {
  id: string;
  scopeType: WorkspaceRootScope;
  ownerProfileId: string | null;
  gymId: string | null;
  status: WorkspaceRootStatus;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
};

export type ChangeSet = {
  id: string;
  workspaceRootId: string;
  action: string;
  summary: string | null;
  metadata: Record<string, unknown>;
  createdByProfileId: string | null;
  createdAt: IsoDateString;
};

export type EntityVersion<T = Record<string, unknown>> = {
  id: string;
  entityType: VersionedEntityType;
  entityId: string;
  workspaceRootId: string;
  versionNumber: number;
  changeType: PlannerChangeType;
  snapshot: T;
  changedByProfileId: string | null;
  changeSetId: string;
  createdAt: IsoDateString;
};

export type WorkspaceBackup = {
  id: string;
  workspaceRootId: string;
  backupType: string;
  status: string;
  snapshot: Record<string, unknown>;
  metadata: Record<string, unknown>;
  triggeredByProfileId: string | null;
  createdAt: IsoDateString;
  expiresAt: IsoDateString | null;
};

export type RestorePreview = {
  entityType: VersionedEntityType;
  entityId: string;
  versionId: string;
  versionNumber: number;
  currentLockVersion: number | null;
  restoreSnapshot: Record<string, unknown>;
};

export type SyncMetadata = {
  lastChangeSetId: string | null;
  lastBackupAt: IsoDateString | null;
};
