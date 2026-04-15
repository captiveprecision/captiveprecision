import type { Route } from "next";

import { CheckoutButton, BillingPortalButton } from "@/components/billing/checkout-button";
import { Badge, ButtonLink, Card, CardContent, PageHero, SectionHeader } from "@/components/ui";
import { getAuthSession } from "@/lib/auth/session";
import { resolveBillingStatus } from "@/lib/billing/stripe";

function formatPeriodEnd(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Not scheduled";
}

export default async function PlansPage() {
  const session = await getAuthSession();
  const status = session ? await resolveBillingStatus(session) : null;
  const checkoutScope = session?.roles.includes("gym") ? "gym" : "coach";
  const checkoutGymId = checkoutScope === "gym" ? session?.primaryGymId ?? null : null;
  const toolsHref = session?.roles.includes("gym") ? "/gym/tools" : session?.roles.includes("coach") ? "/coach/tools" : "/tools";
  const plannerHref = session?.roles.includes("gym") ? "/gym/cheer-planner" : session?.roles.includes("coach") ? "/coach/cheer-planner" : "/select-workspace";
  const isPremium = status?.tier === "premium";

  return (
    <main className="workspace-shell page-stack plans-shell">
      <PageHero
        className="plans-hero"
        contentClassName="plans-hero__content"
        eyebrow="Plans"
        title="Choose your workspace access"
        description="Keep the free calculators moving, or unlock premium editing, team records, and the full Cheer Planner workflow."
        actions={isPremium ? <Badge variant="accent">Premium active</Badge> : <Badge variant="subtle">Free plan</Badge>}
      >
        <div className="plans-hero-actions">
          {session ? (
            isPremium ? <BillingPortalButton /> : <CheckoutButton scope={checkoutScope} gymId={checkoutGymId} label="Upgrade today" />
          ) : (
            <ButtonLink href="/" variant="primary">Sign in to upgrade</ButtonLink>
          )}
          <ButtonLink href={toolsHref as Route} variant="secondary">Open free tools</ButtonLink>
        </div>
      </PageHero>

      <section className="plans-layout" aria-label="Membership plans">
        <div className="plans-plan-grid">
          <Card radius="panel" className="plans-card plans-card--free">
            <CardContent className="plans-card__content">
              <div className="plans-card__topline">
                <Badge variant="subtle">Free</Badge>
                <span>No payment required</span>
              </div>
              <SectionHeader title="Free" description="Use the live tools and review the Planner work you already created." />
              <ul className="plans-list">
                <li>Cheer Score Calculator</li>
                <li>Full-out Evaluator</li>
                <li>View and download previous Cheer Planner work</li>
              </ul>
              <div className="plans-card__footer">
                <ButtonLink href={toolsHref as Route} variant="secondary">Open free tools</ButtonLink>
                <span>Saving team records is premium.</span>
              </div>
            </CardContent>
          </Card>

          <Card radius="panel" className="plans-card plans-card--premium">
            <CardContent className="plans-card__content">
              <div className="plans-card__topline">
                <Badge variant="accent">Premium</Badge>
                <span>{checkoutScope === "gym" ? "Gym workspace" : "Coach workspace"}</span>
              </div>
              <SectionHeader title="Premium" description="Edit Cheer Planner and save team records across the workspace." />
              <ul className="plans-list plans-list--premium">
                <li>Cheer Planner editing</li>
                <li>Tryouts, Team Builder, Skill Planner, Routine Builder, Season Planner</li>
                <li>Saved team records for Score Calculator and Full-out Evaluator</li>
                <li>Stripe-hosted checkout and billing management</li>
              </ul>
              <div className="plans-card__footer">
                {session ? (
                  isPremium ? <ButtonLink href={plannerHref as Route} variant="primary">Open Cheer Planner</ButtonLink> : <CheckoutButton scope={checkoutScope} gymId={checkoutGymId} />
                ) : (
                  <ButtonLink href="/" variant="primary">Sign in to upgrade</ButtonLink>
                )}
                <span>One Premium plan for now.</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card radius="panel" className="plans-status-card">
          <CardContent className="plans-status-card__content">
            <SectionHeader
              eyebrow="Current plan"
              title={isPremium ? "Premium" : "Free"}
              description={isPremium ? "Your premium access is active for this billing scope." : "Upgrade when you are ready to keep editing and saving team records."}
            />
            <div className="plans-detail-list">
              <div><span>Status</span><strong>{status?.status ?? "none"}</strong></div>
              <div><span>Scope</span><strong>{status?.scope ?? "none"}</strong></div>
              <div><span>Period end</span><strong>{formatPeriodEnd(status?.currentPeriodEnd)}</strong></div>
            </div>
            <div className="plans-status-actions">
              {session ? (
                isPremium ? <BillingPortalButton /> : <CheckoutButton scope={checkoutScope} gymId={checkoutGymId} label="Upgrade to Premium" />
              ) : (
                <ButtonLink href="/" variant="primary">Sign in</ButtonLink>
              )}
              <ButtonLink href={plannerHref as Route} variant="ghost">Go to workspace</ButtonLink>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
