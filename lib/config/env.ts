import { z } from "zod";

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url()
});

const serverSchema = clientSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  WHOP_API_KEY: z.string().min(1).optional(),
  WHOP_WEBHOOK_SECRET: z.string().min(1).optional()
});

function readClientEnv() {
  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL
  };
}

function readServerEnv() {
  return {
    ...readClientEnv(),
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    WHOP_API_KEY: process.env.WHOP_API_KEY,
    WHOP_WEBHOOK_SECRET: process.env.WHOP_WEBHOOK_SECRET
  };
}

export function getClientEnv() {
  return clientSchema.parse(readClientEnv());
}

export function getServerEnv() {
  return serverSchema.parse(readServerEnv());
}
