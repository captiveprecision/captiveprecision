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
  { label: "Renewal", value: "April 12, 2026" },
  { label: "Provider", value: "Whop" }
];

export default function CoachSettingsPage() {
  return (
    <main className="workspace-shell page-stack">
      <PageHero
        className="settings-hero"
        contentClassName="settings-hero"
        eyebrow="Settings"
        title="Platform settings"
        description="This is a more realistic product shell for profile controls, membership management, notifications, and future preferences."
        actions={<ButtonLink variant="ghost" href="/coach/profile/edit" leadingIcon={<Pencil />}>Edit Profile</ButtonLink>}
      />

      <PageColumns className="settings-layout">
        <PageMainColumn className="settings-main-column">
          <PageHero
            className="settings-section"
            contentClassName="settings-section"
            eyebrow="Profile"
            title="Account identity"
            description="Update the core information shown throughout the platform, including name, gym, role, teams, and profile image."
            actions={<ButtonLink variant="ghost" href="/coach/profile/edit" leadingIcon={<Pencil />}>Open profile editor</ButtonLink>}
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
                  <div key={item.title} className="settings-toggle-row">
                    <div>
                      <h3>{item.title}</h3>
                      <p>{item.description}</p>
                    </div>
                    <Button variant={item.enabled ? "primary" : "secondary"} size="sm">
                      {item.enabled ? "Enabled" : "Enable"}
                    </Button>
                  </div>
                ))}
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
                  <h2 className="ui-section-header__title">Current plan</h2>
                </div>
              </div>
              <DetailGrid>
                {membershipItems.map((item) => (
                  <div key={item.label} className="settings-detail-row">
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </DetailGrid>
              <Badge variant="accent">Premium member</Badge>
            </div>
          </Card>
        </PageSideColumn>
      </PageColumns>
    </main>
  );
}
