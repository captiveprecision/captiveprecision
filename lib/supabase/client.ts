import { createBrowserClient } from "@supabase/ssr";

import { getClientEnv } from "@/lib/config/env";
import type { Database } from "@/lib/types/database";

export function createClient() {
  const clientEnv = getClientEnv();

  return createBrowserClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
