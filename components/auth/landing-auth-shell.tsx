"use client";

import { useState } from "react";

import {
  Badge,
  Button,
  Card,
  CardContent,
  FormShell,
  Input,
  PageColumns,
  PageHero,
  PageMainColumn,
  PageSideColumn,
  Select,
  StatGrid
} from "@/components/ui";
import type { AppRole } from "@/lib/auth/mock-auth";

type RequestState = {
  mode: "idle" | "loading" | "error";
  message?: string;
};

const roleOptions: Array<{ value: Extract<AppRole, "coach" | "gym">; label: string }> = [
  { value: "coach", label: "Coach" },
  { value: "gym", label: "Gym" }
];

const highlightCards = [
  {
    title: "For coaches",
    body: "Score tools, team dashboards, and athlete progress in one structured workspace."
  },
  {
    title: "For gyms",
    body: "Coach licenses, shared oversight, teams, athletes, and organization visibility."
  },
  {
    title: "For admins",
    body: "Scoring systems, version control, and platform-wide operational settings."
  }
] as const;

export function LandingAuthShell() {
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

    const payload = await response.json();

    if (!response.ok) {
      setRegisterState({ mode: "error", message: payload.error ?? "Unable to create account." });
      return;
    }

    window.location.assign(payload.nextPath ?? `/${registerRole}`);
  }

  return (
    <main className="landing-shell page-stack">
      <PageColumns className="landing-top-grid">
        <PageMainColumn className="landing-main-column">
          <PageHero
            className="landing-hero-card"
            contentClassName="landing-hero-content"
            eyebrow={<Badge variant="accent">Captive Precision</Badge>}
            title="Premium cheer software for coaches, gyms, and system admins."
            description="Captive Precision centralizes scoring tools, team planning, gym oversight, and future membership access into one structured product workflow."
          >
            <StatGrid className="landing-highlights">
              {highlightCards.map((card) => (
                <Card key={card.title} className="landing-highlight-card">
                  <CardContent className="landing-highlight-card__content">
                    <span className="metric-label">{card.title}</span>
                    <p className="landing-highlight-copy">{card.body}</p>
                  </CardContent>
                </Card>
              ))}
            </StatGrid>
          </PageHero>
        </PageMainColumn>

        <PageSideColumn className="landing-side-column">
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
                type="password"
                label="Password"
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
                required
              />
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
                type="password"
                label="Password"
                value={registerPassword}
                onChange={(event) => setRegisterPassword(event.target.value)}
                required
              />
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
        </PageSideColumn>
      </PageColumns>
    </main>
  );
}
