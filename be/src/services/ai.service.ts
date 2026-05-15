import { GoogleGenerativeAI, SchemaType, Schema } from "@google/generative-ai";
import { gemini_api_key } from "../constants/e";
import { Logger } from "../helpers/ext.h";

// Initialize the Gemini client
const ai = new GoogleGenerativeAI(gemini_api_key);

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const SUPPORTED_GEMINI_MODELS = new Set([
  DEFAULT_GEMINI_MODEL,
  "gemini-2.5-pro",
]);

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/** HTTP statuses where Google's API often suggests retry (overload / transient). */
const GEMINI_RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

const getGeminiFetchStatus = (error: unknown): number | undefined => {
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as { status: unknown }).status;
    return typeof status === "number" ? status : undefined;
  }
  return undefined;
};

const resolveGeminiModel = (model?: string | null): string => {
  if (model && SUPPORTED_GEMINI_MODELS.has(model)) {
    return model;
  }
  if (model) {
    Logger.warn(`Unsupported model requested: ${model}. Falling back.`);
  }
  return DEFAULT_GEMINI_MODEL;
};

const parseRetryDelaySeconds = (value: string): number | undefined => {
  const match = value.match(/(\d+(?:\.\d+)?)s/i);
  if (!match) return undefined;
  const seconds = Number(match[1]);
  return Number.isFinite(seconds) ? Math.ceil(seconds) : undefined;
};

const getGeminiRetryDelaySeconds = (error: unknown): number | undefined => {
  if (!error || typeof error !== "object" || !("errorDetails" in error)) {
    return undefined;
  }
  const details = (error as { errorDetails?: unknown }).errorDetails;
  if (!Array.isArray(details)) return undefined;

  const retryInfo = details.find(
    (detail) => detail && typeof detail === "object" && "retryDelay" in detail,
  ) as { retryDelay?: unknown } | undefined;
  if (!retryInfo || typeof retryInfo.retryDelay !== "string") {
    return undefined;
  }
  return parseRetryDelaySeconds(retryInfo.retryDelay);
};

async function generateContentWithRetry<T>(
  run: () => Promise<T>,
  context: string,
): Promise<T> {
  const maxAttempts = 5;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      const status = getGeminiFetchStatus(error);
      const retryable =
        status !== undefined && GEMINI_RETRYABLE_STATUS.has(status);
      if (!retryable || attempt === maxAttempts) {
        throw error;
      }
      const baseMs = 600;
      const backoff = Math.min(15_000, baseMs * 2 ** (attempt - 1));
      const jitter = Math.floor(Math.random() * 400);
      const delayMs = backoff + jitter;
      Logger.warn(
        `Gemini transient error ${String(status)}; waiting ${delayMs}ms before retry ${attempt + 1}/${maxAttempts} [${context}]`,
      );
      await sleep(delayMs);
    }
  }
  throw new Error("Gemini retry loop exhausted without success");
}

const extractJsonCandidate = (text: string): string | null => {
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch && fencedMatch[1]) {
    return fencedMatch[1].trim();
  }

  const objectStart = text.indexOf("{");
  const objectEnd = text.lastIndexOf("}");
  if (objectStart !== -1 && objectEnd > objectStart) {
    return text.slice(objectStart, objectEnd + 1);
  }

  const arrayStart = text.indexOf("[");
  const arrayEnd = text.lastIndexOf("]");
  if (arrayStart !== -1 && arrayEnd > arrayStart) {
    return text.slice(arrayStart, arrayEnd + 1);
  }

  return null;
};

const truncateToBalancedJson = (text: string): string | null => {
  const startIndex = text.search(/[\[{]/);
  if (startIndex === -1) {
    return null;
  }

  let inString = false;
  let escape = false;
  let braceCount = 0;
  let bracketCount = 0;
  let lastBalancedIndex = -1;

  for (let i = startIndex; i < text.length; i += 1) {
    const ch = text[i];

    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === "{") {
      braceCount += 1;
    } else if (ch === "}") {
      braceCount = Math.max(0, braceCount - 1);
    } else if (ch === "[") {
      bracketCount += 1;
    } else if (ch === "]") {
      bracketCount = Math.max(0, bracketCount - 1);
    }

    if (braceCount === 0 && bracketCount === 0) {
      lastBalancedIndex = i;
    }
  }

  if (lastBalancedIndex === -1) {
    return null;
  }

  return text.slice(startIndex, lastBalancedIndex + 1);
};

const forceBalanceJson = (text: string): string | null => {
  const startIndex = text.search(/[\[{]/);
  if (startIndex === -1) return null;

  let inString = false;
  let escape = false;
  const stack: ("{" | "[")[] = [];

  for (let i = startIndex; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") stack.push("{");
    else if (ch === "[") stack.push("[");
    else if (ch === "}") {
      if (stack[stack.length - 1] === "{") stack.pop();
    } else if (ch === "]") {
      if (stack[stack.length - 1] === "[") stack.pop();
    }
  }

  let result = text.slice(startIndex);
  if (inString) {
    result += '"';
  }

  result = result.replace(/(,|:\s*|\s+)$/, "");

  while (stack.length > 0) {
    const top = stack.pop();
    if (top === "{") result += "}";
    else if (top === "[") result += "]";
  }

  return result;
};

/** Maximal prefix that is a valid JSON number (RFC 8259). */
const JSON_NUMBER_PREFIX = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/;

const isLikelyJsonNumberStart = (s: string, i: number): boolean => {
  const c = s[i];
  if (c === "-" && /\d/.test(s[i + 1] ?? "")) {
    return true;
  }
  return c !== undefined && /\d/.test(c);
};

/**
 * Gemini sometimes emits huge float literals (FP noise / invalid continuation).
 * Normalize numeric tokens outside quoted strings so JSON.parse succeeds.
 */
const sanitizeJsonNumericLiterals = (json: string): string => {
  const out: string[] = [];
  let i = 0;
  let inString = false;
  let escape = false;

  while (i < json.length) {
    const ch = json[i];
    if (inString) {
      out.push(ch);
      if (escape) {
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      i += 1;
      continue;
    }
    if (ch === '"') {
      out.push(ch);
      inString = true;
      i += 1;
      continue;
    }

    if (isLikelyJsonNumberStart(json, i)) {
      const rest = json.slice(i);
      const match = rest.match(JSON_NUMBER_PREFIX);
      if (match && match[0].length > 0) {
        const raw = match[0];
        const n = Number(raw);
        let replacement = raw;
        if (Number.isFinite(n)) {
          const rounded = Math.round(n * 10_000) / 10_000;
          replacement = Number.isInteger(rounded)
            ? String(rounded)
            : String(rounded);
        }
        out.push(replacement);
        let j = i + raw.length;
        // Skip invalid repeated ".<digits>" tails (e.g. 150.000.000032…) that break JSON.parse
        while (j < json.length) {
          if (json[j] !== ".") {
            break;
          }
          let k = j + 1;
          while (k < json.length && /\d/.test(json[k])) {
            k += 1;
          }
          if (k > j + 1) {
            j = k;
            continue;
          }
          break;
        }
        i = j;
        continue;
      }
    }

    out.push(ch);
    i += 1;
  }

  return out.join("");
};

const parseGeminiJson = <T>(raw: string): T => {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("Empty response received from model");
  }

  const candidates = [trimmed, extractJsonCandidate(trimmed)].filter(
    (candidate): candidate is string => Boolean(candidate),
  );
  let lastError: unknown = null;

  const variants = candidates.flatMap((candidate) => {
    const balanced = truncateToBalancedJson(candidate);
    const forced = forceBalanceJson(candidate);
    return [candidate, balanced, forced].filter((value): value is string =>
      Boolean(value),
    );
  });

  for (const candidate of variants) {
    const sanitized = sanitizeJsonNumericLiterals(candidate);
    const attempts = Array.from(new Set([candidate, sanitized]));
    for (const attempt of attempts) {
      try {
        const parsed = JSON.parse(attempt) as T;
        const usedRecovery = candidate !== trimmed || attempt !== candidate;
        if (usedRecovery) {
          Logger.warn("Recovered partial JSON payload from Gemini response", {
            rawLength: trimmed.length,
            recoveredLength: attempt.length,
            usedExtractionOrBalance: candidate !== trimmed,
            usedNumericSanitize: attempt !== candidate,
          });
        }
        return parsed;
      } catch (error) {
        lastError = error;
      }
    }
  }

  Logger.error("Failed to parse JSON from Gemini response", {
    error: lastError,
    preview: trimmed.slice(0, 400),
  });
  throw new Error("Invalid JSON received from Gemini.");
};

export interface AiDrawingRequest {
  prompt: string;
  mode?: "vector" | "raster";
  model?: string;
}

export interface GeneratedElement {
  type: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  text?: string;
  fontSize?: number;
  strokeColor?: string;
  fillColor?: string;
  strokeWidth?: number;
  edgeStyle?: "sharp" | "curve";
  imageUrl?: string;
}

export interface AiDrawingResponse {
  elements: GeneratedElement[];
  isRaster?: boolean;
}

export interface AiChatRequest {
  prompt: string;
  model?: string;
}

export interface AiChatResponse {
  message: string;
}

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

    const systemInstruction = `You are an expert design assistant for a beautiful vector canvas drawing app called draw.wine.
Your goal is to convert natural language descriptions into professional, well-structured layout diagrams or illustrations composed of primitive elements: Rectangle, Diamond, Circle, Arrow, Line, and Text.
Coordinate System: Assume (0,0) is the center of the diagram. Arrange elements logically relative to each other using absolute distances.
Aesthetic Guidelines:
- Use curated, beautiful color palettes (e.g., modern tech blues, warm accents, elegant dark shades) instead of basic defaults.
- Always provide sensible widths and heights for shape elements.
- Space out nodes and link them clearly if the prompt implies a flowchart, process, or architecture diagram.
  - Limit output to at most 30 elements.
  - Use ONLY integer coordinates and sizes.
Output strictly as JSON adhering to the supplied schema.`;

    // Using gemini-2.5-flash as default high-speed structured model
    const model = ai.getGenerativeModel({
      model: modelName,
      systemInstruction,
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
    const systemInstruction = `You are a friendly assistant inside the draw.wine canvas app.
Keep replies concise (1-3 short sentences). If the user wants a diagram or drawing,
ask them to describe the layout they want on the canvas.`;

    const model = ai.getGenerativeModel({
      model: modelName,
      systemInstruction,
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
    const systemInstruction = `You are a world-class graphic designer and SVG generator.
The user wants a raster/photographic or highly detailed illustration. Since you output text, create a complete, beautifully designed standalone SVG code block representing the visual prompt.
Ensure the SVG is responsive, self-contained with a viewBox, uses rich aesthetic gradients, smooth curves, and gorgeous vibrant visual tokens.
Return ONLY valid raw JSON with a single string field 'svgContent' containing the complete XML/SVG code string. No markdown formatting outside the JSON.`;

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
      systemInstruction,
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
