import { createAdminClient } from "@/lib/supabase/admin";

export async function hasPremiumAccess(userId: string, toolSlug: string) {
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("user_has_tool_access" as never, {
    p_user_id: userId,
    p_tool_slug: toolSlug
  } as never);

  if (error) {
    return false;
  }

  return Boolean(data);
}
