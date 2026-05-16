"use client";

import { useEffect, useState, type FormEvent } from "react";
import { KeyRound, Mail } from "lucide-react";

import { Button, Card, CardContent, Input, SectionHeader } from "@/components/ui";
import {
  PASSWORD_RECOVERY_SESSION_COOKIE,
  PASSWORD_RECOVERY_SESSION_COOKIE_VALUE,
  PASSWORD_RECOVERY_SESSION_MAX_AGE_SECONDS
} from "@/lib/auth/password-recovery";
import { createClient } from "@/lib/supabase/client";

type ResetState =
  | { mode: "request"; message: string }
  | { mode: "checking"; message: string }
  | { mode: "ready"; message: string }
  | { mode: "submitting"; message: string }
  | { mode: "success"; message: string }
  | { mode: "error"; message: string };

function getSecureCookieFlag() {
  return window.location.protocol === "https:" ? "Secure" : "";
}

function hasPasswordRecoveryGuardCookie() {
  return document.cookie
    .split(";")
    .some((cookie) => cookie.trim() === `${PASSWORD_RECOVERY_SESSION_COOKIE}=${PASSWORD_RECOVERY_SESSION_COOKIE_VALUE}`);
}

function setPasswordRecoveryGuardCookie() {
  document.cookie = [
    `${PASSWORD_RECOVERY_SESSION_COOKIE}=${PASSWORD_RECOVERY_SESSION_COOKIE_VALUE}`,
    `Max-Age=${PASSWORD_RECOVERY_SESSION_MAX_AGE_SECONDS}`,
    "Path=/",
    "SameSite=Lax",
    getSecureCookieFlag()
  ].filter(Boolean).join("; ");
}

function clearPasswordRecoveryGuardCookie() {
  document.cookie = [
    `${PASSWORD_RECOVERY_SESSION_COOKIE}=`,
    "Max-Age=0",
    "Path=/",
    "SameSite=Lax",
    getSecureCookieFlag()
  ].filter(Boolean).join("; ");
}

async function readResetResponse(response: Response) {
  return response.json().catch(() => ({ error: "The password reset service returned an invalid response." })) as Promise<{
    error?: string;
    message?: string;
  }>;
}

export function PasswordResetShell() {
  const [state, setState] = useState<ResetState>({
    mode: "request",
    message: "Enter your account email and we will send a secure reset link."
  });
  const [sessionReady, setSessionReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function initializeResetSession() {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (!code && (!accessToken || !refreshToken)) {
        if (hasPasswordRecoveryGuardCookie()) {
          const supabase = createClient();
          await supabase.auth.signOut();
          clearPasswordRecoveryGuardCookie();
        }

        return;
      }

      setState({ mode: "checking", message: "Checking reset link..." });

      const supabase = createClient();
      const sessionError = code
        ? (await supabase.auth.exchangeCodeForSession(code)).error
        : (await supabase.auth.setSession({
          access_token: accessToken ?? "",
          refresh_token: refreshToken ?? ""
        })).error;

      if (cancelled) {
        return;
      }

      if (sessionError) {
        clearPasswordRecoveryGuardCookie();
        setSessionReady(false);
        setState({
          mode: "error",
          message: "This reset link is invalid or expired. Request a new password reset email."
        });
        return;
      }

      const { data, error } = await supabase.auth.getSession();

      if (cancelled) {
        return;
      }

      if (error || !data.session) {
        clearPasswordRecoveryGuardCookie();
        setSessionReady(false);
        setState({
          mode: "error",
          message: error?.message ?? "This reset session is invalid or expired. Request a new password reset email."
        });
        return;
      }

      setPasswordRecoveryGuardCookie();
      setSessionReady(true);
      setState({ mode: "ready", message: "Choose a new password for your account." });
    }

    initializeResetSession();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleRequestReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setState({ mode: "error", message: "Email is required." });
      return;
    }

    setState({ mode: "submitting", message: "Sending reset email..." });

    const supabase = createClient();
    const resetRedirectUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin}/auth/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: resetRedirectUrl
    });

    if (error) {
      setState({ mode: "error", message: error.message });
      return;
    }

    setState({
      mode: "success",
      message: "If this email belongs to an account, a reset link has been sent."
    });
  }

  async function handleUpdatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (password.length < 8) {
      setState({ mode: "error", message: "Password must be at least 8 characters." });
      return;
    }

    if (password !== confirmPassword) {
      setState({ mode: "error", message: "Passwords do not match." });
      return;
    }

    setState({ mode: "submitting", message: "Updating password..." });

    const supabase = createClient();
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !sessionData.session?.access_token) {
      setSessionReady(false);
      clearPasswordRecoveryGuardCookie();
      setState({
        mode: "error",
        message: sessionError?.message ?? "This reset session is invalid or expired. Request a new password reset email."
      });
      return;
    }

    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        password,
        accessToken: sessionData.session.access_token
      })
    });
    const payload = await readResetResponse(response);

    if (!response.ok) {
      setState({ mode: "error", message: payload.error ?? "Unable to update password." });
      return;
    }

    clearPasswordRecoveryGuardCookie();
    await supabase.auth.signOut();

    setState({ mode: "success", message: "Password updated. Redirecting to sign in..." });
    window.setTimeout(() => {
      window.location.assign("/");
    }, 700);
  }

  async function handleReturnToSignIn() {
    setSessionReady(false);
    setState({ mode: "checking", message: "Closing reset session..." });

    const supabase = createClient();
    await supabase.auth.signOut();
    clearPasswordRecoveryGuardCookie();
    window.location.assign("/");
  }

  const isBusy = state.mode === "checking" || state.mode === "submitting";
  const isResetMode = sessionReady || state.mode === "checking" || (state.mode === "ready" && sessionReady);
  const title = isResetMode ? "Set a new password" : "Reset your password";
  const description = isResetMode
    ? "Use this secure reset session to choose a new password."
    : "We will send a password reset link to the email connected to your account.";

  return (
    <main className="landing-shell page-stack account-activation-shell">
      <Card radius="panel" className="account-activation-card">
        <CardContent className="account-activation-card__content">
          <SectionHeader
            eyebrow="Account access"
            title={title}
            description={description}
          />

          {isResetMode ? (
            <form className="account-activation-form" onSubmit={handleUpdatePassword}>
              <Input
                id="reset-password"
                type="password"
                label="New password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={!sessionReady || isBusy}
                required
                minLength={8}
              />
              <Input
                id="reset-password-confirm"
                type="password"
                label="Confirm new password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                disabled={!sessionReady || isBusy}
                required
                minLength={8}
              />
              <Button type="submit" variant="primary" size="lg" leadingIcon={<KeyRound size={18} />} disabled={!sessionReady || isBusy}>
                {state.mode === "submitting" ? "Saving password..." : "Save new password"}
              </Button>
            </form>
          ) : (
            <form className="account-activation-form" onSubmit={handleRequestReset}>
              <Input
                id="reset-email"
                type="email"
                label="Email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={isBusy}
                required
              />
              <Button type="submit" variant="primary" size="lg" leadingIcon={<Mail size={18} />} disabled={isBusy}>
                {state.mode === "submitting" ? "Sending reset link..." : "Send reset link"}
              </Button>
            </form>
          )}

          <p className={`account-activation-message account-activation-message--${state.mode}`}>{state.message}</p>
          <button type="button" className="password-reset-back-link" onClick={handleReturnToSignIn}>
            Back to sign in
          </button>
        </CardContent>
      </Card>
    </main>
  );
}
