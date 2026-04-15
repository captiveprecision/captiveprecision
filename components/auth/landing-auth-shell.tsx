"use client";

import Image from "next/image";
import { useState } from "react";

import { PwaInstallPrompt, usePwa } from "@/components/pwa/pwa-provider";
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

type LandingFaq = {
  question: string;
  answer: string;
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

const landingFaqs: LandingFaq[] = [
  {
    question: "How do I get access?",
    answer: "Request beta access from the platform and an admin will review your account before sign-in is enabled."
  },
  {
    question: "Can I install the app on my phone?",
    answer: "Yes. Captive Precision can be installed on supported iPhone, Android, and desktop browsers for faster access."
  },
  {
    question: "What works offline?",
    answer: "Installed pages and locally saved tool data remain available offline, while sign-in and synced updates still require a connection."
  },
  {
    question: "Which workspaces are available today?",
    answer: "Approved accounts can access coach, gym, or admin depending on the permissions assigned to the profile."
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
  const { canInstall } = usePwa();
  const [loginState, setLoginState] = useState<RequestState>({ mode: "idle" });
  const [betaState, setBetaState] = useState<RequestState>({ mode: "idle" });
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [accessExpanded, setAccessExpanded] = useState(false);
  const [betaExpanded, setBetaExpanded] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [betaName, setBetaName] = useState("");
  const [betaEmail, setBetaEmail] = useState("");
  const [betaPassword, setBetaPassword] = useState("");
  const [showBetaPassword, setShowBetaPassword] = useState(false);
  const [betaRole, setBetaRole] = useState<"coach" | "gym">("coach");

  function scrollToAccess() {
    window.setTimeout(() => {
      document.getElementById("landing-access")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 32);
  }

  function openAccessPlatform() {
    setAccessExpanded(true);
    setBetaExpanded(false);
    scrollToAccess();
  }

  function openBetaAccess() {
    setAccessExpanded(true);
    setBetaExpanded(true);
    setBetaState({ mode: "idle" });
    scrollToAccess();
  }

  function backToSignIn() {
    setAccessExpanded(true);
    setBetaExpanded(false);
    setBetaState({ mode: "idle" });
    scrollToAccess();
  }

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginState({ mode: "loading" });

    try {
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
    } catch {
      setLoginState({ mode: "error", message: "Unable to reach the sign-in service. Check your connection and try again." });
    }
  }

  async function handleBetaRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBetaState({ mode: "loading" });

    try {
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
    } catch {
      setBetaState({ mode: "error", message: "Unable to reach the access request service. Check your connection and try again." });
    }
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
              <Button size="lg" variant="secondary" className="landing-hero-cta" onClick={openAccessPlatform}>Access Platform</Button>
            </div>
          </CardContent>
        </Card>

        {canInstall ? (
          <section className="landing-section landing-install-section">
            <Card className="landing-install-card" radius="panel">
              <CardContent className="landing-install-card__content">
                <div className="landing-install-card__copy">
                  <h2>Install Captive Precision</h2>
                  <p>Add the platform to your phone or desktop for faster access and a cleaner app experience.</p>
                </div>
                <PwaInstallPrompt className="landing-install-prompt" buttonClassName="landing-install-button" context="landing" />
              </CardContent>
            </Card>
          </section>
        ) : null}

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

        {accessExpanded ? (
          <section id="landing-access" className="landing-section landing-access-section">
            <div className="landing-auth-grid">
              <FormShell className="landing-auth-card" contentClassName="landing-auth-card__content">
                <div className="landing-auth-card__brand">
                  <Image
                    src="/brand/logo-mark.png"
                    alt="Captive Precision mark"
                    width={40}
                    height={40}
                    className="landing-access-mark__image"
                  />
                </div>
                {betaExpanded ? (
                  <>
                    <div className="landing-auth-card__intro">
                      <span className="metric-label">Beta access</span>
                      <h2 className="ui-card__title">Request Access to Beta</h2>
                      <p className="muted-copy">Submit your team details here. Access is enabled only after an admin reviews and approves the request.</p>
                    </div>
                    <form className="landing-auth-form" onSubmit={handleBetaRequest}>
                      <Input id="beta-name" type="text" label="Name" value={betaName} onChange={(event) => setBetaName(event.target.value)} required />
                      <Input id="beta-email" type="email" label="Email" value={betaEmail} onChange={(event) => setBetaEmail(event.target.value)} required />
                      <div className="landing-password-field">
                        <Input id="beta-password" type={showBetaPassword ? "text" : "password"} label="Password" value={betaPassword} onChange={(event) => setBetaPassword(event.target.value)} required />
                        <Button type="button" variant="ghost" size="sm" className="landing-password-toggle" onClick={() => setShowBetaPassword((current) => !current)}>
                          {showBetaPassword ? "Hide password" : "Show password"}
                        </Button>
                      </div>
                      <Select id="beta-role" label="Workspace type" value={betaRole} onChange={(event) => setBetaRole(event.target.value as "coach" | "gym")}>
                        {roleOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                      <div className="landing-auth-actions landing-auth-actions--stacked">
                        <Button type="submit" variant="primary" size="lg" disabled={betaState.mode === "loading"}>
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
                      <h2 className="ui-card__title">Sign in to your workspace</h2>
                      <p className="muted-copy">Access is restricted to approved accounts.</p>
                    </div>
                    <form className="landing-auth-form" onSubmit={handleLogin}>
                      <Input id="login-email" type="email" label="Email" value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} required />
                      <div className="landing-password-field">
                        <Input id="login-password" type={showLoginPassword ? "text" : "password"} label="Password" value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} required />
                        <Button type="button" variant="ghost" size="sm" className="landing-password-toggle" onClick={() => setShowLoginPassword((current) => !current)}>
                          {showLoginPassword ? "Hide password" : "Show password"}
                        </Button>
                      </div>
                      <Button type="submit" variant="primary" size="lg" disabled={loginState.mode === "loading"}>
                        {loginState.mode === "loading" ? "Signing in..." : "Sign in"}
                      </Button>
                      {loginState.mode === "error" ? <p className="landing-auth-error">{loginState.message}</p> : null}
                    </form>
                  </>
                )}
              </FormShell>
            </div>
          </section>
        ) : null}

        <section className="landing-section landing-faq-section">
          <Card className="landing-faq-card" radius="panel">
            <CardContent className="landing-faq-card__content">
              <div className="landing-faq-card__header">
                <h2>Frequently asked questions</h2>
                <p>Quick answers for access, installation, and how the current platform works.</p>
              </div>
              <div className="landing-tool-divider" aria-hidden="true" />
              {landingFaqs.map((faq, index) => {
                const isOpen = openFaqIndex === index;

                return (
                  <div key={faq.question} className="landing-faq-item" data-open={isOpen}>
                    <button
                      type="button"
                      className="landing-faq-trigger"
                      onClick={() => setOpenFaqIndex((current) => (current === index ? null : index))}
                      aria-expanded={isOpen}
                    >
                      <span>{faq.question}</span>
                      <span className="landing-faq-icon" aria-hidden="true">{isOpen ? "-" : "+"}</span>
                    </button>
                    {isOpen ? <p>{faq.answer}</p> : null}
                    {index < landingFaqs.length - 1 ? <div className="landing-tool-divider" aria-hidden="true" /> : null}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </section>
      </section>
    </main>
  );
}
