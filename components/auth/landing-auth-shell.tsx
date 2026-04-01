"use client";

import { useState } from "react";

import {
  Badge,
  Button,
  Card,
  CardContent,
  FormShell,
  Input,
  PageHero,
  Select
} from "@/components/ui";
import type { AppRole } from "@/lib/auth/session";

type RequestState = {
  mode: "idle" | "loading" | "error";
  message?: string;
};

type LandingTool = {
  title: string;
  body: string;
  tag: string;
  accent: string;
};

type AuthResponsePayload = {
  error?: string;
  nextPath?: string;
};

const roleOptions: Array<{ value: Extract<AppRole, "coach" | "gym">; label: string }> = [
  { value: "coach", label: "Coach" },
  { value: "gym", label: "Gym" }
];

const activeTools: LandingTool[] = [
  {
    title: "Cheer Score",
    body: "Calculate routine scoring outcomes fast with clean section-based inputs and competition-ready score math.",
    tag: "Live",
    accent: "Precision scoring"
  },
  {
    title: "Execution Evaluator",
    body: "Track deductions, control execution totals, and review routine impact with a live evaluator workflow.",
    tag: "Live",
    accent: "Routine review"
  },
  {
    title: "Cheer Planner",
    body: "Manage tryout records and build team structure from live athlete data inside one connected planning workflow.",
    tag: "Live",
    accent: "Planning system"
  }
];

const comingSoonItems: LandingTool[] = [
  {
    title: "Dance Tryouts",
    body: "Upcoming planner track for dance-focused athlete evaluation and assignment readiness.",
    tag: "Coming Soon",
    accent: "Planner expansion"
  },
  {
    title: "Jumps Tryouts",
    body: "Upcoming jump-specific evaluation lane designed to complement the active tumbling workflow.",
    tag: "Coming Soon",
    accent: "Planner expansion"
  },
  {
    title: "Stunts Tryouts",
    body: "Upcoming stunt assessment workflow for deeper athlete profiling across team-building decisions.",
    tag: "Coming Soon",
    accent: "Planner expansion"
  }
];

const landingStats = [
  { label: "Active tools", value: "3" },
  { label: "Upcoming lanes", value: "3" },
  { label: "Workspaces", value: "Coach, Gym" }
] as const;

async function readAuthResponse(response: Response): Promise<AuthResponsePayload> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json().catch(() => ({ error: "The server returned invalid JSON." }));
  }

  const text = await response.text().catch(() => "");
  return {
    error: text.trim() || "The server returned an unexpected response."
  };
}

export function LandingAuthShell() {
  const [loginState, setLoginState] = useState<RequestState>({ mode: "idle" });
  const [registerState, setRegisterState] = useState<RequestState>({ mode: "idle" });
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [registerRole, setRegisterRole] = useState<"coach" | "gym">("coach");

  function scrollToAccess() {
    document.getElementById("landing-access")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginState({ mode: "loading" });

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: loginEmail, password: loginPassword })
    });

    const payload = await readAuthResponse(response);

    if (!response.ok) {
      setLoginState({ mode: "error", message: payload.error ?? "Unable to sign in." });
      return;
    }

    window.location.assign(payload.nextPath ?? "/select-workspace");
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

    const payload = await readAuthResponse(response);

    if (!response.ok) {
      setRegisterState({ mode: "error", message: payload.error ?? "Unable to create account." });
      return;
    }

    window.location.assign(payload.nextPath ?? `/${registerRole}`);
  }

  return (
    <main className="landing-shell page-stack">
      <section className="landing-stack">
        <PageHero
          className="landing-hero-card"
          contentClassName="landing-hero-content"
          eyebrow={<Badge variant="accent">Captive Precision</Badge>}
          title="Professional cheer software built around the tools you actually use."
          description="Discover the live scoring and planning tools available now, see what is coming next, and access your workspace when you are ready."
          actions={
            <div className="landing-hero-actions">
              <Button size="lg" onClick={scrollToAccess}>Access Platform</Button>
              <Badge variant="subtle">English-first product experience</Badge>
            </div>
          }
        >
          <div className="landing-stats-grid">
            {landingStats.map((item) => (
              <div key={item.label} className="landing-stat-card">
                <span className="metric-label">{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </PageHero>

        <section className="landing-section landing-section--active">
          <div className="landing-section-copy">
            <Badge variant="accent">Active Tools</Badge>
            <h2>Workflows ready right now</h2>
            <p>Open the platform to score routines, evaluate execution, and build athlete-driven planning workflows.</p>
          </div>

          <div className="landing-tool-grid">
            {activeTools.map((tool, index) => (
              <Card key={tool.title} className="landing-tool-card landing-tool-card--live" style={{ animationDelay: `${index * 80}ms` }}>
                <CardContent className="landing-tool-card__content">
                  <div className="landing-tool-card__topline">
                    <Badge variant="accent">{tool.tag}</Badge>
                    <span className="metric-label">{tool.accent}</span>
                  </div>
                  <div className="landing-tool-card__copy">
                    <h3>{tool.title}</h3>
                    <p>{tool.body}</p>
                  </div>
                  <Button variant="secondary" onClick={scrollToAccess}>Access Tool</Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="landing-section landing-section--upcoming">
          <div className="landing-section-copy">
            <Badge variant="subtle">Coming Soon</Badge>
            <h2>Next planner expansions</h2>
            <p>Upcoming evaluation lanes will extend the active planner with more complete athlete profiling.</p>
          </div>

          <div className="landing-tool-grid landing-tool-grid--upcoming">
            {comingSoonItems.map((tool, index) => (
              <Card key={tool.title} className="landing-tool-card landing-tool-card--upcoming" style={{ animationDelay: `${120 + index * 80}ms` }}>
                <CardContent className="landing-tool-card__content">
                  <div className="landing-tool-card__topline">
                    <Badge variant="subtle">{tool.tag}</Badge>
                    <span className="metric-label">{tool.accent}</span>
                  </div>
                  <div className="landing-tool-card__copy">
                    <h3>{tool.title}</h3>
                    <p>{tool.body}</p>
                  </div>
                  <span className="landing-tool-card__status">Planned for a future release</span>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section id="landing-access" className="landing-section landing-access-section">
          <div className="landing-section-copy landing-section-copy--compact">
            <Badge variant="accent">Access Platform</Badge>
            <h2>Sign in or create your workspace</h2>
            <p>Authentication stays fully available here, but now follows the product story instead of leading it.</p>
          </div>

          <div className="landing-auth-grid">
            <FormShell className="landing-auth-card" contentClassName="landing-auth-card__content">
              <div className="landing-auth-card__intro">
                <span className="metric-label">Sign in</span>
                <h2 className="ui-card__title">Access your workspace</h2>
                <p className="muted-copy">Use your existing account to continue into coach, gym, or admin.</p>
              </div>
              <form className="landing-auth-form" onSubmit={handleLogin}>
                <Input
                  id="login-email"
                  type="email"
                  label="Email"
                  value={loginEmail}
                  onChange={(event) => setLoginEmail(event.target.value)}
                  required
                />
                <Input
                  id="login-password"
                  type={showLoginPassword ? "text" : "password"}
                  label="Password"
                  value={loginPassword}
                  onChange={(event) => setLoginPassword(event.target.value)}
                  required
                />
                <div className="landing-password-row">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowLoginPassword((current) => !current)}>
                    {showLoginPassword ? "Hide password" : "Show password"}
                  </Button>
                </div>
                <Button type="submit" variant="primary" size="lg">
                  {loginState.mode === "loading" ? "Signing in..." : "Sign in"}
                </Button>
                {loginState.mode === "error" ? <p className="landing-auth-error">{loginState.message}</p> : null}
              </form>
            </FormShell>

            <FormShell className="landing-auth-card" contentClassName="landing-auth-card__content">
              <div className="landing-auth-card__intro">
                <span className="metric-label">Register</span>
                <h2 className="ui-card__title">Create a new account</h2>
                <p className="muted-copy">New accounts can start as a coach or a gym. Admin access remains restricted.</p>
              </div>
              <form className="landing-auth-form" onSubmit={handleRegister}>
                <Input
                  id="register-name"
                  type="text"
                  label="Name"
                  value={registerName}
                  onChange={(event) => setRegisterName(event.target.value)}
                  required
                />
                <Input
                  id="register-email"
                  type="email"
                  label="Email"
                  value={registerEmail}
                  onChange={(event) => setRegisterEmail(event.target.value)}
                  required
                />
                <Input
                  id="register-password"
                  type={showRegisterPassword ? "text" : "password"}
                  label="Password"
                  value={registerPassword}
                  onChange={(event) => setRegisterPassword(event.target.value)}
                  required
                />
                <div className="landing-password-row">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowRegisterPassword((current) => !current)}>
                    {showRegisterPassword ? "Hide password" : "Show password"}
                  </Button>
                </div>
                <Select
                  id="register-role"
                  label="Workspace type"
                  value={registerRole}
                  onChange={(event) => setRegisterRole(event.target.value as "coach" | "gym")}
                >
                  {roleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                <Button type="submit" variant="primary" size="lg">
                  {registerState.mode === "loading" ? "Creating account..." : "Create account"}
                </Button>
                {registerState.mode === "error" ? <p className="landing-auth-error">{registerState.message}</p> : null}
              </form>
            </FormShell>
          </div>
        </section>
      </section>
    </main>
  );
}
