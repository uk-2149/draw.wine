import { Request, Response } from "express";
import aiService, {
  AiChatRequest,
  AiDrawingRequest,
} from "../services/ai.service";
import { Logger } from "../helpers/ext.h";

export const generateDrawing = async (
  req: Request,
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

export const chatWithAi = async (req: Request, res: Response): Promise<any> => {
  try {
    const { prompt, model }: AiChatRequest = req.body;

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
      `AI chat requested. Model: ${model || "default"}, Prompt: "${prompt.substring(0, 60)}..."`,
    );

    const result = await aiService.generateChat({
      prompt: prompt.trim(),
      model,
    });

    Logger.success("Successfully generated chat response.");

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    Logger.error("Controller error in chatWithAi:", error);
    return res.status(500).json({
      error: "Chat Failed",
      message: error?.message || "An unexpected error occurred during chat.",
    });
  }
};
