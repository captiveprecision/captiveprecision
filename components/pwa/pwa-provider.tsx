"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import {
  getNavigatorOnlineState,
  isIosInstallCandidate,
  isStandaloneDisplay,
  type BeforeInstallPromptEvent
} from "@/lib/pwa/client";

type PwaContextValue = {
  online: boolean;
  canInstall: boolean;
  isInstalled: boolean;
  isIosInstall: boolean;
  installLabel: string;
  promptInstall: () => Promise<"accepted" | "dismissed" | "unavailable" | "ios">;
};

const PwaContext = createContext<PwaContextValue | null>(null);

function isLocalDevelopmentHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0";
}

async function clearRegisteredServiceWorkers() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));

  if (typeof window !== "undefined" && "caches" in window) {
    const cacheKeys = await window.caches.keys();
    await Promise.all(cacheKeys.map((cacheKey) => window.caches.delete(cacheKey)));
  }
}

async function registerProductionServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  const registration = await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
  await registration.update().catch(() => undefined);
}

export function PwaProvider({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState(true);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIosInstall, setIsIosInstall] = useState(false);

  useEffect(() => {
    setOnline(getNavigatorOnlineState());
    setIsInstalled(isStandaloneDisplay());
    setIsIosInstall(isIosInstallCandidate());

    if (typeof window !== "undefined") {
      const shouldRegisterServiceWorker = (
        process.env.NODE_ENV === "production"
        && window.isSecureContext
        && !isLocalDevelopmentHost(window.location.hostname)
      );
      const serviceWorkerSetup = shouldRegisterServiceWorker
        ? registerProductionServiceWorker()
        : clearRegisteredServiceWorkers();

      if (!shouldRegisterServiceWorker) {
        setInstallEvent(null);
      }

      void serviceWorkerSetup.catch(() => undefined);
    }

    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setInstallEvent(null);
    };
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("appinstalled", handleAppInstalled);
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("appinstalled", handleAppInstalled);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const value = useMemo<PwaContextValue>(() => {
    const canInstall = !isInstalled && (Boolean(installEvent) || isIosInstall);

    return {
      online,
      canInstall,
      isInstalled,
      isIosInstall,
      installLabel: installEvent ? "Install App" : "Add to Home Screen",
      async promptInstall() {
        if (installEvent) {
          await installEvent.prompt();
          const result = await installEvent.userChoice;

          if (result.outcome === "accepted") {
            setInstallEvent(null);
          }

          return result.outcome;
        }

        if (isIosInstall) {
          return "ios";
        }

        return "unavailable";
      }
    };
  }, [installEvent, isInstalled, isIosInstall, online]);

  return <PwaContext.Provider value={value}>{children}</PwaContext.Provider>;
}

export function usePwa() {
  const context = useContext(PwaContext);

  if (!context) {
    throw new Error("usePwa must be used within PwaProvider.");
  }

  return context;
}

export function PwaOfflineNotice() {
  const pathname = usePathname();
  const { online } = usePwa();

  if (online) {
    return null;
  }

  const workspaceRoute = pathname !== "/";

  return (
    <div className="pwa-offline-notice" role="status" aria-live="polite">
      <p>
        {workspaceRoute
          ? "Offline mode: locally saved tool data remains available, but sign-in and synced updates require a connection."
          : "Offline mode: installed pages and locally saved tool data remain available while the network is unavailable."}
      </p>
    </div>
  );
}

type PwaInstallPromptProps = {
  className?: string;
  buttonClassName?: string;
  context?: "landing" | "workspace" | "sidebar";
};

export function PwaInstallPrompt({
  className,
  buttonClassName,
  context = "landing"
}: PwaInstallPromptProps) {
  const { canInstall, installLabel, isIosInstall, promptInstall } = usePwa();
  const [showIosHelp, setShowIosHelp] = useState(false);

  if (!canInstall) {
    return null;
  }

  const handleClick = async () => {
    try {
      const result = await promptInstall();

      if (result === "ios") {
        setShowIosHelp((current) => !current);
      }
    } catch {
      setShowIosHelp(true);
    }
  };

  return (
    <div className={cn("pwa-install-prompt", className)} data-context={context}>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className={cn("pwa-install-button", buttonClassName)}
        onClick={handleClick}
      >
        {installLabel}
      </Button>
      {showIosHelp ? (
        <p className="pwa-install-copy">
          On iPhone, tap Share and choose Add to Home Screen.
        </p>
      ) : (
        <p className="pwa-install-copy">
          {isIosInstall
            ? "Install this app from Safari for faster access."
            : "Install this app for faster access and a cleaner workspace."}
        </p>
      )}
    </div>
  );
}
