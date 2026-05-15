import { AdminAgeCategoriesManager } from "@/components/admin/admin-age-categories-manager";
import { requireAuthSession } from "@/lib/auth/session";
import { listAgeCategoryGrids } from "@/lib/services/age-category-eligibility";

export const dynamic = "force-dynamic";

export default async function AdminAgeCategoriesPage() {
  await requireAuthSession("admin");

  const grids = await listAgeCategoryGrids();

  return <AdminAgeCategoriesManager initialGrids={grids} />;
}
