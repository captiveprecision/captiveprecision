import type { Route } from "next";
import Link from "next/link";

export default function GymToolsPage() {
  return (
    <main className="workspace-shell page-stack">
      <section className="surface-card panel-pad settings-hero">
        <div className="metric-label">Tools</div>
        <h1 className="page-title settings-title">All gym tools</h1>
        <p className="page-copy">Gym memberships have access to all current tools and future shared modules.</p>
      </section>

      <section className="info-grid">
        <article className="surface-card panel-pad settings-section">
          <div className="metric-label">Live</div>
          <h2>Cheer Score</h2>
          <div className="settings-inline-actions">
            <Link className="profile-edit-button" href={"/gym/tools/cheer-score-calculator" as Route}>
              Open tool
            </Link>
          </div>
        </article>
        <article className="surface-card panel-pad settings-section">
          <div className="metric-label">Live</div>
          <h2>Execution Evaluator</h2>
          <p className="muted-copy">Routine execution scoring with central admin-controlled scoring values and local records saved by team.</p>
          <div className="settings-inline-actions">
            <Link className="profile-edit-button" href={"/gym/tools/full-out-evaluator" as Route}>
              Open tool
            </Link>
          </div>
        </article>
        <article className="surface-card panel-pad settings-section">
          <div className="metric-label">Live</div>
          <h2>Cheer Planner</h2>
          <p className="muted-copy">Step 1 of the planner is now live with tryout evaluations, local templates, and athlete records prepared for later planner phases.</p>
          <div className="settings-inline-actions">
            <Link className="profile-edit-button" href={"/gym/tools/cheer-planner" as Route}>
              Open tool
            </Link>
          </div>
        </article>
      </section>
    </main>
  );
}
