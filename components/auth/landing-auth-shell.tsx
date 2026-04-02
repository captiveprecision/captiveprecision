"use client";

import Image from "next/image";
import { useState } from "react";

import {
  Button,
  Card,
  CardContent,
  FormShell,
  Input,
  Select
} from "@/components/ui";
import type { AppRole } from "@/lib/auth/session";

type RequestState = {
  mode: "idle" | "loading" | "error" | "success";
  message?: string;
};

type LandingTool = {
  title: string;
  body: string;
};

type AuthResponsePayload = {
  error?: string;
  message?: string;
  nextPath?: string;
};

const roleOptions: Array<{ value: Extract<AppRole, "coach" | "gym">; label: string }> = [
  { value: "coach", label: "Coach" },
  { value: "gym", label: "Gym" }
];

const activeTools: LandingTool[] = [
  {
    title: "Cheer Score",
    body: "Calculate scoring outcomes using clean, section-based inputs aligned with competition standards."
  },
  {
    title: "Execution Evaluator",
    body: "Track deductions, measure execution totals, and review performance impact through a live evaluation workflow."
  },
  {
    title: "Cheer Planner",
    body: "Build team structure from real athlete data, manage tryouts, and create planning decisions with full visibility."
  }
];

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
  const [betaState, setBetaState] = useState<RequestState>({ mode: "idle" });
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [betaExpanded, setBetaExpanded] = useState(false);
  const [betaName, setBetaName] = useState("");
  const [betaEmail, setBetaEmail] = useState("");
  const [betaPassword, setBetaPassword] = useState("");
  const [showBetaPassword, setShowBetaPassword] = useState(false);
  const [betaRole, setBetaRole] = useState<"coach" | "gym">("coach");

  function scrollToAccess() {
    document.getElementById("landing-access")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function openBetaAccess() {
    setBetaExpanded(true);
    setBetaState({ mode: "idle" });
    scrollToAccess();
  }

  function backToSignIn() {
    setBetaExpanded(false);
    setBetaState({ mode: "idle" });
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

  async function handleBetaRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBetaState({ mode: "loading" });

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: betaName,
        email: betaEmail,
        password: betaPassword,
        role: betaRole
      })
    });

    const payload = await readAuthResponse(response);

    if (!response.ok) {
      setBetaState({ mode: "error", message: payload.error ?? "Unable to submit beta request." });
      return;
    }

    setBetaState({
      mode: "success",
      message: payload.message ?? "Beta request received. An admin must approve your account before you can sign in."
    });
    setBetaName("");
    setBetaEmail("");
    setBetaPassword("");
    setBetaRole("coach");
  }

  return (
    <main className="landing-shell page-stack">
      <section className="landing-stack">
        <Card className="landing-hero-card" radius="panel">
          <CardContent className="landing-hero-content">
            <div className="landing-hero-grid">
              <div className="landing-brand-lockup">
                <Image
                  src="/brand/logo-primary.png"
                  alt="Captive Precision"
                  width={300}
                  height={68}
                  className="landing-brand-lockup__image"
                  priority
                />
              </div>
              <div className="landing-hero-copy">
                <h1 className="landing-hero-title">Professional Cheer Software for your teams</h1>
                <p className="landing-hero-subtitle">built around the tools you actually use to max score your routines</p>
              </div>
            </div>
            <div className="landing-hero-footer">
              <Button size="lg" variant="secondary" className="landing-hero-cta" onClick={scrollToAccess}>Access Platform</Button>
            </div>
          </CardContent>
        </Card>

        <section className="landing-section landing-section--active">
          <Card className="landing-tools-card">
            <CardContent className="landing-tools-card__content">
              <div className="landing-tools-card__header">
                <h2>A structured system for building competitive routines</h2>
                <p>Use one connected platform to evaluate execution, calculate scoring, and plan athlete-driven team structures.</p>
              </div>
              <div className="landing-tool-divider" aria-hidden="true" />
              {activeTools.map((tool, index) => (
                <div key={tool.title} className="landing-tools-card__item">
                  <div className="landing-tool-row">
                    <div className="landing-tool-card__copy">
                      <h3>{tool.title}</h3>
                      <p>{tool.body}</p>
                    </div>
                  </div>
                  {index < activeTools.length - 1 ? <div className="landing-tool-divider" aria-hidden="true" /> : null}
                </div>
              ))}
              <Button type="button" size="lg" className="landing-tools-card__cta" onClick={openBetaAccess}>Request Access</Button>
            </CardContent>
          </Card>
        </section>

        <section id="landing-access" className="landing-section landing-access-section">
          <div className="landing-section-copy landing-section-copy--compact">
            <div className="landing-access-mark">
              <Image
                src="/brand/logo-mark.png"
                alt="Captive Precision mark"
                width={40}
                height={40}
                className="landing-access-mark__image"
              />
            </div>
            <h2>{betaExpanded ? "Request access to beta" : "Sign in to your workspace"}</h2>
            <p>
              {betaExpanded
                ? "Submit your request here. Access is reviewed by an admin before your account is enabled."
                : "Authentication stays available here. New access now starts through a beta request and requires admin approval before sign-in is enabled."}
            </p>
          </div>

          <div className="landing-auth-grid">
            <FormShell className="landing-auth-card" contentClassName="landing-auth-card__content">
              {betaExpanded ? (
                <>
                  <div className="landing-auth-card__intro">
                    <span className="metric-label">Beta access</span>
                    <h2 className="ui-card__title">Request Access to Beta</h2>
                    <p className="muted-copy">Submit your team details here. Access is enabled only after an admin reviews and approves the request.</p>
                  </div>
                  <form className="landing-auth-form" onSubmit={handleBetaRequest}>
                    <Input
                      id="beta-name"
                      type="text"
                      label="Name"
                      value={betaName}
                      onChange={(event) => setBetaName(event.target.value)}
                      required
                    />
                    <Input
                      id="beta-email"
                      type="email"
                      label="Email"
                      value={betaEmail}
                      onChange={(event) => setBetaEmail(event.target.value)}
                      required
                    />
                    <Input
                      id="beta-password"
                      type={showBetaPassword ? "text" : "password"}
                      label="Password"
                      value={betaPassword}
                      onChange={(event) => setBetaPassword(event.target.value)}
                      required
                    />
                    <div className="landing-password-row">
                      <Button type="button" variant="ghost" size="sm" onClick={() => setShowBetaPassword((current) => !current)}>
                        {showBetaPassword ? "Hide password" : "Show password"}
                      </Button>
                    </div>
                    <Select
                      id="beta-role"
                      label="Workspace type"
                      value={betaRole}
                      onChange={(event) => setBetaRole(event.target.value as "coach" | "gym")}
                    >
                      {roleOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                    <div className="landing-auth-actions landing-auth-actions--stacked">
                      <Button type="submit" variant="primary" size="lg">
                        {betaState.mode === "loading" ? "Submitting request..." : "Request Access to Beta"}
                      </Button>
                      <Button type="button" variant="secondary" size="lg" onClick={backToSignIn}>
                        Back to Sign In
                      </Button>
                    </div>
                    {betaState.mode === "error" ? <p className="landing-auth-error">{betaState.message}</p> : null}
                    {betaState.mode === "success" ? <p className="landing-auth-success">{betaState.message}</p> : null}
                  </form>
                </>
              ) : (
                <>
                  <div className="landing-auth-card__intro">
                    <span className="metric-label">Sign in</span>
                    <h2 className="ui-card__title">Access your workspace</h2>
                    <p className="muted-copy">Use your approved account to continue into coach, gym, or admin.</p>
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
                </>
              )}
            </FormShell>
          </div>
        </section>
      </section>
    </main>
  );
}
