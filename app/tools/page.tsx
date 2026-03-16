import Link from "next/link";

export default function ToolsPage() {
  return (
    <main className="workspace-shell page-stack">
      <section className="surface-card panel-pad">
        <div className="metric-label">Tools</div>
        <h1 className="page-title">Tools</h1>
        <p className="page-copy">Coming soon.</p>
      </section>

      <section className="settings-layout">
        <article className="surface-card panel-pad settings-section">
          <div className="metric-label">Available now</div>
          <h2>Cheer Score</h2>
          <p className="muted-copy">The first active tool in the platform.</p>
          <div className="settings-inline-actions">
            <Link className="profile-edit-button" href="/tools/cheer-score-calculator">
              Open tool
            </Link>
          </div>
        </article>

        <article className="surface-card panel-pad settings-section">
          <div className="metric-label">Coming soon</div>
          <h2>Full out evaluator</h2>
          <p className="muted-copy">Placeholder for a future performance review workflow.</p>
        </article>

        <article className="surface-card panel-pad settings-section">
          <div className="metric-label">Coming soon</div>
          <h2>Cheer Planner</h2>
          <p className="muted-copy">Placeholder for planning routines, sessions, and progression.</p>
        </article>
      </section>
    </main>
  );
}
