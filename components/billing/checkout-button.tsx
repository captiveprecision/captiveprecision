"use client";

import { useState } from "react";

import { Button } from "@/components/ui";
import type { PlannerWorkspaceScope } from "@/lib/services/planner-workspace";

type CheckoutButtonProps = {
  scope: PlannerWorkspaceScope;
  gymId?: string | null;
  label?: string;
  loadingLabel?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

async function parseBillingResponse(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json().catch(() => null) as Promise<{ url?: string; error?: string } | null>;
  }

  const text = await response.text().catch(() => "");
  return text ? { error: text } : null;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof TypeError && error.message === "Failed to fetch") {
    return "Could not reach the billing service. Refresh the page and make sure the local app is still running.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return fallback;
}

export function CheckoutButton({
  scope,
  gymId,
  label = "Actualizar a Premium",
  loadingLabel = "Opening checkout...",
  variant = "primary"
}: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startCheckout = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ scope, gymId })
      });
      const result = await parseBillingResponse(response);

      if (!response.ok || !result?.url) {
        throw new Error(result?.error ?? "Unable to start checkout.");
      }

      window.location.assign(result.url);
    } catch (checkoutError) {
      setError(getErrorMessage(checkoutError, "Unable to start checkout."));
      setLoading(false);
    }
  };

  return (
    <div className="plans-action-stack">
      <Button variant={variant} onClick={startCheckout} disabled={loading}>{loading ? loadingLabel : label}</Button>
      {error ? <p className="plans-error">{error}</p> : null}
    </div>
  );
}

export function BillingPortalButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openPortal = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/billing/portal", {
        method: "POST",
        credentials: "include"
      });
      const result = await parseBillingResponse(response);

      if (!response.ok || !result?.url) {
        throw new Error(result?.error ?? "Unable to open billing portal.");
      }

      window.location.assign(result.url);
    } catch (portalError) {
      setError(getErrorMessage(portalError, "Unable to open billing portal."));
      setLoading(false);
    }
  };

  return (
    <div className="plans-action-stack">
      <Button variant="secondary" onClick={openPortal} disabled={loading}>{loading ? "Opening..." : "Manage billing"}</Button>
      {error ? <p className="plans-error">{error}</p> : null}
    </div>
  );
}
