import Link from "next/link";

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
  { label: "Status", value: "Active" },
  { label: "Renewal", value: "April 12, 2026" },
  { label: "Provider", value: "Whop" }
];

export default function CoachSettingsPage() {
  return (
    <main className="workspace-shell page-stack">
      <section className="surface-card panel-pad settings-hero">
        <div className="settings-hero-top">
          <div>
            <div className="metric-label">Settings</div>
            <h1 className="page-title settings-title">Platform settings</h1>
            <p className="page-copy">
              This is a more realistic product shell for profile controls, membership management, notifications, and future preferences.
            </p>
          </div>

          <Link className="profile-edit-button" href="/coach/profile/edit">
            Edit profile
          </Link>
        </div>
      </section>

      <section className="settings-layout">
        <div className="settings-main-column">
          <article className="surface-card panel-pad settings-section">
            <div className="metric-label">Profile</div>
            <h2>Account identity</h2>
            <p className="muted-copy">
              Update the core information shown throughout the platform, including name, gym, role, teams, and profile image.
            </p>
            <div className="settings-inline-actions">
              <Link className="profile-edit-button" href="/coach/profile/edit">
                Open profile editor
              </Link>
            </div>
          </article>

          <article className="surface-card panel-pad settings-section">
            <div className="metric-label">Notifications</div>
            <h2>Notification preferences</h2>
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
          </article>

          <article className="surface-card panel-pad settings-section">
            <div className="metric-label">Preferences</div>
            <h2>Workspace defaults</h2>
            <div className="settings-preference-grid">
              <div className="settings-preference-card">
                <span className="settings-row-title">Default view</span>
                <p className="settings-row-copy">Dashboard-first workspace with premium tools pinned on top.</p>
              </div>
              <div className="settings-preference-card">
                <span className="settings-row-title">Saved results</span>
                <p className="settings-row-copy">Keep local placeholders until account persistence is turned back on.</p>
              </div>
              <div className="settings-preference-card">
                <span className="settings-row-title">Language</span>
                <p className="settings-row-copy">English product shell with Spanish collaboration during setup.</p>
              </div>
              <div className="settings-preference-card">
                <span className="settings-row-title">Theme</span>
                <p className="settings-row-copy">Premium light interface based on the cheer calculator system.</p>
              </div>
            </div>
          </article>
        </div>

        <aside className="settings-side-column">
          <article className="surface-card panel-pad settings-section">
            <div className="metric-label">Membership</div>
            <h2>Subscription control</h2>
            <div className="settings-detail-grid">
              {membershipItems.map((item) => (
                <div key={item.label}>
                  <span className="profile-detail-label">{item.label}</span>
                  <p className="profile-detail-value">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="settings-inline-actions">
              <button type="button" className="profile-edit-button">
                Manage membership
              </button>
            </div>
          </article>

          <article className="surface-card panel-pad settings-section">
            <div className="metric-label">Security</div>
            <h2>Access controls</h2>
            <div className="settings-security-list">
              <div className="settings-security-item">
                <span className="settings-row-title">Password and login</span>
                <p className="settings-row-copy">Placeholder until authentication is active again.</p>
              </div>
              <div className="settings-security-item">
                <span className="settings-row-title">Connected services</span>
                <p className="settings-row-copy">Future section for Whop, Supabase, and platform integrations.</p>
              </div>
            </div>
          </article>
        </aside>
      </section>
    </main>
  );
}
