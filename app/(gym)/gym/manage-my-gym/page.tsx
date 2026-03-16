const assignedCoaches = [
  { name: "Edith Morales", type: "Gym coach", teams: "3 teams", athletes: "41 athletes" },
  { name: "James Lee", type: "Gym coach", teams: "2 teams", athletes: "28 athletes" },
  { name: "Ariana Scott", type: "Gym coach", teams: "4 teams", athletes: "56 athletes" },
  { name: "Maya Rivera", type: "Independent + gym", teams: "2 personal + 2 gym teams", athletes: "23 personal / 19 gym" }
];

const gymStats = [
  { label: "Active coaches", value: "4", copy: "Under assigned gym licenses" },
  { label: "Teams", value: "11", copy: "Across all licensed coaches" },
  { label: "Athletes", value: "148", copy: "Visible at organization level" }
];

export default function ManageMyGymPage() {
  return (
    <main className="workspace-shell page-stack">
      <section className="surface-card panel-pad settings-hero">
        <div className="metric-label">Manage my gym</div>
        <h1 className="page-title settings-title">Coaches, teams, athletes, and stats</h1>
        <p className="page-copy">
          This workspace centralizes the gym admin view: license allocation, assigned coaches, gym teams, and athlete visibility across the organization.
        </p>
      </section>

      <section className="dashboard-summary-grid">
        {gymStats.map((item) => (
          <article className="dashboard-summary-card" key={item.label}>
            <span className="metric-label">{item.label}</span>
            <div className="metric-value">{item.value}</div>
            <div className="metric-subtext">{item.copy}</div>
          </article>
        ))}
      </section>

      <section className="settings-layout">
        <div className="settings-main-column">
          <article className="surface-card panel-pad settings-section">
            <div className="metric-label">Assigned coaches</div>
            <h2>Coach licenses and organization access</h2>
            <div className="dashboard-update-list">
              {assignedCoaches.map((coach) => (
                <div className="dashboard-update-item" key={coach.name}>
                  <div className="profile-chip-row">
                    <span className="profile-chip">{coach.name}</span>
                    <span className="profile-chip">{coach.type}</span>
                  </div>
                  <p className="settings-row-copy">{coach.teams}</p>
                  <p className="settings-row-copy">{coach.athletes}</p>
                </div>
              ))}
            </div>
          </article>
        </div>

        <aside className="settings-side-column">
          <article className="surface-card panel-pad settings-section">
            <div className="metric-label">Modules</div>
            <h2>Scope</h2>
            <div className="dashboard-note-list">
              <div className="dashboard-note-item">
                <span className="dashboard-note-bullet" aria-hidden="true" />
                <p>Coach directory and license assignment.</p>
              </div>
              <div className="dashboard-note-item">
                <span className="dashboard-note-bullet" aria-hidden="true" />
                <p>Gym teams and shared athlete visibility.</p>
              </div>
              <div className="dashboard-note-item">
                <span className="dashboard-note-bullet" aria-hidden="true" />
                <p>Cross-coach statistics and organization-level reporting.</p>
              </div>
            </div>
          </article>
        </aside>
      </section>
    </main>
  );
}
