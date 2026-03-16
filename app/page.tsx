import Link from "next/link";

export default function HomePage() {
  return (
    <main className="role-selection-shell">
      <section className="role-selection-card">
        <div className="role-selection-badge">Captive Precision</div>
        <h1 className="role-selection-title">Choose how you want to enter the platform.</h1>
        <p className="role-selection-copy">
          This provisional access screen lets us work on the coach and admin experiences separately until authentication and role gating are connected.
        </p>

        <div className="role-selection-actions">
          <Link href="/coach" className="role-selection-button role-selection-button-primary">
            Enter as Coach
          </Link>
          <Link href="/admin" className="role-selection-button">
            Enter as Administrator
          </Link>
        </div>
      </section>
    </main>
  );
}
