import { be_url } from "@/env/e";
import type { AiDrawingResponse, AiMode, AiModel } from "@/contexts/ai/types";

type AiChatResponse = {
  message: string;
  sessionId?: string; // for conversation history
};

export const generateAiDrawing = async (
  prompt: string,
  mode: AiMode,
  model?: AiModel | null,
): Promise<AiDrawingResponse> => {
  const response = await fetch(`${be_url}/api/ai/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt, mode, model: model ?? undefined }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || data.error || "Failed to generate drawing");
  }

  return data.data;
};

export const generateAiChat = async (
  prompt: string,
  model?: AiModel | null,
  sessionId?: string | null,
): Promise<AiChatResponse> => {
  const response = await fetch(`${be_url}/api/ai/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      model: model ?? undefined,
      sessionId: sessionId ?? undefined,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || data.error || "Failed to generate reply");
  }

  return data.data;
};
