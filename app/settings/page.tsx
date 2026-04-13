import { Pencil } from "lucide-react";
import { Badge, Button, ButtonLink, Card, DetailGrid, PageColumns, PageHero, PageMainColumn, PageSideColumn } from "@/components/ui";

const notificationItems = [
  {
    title: "Email updates",
    description: "Product announcements, releases, and workflow updates.",
    enabled: true
  },
  {
    title: "Membership reminders",
    description: "Renewal notices, billing events, and subscription changes.",
    enabled: true
  },
  {
    title: "Tool alerts",
    description: "New calculators, saved-result reminders, and premium releases.",
    enabled: false
  }
];

const membershipItems = [
  { label: "Plan", value: "Premium Monthly" },
  { label: "Coach type", value: "Independent Coach" },
  { label: "Status", value: "Active" },
  { label: "Renewal", value: "April 12, 2026" }
];

export default function SettingsPage() {
  return (
    <main className="workspace-shell page-stack">
      <PageHero
        className="settings-hero"
        contentClassName="settings-hero"
        eyebrow="Settings"
        title="Platform settings"
        description="This is a more realistic product shell for profile controls, membership management, notifications, and future preferences."
        actions={<ButtonLink variant="ghost" href="/profile/edit" leadingIcon={<Pencil />}>Edit Profile</ButtonLink>}
      />

      <PageColumns className="settings-layout">
        <PageMainColumn className="settings-main-column">
          <PageHero
            className="settings-section"
            contentClassName="settings-section"
            eyebrow="Profile"
            title="Account identity"
            description="Update the core information shown throughout the platform, including name, gym, role, teams, and profile image."
            actions={<ButtonLink variant="secondary" href="/profile/edit">Open profile editor</ButtonLink>}
          />

          <Card radius="panel" className="settings-section">
            <div className="ui-card__content settings-section">
              <div className="ui-section-header">
                <div className="ui-section-header__copy">
                  <span className="ui-section-header__eyebrow">Notifications</span>
                  <h2 className="ui-section-header__title">Notification preferences</h2>
                </div>
              </div>
              <div className="settings-toggle-list">
                {notificationItems.map((item) => (
                  <div className="settings-toggle-row" key={item.title}>
                    <div>
                      <p className="settings-row-title">{item.title}</p>
                      <p className="settings-row-copy">{item.description}</p>
                    </div>
                    <button type="button" className="settings-toggle" data-enabled={item.enabled} aria-pressed={item.enabled}>
                      <span className="settings-toggle-knob" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card radius="panel" className="settings-section">
            <div className="ui-card__content settings-section">
              <div className="ui-section-header">
                <div className="ui-section-header__copy">
                  <span className="ui-section-header__eyebrow">Preferences</span>
                  <h2 className="ui-section-header__title">Workspace defaults</h2>
                </div>
              </div>
              <div className="settings-preference-grid">
                <Card variant="subtle" className="settings-preference-card">
                  <div className="settings-preference-card__content">
                    <span className="settings-row-title">Default view</span>
                    <p className="settings-row-copy">Dashboard-first workspace with premium tools pinned on top.</p>
                  </div>
                </Card>
                <Card variant="subtle" className="settings-preference-card">
                  <div className="settings-preference-card__content">
                    <span className="settings-row-title">Saved results</span>
                    <p className="settings-row-copy">Keep local placeholders until account persistence is turned back on.</p>
                  </div>
                </Card>
                <Card variant="subtle" className="settings-preference-card">
                  <div className="settings-preference-card__content">
                    <span className="settings-row-title">Language</span>
                    <p className="settings-row-copy">English product shell with Spanish collaboration during setup.</p>
                  </div>
                </Card>
                <Card variant="subtle" className="settings-preference-card">
                  <div className="settings-preference-card__content">
                    <span className="settings-row-title">Theme</span>
                    <p className="settings-row-copy">Premium light interface based on the cheer calculator system.</p>
                  </div>
                </Card>
              </div>
            </div>
          </Card>

          <Card radius="panel" className="settings-section">
            <div className="ui-card__content settings-section">
              <div className="ui-section-header">
                <div className="ui-section-header__copy">
                  <span className="ui-section-header__eyebrow">Coach classification</span>
                  <h2 className="ui-section-header__title">Membership states</h2>
                </div>
              </div>
              <div className="settings-preference-grid settings-preference-grid--compact">
                <Card variant="subtle" className="settings-preference-card">
                  <div className="settings-preference-card__content">
                    <div className="settings-card-topline">
                      <span className="settings-row-title">Independent coach</span>
                      <Badge variant="subtle">Personal</Badge>
                    </div>
                    <p className="settings-row-copy">Keeps personal teams, tools, and records under an individual membership.</p>
                  </div>
                </Card>
                <Card variant="subtle" className="settings-preference-card">
                  <div className="settings-preference-card__content">
                    <div className="settings-card-topline">
                      <span className="settings-row-title">Gym-assigned coach</span>
                      <Badge variant="accent">Linked</Badge>
                    </div>
                    <p className="settings-row-copy">Keeps personal teams and also sees gym-assigned teams once a gym license is attached.</p>
                  </div>
                </Card>
              </div>
            </div>
          </Card>
        </PageMainColumn>

        <PageSideColumn className="settings-side-column">
          <Card radius="panel" className="settings-section">
            <div className="ui-card__content settings-section">
              <div className="ui-section-header">
                <div className="ui-section-header__copy">
                  <span className="ui-section-header__eyebrow">Membership</span>
                  <h2 className="ui-section-header__title">Subscription control</h2>
                </div>
                <div className="ui-section-header__actions">
                  <Button variant="secondary">Manage membership</Button>
                </div>
              </div>
              <DetailGrid className="settings-detail-grid">
                {membershipItems.map((item) => (
                  <div key={item.label} className="settings-detail-item">
                    <span className="profile-detail-label">{item.label}</span>
                    <p className="profile-detail-value">{item.value}</p>
                  </div>
                ))}
              </DetailGrid>
            </div>
          </Card>

          <Card radius="panel" className="settings-section">
            <div className="ui-card__content settings-section">
              <div className="ui-section-header">
                <div className="ui-section-header__copy">
                  <span className="ui-section-header__eyebrow">Security</span>
                  <h2 className="ui-section-header__title">Access controls</h2>
                </div>
              </div>
              <div className="settings-security-list">
                <div className="settings-security-item">
                  <span className="settings-row-title">Password and login</span>
                  <p className="settings-row-copy">Placeholder until authentication is active again.</p>
                </div>
                <div className="settings-security-item">
                  <span className="settings-row-title">Connected services</span>
                  <p className="settings-row-copy">Future section for billing, Supabase, and platform integrations.</p>
                </div>
              </div>
            </div>
          </Card>
        </PageSideColumn>
      </PageColumns>
    </main>
  );
}
