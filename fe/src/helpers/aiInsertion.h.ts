import type { GeneratedElement } from "@/contexts/ai/types";
import { normalizeAiLayout } from "./normalizeAiLayout.h";

export const insertAiElementsIntoCanvas = (
  generatedElements: GeneratedElement[],
): void => {
  // Normalize the layout for clean, aligned diagrams
  const normalizedElements = normalizeAiLayout(generatedElements);

  // Dispatch custom event to notify canvas board directly with the generated elements
  window.dispatchEvent(
    new CustomEvent("ai-elements-generated", {
      detail: { generatedElements: normalizedElements },
    }),
  );
};
