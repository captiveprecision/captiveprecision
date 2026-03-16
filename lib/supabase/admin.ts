import { createClient } from "@supabase/supabase-js";

import { serverEnv } from "@/lib/config/env";
import type { Database } from "@/lib/types/database";

export function createAdminClient() {
  return createClient<Database>(
    serverEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    }
  );
}
