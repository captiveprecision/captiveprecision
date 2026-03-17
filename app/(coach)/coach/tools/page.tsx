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
          <div className="metric-label">Live</div>
          <h2>Execution Evaluator</h2>
          <p className="muted-copy">Routine execution scoring with central admin-controlled scoring values and local records saved by team.</p>
          <div className="settings-inline-actions">
            <Link className="profile-edit-button" href="/coach/tools/full-out-evaluator">
              Open tool
            </Link>
          </div>
        </article>

        <article className="surface-card panel-pad settings-section">
          <div className="metric-label">Live</div>
          <h2>Cheer Planner</h2>
          <p className="muted-copy">Step 1 of the planner is now live with tryout evaluations, local templates, and athlete records prepared for later planner phases.</p>
          <div className="settings-inline-actions">
            <Link className="profile-edit-button" href="/coach/tools/cheer-planner">
              Open tool
            </Link>
          </div>
        </article>
      </section>
    </main>
  );
}
