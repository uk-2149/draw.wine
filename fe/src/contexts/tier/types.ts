export type AppMode = "free" | "premium";

export interface TierLimits {
  roomTtlMinutes: number;
  maxUsersPerRoom: number;
  aiMonthlyLimit: number;
  maxPlaygrounds: number;
  collaborativeSaveEnabled: boolean;
}

export interface AiQuotaState {
  used: number;
  limit: number;
  remaining: number;
}

export interface TierContextType {
  mode: AppMode;
  limits: TierLimits;
  aiQuota: AiQuotaState;
  isFree: boolean;
  isPremium: boolean;
  isLoading: boolean;
  refreshAiQuota: () => Promise<void>;
  refreshConfig: () => Promise<void>;
}
