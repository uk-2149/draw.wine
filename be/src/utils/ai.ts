import { GoogleGenerativeAI } from "@google/generative-ai";
import { gemini_api_key } from "../constants/e";

// Initialize the Gemini client
export const ai = new GoogleGenerativeAI(gemini_api_key);

export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
export const SUPPORTED_GEMINI_MODELS = new Set([
  DEFAULT_GEMINI_MODEL,
  "gemini-2.5-pro",
]);
