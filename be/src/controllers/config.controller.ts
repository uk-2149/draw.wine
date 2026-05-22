import { Response } from "express";
import { appMode } from "../constants";
import { AiQuotaService } from "../services/ai-quota.service";
import { TierService } from "../services/tier.service";
import { AuthenticatedRequest } from "../middleware";

/**
 * GET /api/config
 * Returns the current tier configuration (read-only, no secrets).
 */
export const getAppConfig = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<any> => {
  const walletAddress = req.walletAddress;
  const clientIp = req.ip || req.socket.remoteAddress || "unknown";
  
  const isPremium = await TierService.isPremiumUser(walletAddress);
  const limits = await TierService.getLimitsForUser(walletAddress);

  const identifier = walletAddress || clientIp;
  const aiQuota = await AiQuotaService.getUsage(identifier, limits.aiMonthlyRequestLimit);

  return res.status(200).json({
    mode: isPremium ? "premium" : "free",
    limits: {
      roomTtlMinutes: Math.floor(limits.roomTtlSeconds / 60),
      maxUsersPerRoom: limits.maxUsersPerRoom,
      aiMonthlyLimit: limits.aiMonthlyRequestLimit,
      maxPlaygrounds: limits.maxPlaygrounds,
      collaborativeSaveEnabled: limits.collaborativeSaveEnabled,
    },
    aiQuota,
  });
};
