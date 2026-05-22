import dotenv from "dotenv";
dotenv.config();

export type AppMode = "free" | "premium";

export interface TierLimits {
  /** Room time-to-live in seconds */
  roomTtlSeconds: number;
  /** Maximum users per room */
  maxUsersPerRoom: number;
  /** Monthly AI request quota per identity */
  aiMonthlyRequestLimit: number;
  /** Maximum simultaneous playgrounds per user */
  maxPlaygrounds: number;
  /** Whether collaborative saves persist beyond session */
  collaborativeSaveEnabled: boolean;
}

const parseMode = (raw?: string): AppMode => {
  if (raw === "premium") return "premium";
  return "free";
};

export const appMode: AppMode = parseMode(process.env.APP_MODE);

const FREE_DEFAULTS: TierLimits = {
  roomTtlSeconds: 60 * 60, // 1 hour
  maxUsersPerRoom: 20,
  aiMonthlyRequestLimit: 50,
  maxPlaygrounds: 1,
  collaborativeSaveEnabled: false,
};

const PREMIUM_DEFAULTS: TierLimits = {
  roomTtlSeconds: 24 * 60 * 60, // 24 hours
  maxUsersPerRoom: 200,
  aiMonthlyRequestLimit: 10_000, // effectively unlimited
  maxPlaygrounds: Infinity,
  collaborativeSaveEnabled: true,
};

const resolveLimits = (isPremium: boolean): TierLimits => {
  const base = isPremium ? { ...PREMIUM_DEFAULTS } : { ...FREE_DEFAULTS };

  // Allow env overrides for free mode limits
  if (!isPremium) {
    const ttlMinutes = process.env.FREE_ROOM_TTL_MINUTES;
    if (ttlMinutes) base.roomTtlSeconds = Number(ttlMinutes) * 60;

    const maxUsers = process.env.FREE_ROOM_MAX_USERS;
    if (maxUsers) base.maxUsersPerRoom = Number(maxUsers);

    const aiLimit = process.env.FREE_AI_MONTHLY_TOKEN_LIMIT;
    if (aiLimit) base.aiMonthlyRequestLimit = Number(aiLimit);
  }

  // Allow env overrides for premium mode limits
  if (isPremium) {
    const maxUsers = process.env.PREMIUM_ROOM_MAX_USERS;
    if (maxUsers) base.maxUsersPerRoom = Number(maxUsers);

    const aiLimit = process.env.PREMIUM_AI_MONTHLY_TOKEN_LIMIT;
    if (aiLimit) base.aiMonthlyRequestLimit = Number(aiLimit);
  }

  return base;
};

export const getTierLimits = (isPremium: boolean): TierLimits => resolveLimits(isPremium);

// Keep tierConfig temporarily exported as a fallback for pure global limits (using appMode)
export const tierConfig: TierLimits = resolveLimits(appMode === "premium");
