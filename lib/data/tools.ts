import { createAdminClient } from "@/lib/supabase/admin";

export async function getToolCatalog() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("tools")
    .select("id, slug, name, description, is_premium")
    .eq("status", "active")
    .order("sort_order", { ascending: true });

  if (error) {
    return [];
  }

  return data;
}
