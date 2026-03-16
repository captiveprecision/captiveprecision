"use client";

import { useEffect, useState } from "react";

import {
  SCORING_SYSTEMS_STORAGE_KEY,
  cloneScoringSystemsConfig,
  defaultScoringSystemsConfig,
  type ScoringSystemsConfig
} from "@/lib/scoring/scoring-systems";

function readStoredConfig() {
  if (typeof window === "undefined") {
    return cloneScoringSystemsConfig(defaultScoringSystemsConfig);
  }

  const stored = window.localStorage.getItem(SCORING_SYSTEMS_STORAGE_KEY);

  if (!stored) {
    return cloneScoringSystemsConfig(defaultScoringSystemsConfig);
  }

  try {
    const parsed = JSON.parse(stored) as Partial<ScoringSystemsConfig>;

    if (!parsed.systems || !Array.isArray(parsed.systems)) {
      return cloneScoringSystemsConfig(defaultScoringSystemsConfig);
    }

    return cloneScoringSystemsConfig(parsed as ScoringSystemsConfig);
  } catch {
    return cloneScoringSystemsConfig(defaultScoringSystemsConfig);
  }
}

export function useScoringSystems() {
  const [config, setConfig] = useState<ScoringSystemsConfig>(() => cloneScoringSystemsConfig(defaultScoringSystemsConfig));
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setConfig(readStoredConfig());
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (!isReady || typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(SCORING_SYSTEMS_STORAGE_KEY, JSON.stringify(config));
  }, [config, isReady]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key === SCORING_SYSTEMS_STORAGE_KEY) {
        setConfig(readStoredConfig());
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  return {
    config,
    setConfig,
    isReady
  };
}
