import { be_url } from "@/env/e";
import type { AiDrawingResponse, AiMode } from "@/contexts/ai/types";

export const generateAiDrawing = async (prompt: string, mode: AiMode): Promise<AiDrawingResponse> => {
  const response = await fetch(`${be_url}/api/ai/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt, mode }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || data.error || "Failed to generate drawing");
  }

  return data.data;
};
