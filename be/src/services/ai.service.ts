import { SchemaType, Schema } from "@google/generative-ai";
import {
  augmentedPrompt,
  gemini_api_key,
  systemInstruction_generateChatReply,
  systemInstruction_generateRasterDrawing,
  systemInstruction_generateVectorDrawing,
} from "../constants";
import {
  AiChatRequest,
  AiChatResponse,
  AiDrawingRequest,
  AiDrawingResponse,
  GeneratedElement,
} from "../types";
import {
  generateContentWithRetry,
  getGeminiFetchStatus,
  getGeminiRetryDelaySeconds,
  Logger,
  parseGeminiJson,
  resolveGeminiModel,
} from "../helpers";
import { ai } from "../utils/ai";
import sessionManager from "./session.service";

type GeminiTextResponse = {
  response: {
    text: () => string;
  };
};

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
    const { prompt, model, sessionId } = request;
    const resolvedModel = resolveGeminiModel(model);

    if (!this.isConfigured()) {
      Logger.warn("GEMINI_API_KEY is not set. Returning simulated chat.");
      return this.getChatSimulation(prompt);
    }

    try {
      const response = await this.generateChatReply(
        prompt,
        resolvedModel,
        sessionId,
      );
      return response;
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
            "Shape type. Must be one of: Rectangle, Diamond, Circle, Arrow, Line, Text",
        },
        x: {
          type: SchemaType.INTEGER,
          description: "X coordinate (multiple of 50).",
        },
        y: {
          type: SchemaType.INTEGER,
          description: "Y coordinate (multiple of 50).",
        },
        width: {
          type: SchemaType.INTEGER,
          description:
            "Width. For shapes: size (min 150). For Arrow/Line: horizontal delta to endpoint.",
        },
        height: {
          type: SchemaType.INTEGER,
          description:
            "Height. For shapes: size (min 50). For Arrow/Line: vertical delta to endpoint (0 for horizontal arrows).",
        },
        label: {
          type: SchemaType.STRING,
          description:
            "Text label centered inside the shape. REQUIRED for Rectangle, Diamond, Circle.",
        },
        text: {
          type: SchemaType.STRING,
          description: "Text content for type=Text elements only.",
        },
        fontSize: {
          type: SchemaType.INTEGER,
          description: "Font size for Text elements.",
        },
        strokeColor: {
          type: SchemaType.STRING,
          description: "Hex color for stroke (e.g. #0066CC).",
        },
        fillColor: {
          type: SchemaType.STRING,
          description:
            "Hex color for fill (e.g. #E8F4F8). Required for shapes.",
        },
        strokeWidth: {
          type: SchemaType.INTEGER,
          description: "Stroke thickness. Default 2.",
        },
        edgeStyle: {
          type: SchemaType.STRING,
          description: "Edge style: 'curve' or 'sharp'.",
        },
      },
      required: ["type", "x", "y", "width", "height", "strokeColor"],
    };

    const responseSchema: Schema = {
      type: SchemaType.OBJECT,
      properties: {
        elements: {
          type: SchemaType.ARRAY,
          items: elementSchema,
          description: "Array of diagram elements (15-30 elements).",
        },
      },
      required: ["elements"],
    };

    // Disable thinking for structured output — thinking consumes output tokens
    // and leaves too few for the actual JSON response
    const model = ai.getGenerativeModel({
      model: modelName,
      systemInstruction: systemInstruction_generateVectorDrawing,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.4,
        maxOutputTokens: 16384,
        // @ts-ignore — thinkingConfig is supported by the API but not typed in SDK v0.24
        thinkingConfig: { thinkingBudget: 0 },
      } as any,
    });

    const responseResult = await generateContentWithRetry<GeminiTextResponse>(
      () => model.generateContent(augmentedPrompt(prompt)),
      "vector",
    );
    const text = responseResult.response.text();
    if (!text) {
      throw new Error("Empty response received from model");
    }

    Logger.info(
      `Gemini raw response (first 500 chars): ${text.substring(0, 500)}`,
    );

    const parsed = parseGeminiJson<{ elements?: GeneratedElement[] }>(text);

    Logger.info(
      `Parsed ${parsed.elements?.length ?? 0} elements. Types: ${(parsed.elements || []).map((e) => e.type).join(", ")}`,
    );

    return {
      elements: parsed.elements || [],
      isRaster: false,
    };
  }

  private async generateChatReply(
    prompt: string,
    modelName: string,
    sessionId?: string,
  ): Promise<AiChatResponse> {
    // Generate a session ID if not provided
    const effectiveSessionId =
      sessionId ||
      `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const model = ai.getGenerativeModel({
      model: modelName,
      systemInstruction: systemInstruction_generateChatReply,
      generationConfig: {
        temperature: 0.6,
        maxOutputTokens: 256,
      },
    });

    const chatSession = sessionManager.getOrCreateSession(
      effectiveSessionId,
      () => model.startChat(),
    );

    const responseResult = await generateContentWithRetry<GeminiTextResponse>(
      () => chatSession.sendMessage(prompt),
      "chat",
    );

    const text = responseResult.response.text();
    if (!text) {
      throw new Error("Empty response received from model");
    }

    // Note: getHistory() returns the message history from this chat session
    // which means the model has access to prior messages without resending them
    Logger.info(
      `[Chat] Used session: ${effectiveSessionId} | Conversation maintained with prior context`,
    );

    return {
      message: text.trim(),
      sessionId: effectiveSessionId,
    };
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

    const responseResult = await generateContentWithRetry<GeminiTextResponse>(
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
          x: 0,
          y: 0,
          width: 200,
          height: 100,
          strokeColor: "#0066CC",
          fillColor: "#E8F4F8",
          strokeWidth: 2,
          edgeStyle: "curve",
          label: "Client Request",
        },
        {
          type: "Arrow",
          x: 200,
          y: 50,
          width: 100,
          height: 0,
          strokeColor: "#64748B",
          strokeWidth: 2,
        },
        {
          type: "Diamond",
          x: 300,
          y: 0,
          width: 150,
          height: 150,
          strokeColor: "#2E7D32",
          fillColor: "#E8F5E9",
          strokeWidth: 2,
          edgeStyle: "curve",
          label: "Gemini AI",
        },
        {
          type: "Arrow",
          x: 450,
          y: 75,
          width: 100,
          height: 0,
          strokeColor: "#64748B",
          strokeWidth: 2,
        },
        {
          type: "Rectangle",
          x: 550,
          y: 0,
          width: 200,
          height: 100,
          strokeColor: "#7B1FA2",
          fillColor: "#F3E5F5",
          strokeWidth: 2,
          edgeStyle: "curve",
          label: "Canvas Output",
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
