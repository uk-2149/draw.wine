import React, { createContext, useCallback, useEffect, useState } from "react";
import type { AiQuotaState, AppMode, TierContextType, TierLimits } from "./types";
import { be_url } from "@/env/e";

const DEFAULT_LIMITS: TierLimits = {
  roomTtlMinutes: 60,
  maxUsersPerRoom: 20,
  aiMonthlyLimit: 50,
  maxPlaygrounds: 1,
  collaborativeSaveEnabled: false,
};

const DEFAULT_QUOTA: AiQuotaState = { used: 0, limit: 50, remaining: 50 };

export const TierContext = createContext<TierContextType>({
  mode: "free",
  limits: DEFAULT_LIMITS,
  aiQuota: DEFAULT_QUOTA,
  isFree: true,
  isPremium: false,
  isLoading: true,
  refreshAiQuota: async () => {},
  refreshConfig: async () => {},
});

export const TierProvider = ({ children }: { children: React.ReactNode }) => {
  const [mode, setMode] = useState<AppMode>("free");
  const [limits, setLimits] = useState<TierLimits>(DEFAULT_LIMITS);
  const [aiQuota, setAiQuota] = useState<AiQuotaState>(DEFAULT_QUOTA);
  const [isLoading, setIsLoading] = useState(true);

  const refreshConfig = useCallback(async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem("draw_wine_token");
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${be_url}/api/config`, { headers });
      if (!res.ok) throw new Error("Failed to fetch config");
      const data = await res.json();
      setMode(data.mode || "free");
      setLimits(data.limits || DEFAULT_LIMITS);
      if (data.aiQuota) setAiQuota(data.aiQuota);
    } catch (err) {
      console.warn("[TierProvider] Could not fetch tier config, using defaults:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshConfig();
  }, [refreshConfig]);

  const refreshAiQuota = useCallback(async () => {
    try {
      const res = await fetch(`${be_url}/api/ai/quota`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.aiQuota) setAiQuota(data.aiQuota);
    } catch (err) {
      console.warn("[TierProvider] Could not refresh AI quota:", err);
    }
  }, []);

  const contextValue: TierContextType = {
    mode,
    limits,
    aiQuota,
    isFree: mode === "free",
    isPremium: mode === "premium",
    isLoading,
    refreshAiQuota,
    refreshConfig,
  };

  return (
    <TierContext.Provider value={contextValue}>
      {children}
    </TierContext.Provider>
  );
};
