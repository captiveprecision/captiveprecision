export type EntityId = string;
export type IsoDateString = string;

export type DomainEntityStatus = "draft" | "active" | "archived";

export type VersionedEntityMetadata = {
  lockVersion?: number;
  workspaceRootId?: string;
  lastChangeSetId?: string | null;
  archivedAt?: IsoDateString | null;
  deletedAt?: IsoDateString | null;
  restoredFromVersionId?: string | null;
};

export type TimestampedEntity = {
  id: EntityId;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
} & VersionedEntityMetadata;
