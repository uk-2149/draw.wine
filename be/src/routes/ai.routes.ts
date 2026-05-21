import { Router } from "express";
import type { Request, Response } from "express";

import { aiLimiter } from "../constants";
import { chatWithAi, generateDrawing } from "../controllers";
import { AiQuotaService } from "../services/ai-quota.service";

export const aiRouter = Router();

// POST /api/ai/generate
aiRouter.post("/generate", aiLimiter, generateDrawing);

// POST /api/ai/chat
aiRouter.post("/chat", aiLimiter, chatWithAi);

// GET /api/ai/quota — returns current AI usage for the caller
aiRouter.get("/quota", async (req: Request, res: Response): Promise<any> => {
  const clientIp = req.ip || req.socket.remoteAddress || "unknown";
  const usage = await AiQuotaService.getUsage(clientIp);
  return res.status(200).json({ success: true, aiQuota: usage });
});
