import { SchemaType, Schema } from "@google/generative-ai";
import { gemini_api_key } from "../constants/e";
import { Logger } from "../helpers/ext.h";
import {
  systemInstruction_generateChatReply,
  systemInstruction_generateRasterDrawing,
  systemInstruction_generateVectorDrawing,
} from "../constants/ai";
import { ai } from "../utils/ai";
import {
  generateContentWithRetry,
  getGeminiFetchStatus,
  getGeminiRetryDelaySeconds,
  parseGeminiJson,
  resolveGeminiModel,
  sleep,
} from "../helpers/ai.h";
import {
  AiChatRequest,
  AiChatResponse,
  AiDrawingRequest,
  AiDrawingResponse,
  GeneratedElement,
} from "../types";

class AiService {
  private isConfigured(): boolean {
    return !!gemini_api_key && gemini_api_key.length > 0;
  }

  async generateDrawing(request: AiDrawingRequest): Promise<AiDrawingResponse> {
    const { prompt, mode = "vector", model } = request;
    const resolvedModel = resolveGeminiModel(model);

    if (!this.isConfigured()) {
      Logger.warn("GEMINI_API_KEY is not set. Returning simulation data.");
      return this.getSimulationData(prompt, mode);
    }

    try {
      if (mode === "raster") {
        return await this.generateRasterDrawing(prompt, resolvedModel);
      } else {
        return await this.generateVectorDrawing(prompt, resolvedModel);
      }
    } catch (error) {
      Logger.error("Error generating drawing from Gemini:", error);
      throw new Error("Failed to generate drawing using AI. Please try again.");
    }
  }

  async generateChat(request: AiChatRequest): Promise<AiChatResponse> {
    const { prompt, model } = request;
    const resolvedModel = resolveGeminiModel(model);

    if (!this.isConfigured()) {
      Logger.warn("GEMINI_API_KEY is not set. Returning simulated chat.");
      return this.getChatSimulation(prompt);
    }

    try {
      return await this.generateChatReply(prompt, resolvedModel);
    } catch (error) {
      const status = getGeminiFetchStatus(error);
      if (status === 429) {
        const retryDelaySeconds = getGeminiRetryDelaySeconds(error);
        const retryMessage = retryDelaySeconds
          ? `Rate limit reached. Please retry in about ${retryDelaySeconds}s.`
          : "Rate limit reached. Please try again in a moment.";
        Logger.warn(retryMessage);
        return { message: retryMessage };
      }
      Logger.error("Error generating chat response from Gemini:", error);
      throw new Error("Failed to generate chat response. Please try again.");
    }
  }

  private async generateVectorDrawing(
    prompt: string,
    modelName: string,
  ): Promise<AiDrawingResponse> {
    // Define the schema using the new SDK Type enum
    const elementSchema: Schema = {
      type: SchemaType.OBJECT,
      properties: {
        type: {
          type: SchemaType.STRING,
          description:
            "Must be one of: Rectangle, Diamond, Circle, Arrow, Line, Text",
        },
        x: {
          type: SchemaType.INTEGER,
          description: "X coordinate relative to center (0,0).",
        },
        y: {
          type: SchemaType.INTEGER,
          description: "Y coordinate relative to center (0,0).",
        },
        width: {
          type: SchemaType.INTEGER,
          description:
            "Width of the element (required for Rectangle, Diamond, Circle). Typical range 50 to 400.",
        },
        height: {
          type: SchemaType.INTEGER,
          description:
            "Height of the element (required for Rectangle, Diamond, Circle). Typical range 50 to 400.",
        },
        text: {
          type: SchemaType.STRING,
          description: "Text content if type is Text.",
        },
        fontSize: {
          type: SchemaType.INTEGER,
          description: "Font size if type is Text. Default is 20.",
        },
        strokeColor: {
          type: SchemaType.STRING,
          description:
            "Hex color code for stroke/border. Use professional rich aesthetic colors.",
        },
        fillColor: {
          type: SchemaType.STRING,
          description:
            "Hex color code for background fill if applicable. Optional.",
        },
        strokeWidth: {
          type: SchemaType.INTEGER,
          description: "Stroke thickness, default 2.",
        },
        edgeStyle: {
          type: SchemaType.STRING,
          description: "Either 'sharp' or 'curve' for Rectangle or Diamond.",
        },
      },
      required: ["type", "x", "y"],
    };

    const responseSchema: Schema = {
      type: SchemaType.OBJECT,
      properties: {
        elements: {
          type: SchemaType.ARRAY,
          items: elementSchema,
          description:
            "A comprehensive array of drawing elements creating the visual diagram/scene requested by the user.",
        },
      },
      required: ["elements"],
    };

    // Using gemini-2.5-flash as default high-speed structured model
    const model = ai.getGenerativeModel({
      model: modelName,
      systemInstruction: systemInstruction_generateVectorDrawing,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.2,
        maxOutputTokens: 4096,
      },
    });

    const responseResult = await generateContentWithRetry(
      () => model.generateContent(prompt),
      "vector",
    );
    const text = responseResult.response.text();
    if (!text) {
      throw new Error("Empty response received from model");
    }

    const parsed = parseGeminiJson<{ elements?: GeneratedElement[] }>(text);
    return {
      elements: parsed.elements || [],
      isRaster: false,
    };
  }

  private async generateChatReply(
    prompt: string,
    modelName: string,
  ): Promise<AiChatResponse> {
    const model = ai.getGenerativeModel({
      model: modelName,
      systemInstruction: systemInstruction_generateChatReply,
      generationConfig: {
        temperature: 0.6,
        maxOutputTokens: 256,
      },
    });

    const responseResult = await generateContentWithRetry(
      () => model.generateContent(prompt),
      "chat",
    );
    const text = responseResult.response.text();
    if (!text) {
      throw new Error("Empty response received from model");
    }

    return { message: text.trim() };
  }

  private async generateRasterDrawing(
    prompt: string,
    modelName: string,
  ): Promise<AiDrawingResponse> {
    const responseSchema: Schema = {
      type: SchemaType.OBJECT,
      properties: {
        svgContent: {
          type: SchemaType.STRING,
          description:
            "Complete raw SVG source code string starting with <svg> and ending with </svg>.",
        },
      },
      required: ["svgContent"],
    };

    const model = ai.getGenerativeModel({
      model: modelName,
      systemInstruction: systemInstruction_generateRasterDrawing,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.7,
      },
    });

    const responseResult = await generateContentWithRetry(
      () =>
        model.generateContent(
          `Generate a detailed high-quality SVG illustration for the following description: ${prompt}`,
        ),
      "raster",
    );
    const text = responseResult.response.text();
    if (!text) {
      throw new Error("Empty response received from model");
    }

    const parsed = parseGeminiJson<{ svgContent?: string }>(text);
    const svgContent = parsed.svgContent || "";

    // Encode SVG to a reliable Data URI
    const encodedSvg = encodeURIComponent(svgContent.trim())
      .replace(/'/g, "%27")
      .replace(/"/g, "%22");
    const dataUri = `data:image/svg+xml;charset=utf-8,${encodedSvg}`;

    // Return as a single Image element
    return {
      elements: [
        {
          type: "Image",
          x: -250,
          y: -250,
          width: 500,
          height: 500,
          // We map the generated image data URI to be consumed by the frontend Image tool
          text: dataUri,
        },
      ],
      isRaster: true,
    };
  }

  private getSimulationData(
    prompt: string,
    mode: "vector" | "raster",
  ): AiDrawingResponse {
    Logger.info(
      `Simulating AI generation for prompt: "${prompt}" in mode: ${mode}`,
    );

    if (mode === "raster") {
      // Return a beautiful sample SVG encoded
      const sampleSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="100%" height="100%"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#ec4899"/><stop offset="100%" stop-color="#8b5cf6"/></linearGradient></defs><rect width="400" height="400" rx="20" fill="url(#g)"/><circle cx="200" cy="200" r="100" fill="#ffffff" opacity="0.2"/><text x="200" y="210" font-family="sans-serif" font-size="28" font-weight="bold" fill="#ffffff" text-anchor="middle">AI Raster Art</text></svg>`;
      const encoded = encodeURIComponent(sampleSvg)
        .replace(/'/g, "%27")
        .replace(/"/g, "%22");
      return {
        elements: [
          {
            type: "Image",
            x: -200,
            y: -200,
            width: 400,
            height: 400,
            text: `data:image/svg+xml;charset=utf-8,${encoded}`,
          },
        ],
        isRaster: true,
      };
    }

    // Default Vector simulation flow charts
    return {
      elements: [
        {
          type: "Rectangle",
          x: -200,
          y: -50,
          width: 140,
          height: 80,
          strokeColor: "#2563eb",
          fillColor: "#eff6ff",
          strokeWidth: 2,
          edgeStyle: "curve",
        },
        {
          type: "Text",
          x: -180,
          y: -15,
          text: "Client Request",
          fontSize: 16,
          strokeColor: "#1e3a8a",
        },
        {
          type: "Arrow",
          x: -50,
          y: -10,
          width: 80,
          height: 0,
          strokeColor: "#94a3b8",
          strokeWidth: 2,
        },
        {
          type: "Diamond",
          x: 40,
          y: -60,
          width: 120,
          height: 100,
          strokeColor: "#059669",
          fillColor: "#ecfdf5",
          strokeWidth: 2,
        },
        {
          type: "Text",
          x: 65,
          y: -15,
          text: "Gemini AI",
          fontSize: 16,
          strokeColor: "#065f46",
        },
      ],
      isRaster: false,
    };
  }

  private getChatSimulation(prompt: string): AiChatResponse {
    const normalized = prompt.trim();
    if (!normalized) {
      return {
        message:
          "Tell me what you want to draw and I will add it to the canvas.",
      };
    }

    return {
      message:
        "I can help with canvas layouts. Describe the diagram or layout you want to draw.",
    };
  }
}

export default new AiService();
