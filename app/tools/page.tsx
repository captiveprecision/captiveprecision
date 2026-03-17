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
            <Link className="profile-edit-button" href="/coach/tools/cheer-score-calculator">
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
          <div className="metric-label">Live</div>
          <h2>Cheer Planner</h2>
          <p className="muted-copy">Step 1 of the planner is now live with tryout evaluations, local templates, and athlete records prepared for later planner phases.</p>
          <div className="settings-inline-actions">
            <Link className="profile-edit-button" href="/tools/cheer-planner">
              Open tool
            </Link>
          </div>
        </article>
      </section>
    </main>
  );
}
