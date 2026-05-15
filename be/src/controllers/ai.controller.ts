import { Request, Response } from "express";
import aiService, { AiDrawingRequest } from "../services/ai.service";
import { Logger } from "../helpers/ext.h";

export const generateDrawing = async (req: Request, res: Response): Promise<any> => {
  try {
    const { prompt, mode }: AiDrawingRequest = req.body;

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

    Logger.info(`AI generation requested. Mode: ${mode || "vector"}, Prompt: "${prompt.substring(0, 60)}..."`);

    const result = await aiService.generateDrawing({ prompt: prompt.trim(), mode });

    Logger.success(`Successfully generated ${result.elements.length} elements.`);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    Logger.error("Controller error in generateDrawing:", error);
    return res.status(500).json({
      error: "Generation Failed",
      message: error?.message || "An unexpected error occurred during AI generation.",
    });
  }
};
