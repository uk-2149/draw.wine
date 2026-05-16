import type { GeneratedElement } from "@/contexts/ai/types";

const GRID_SIZE = 50; // Snap to 50px grid

/**
 * Snap coordinate to nearest grid point
 */
function snapToGrid(value: number, gridSize: number = GRID_SIZE): number {
  return Math.round(value / gridSize) * gridSize;
}

/**
 * Normalize AI-generated layout for clean, production-grade architecture diagrams.
 *
 * Pipeline:
 * 1. Grid-snap all shape coordinates and enforce minimum sizes
 * 2. Extract labels from shapes and generate centered Text elements
 * 3. Pass through Text elements (standalone annotations) with grid-snapped coords
 * 4. Pass through Arrow/Line connectors with their original AI coordinates
 * 5. Return ordered array: shapes → label texts → standalone texts → connectors
 */
export function normalizeAiLayout(
  elements: GeneratedElement[],
): GeneratedElement[] {
  if (elements.length === 0) return elements;

  // ═══ Classify elements ═══
  const shapes: GeneratedElement[] = [];
  const connectors: GeneratedElement[] = [];
  const standaloneTexts: GeneratedElement[] = [];

  for (const el of elements) {
    const type = el.type || "Rectangle";
    if (type === "Arrow" || type === "Line") {
      connectors.push(el);
    } else if (type === "Text") {
      standaloneTexts.push(el);
    } else {
      shapes.push(el);
    }
  }

  // ═══ Phase 1: Grid-snap shapes and enforce minimum sizes ═══
  const normalizedShapes: GeneratedElement[] = shapes.map((shape) => {
    const type = shape.type || "Rectangle";
    const isImageType = type === "Image";

    const x = snapToGrid(shape.x ?? 0);
    const y = snapToGrid(shape.y ?? 0);

    let width = shape.width;
    let height = shape.height;

    if (!isImageType) {
      // Enforce minimum sizes and snap to grid
      width = snapToGrid(Math.max(width ?? 200, 150));
      height = snapToGrid(Math.max(height ?? 100, 50));
    }

    return { ...shape, type, x, y, width, height };
  });

  // ═══ Phase 2: Generate centered label Text elements from shape labels ═══
  const labelTexts: GeneratedElement[] = [];
  for (const shape of normalizedShapes) {
    // Skip images — they don't get text labels
    if (shape.type === "Image") continue;

    const labelText = shape.label || shape.text;
    if (!labelText) continue;

    const fontSize = 16;
    const shapeW = shape.width ?? 200;
    const shapeH = shape.height ?? 100;
    const shapeX = shape.x ?? 0;
    const shapeY = shape.y ?? 0;

    // Estimate text width using Virgil-like metrics (wider than monospace)
    const estimatedTextWidth = labelText.length * fontSize * 0.55;

    // Center the text inside the shape bounding box
    const textX = shapeX + shapeW / 2 - estimatedTextWidth / 2;
    const textY = shapeY + shapeH / 2 - fontSize / 2;

    labelTexts.push({
      type: "Text",
      x: textX,
      y: textY,
      text: labelText,
      fontSize,
      strokeColor: shape.strokeColor || "#1e293b",
    });
  }

  // ═══ Phase 3: Grid-snap standalone text (annotations, layer titles) ═══
  const normalizedTexts: GeneratedElement[] = standaloneTexts.map((text) => ({
    ...text,
    x: snapToGrid(text.x ?? 0),
    y: snapToGrid(text.y ?? 0),
  }));

  // ═══ Phase 4: Pass connectors through as-is (AI coordinates are intentional) ═══
  // Arrow x/y/width/height encode start point and direction — don't mangle them
  const normalizedConnectors = connectors;

  // ═══ Assemble: shapes → label texts → standalone texts → connectors ═══
  return [
    ...normalizedShapes,
    ...labelTexts,
    ...normalizedTexts,
    ...normalizedConnectors,
  ];
}
