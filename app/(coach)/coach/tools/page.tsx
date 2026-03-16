import Link from "next/link";

export default function CoachToolsPage() {
  return (
    <main className="workspace-shell page-stack">
      <section className="surface-card panel-pad settings-hero">
        <div className="metric-label">Tools</div>
        <h1 className="page-title settings-title">Tools</h1>
        <p className="page-copy">Available tools and upcoming releases.</p>
      </section>

      <section className="info-grid">
        <article className="surface-card panel-pad settings-section">
          <div className="metric-label">Live</div>
          <h2>Cheer Score</h2>
          <p className="muted-copy">The first active premium tool in the coach workspace.</p>
          <div className="settings-inline-actions">
            <Link className="profile-edit-button" href="/coach/tools/cheer-score-calculator">
              Open tool
            </Link>
          </div>
        </article>

        <article className="surface-card panel-pad settings-section">
          <div className="metric-label">Coming soon</div>
          <h2>Full Out Evaluator</h2>
          <p className="muted-copy">Coming soon.</p>
        </article>

        <article className="surface-card panel-pad settings-section">
          <div className="metric-label">Coming soon</div>
          <h2>Cheer Planner</h2>
          <p className="muted-copy">Coming soon.</p>
        </article>
      </section>
    </main>
  );
}
