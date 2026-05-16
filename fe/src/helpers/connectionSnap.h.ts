import type { Element } from "@/types/element";

export type ConnectionPoint = "center" | "top" | "bottom" | "left" | "right";

export interface SnapResult {
  x: number;
  y: number;
  connection: { elementId: string; point: ConnectionPoint };
}

const SNAP_RADIUS = 20; // screen-independent canvas units

function getConnectionCoords(
  el: Element,
  point: ConnectionPoint,
): { x: number; y: number } {
  const minX = Math.min(el.x, el.x + (el.width ?? 0));
  const maxX = Math.max(el.x, el.x + (el.width ?? 0));
  const minY = Math.min(el.y, el.y + (el.height ?? 0));
  const maxY = Math.max(el.y, el.y + (el.height ?? 0));
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  switch (point) {
    case "center": return { x: cx, y: cy };
    case "top":    return { x: cx, y: minY };
    case "bottom": return { x: cx, y: maxY };
    case "left":   return { x: minX, y: cy };
    case "right":  return { x: maxX, y: cy };
  }
}

export function getConnectionCoordsForElement(
  el: Element,
  point: ConnectionPoint,
) {
  return getConnectionCoords(el, point);
}

const CANDIDATE_POINTS: ConnectionPoint[] = [
  "center", "top", "bottom", "left", "right",
];

export function findSnapTarget(
  cursorPoint: { x: number; y: number },
  elements: Element[],
  excludeElementId: string,
  scale: number,
): SnapResult | null {
  const snapRadius = SNAP_RADIUS / scale;
  let best: SnapResult | null = null;
  let bestDist = Infinity;

  for (const el of elements) {
    if (el.id === excludeElementId) continue;
    if (
      el.type === "Line" ||
      el.type === "Arrow" ||
      el.type === "Pencil" ||
      el.type === "Text" ||
      el.type === "Image"
    )
      continue;
    if (el.width === undefined || el.height === undefined) continue;

    for (const cp of CANDIDATE_POINTS) {
      const coords = getConnectionCoords(el, cp);
      const dist = Math.hypot(
        cursorPoint.x - coords.x,
        cursorPoint.y - coords.y,
      );
      if (dist <= snapRadius && dist < bestDist) {
        bestDist = dist;
        best = { x: coords.x, y: coords.y, connection: { elementId: el.id, point: cp } };
      }
    }
  }

  return best;
}