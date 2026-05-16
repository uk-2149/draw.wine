import { DEFAULT_GEMINI_MODEL, SUPPORTED_GEMINI_MODELS } from "../utils/ai";
import { Logger } from "./ext.h";

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/** HTTP statuses where Google's API often suggests retry (overload / transient). */
export const GEMINI_RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

export const getGeminiFetchStatus = (error: unknown): number | undefined => {
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as { status: unknown }).status;
    return typeof status === "number" ? status : undefined;
  }
  return undefined;
};

export const resolveGeminiModel = (model?: string | null): string => {
  if (model && SUPPORTED_GEMINI_MODELS.has(model)) {
    return model;
  }
  if (model) {
    Logger.warn(`Unsupported model requested: ${model}. Falling back.`);
  }
  return DEFAULT_GEMINI_MODEL;
};

export const parseRetryDelaySeconds = (value: string): number | undefined => {
  const match = value.match(/(\d+(?:\.\d+)?)s/i);
  if (!match) return undefined;
  const seconds = Number(match[1]);
  return Number.isFinite(seconds) ? Math.ceil(seconds) : undefined;
};

export const getGeminiRetryDelaySeconds = (error: unknown): number | undefined => {
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

export const generateContentWithRetry = async <T>(
  run: () => Promise<T>,
  context: string,
): Promise<T> => {
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

export const extractJsonCandidate = (text: string): string | null => {
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

export const truncateToBalancedJson = (text: string): string | null => {
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

export const forceBalanceJson = (text: string): string | null => {
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
export const JSON_NUMBER_PREFIX = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/;

export const isLikelyJsonNumberStart = (s: string, i: number): boolean => {
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
export const sanitizeJsonNumericLiterals = (json: string): string => {
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

export const parseGeminiJson = <T>(raw: string): T => {
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
