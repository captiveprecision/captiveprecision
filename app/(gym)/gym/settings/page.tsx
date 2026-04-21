import { BillingPortalButton, CheckoutButton } from "@/components/billing/checkout-button";
import { Badge, ButtonLink, Card, CardContent, SectionHeader } from "@/components/ui";
import { getAuthSession } from "@/lib/auth/session";
import { resolveBillingStatus } from "@/lib/billing/stripe";

function formatPeriodEnd(value: string | null) {
  return value ? new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Not scheduled";
}

export default async function GymSettingsPage() {
  const session = await getAuthSession();
  const billingStatus = session ? await resolveBillingStatus(session) : null;
  const isPremium = billingStatus?.tier === "premium";
  const canManageBilling = Boolean(billingStatus?.customerId);
  const gymId = session?.primaryGymId ?? null;

  const gymMembershipItems = [
    { label: "Plan", value: isPremium ? "Premium" : "Free" },
    { label: "Status", value: billingStatus?.status ?? "none" },
    { label: "Scope", value: billingStatus?.scope ?? "none" },
    { label: "Period end", value: formatPeriodEnd(billingStatus?.currentPeriodEnd ?? null) }
  ];

  return (
    <main className="workspace-shell page-stack">
      <Card radius="panel" className="settings-hero">
        <CardContent className="settings-hero">
          <SectionHeader
            eyebrow="Gym settings"
            title="Organization settings"
            description="Membership, coach license allocation, and gym-level visibility controls."
            actions={<ButtonLink href="/plans" variant="secondary">View plans</ButtonLink>}
          />
        </CardContent>
      </Card>

      <section className="settings-layout">
        <div className="settings-main-column">
          <Card radius="panel" className="settings-section">
            <CardContent className="settings-section">
              <SectionHeader eyebrow="Coach licenses" title="Assignment rules" />
              <div className="settings-security-list">
                <div className="settings-security-item">
                  <div className="settings-card-topline">
                    <span className="settings-row-title">License capacity</span>
                    <Badge variant="accent">Gym plan</Badge>
                  </div>
                  <p className="settings-row-copy">Gym memberships unlock premium access for coaches with active manual licenses.</p>
                </div>
                <div className="settings-security-item">
                  <div className="settings-card-topline">
                    <span className="settings-row-title">Coach visibility</span>
                    <Badge variant="subtle">Shared</Badge>
                  </div>
                  <p className="settings-row-copy">Assigned coaches keep their own coach workspace while also gaining gym-linked premium visibility.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="settings-side-column">
          <Card radius="panel" className="settings-section">
            <CardContent className="settings-section">
              <SectionHeader eyebrow="Membership" title="Gym plan" />
              <div className="settings-detail-grid">
                {gymMembershipItems.map((item) => (
                  <div key={item.label} className="settings-detail-item">
                    <span className="profile-detail-label">{item.label}</span>
                    <p className="profile-detail-value">{item.value}</p>
                  </div>
                ))}
              </div>
              <Badge variant={isPremium ? "accent" : "subtle"}>{isPremium ? "Premium active" : "Free plan"}</Badge>
              <div className="settings-inline-actions">
                {isPremium ? (canManageBilling ? <BillingPortalButton /> : null) : <CheckoutButton scope="gym" gymId={gymId} label="Upgrade gym" />}
                <ButtonLink href="/plans" variant="secondary">View plans</ButtonLink>
              </div>
            </CardContent>
          </Card>
        </aside>
      </section>
    </main>
  );
}
