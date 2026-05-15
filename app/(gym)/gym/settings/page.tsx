import { revalidatePath } from "next/cache";

import { BillingPortalButton, CheckoutButton } from "@/components/billing/checkout-button";
import { Badge, Button, ButtonLink, Card, CardContent, SectionHeader } from "@/components/ui";
import { getAuthSession, requireAuthSession } from "@/lib/auth/session";
import { resolveBillingStatus } from "@/lib/billing/stripe";
import { canManageGymAdministration, resolveGymAccessContext } from "@/lib/services/gym-access";
import {
  getGymRegistrationNumberModeByGymId,
  normalizeGymRegistrationNumberMode,
  saveGymRegistrationNumberMode
} from "@/lib/services/gym-registration-settings";

export const dynamic = "force-dynamic";

function formatPeriodEnd(value: string | null) {
  return value ? new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Not scheduled";
}

async function updateRegistrationNumberMode(formData: FormData) {
  "use server";

  const session = await requireAuthSession("gym");
  const access = await resolveGymAccessContext(session, { ensureOwnerSeat: true });

  if (!access || !canManageGymAdministration(access)) {
    throw new Error("Program Director access is required.");
  }

  const mode = normalizeGymRegistrationNumberMode(formData.get("registrationNumberMode"));
  await saveGymRegistrationNumberMode(access.gym.id, mode);

  revalidatePath("/gym/settings");
  revalidatePath("/gym/cheer-planner");
  revalidatePath("/gym/manage-my-gym/athletes");
}

export default async function GymSettingsPage() {
  const session = await getAuthSession();
  const billingStatus = session ? await resolveBillingStatus(session) : null;
  const gymAccess = session ? await resolveGymAccessContext(session) : null;
  const isPremium = billingStatus?.tier === "premium";
  const canManageBilling = Boolean(billingStatus?.customerId);
  const gymId = session?.primaryGymId ?? null;
  const registrationNumberMode = await getGymRegistrationNumberModeByGymId(gymAccess?.gym.id ?? gymId);
  const canManageRegistrationSettings = canManageGymAdministration(gymAccess);

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

          <Card radius="panel" className="settings-section">
            <CardContent className="settings-section">
              <SectionHeader
                eyebrow="Athletes"
                title="Registration numbers"
                description="Choose whether athlete registration numbers are generated automatically or entered manually during athlete intake."
              />
              <form action={updateRegistrationNumberMode} className="settings-security-list">
                <label className="settings-security-item">
                  <div className="settings-card-topline">
                    <span className="settings-row-title">Auto assign</span>
                    <Badge variant={registrationNumberMode === "auto" ? "accent" : "subtle"}>Default</Badge>
                  </div>
                  <p className="settings-row-copy">Captive Precision assigns the next registration number when the athlete is saved.</p>
                  <input
                    type="radio"
                    name="registrationNumberMode"
                    value="auto"
                    defaultChecked={registrationNumberMode === "auto"}
                    disabled={!canManageRegistrationSettings}
                  />
                </label>
                <label className="settings-security-item">
                  <div className="settings-card-topline">
                    <span className="settings-row-title">Manual entry</span>
                    <Badge variant={registrationNumberMode === "manual" ? "accent" : "subtle"}>Gym choice</Badge>
                  </div>
                  <p className="settings-row-copy">Allow staff to enter a registration number manually. Blank values still fall back to auto-assignment.</p>
                  <input
                    type="radio"
                    name="registrationNumberMode"
                    value="manual"
                    defaultChecked={registrationNumberMode === "manual"}
                    disabled={!canManageRegistrationSettings}
                  />
                </label>
                <div className="settings-inline-actions">
                  <Button type="submit" disabled={!canManageRegistrationSettings}>Save registration settings</Button>
                  {!canManageRegistrationSettings ? (
                    <span className="metric-subtext">Program Director access is required to change this setting.</span>
                  ) : null}
                </div>
              </form>
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
