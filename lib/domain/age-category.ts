export type AgeCategoryGridStatus = "draft" | "active" | "archived";
export type AgeCategoryRuleStatus = "active" | "inactive";
export type AgeCategoryEligibilityStatus =
  | "eligible"
  | "missing-birth-date"
  | "invalid-birth-date"
  | "missing-season"
  | "missing-grid";

export type AgeCategoryRule = {
  id: string;
  gridId: string;
  categoryKey: string;
  categoryName: string;
  minBirthYear: number;
  maxBirthYear: number;
  sortOrder: number;
  status: AgeCategoryRuleStatus;
  createdAt: string;
  updatedAt: string;
};

export type AgeCategoryGrid = {
  id: string;
  seasonLabel: string;
  label: string;
  status: AgeCategoryGridStatus;
  sourceName: string | null;
  notes: string | null;
  createdByProfileId: string | null;
  createdAt: string;
  updatedAt: string;
  rules: AgeCategoryRule[];
};

export type AgeCategoryEligibilityResult = {
  status: AgeCategoryEligibilityStatus;
  seasonLabel: string | null;
  gridId: string | null;
  gridLabel: string | null;
  birthYear: number | null;
  categories: AgeCategoryRule[];
};
