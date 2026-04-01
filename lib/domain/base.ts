export type EntityId = string;
export type IsoDateString = string;

export type DomainEntityStatus = "draft" | "active" | "archived";

export type TimestampedEntity = {
  id: EntityId;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
};
