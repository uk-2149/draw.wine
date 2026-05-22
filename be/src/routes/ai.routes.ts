import { Router } from "express";
import type { Request, Response } from "express";

import { aiLimiter } from "../constants";
import { chatWithAi, generateDrawing } from "../controllers";
import { AiQuotaService } from "../services/ai-quota.service";

export const aiRouter = Router();

/**
 * @swagger
 * /api/ai/generate:
 *   post:
 *     summary: Generate an AI diagram layout
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [prompt]
 *             properties:
 *               prompt:
 *                 type: string
 *               mode:
 *                 type: string
 *               model:
 *                 type: string
 *     responses:
 *       200:
 *         description: AI diagram elements returned successfully
 *       401:
 *         description: Unauthorized
 *       429:
 *         description: Quota exceeded
 */
aiRouter.post("/generate", aiLimiter, generateDrawing);

/**
 * @swagger
 * /api/ai/chat:
 *   post:
 *     summary: Chat with the AI assistant
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message]
 *             properties:
 *               message:
 *                 type: string
 *               model:
 *                 type: string
 *               sessionId:
 *                 type: string
 *     responses:
 *       200:
 *         description: AI chat response
 *       401:
 *         description: Unauthorized
 *       429:
 *         description: Quota exceeded
 */
aiRouter.post("/chat", aiLimiter, chatWithAi);

/**
 * @swagger
 * /api/ai/quota:
 *   get:
 *     summary: Get current AI usage quota for the user or IP
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: AI usage returned successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 aiQuota:
 *                   type: number
 */
aiRouter.get("/quota", async (req: Request, res: Response): Promise<any> => {
  const clientIp = req.ip || req.socket.remoteAddress || "unknown";
  const usage = await AiQuotaService.getUsage(clientIp);
  return res.status(200).json({ success: true, aiQuota: usage });
});
