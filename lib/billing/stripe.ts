import Stripe from "stripe";

import type { AuthSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

type BillingScope = "coach" | "gym";

type CustomerTarget = {
  customerId: string;
  billingScope: BillingScope;
  gymId: string | null;
};

const STRIPE_API_VERSION = "2026-02-25.clover";

let stripeClient: Stripe | null = null;

function requireEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required for Stripe billing.`);
  }

  return value;
}

export function getStripe() {
  if (!stripeClient) {
    stripeClient = new Stripe(requireEnv("STRIPE_SECRET_KEY"), {
      apiVersion: STRIPE_API_VERSION as never
    });
  }

  return stripeClient;
}

export function getStripeWebhookSecret() {
  return requireEnv("STRIPE_WEBHOOK_SECRET");
}

export function getPremiumPriceId() {
  return requireEnv("STRIPE_PREMIUM_PRICE_ID");
}

export function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

function normalizeScope(value: unknown): BillingScope {
  return value === "gym" ? "gym" : "coach";
}

async function resolveBillingGymId(
  admin: ReturnType<typeof createAdminClient>,
  session: AuthSession,
  requestedGymId?: string | null
) {
  if (requestedGymId || session.primaryGymId) {
    return requestedGymId ?? session.primaryGymId;
  }

  if (!session.roles.includes("gym")) {
    return null;
  }

  const { data: ownedGymData } = await admin
    .from("gyms" as never)
    .select("id" as never)
    .eq("owner_profile_id", session.userId as never)
    .order("created_at" as never, { ascending: true })
    .limit(1)
    .maybeSingle();

  return (ownedGymData as { id: string } | null)?.id ?? null;
}

export async function getOrCreateStripeCustomer(session: AuthSession, requestedScope: unknown, requestedGymId?: string | null): Promise<CustomerTarget> {
  const billingScope = normalizeScope(requestedScope);
  const admin = createAdminClient();
  const stripe = getStripe();

  if (billingScope === "gym") {
    if (!session.roles.includes("gym")) {
      throw new Error("A gym workspace is required to start gym billing.");
    }

    const gymId = await resolveBillingGymId(admin, session, requestedGymId);

    if (!gymId) {
      throw new Error("A gym workspace is required to start gym billing.");
    }

    const { data: gymData, error: gymError } = await admin
      .from("gyms" as never)
      .select("id, name, owner_profile_id, stripe_customer_id" as never)
      .eq("id", gymId as never)
      .maybeSingle();

    const gym = gymData as { id: string; name: string; owner_profile_id: string; stripe_customer_id: string | null } | null;

    if (gymError || !gym) {
      throw new Error("The gym workspace could not be found.");
    }

    if (session.role !== "admin" && gym.owner_profile_id !== session.userId) {
      throw new Error("Only the gym owner can manage gym billing.");
    }

    if (gym.stripe_customer_id) {
      return { customerId: gym.stripe_customer_id, billingScope, gymId: gym.id };
    }

    const customer = await stripe.customers.create({
      email: session.email || undefined,
      name: gym.name,
      metadata: {
        user_id: session.userId,
        billing_scope: "gym",
        gym_id: gym.id
      }
    });

    await admin
      .from("gyms" as never)
      .update({ stripe_customer_id: customer.id } as never)
      .eq("id", gym.id as never);

    return { customerId: customer.id, billingScope, gymId: gym.id };
  }

  const { data: profileData, error: profileError } = await admin
    .from("profiles" as never)
    .select("id, email, display_name, stripe_customer_id" as never)
    .eq("id", session.userId as never)
    .maybeSingle();

  const profile = profileData as { id: string; email: string | null; display_name: string | null; stripe_customer_id: string | null } | null;

  if (profileError || !profile) {
    throw new Error("The billing profile could not be found.");
  }

  if (profile.stripe_customer_id) {
    return { customerId: profile.stripe_customer_id, billingScope, gymId: null };
  }

  const customer = await stripe.customers.create({
    email: (profile.email ?? session.email) || undefined,
    name: profile.display_name ?? session.displayName,
    metadata: {
      user_id: session.userId,
      billing_scope: "coach"
    }
  });

  await admin
    .from("profiles" as never)
    .update({ stripe_customer_id: customer.id } as never)
    .eq("id", session.userId as never);

  return { customerId: customer.id, billingScope, gymId: null };
}

export async function createPremiumCheckoutSession(session: AuthSession, requestedScope: unknown, requestedGymId?: string | null) {
  const target = await getOrCreateStripeCustomer(session, requestedScope, requestedGymId);
  const appUrl = getAppUrl();

  return getStripe().checkout.sessions.create({
    mode: "subscription",
    customer: target.customerId,
    line_items: [
      {
        price: getPremiumPriceId(),
        quantity: 1
      }
    ],
    allow_promotion_codes: true,
    success_url: `${appUrl}/plans?checkout=success`,
    cancel_url: `${appUrl}/plans?checkout=cancelled`,
    metadata: {
      user_id: session.userId,
      billing_scope: target.billingScope,
      gym_id: target.gymId ?? ""
    },
    subscription_data: {
      metadata: {
        user_id: session.userId,
        billing_scope: target.billingScope,
        gym_id: target.gymId ?? ""
      }
    }
  });
}

export async function createBillingPortalSession(session: AuthSession) {
  const status = await resolveBillingStatus(session);
  const customerId = status.customerId;

  if (!customerId) {
    throw new Error("No Stripe customer is available for this account.");
  }

  return getStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: `${getAppUrl()}/plans`
  });
}

export type BillingStatus = {
  tier: "free" | "premium";
  scope: "individual" | "gym" | "none";
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  customerId: string | null;
};

function isPremiumStatus(status: string, currentPeriodEnd: string | null) {
  if (!["trialing", "active", "past_due", "canceled"].includes(status)) {
    return false;
  }

  if (!currentPeriodEnd) {
    return status === "trialing" || status === "active";
  }

  return new Date(currentPeriodEnd).getTime() >= Date.now();
}

export async function resolveBillingStatus(session: AuthSession): Promise<BillingStatus> {
  const admin = createAdminClient();
  const billingGymId = await resolveBillingGymId(admin, session);
  const { data } = await admin
    .from("user_memberships" as never)
    .select("status, current_period_end, cancel_at_period_end, provider_customer_id, gym_id" as never)
    .or(`user_id.eq.${session.userId},gym_id.eq.${billingGymId ?? "00000000-0000-0000-0000-000000000000"}` as never)
    .order("current_period_end" as never, { ascending: false, nullsFirst: false })
    .limit(10);

  const rows = (data ?? []) as Array<{
    status: string;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
    provider_customer_id: string | null;
    gym_id: string | null;
  }>;

  let canUsePrimaryGymBilling = false;

  if (billingGymId) {
    const [{ data: ownedGym }, { data: activeLicense }] = await Promise.all([
      admin
        .from("gyms" as never)
        .select("id" as never)
        .eq("id", billingGymId as never)
        .eq("owner_profile_id", session.userId as never)
        .maybeSingle(),
      admin
        .from("gym_coach_licenses" as never)
        .select("id" as never)
        .eq("gym_id", billingGymId as never)
        .eq("coach_profile_id", session.userId as never)
        .eq("status", "active" as never)
        .maybeSingle()
    ]);

    canUsePrimaryGymBilling = session.role === "admin" || Boolean(ownedGym || activeLicense);
  }

  const eligibleRows = rows.filter((row) => {
    if (!row.gym_id) {
      return true;
    }

    return row.gym_id === billingGymId && canUsePrimaryGymBilling;
  });

  const premiumRow = eligibleRows.find((row) => isPremiumStatus(row.status, row.current_period_end)) ?? null;
  const fallbackRow = eligibleRows[0] ?? null;
  const selectedRow = premiumRow ?? fallbackRow;

  return {
    tier: premiumRow ? "premium" : "free",
    scope: premiumRow ? (premiumRow.gym_id ? "gym" : "individual") : "none",
    status: selectedRow?.status ?? "none",
    currentPeriodEnd: selectedRow?.current_period_end ?? null,
    cancelAtPeriodEnd: selectedRow?.cancel_at_period_end ?? false,
    customerId: selectedRow?.provider_customer_id ?? null
  };
}



