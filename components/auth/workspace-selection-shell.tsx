"use client";

import type { AuthSession } from "@/lib/auth/mock-auth";

type WorkspaceSelectionShellProps = {
  session: AuthSession;
};

const roleCopy = {
  coach: "Teams, tools, personal performance flow.",
  gym: "Licenses, coaches, teams, athletes, organization stats.",
  admin: "Platform controls, scoring systems, internal operations."
} as const;

const roleLabel = {
  coach: "Coach",
  gym: "Gym",
  admin: "Admin"
} as const;

export function WorkspaceSelectionShell({ session }: WorkspaceSelectionShellProps) {
  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/");
  }

  return (
    <main className="landing-shell">
      <section className="landing-hero-card">
        <div className="role-selection-badge">Captive Precision</div>
        <h1 className="landing-title">Choose your workspace.</h1>
        <p className="landing-copy">
          This account can move across multiple workspace types. Select the environment you want to open for this session.
        </p>

        <div className="landing-role-grid">
          {session.roles.map((role) => (
            <a key={role} className="landing-role-card" href={`/${role}`}>
              <strong>{roleLabel[role]}</strong>
              <span>{roleCopy[role]}</span>
            </a>
          ))}
        </div>

        <div className="landing-session-row">
          <div>
            <div className="metric-label">Signed in as</div>
            <p className="landing-session-value">{session.displayName}</p>
            <p className="landing-session-meta">{session.email}</p>
          </div>
          <button type="button" className="landing-auth-button landing-auth-button-secondary" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </section>
    </main>
  );
}
