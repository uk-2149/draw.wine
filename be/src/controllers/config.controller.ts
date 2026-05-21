import { Request, Response } from "express";
import { appMode, tierConfig } from "../constants";
import { AiQuotaService } from "../services/ai-quota.service";

/**
 * GET /api/config
 * Returns the current tier configuration (read-only, no secrets).
 */
export const getAppConfig = async (
  req: Request,
  res: Response,
): Promise<any> => {
  const clientIp = req.ip || req.socket.remoteAddress || "unknown";
  const aiQuota = await AiQuotaService.getUsage(clientIp);

  return res.status(200).json({
    mode: appMode,
    limits: {
      roomTtlMinutes: Math.floor(tierConfig.roomTtlSeconds / 60),
      maxUsersPerRoom: tierConfig.maxUsersPerRoom,
      aiMonthlyLimit: tierConfig.aiMonthlyRequestLimit,
      maxPlaygrounds: tierConfig.maxPlaygrounds,
      collaborativeSaveEnabled: tierConfig.collaborativeSaveEnabled,
    },
    aiQuota,
  });
};
