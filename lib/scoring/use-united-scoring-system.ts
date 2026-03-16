"use client";

import { useEffect, useState } from "react";

import {
  UNITED_SCORING_SYSTEM_STORAGE_KEY,
  cloneScoringConfig,
  defaultUnitedScoringSystemConfig,
  type UnitedScoringSystemConfig
} from "@/lib/scoring/united-scoring-system";

function readStoredConfig() {
  if (typeof window === "undefined") {
    return cloneScoringConfig(defaultUnitedScoringSystemConfig);
  }

  const stored = window.localStorage.getItem(UNITED_SCORING_SYSTEM_STORAGE_KEY);

  if (!stored) {
    return cloneScoringConfig(defaultUnitedScoringSystemConfig);
  }

  try {
    return {
      ...cloneScoringConfig(defaultUnitedScoringSystemConfig),
      ...JSON.parse(stored)
    } as UnitedScoringSystemConfig;
  } catch {
    return cloneScoringConfig(defaultUnitedScoringSystemConfig);
  }
}

export function useUnitedScoringSystem() {
  const [config, setConfig] = useState<UnitedScoringSystemConfig>(() => cloneScoringConfig(defaultUnitedScoringSystemConfig));
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setConfig(readStoredConfig());
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (!isReady || typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(UNITED_SCORING_SYSTEM_STORAGE_KEY, JSON.stringify(config));
  }, [config, isReady]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key === UNITED_SCORING_SYSTEM_STORAGE_KEY) {
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
