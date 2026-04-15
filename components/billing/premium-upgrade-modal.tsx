"use client";

import type { Route } from "next";

import { Button, ButtonLink } from "@/components/ui";

type PremiumUpgradeModalProps = {
  open: boolean;
  onClose: () => void;
};

export function PremiumUpgradeModal({ open, onClose }: PremiumUpgradeModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="premium-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="premium-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="premium-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <span className="premium-modal__eyebrow">Premium</span>
        <h2 id="premium-modal-title">Esta es una funcion premium</h2>
        <p>Actualiza tu plan hoy para seguir editando, guardar registros por equipo y desbloquear Cheer Planner completo.</p>
        <div className="premium-modal__actions">
          <ButtonLink href={"/plans" as Route} variant="primary">Ver planes</ButtonLink>
          <Button variant="secondary" onClick={onClose}>Ahora no</Button>
        </div>
      </div>
    </div>
  );
}

