import type {
  AgeCategoryEligibilityResult,
  AgeCategoryGrid,
  AgeCategoryGridStatus,
  AgeCategoryRule,
  AgeCategoryRuleStatus
} from "@/lib/domain/age-category";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/types/database";

type AdminClient = ReturnType<typeof createAdminClient>;
type AgeCategoryGridRow = Database["public"]["Tables"]["usasf_age_category_grids"]["Row"];
type AgeCategoryRuleRow = Database["public"]["Tables"]["usasf_age_category_rules"]["Row"];

export type AgeCategoryRuleInput = {
  id?: string | null;
  categoryKey?: string | null;
  categoryName: string;
  minBirthYear: number;
  maxBirthYear: number;
  sortOrder?: number;
  status?: AgeCategoryRuleStatus;
};

export type AgeCategoryGridInput = {
  gridId?: string | null;
  seasonLabel: string;
  label: string;
  status?: AgeCategoryGridStatus;
  sourceName?: string | null;
  notes?: string | null;
  rules: AgeCategoryRuleInput[];
};

function normalizeGridStatus(value: unknown): AgeCategoryGridStatus {
  return value === "active" || value === "archived" || value === "draft" ? value : "draft";
}

function isMissingAgeCategoryStorageError(error: { code?: string; message?: string } | null | undefined) {
  return (
    error?.code === "42P01"
    || error?.code === "42703"
    || error?.code === "PGRST204"
    || error?.code === "PGRST205"
    || /usasf_age_category/i.test(error?.message ?? "")
  );
}

function normalizeRuleStatus(value: unknown): AgeCategoryRuleStatus {
  return value === "inactive" ? "inactive" : "active";
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeYear(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) ? parsed : NaN;
}

function parseBirthYear(dateOfBirth: string) {
  const trimmed = dateOfBirth.trim();

  if (!trimmed) {
    return null;
  }

  const match = /^(\d{4})-\d{2}-\d{2}$/.exec(trimmed) ?? /^(\d{4})/.exec(trimmed);
  const year = match ? Number(match[1]) : NaN;

  return Number.isInteger(year) && year >= 1900 && year <= 2100 ? year : NaN;
}

export function buildAgeCategoryRuleFromRow(row: AgeCategoryRuleRow): AgeCategoryRule {
  return {
    id: row.id,
    gridId: row.grid_id,
    categoryKey: row.category_key,
    categoryName: row.category_name,
    minBirthYear: row.min_birth_year,
    maxBirthYear: row.max_birth_year,
    sortOrder: row.sort_order,
    status: normalizeRuleStatus(row.status),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function buildAgeCategoryGridFromRows(row: AgeCategoryGridRow, rules: AgeCategoryRuleRow[]): AgeCategoryGrid {
  return {
    id: row.id,
    seasonLabel: row.season_label,
    label: row.label,
    status: normalizeGridStatus(row.status),
    sourceName: row.source_name,
    notes: row.notes,
    createdByProfileId: row.created_by_profile_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    rules: rules
      .filter((rule) => rule.grid_id === row.id)
      .map(buildAgeCategoryRuleFromRow)
      .sort((left, right) => left.sortOrder - right.sortOrder || left.categoryName.localeCompare(right.categoryName))
  };
}

export function validateAgeCategoryGridInput(input: AgeCategoryGridInput) {
  const seasonLabel = normalizeText(input.seasonLabel);
  const label = normalizeText(input.label);

  if (!seasonLabel) {
    throw new Error("Season label is required.");
  }

  if (!label) {
    throw new Error("Grid label is required.");
  }

  if (!input.rules.length) {
    throw new Error("At least one category rule is required.");
  }

  const seenKeys = new Set<string>();
  const rules = input.rules.map((rule, index) => {
    const categoryName = normalizeText(rule.categoryName);
    const categoryKey = slugify(normalizeText(rule.categoryKey) || categoryName);
    const minBirthYear = normalizeYear(rule.minBirthYear);
    const maxBirthYear = normalizeYear(rule.maxBirthYear);

    if (!categoryName) {
      throw new Error("Every category needs a name.");
    }

    if (!categoryKey) {
      throw new Error("Every category needs a key.");
    }

    if (seenKeys.has(categoryKey)) {
      throw new Error(`Duplicate category key: ${categoryKey}.`);
    }

    if (!Number.isInteger(minBirthYear) || !Number.isInteger(maxBirthYear) || minBirthYear < 1900 || maxBirthYear > 2100 || maxBirthYear < minBirthYear) {
      throw new Error(`Invalid birth year range for ${categoryName}.`);
    }

    seenKeys.add(categoryKey);

    return {
      category_key: categoryKey,
      category_name: categoryName,
      min_birth_year: minBirthYear,
      max_birth_year: maxBirthYear,
      sort_order: Number.isInteger(rule.sortOrder) ? rule.sortOrder ?? index + 1 : index + 1,
      status: normalizeRuleStatus(rule.status)
    };
  });

  return {
    seasonLabel,
    label,
    status: normalizeGridStatus(input.status),
    sourceName: normalizeText(input.sourceName) || null,
    notes: normalizeText(input.notes) || null,
    rules
  };
}

export async function listAgeCategoryGrids(admin: AdminClient = createAdminClient()) {
  const [gridsResult, rulesResult] = await Promise.all([
    admin
      .from("usasf_age_category_grids" as never)
      .select("*" as never)
      .order("season_label" as never, { ascending: false })
      .order("updated_at" as never, { ascending: false }),
    admin
      .from("usasf_age_category_rules" as never)
      .select("*" as never)
      .order("sort_order" as never, { ascending: true })
  ]);

  if (gridsResult.error) {
    if (isMissingAgeCategoryStorageError(gridsResult.error)) {
      return [];
    }

    throw new Error("Unable to load age category grids.");
  }

  if (rulesResult.error) {
    throw new Error("Unable to load age category rules.");
  }

  return ((gridsResult.data ?? []) as AgeCategoryGridRow[]).map((grid) => (
    buildAgeCategoryGridFromRows(grid, (rulesResult.data ?? []) as AgeCategoryRuleRow[])
  ));
}

export async function getActiveAgeCategoryGrid(seasonLabel: string | null | undefined, admin: AdminClient = createAdminClient()) {
  const normalizedSeasonLabel = normalizeText(seasonLabel);

  if (!normalizedSeasonLabel) {
    return null;
  }

  const { data: gridRow, error: gridError } = await admin
    .from("usasf_age_category_grids" as never)
    .select("*" as never)
    .eq("season_label", normalizedSeasonLabel as never)
    .eq("status", "active" as never)
    .order("updated_at" as never, { ascending: false })
    .limit(1);

  if (gridError) {
    if (isMissingAgeCategoryStorageError(gridError)) {
      return null;
    }

    console.error("[age-category-eligibility] Unable to load active age category grid.", gridError);
    return null;
  }

  const activeGridRow = Array.isArray(gridRow) ? gridRow[0] as AgeCategoryGridRow | undefined : null;

  if (!activeGridRow) {
    return null;
  }

  const { data: ruleRows, error: ruleError } = await admin
    .from("usasf_age_category_rules" as never)
    .select("*" as never)
    .eq("grid_id", activeGridRow.id as never)
    .eq("status", "active" as never)
    .order("sort_order" as never, { ascending: true });

  if (ruleError) {
    if (isMissingAgeCategoryStorageError(ruleError)) {
      return null;
    }

    console.error("[age-category-eligibility] Unable to load active age category rules.", ruleError);
    return null;
  }

  return buildAgeCategoryGridFromRows(activeGridRow, (ruleRows ?? []) as AgeCategoryRuleRow[]);
}

export function resolveEligibleAgeCategoriesFromGrid(
  dateOfBirth: string,
  seasonLabel: string | null | undefined,
  grid: AgeCategoryGrid | null
): AgeCategoryEligibilityResult {
  const normalizedSeasonLabel = normalizeText(seasonLabel) || null;
  const birthYear = parseBirthYear(dateOfBirth);

  if (!dateOfBirth.trim()) {
    return {
      status: "missing-birth-date",
      seasonLabel: normalizedSeasonLabel,
      gridId: grid?.id ?? null,
      gridLabel: grid?.label ?? null,
      birthYear: null,
      categories: []
    };
  }

  if (birthYear === null || Number.isNaN(birthYear)) {
    return {
      status: "invalid-birth-date",
      seasonLabel: normalizedSeasonLabel,
      gridId: grid?.id ?? null,
      gridLabel: grid?.label ?? null,
      birthYear: null,
      categories: []
    };
  }

  if (!normalizedSeasonLabel) {
    return {
      status: "missing-season",
      seasonLabel: null,
      gridId: null,
      gridLabel: null,
      birthYear,
      categories: []
    };
  }

  if (!grid) {
    return {
      status: "missing-grid",
      seasonLabel: normalizedSeasonLabel,
      gridId: null,
      gridLabel: null,
      birthYear,
      categories: []
    };
  }

  const categories = grid.rules.filter((rule) => (
    rule.status === "active"
    && birthYear >= rule.minBirthYear
    && birthYear <= rule.maxBirthYear
  ));

  return {
    status: "eligible",
    seasonLabel: normalizedSeasonLabel,
    gridId: grid.id,
    gridLabel: grid.label,
    birthYear,
    categories
  };
}

export async function getEligibleAgeCategoriesForBirthDate(dateOfBirth: string, seasonLabel: string | null | undefined) {
  const grid = await getActiveAgeCategoryGrid(seasonLabel);
  return resolveEligibleAgeCategoriesFromGrid(dateOfBirth, seasonLabel, grid);
}

export async function createAgeCategoryGrid(input: AgeCategoryGridInput, actorProfileId: string) {
  const admin = createAdminClient();
  const normalized = validateAgeCategoryGridInput(input);

  if (normalized.status === "active") {
    await admin
      .from("usasf_age_category_grids" as never)
      .update({ status: "archived" } as never)
      .eq("season_label", normalized.seasonLabel as never)
      .eq("status", "active" as never);
  }

  const { data: gridRow, error: gridError } = await admin
    .from("usasf_age_category_grids" as never)
    .insert({
      season_label: normalized.seasonLabel,
      label: normalized.label,
      status: normalized.status,
      source_name: normalized.sourceName,
      notes: normalized.notes,
      created_by_profile_id: actorProfileId
    } as never)
    .select("*" as never)
    .single();

  if (gridError || !gridRow) {
    throw new Error(gridError?.code === "23505" ? "An active grid already exists for this season." : "Unable to create age category grid.");
  }

  const gridId = (gridRow as AgeCategoryGridRow).id;
  const { error: rulesError } = await admin
    .from("usasf_age_category_rules" as never)
    .insert(normalized.rules.map((rule) => ({
      ...rule,
      grid_id: gridId
    })) as never);

  if (rulesError) {
    throw new Error("Age category grid was created, but rules could not be saved.");
  }

  return { gridId, grids: await listAgeCategoryGrids(admin) };
}

export async function updateAgeCategoryGrid(input: AgeCategoryGridInput & { gridId: string }, actorProfileId: string) {
  const admin = createAdminClient();
  const normalized = validateAgeCategoryGridInput(input);
  const gridId = normalizeText(input.gridId);

  if (!gridId) {
    throw new Error("Grid id is required.");
  }

  if (normalized.status === "active") {
    await admin
      .from("usasf_age_category_grids" as never)
      .update({ status: "archived" } as never)
      .eq("season_label", normalized.seasonLabel as never)
      .eq("status", "active" as never)
      .neq("id", gridId as never);
  }

  const { error: gridError } = await admin
    .from("usasf_age_category_grids" as never)
    .update({
      season_label: normalized.seasonLabel,
      label: normalized.label,
      status: normalized.status,
      source_name: normalized.sourceName,
      notes: normalized.notes,
      created_by_profile_id: actorProfileId
    } as never)
    .eq("id", gridId as never);

  if (gridError) {
    throw new Error(gridError.code === "23505" ? "An active grid already exists for this season." : "Unable to update age category grid.");
  }

  await admin
    .from("usasf_age_category_rules" as never)
    .delete()
    .eq("grid_id", gridId as never);

  const { error: rulesError } = await admin
    .from("usasf_age_category_rules" as never)
    .insert(normalized.rules.map((rule) => ({
      ...rule,
      grid_id: gridId
    })) as never);

  if (rulesError) {
    throw new Error("Age category rules could not be saved.");
  }

  return { gridId, grids: await listAgeCategoryGrids(admin) };
}
