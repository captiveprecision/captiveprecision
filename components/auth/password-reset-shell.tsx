"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { KeyRound, Mail } from "lucide-react";

import { Button, Card, CardContent, Input, SectionHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

type ResetState =
  | { mode: "request"; message: string }
  | { mode: "checking"; message: string }
  | { mode: "ready"; message: string }
  | { mode: "submitting"; message: string }
  | { mode: "success"; message: string }
  | { mode: "error"; message: string };

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
        setSessionReady(false);
        setState({
          mode: "error",
          message: error?.message ?? "This reset session is invalid or expired. Request a new password reset email."
        });
        return;
      }

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
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: `${window.location.origin}/auth/reset-password`
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
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setState({ mode: "error", message: error.message });
      return;
    }

    await supabase.auth.signOut();

    setState({ mode: "success", message: "Password updated. Redirecting to sign in..." });
    window.setTimeout(() => {
      window.location.assign("/");
    }, 700);
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
          <Link className="password-reset-back-link" href="/">Back to sign in</Link>
        </CardContent>
      </Card>
    </main>
  );
}
