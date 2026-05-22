import { Request, Response } from "express";
import { Logger } from "../helpers";
import { AiChatRequest, AiDrawingRequest } from "../types";
import aiService from "../services/ai.service";
import { AiQuotaService } from "../services/ai-quota.service";
import { AuthenticatedRequest } from "../middleware";
import { TierService } from "../services/tier.service";

export const generateDrawing = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<any> => {
  try {
    const { prompt, mode, model }: AiDrawingRequest = req.body;

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return res.status(400).json({
        error: "Prompt is required",
        message: "Please provide a descriptive prompt to generate a drawing.",
      });
    }

    if (mode && mode !== "vector" && mode !== "raster") {
      return res.status(400).json({
        error: "Invalid mode",
        message: "Mode must be either 'vector' or 'raster'.",
      });
    }

    if (model && typeof model !== "string") {
      return res.status(400).json({
        error: "Invalid model",
        message: "Model must be a string identifier.",
      });
    }

    Logger.info(
      `AI generation requested. Model: ${model || "default"}, Mode: ${
        mode || "vector"
      }, Prompt: "${prompt.substring(0, 60)}..."`,
    );

    // Check AI quota
    const walletAddress = req.walletAddress;
    const clientIp = req.ip || req.socket.remoteAddress || "unknown";
    const identifier = walletAddress || clientIp;
    
    // Pass dynamic limit to checkAndIncrement if needed, but AiQuotaService relies on global. 
    // We must update AiQuotaService to accept a dynamic limit!
    const limits = await TierService.getLimitsForUser(walletAddress);
    
    const quota = await AiQuotaService.checkAndIncrement(identifier, limits.aiMonthlyRequestLimit);
    if (!quota.allowed) {
      return res.status(429).json({
        error: "AI quota exhausted",
        message: "You have used all your AI requests for this month.",
        aiQuota: { used: quota.used, limit: quota.limit, remaining: 0 },
      });
    }

    const result = await aiService.generateDrawing({
      prompt: prompt.trim(),
      mode,
      model,
    });

    Logger.success(
      `Successfully generated ${result.elements.length} elements.`,
    );

    return res.status(200).json({
      success: true,
      data: result,
      aiQuota: { used: quota.used, limit: quota.limit, remaining: quota.remaining },
    });
  } catch (error: any) {
    Logger.error("Controller error in generateDrawing:", error);
    return res.status(500).json({
      error: "Generation Failed",
      message:
        error?.message || "An unexpected error occurred during AI generation.",
    });
  }
};

export const chatWithAi = async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    const { prompt, model, sessionId }: AiChatRequest = req.body;

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return res.status(400).json({
        error: "Prompt is required",
        message: "Please provide a message to chat with the assistant.",
      });
    }

    if (model && typeof model !== "string") {
      return res.status(400).json({
        error: "Invalid model",
        message: "Model must be a string identifier.",
      });
    }

    Logger.info(
      `AI chat requested. Model: ${model || "default"}, Session: ${sessionId || "new"}, Prompt: "${prompt.substring(0, 60)}..."`,
    );

    // Check AI quota
    const walletAddress = req.walletAddress;
    const clientIp = req.ip || req.socket.remoteAddress || "unknown";
    const identifier = walletAddress || clientIp;
    
    const limits = await TierService.getLimitsForUser(walletAddress);
    
    const quota = await AiQuotaService.checkAndIncrement(identifier, limits.aiMonthlyRequestLimit);
    if (!quota.allowed) {
      return res.status(429).json({
        error: "AI quota exhausted",
        message: "You have used all your AI requests for this month.",
        aiQuota: { used: quota.used, limit: quota.limit, remaining: 0 },
      });
    }

    const result = await aiService.generateChat({
      prompt: prompt.trim(),
      model,
      sessionId,
    });

    Logger.success("Successfully generated chat response.");

    return res.status(200).json({
      success: true,
      data: result,
      aiQuota: { used: quota.used, limit: quota.limit, remaining: quota.remaining },
    });
  } catch (error: any) {
    Logger.error("Controller error in chatWithAi:", error);
    return res.status(500).json({
      error: "Chat Failed",
      message:
        error?.message ||
        "An unexpected error occurred during chat generation.",
    });
  }
};
