"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import type { AppRole, AuthSession } from "@/lib/auth/mock-auth";

type LandingAuthShellProps = {
  session: AuthSession | null;
};

type RequestState = {
  mode: "idle" | "loading" | "error";
  message?: string;
};

const roleOptions: Array<{ value: Extract<AppRole, "coach" | "gym">; label: string }> = [
  { value: "coach", label: "Coach" },
  { value: "gym", label: "Gym" }
];

export function LandingAuthShell({ session }: LandingAuthShellProps) {
  const router = useRouter();
  const [loginState, setLoginState] = useState<RequestState>({ mode: "idle" });
  const [registerState, setRegisterState] = useState<RequestState>({ mode: "idle" });
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerRole, setRegisterRole] = useState<"coach" | "gym">("coach");

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginState({ mode: "loading" });

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: loginEmail, password: loginPassword })
    });

    const payload = await response.json();

    if (!response.ok) {
      setLoginState({ mode: "error", message: payload.error ?? "Unable to sign in." });
      return;
    }

    router.refresh();
    router.push(payload.nextPath ?? "/");
  }

  async function handleRegister(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRegisterState({ mode: "loading" });

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: registerName,
        email: registerEmail,
        password: registerPassword,
        role: registerRole
      })
    });

    const payload = await response.json();

    if (!response.ok) {
      setRegisterState({ mode: "error", message: payload.error ?? "Unable to create account." });
      return;
    }

    router.refresh();
    router.push(payload.nextPath ?? "/");
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.refresh();
  }

  if (session) {
    return (
      <main className="landing-shell">
        <section className="landing-hero-card">
          <div className="role-selection-badge">Captive Precision</div>
          <h1 className="landing-title">Your session is active.</h1>
          <p className="landing-copy">
            Continue into the workspace you want to review. This session currently has access to {session.roles.join(", ")}.
          </p>

          <div className="landing-role-grid">
            {session.roles.includes("coach") ? <a className="landing-role-card" href="/coach"><strong>Coach</strong><span>Teams, tools, personal performance flow.</span></a> : null}
            {session.roles.includes("gym") ? <a className="landing-role-card" href="/gym"><strong>Gym</strong><span>Licenses, coaches, teams, athletes, organization stats.</span></a> : null}
            {session.roles.includes("admin") ? <a className="landing-role-card" href="/admin"><strong>Admin</strong><span>Platform controls, scoring systems, internal operations.</span></a> : null}
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

  return (
    <main className="landing-shell">
      <section className="landing-hero-card">
        <div className="role-selection-badge">Captive Precision</div>
        <h1 className="landing-title">Premium cheer tools for coaches, gyms, and system admins.</h1>
        <p className="landing-copy">
          Captive Precision centralizes scoring tools, team tracking, gym oversight, and future membership access into one premium workflow.
        </p>

        <div className="landing-highlights">
          <div className="landing-highlight-card"><strong>For coaches</strong><span>Score tools, team dashboards, athlete-facing progress in one place.</span></div>
          <div className="landing-highlight-card"><strong>For gyms</strong><span>Coach licenses, gym visibility, teams, athletes, and organization stats.</span></div>
          <div className="landing-highlight-card"><strong>For admins</strong><span>Scoring systems, version control, and platform-wide configuration.</span></div>
        </div>
      </section>

      <section className="landing-auth-grid">
        <article className="surface-card panel-pad landing-auth-card">
          <div className="metric-label">Sign in</div>
          <h2>Access your workspace</h2>
          <p className="muted-copy">Use your existing account to continue into coach, gym, or admin.</p>
          <form className="landing-auth-form" onSubmit={handleLogin}>
            <input type="email" placeholder="Email" value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} required />
            <input type="password" placeholder="Password" value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} required />
            <button type="submit" className="landing-auth-button">
              {loginState.mode === "loading" ? "Signing in..." : "Sign in"}
            </button>
            {loginState.mode === "error" ? <p className="landing-auth-error">{loginState.message}</p> : null}
          </form>
        </article>

        <article className="surface-card panel-pad landing-auth-card">
          <div className="metric-label">Register</div>
          <h2>Create a new account</h2>
          <p className="muted-copy">New accounts can start as a coach or a gym. Admin access remains restricted.</p>
          <form className="landing-auth-form" onSubmit={handleRegister}>
            <input type="text" placeholder="Name" value={registerName} onChange={(event) => setRegisterName(event.target.value)} required />
            <input type="email" placeholder="Email" value={registerEmail} onChange={(event) => setRegisterEmail(event.target.value)} required />
            <input type="password" placeholder="Password" value={registerPassword} onChange={(event) => setRegisterPassword(event.target.value)} required />
            <div className="landing-role-picker">
              {roleOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className="dashboard-tab"
                  data-active={registerRole === option.value}
                  onClick={() => setRegisterRole(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <button type="submit" className="landing-auth-button">
              {registerState.mode === "loading" ? "Creating account..." : "Create account"}
            </button>
            {registerState.mode === "error" ? <p className="landing-auth-error">{registerState.message}</p> : null}
          </form>
        </article>
      </section>
    </main>
  );
}
