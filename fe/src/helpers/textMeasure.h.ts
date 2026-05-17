/**
 * Shared off-screen canvas for accurate text measurement.
 * Replaces the rough `text.length * fontSize * 0.6` heuristic
 * with proper canvas `measureText()` calls.
 */

let _measureCanvas: HTMLCanvasElement | null = null;
let _measureCtx: CanvasRenderingContext2D | null = null;

function getMeasureCtx(): CanvasRenderingContext2D {
  if (!_measureCanvas) {
    _measureCanvas = document.createElement("canvas");
    _measureCtx = _measureCanvas.getContext("2d");
  }
  return _measureCtx!;
}

export interface TextMeasureInput {
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: "normal" | "bold";
  fontStyle?: "normal" | "italic";
}

export interface TextMeasureResult {
  width: number;
  height: number;
  lineHeight: number;
  lines: string[];
}

/**
 * Measures the rendered dimensions of a text element, supporting
 * multiline text (split by "\n").
 */
export function measureTextElement(element: TextMeasureInput): TextMeasureResult {
  const text = element.text || "";
  const fontSize = element.fontSize || 20;
  const fontFamily = element.fontFamily || "Virgil";
  const fontWeight = element.fontWeight || "normal";
  const fontStyle = element.fontStyle || "normal";
  const lines = text.split("\n");
  const lineHeight = fontSize * 1.2;

  const ctx = getMeasureCtx();
  ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;

  let maxWidth = 0;
  for (const line of lines) {
    const metrics = ctx.measureText(line);
    maxWidth = Math.max(maxWidth, metrics.width);
  }

  return {
    width: Math.max(maxWidth, 1),
    height: Math.max(lines.length * lineHeight, fontSize),
    lineHeight,
    lines,
  };
}
