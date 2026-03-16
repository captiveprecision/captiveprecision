const gymMembershipItems = [
  { label: "Plan", value: "Gym Pro" },
  { label: "Status", value: "Active" },
  { label: "Coach licenses", value: "6 total / 4 assigned" },
  { label: "Provider", value: "Whop" }
];

export default function GymSettingsPage() {
  return (
    <main className="workspace-shell page-stack">
      <section className="surface-card panel-pad settings-hero">
        <div className="metric-label">Gym settings</div>
        <h1 className="page-title settings-title">Organization settings</h1>
        <p className="page-copy">Membership, coach license allocation, and gym-level visibility controls.</p>
      </section>

      <section className="settings-layout">
        <div className="settings-main-column">
          <article className="surface-card panel-pad settings-section">
            <div className="metric-label">Coach licenses</div>
            <h2>Assignment rules</h2>
            <div className="dashboard-note-list">
              <div className="dashboard-note-item">
                <span className="dashboard-note-bullet" aria-hidden="true" />
                <p>Gym memberships define how many coach accounts can be attached to the organization.</p>
              </div>
              <div className="dashboard-note-item">
                <span className="dashboard-note-bullet" aria-hidden="true" />
                <p>Assigned coaches keep their own coach workspace while also gaining gym-linked visibility.</p>
              </div>
            </div>
          </article>
        </div>

        <aside className="settings-side-column">
          <article className="surface-card panel-pad settings-section">
            <div className="metric-label">Membership</div>
            <h2>Gym plan</h2>
            <div className="settings-detail-grid">
              {gymMembershipItems.map((item) => (
                <div key={item.label}>
                  <span className="profile-detail-label">{item.label}</span>
                  <p className="profile-detail-value">{item.value}</p>
                </div>
              ))}
            </div>
          </article>
        </aside>
      </section>
    </main>
  );
}
