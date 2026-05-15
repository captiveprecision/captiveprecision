export type GymSeasonStatus = "upcoming" | "active" | "closed";

export type GymSeason = {
  id: string;
  gymId: string;
  seasonNumber: number;
  label: string;
  startDate: string;
  endDate: string;
  status: GymSeasonStatus;
  metadata: Record<string, unknown>;
  createdByProfileId: string | null;
  createdAt: string;
  updatedAt: string;
};
