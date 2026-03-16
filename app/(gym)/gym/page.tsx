const gymHighlights = [
  "4 coaches currently assigned under active gym licenses.",
  "11 teams tracked across all assigned coaches.",
  "148 athletes visible at the gym level.",
  "United Scoring System is the active evaluation baseline."
];

export default function GymDashboardPage() {
  return (
    <main className="workspace-shell page-stack">
      <section className="surface-card panel-pad settings-hero">
        <div className="metric-label">Gym dashboard</div>
        <h1 className="page-title settings-title">Gym command center</h1>
        <p className="page-copy">
          Manage licensed coaches, review teams and athletes across the organization, and keep the gym aligned around one shared toolset.
        </p>
      </section>

      <section className="settings-layout">
        <div className="settings-main-column">
          <article className="surface-card panel-pad settings-section">
            <div className="metric-label">Overview</div>
            <h2>Organization snapshot</h2>
            <div className="dashboard-note-list">
              {gymHighlights.map((item) => (
                <div className="dashboard-note-item" key={item}>
                  <span className="dashboard-note-bullet" aria-hidden="true" />
                  <p>{item}</p>
                </div>
              ))}
            </div>
          </article>
        </div>

        <aside className="settings-side-column">
          <article className="surface-card panel-pad settings-section">
            <div className="metric-label">Membership</div>
            <h2>Gym membership</h2>
            <div className="settings-detail-grid">
              <div>
                <span className="profile-detail-label">Plan</span>
                <p className="profile-detail-value">Gym Pro</p>
              </div>
              <div>
                <span className="profile-detail-label">Coach licenses</span>
                <p className="profile-detail-value">4 active / 6 total</p>
              </div>
              <div>
                <span className="profile-detail-label">Visibility</span>
                <p className="profile-detail-value">All gym coaches, teams, and athletes</p>
              </div>
            </div>
          </article>
        </aside>
      </section>
    </main>
  );
}
