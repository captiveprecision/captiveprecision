import { Badge, Card, CardContent, SectionHeader } from "@/components/ui";

const gymMembershipItems = [
  { label: "Plan", value: "Gym Pro" },
  { label: "Status", value: "Active" },
  { label: "Coach licenses", value: "6 total / 4 assigned" },
  { label: "Provider", value: "Whop" }
];

export default function GymSettingsPage() {
  return (
    <main className="workspace-shell page-stack">
      <Card radius="panel" className="settings-hero">
        <CardContent className="settings-hero">
          <SectionHeader
            eyebrow="Gym settings"
            title="Organization settings"
            description="Membership, coach license allocation, and gym-level visibility controls."
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
                  <p className="settings-row-copy">Gym memberships define how many coach accounts can be attached to the organization.</p>
                </div>
                <div className="settings-security-item">
                  <div className="settings-card-topline">
                    <span className="settings-row-title">Coach visibility</span>
                    <Badge variant="subtle">Shared</Badge>
                  </div>
                  <p className="settings-row-copy">Assigned coaches keep their own coach workspace while also gaining gym-linked visibility.</p>
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
            </CardContent>
          </Card>
        </aside>
      </section>
    </main>
  );
}
