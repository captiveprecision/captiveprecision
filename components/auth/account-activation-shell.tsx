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
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setState({ mode: "error", message: error.message });
      return;
    }

    setState({ mode: "success", message: "Password saved. Redirecting to workspace selection..." });
    window.setTimeout(() => {
      window.location.assign("/select-workspace");
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
