import { CheerScoreCalculator } from "@/components/tools/cheer-score-calculator";

export default function CheerScoreCalculatorPage() {
  return (
    <main className="workspace-shell page-stack">
      <section className="workspace-top">
        <div className="surface-card panel-pad">
          <span className="page-kicker">Primary tool</span>
          <h1 className="page-title">Cheer Score Calculator</h1>
          <p className="page-copy">
            This is the first production tool inside the app shell. Its visual system, spacing, colors, and interaction patterns now define the base appearance for the rest of the platform.
          </p>
        </div>

        <div className="surface-card-dark panel-pad">
          <div className="metric-grid">
            <div className="metric-card">
              <div className="metric-label">Modes</div>
              <div className="metric-value">2</div>
              <div className="metric-subtext">Sections and final score</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Templates</div>
              <div className="metric-value">3</div>
              <div className="metric-subtext">Level 1, 2-7, and custom</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">State</div>
              <div className="metric-value">Local</div>
              <div className="metric-subtext">No persistence until auth returns</div>
            </div>
          </div>
        </div>
      </section>

      <CheerScoreCalculator />
    </main>
  );
}
