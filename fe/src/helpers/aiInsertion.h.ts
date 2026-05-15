import type { Element } from "@/types/element";
import type { GeneratedElement } from "@/contexts/ai/types";
import { getCanvasViewport } from "./canvasState.h";

export const insertAiElementsIntoCanvas = (generatedElements: GeneratedElement[]): void => {
  // Dispatch custom event to notify canvas board directly with the generated elements
  window.dispatchEvent(
    new CustomEvent("ai-elements-generated", { detail: { generatedElements } })
  );
};
