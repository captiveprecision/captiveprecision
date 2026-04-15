import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { getStripe, getStripeWebhookSecret } from "@/lib/billing/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type SubscriptionShape = Stripe.Subscription & {
  current_period_start?: number;
  current_period_end?: number;
};

function toIsoFromSeconds(value: unknown) {
  return typeof value === "number" ? new Date(value * 1000).toISOString() : null;
}

function asCustomerId(customer: string | Stripe.Customer | Stripe.DeletedCustomer | null) {
  if (!customer) {
    return null;
  }

  return typeof customer === "string" ? customer : customer.id;
}

function subscriptionMetadata(subscription: Stripe.Subscription) {
  return subscription.metadata ?? {};
}

async function getPremiumPlanId() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("membership_plans" as never)
    .select("id" as never)
    .eq("code", "premium" as never)
    .maybeSingle();

  const plan = data as { id: string } | null;

  if (error || !plan) {
    throw new Error("Premium membership plan is missing. Run migration 009_stripe_billing.sql first.");
  }

  return plan.id;
}

async function upsertMembershipFromSubscription(subscription: Stripe.Subscription) {
  const admin = createAdminClient();
  const planId = await getPremiumPlanId();
  const metadata = subscriptionMetadata(subscription);
  const userId = metadata.user_id;
  const billingScope = metadata.billing_scope === "gym" ? "gym" : "coach";
  const gymId = billingScope === "gym" && metadata.gym_id ? metadata.gym_id : null;
  const customerId = asCustomerId(subscription.customer);
  const shaped = subscription as SubscriptionShape;

  if (!userId || !customerId) {
    throw new Error("Stripe subscription is missing required user or customer metadata.");
  }

  if (gymId) {
    await admin
      .from("gyms" as never)
      .update({ stripe_customer_id: customerId } as never)
      .eq("id", gymId as never);
  } else {
    await admin
      .from("profiles" as never)
      .update({ stripe_customer_id: customerId } as never)
      .eq("id", userId as never);
  }

  const payload = {
    user_id: userId,
    gym_id: gymId,
    membership_plan_id: planId,
    provider: "stripe",
    provider_customer_id: customerId,
    provider_membership_id: subscription.id,
    status: subscription.status,
    current_period_start: toIsoFromSeconds(shaped.current_period_start),
    current_period_end: toIsoFromSeconds(shaped.current_period_end),
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    metadata: {
      billingScope,
      stripePriceId: subscription.items.data[0]?.price?.id ?? null,
      latestInvoiceId: typeof subscription.latest_invoice === "string" ? subscription.latest_invoice : subscription.latest_invoice?.id ?? null
    }
  };

  const { error } = await admin
    .from("user_memberships" as never)
    .upsert(payload as never, { onConflict: "provider_membership_id" as never });

  if (error) {
    throw new Error(error.message);
  }
}

async function processStripeEvent(event: Stripe.Event) {
  const stripe = getStripe();

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;

    if (subscriptionId) {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      await upsertMembershipFromSubscription(subscription);
    }

    return;
  }

  if (
    event.type === "customer.subscription.created"
    || event.type === "customer.subscription.updated"
    || event.type === "customer.subscription.deleted"
  ) {
    await upsertMembershipFromSubscription(event.data.object as Stripe.Subscription);
    return;
  }

  if (event.type === "invoice.payment_succeeded" || event.type === "invoice.payment_failed") {
    const invoice = event.data.object as {
      subscription?: string | { id?: string } | null;
      parent?: { subscription_details?: { subscription?: string | null } } | null;
    };
    const subscriptionId = typeof invoice.subscription === "string"
      ? invoice.subscription
      : invoice.subscription?.id ?? invoice.parent?.subscription_details?.subscription ?? null;

    if (subscriptionId) {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      await upsertMembershipFromSubscription(subscription);
    }
  }
}

export async function POST(request: Request) {
  const stripe = getStripe();
  const signature = request.headers.get("stripe-signature");
  const rawBody = await request.text();

  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, getStripeWebhookSecret());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid Stripe webhook signature.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error: insertError } = await admin
    .from("stripe_webhook_events" as never)
    .insert({
      stripe_event_id: event.id,
      event_type: event.type,
      payload: event as unknown as Record<string, unknown>
    } as never);

  if (insertError?.code === "23505") {
    return NextResponse.json({ received: true, duplicate: true });
  }

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  try {
    await processStripeEvent(event);
    await admin
      .from("stripe_webhook_events" as never)
      .update({ processed_at: new Date().toISOString(), processing_error: null } as never)
      .eq("stripe_event_id", event.id as never);

    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to process Stripe webhook.";
    await admin
      .from("stripe_webhook_events" as never)
      .update({ processing_error: message } as never)
      .eq("stripe_event_id", event.id as never);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
