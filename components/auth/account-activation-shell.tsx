"use client";

import { useEffect, useState, type FormEvent } from "react";
import { KeyRound } from "lucide-react";

import { Button, Card, CardContent, Input, SectionHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

type ActivationState =
  | { mode: "checking"; message: string }
  | { mode: "ready"; message: string }
  | { mode: "submitting"; message: string }
  | { mode: "success"; message: string }
  | { mode: "error"; message: string };

export function AccountActivationShell() {
  const [state, setState] = useState<ActivationState>({ mode: "checking", message: "Checking invite session..." });
  const [sessionReady, setSessionReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function initializeSession() {
      const supabase = createClient();
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (cancelled) {
          return;
        }

        if (error) {
          setSessionReady(false);
          setState({ mode: "error", message: error.message });
          return;
        }
      } else if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });

        if (cancelled) {
          return;
        }

        if (error) {
          setSessionReady(false);
          setState({ mode: "error", message: error.message });
          return;
        }
      } else {
        await supabase.auth.signOut();

        if (cancelled) {
          return;
        }

        setSessionReady(false);
        setState({
          mode: "error",
          message: "This activation page must be opened from a valid invitation link."
        });
        return;
      }

      const { data, error } = await supabase.auth.getSession();

      if (cancelled) {
        return;
      }

      if (error) {
        setSessionReady(false);
        setState({ mode: "error", message: error.message });
        return;
      }

      if (!data.session) {
        setSessionReady(false);
        setState({
          mode: "error",
          message: "This activation link is invalid or expired. Please request a new invitation from an admin."
        });
        return;
      }

      setSessionReady(true);
      setState({ mode: "ready", message: "Choose a password to activate your account." });
    }

    initializeSession();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (password.length < 8) {
      setState({ mode: "error", message: "Password must be at least 8 characters." });
      return;
    }

    if (password !== confirmPassword) {
      setState({ mode: "error", message: "Passwords do not match." });
      return;
    }

    setState({ mode: "submitting", message: "Activating account..." });

    const supabase = createClient();
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !sessionData.session?.access_token) {
      setState({
        mode: "error",
        message: sessionError?.message ?? "This activation session is invalid or expired. Please request a new invitation."
      });
      return;
    }

    const response = await fetch("/api/auth/activate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        password,
        accessToken: sessionData.session.access_token
      })
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setState({ mode: "error", message: typeof payload.error === "string" ? payload.error : "Unable to activate account." });
      return;
    }

    await supabase.auth.signOut();

    setState({ mode: "success", message: "Password saved. Redirecting to sign in..." });
    window.setTimeout(() => {
      window.location.assign("/");
    }, 600);
  }

  const isBusy = state.mode === "checking" || state.mode === "submitting" || state.mode === "success";
  const canSubmit = sessionReady && !isBusy;

  return (
    <main className="landing-shell page-stack account-activation-shell">
      <Card radius="panel" className="account-activation-card">
        <CardContent className="account-activation-card__content">
          <SectionHeader
            eyebrow="Account activation"
            title="Set your password"
            description="Use the invitation link from your email to activate your Captive Precision account."
          />

          <form className="account-activation-form" onSubmit={handleSubmit}>
            <Input
              id="activation-password"
              type="password"
              label="Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={!canSubmit || isBusy}
              required
              minLength={8}
            />
            <Input
              id="activation-password-confirm"
              type="password"
              label="Confirm password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              disabled={!canSubmit || isBusy}
              required
              minLength={8}
            />
            <Button type="submit" variant="primary" size="lg" leadingIcon={<KeyRound size={18} />} disabled={!canSubmit || isBusy}>
              {state.mode === "submitting" ? "Saving password..." : "Activate account"}
            </Button>
          </form>

          <p className={`account-activation-message account-activation-message--${state.mode}`}>{state.message}</p>
        </CardContent>
      </Card>
    </main>
  );
}
