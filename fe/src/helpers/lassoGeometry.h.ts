import type { Position, Element } from "@/types/element";
import { measureTextElement } from "./textMeasure.h";

// ─── Ray-casting point-in-polygon ──────────────────────────────────────────────

/**
 * Determines whether a point lies inside a polygon using the ray-casting algorithm.
 * Casts a horizontal ray from the point to +∞ and counts edge crossings.
 */
export function isPointInPolygon(
  point: Position,
  polygon: Position[],
): boolean {
  if (polygon.length < 3) return false;

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x,
      yi = polygon[i].y;
    const xj = polygon[j].x,
      yj = polygon[j].y;

    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }
  return inside;
}

// ─── Bounding-box helpers for lasso hit-testing ────────────────────────────────

interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Returns the axis-aligned bounding box for an element.
 */
function getElementBBox(el: Element): BBox | null {
  switch (el.type) {
    case "Rectangle":
    case "Diamond":
    case "Circle":
    case "Image":
    case "Icon": {
      if (el.width !== undefined && el.height !== undefined) {
        return {
          minX: Math.min(el.x, el.x + el.width),
          maxX: Math.max(el.x, el.x + el.width),
          minY: Math.min(el.y, el.y + el.height),
          maxY: Math.max(el.y, el.y + el.height),
        };
      }
      return null;
    }
    case "Line":
    case "Arrow": {
      if (el.width !== undefined && el.height !== undefined) {
        return {
          minX: Math.min(el.x, el.x + el.width),
          maxX: Math.max(el.x, el.x + el.width),
          minY: Math.min(el.y, el.y + el.height),
          maxY: Math.max(el.y, el.y + el.height),
        };
      }
      return null;
    }
    case "Text": {
      if (!el.text) return null;
      const measured = measureTextElement(el);
      return {
        minX: el.x,
        maxX: el.x + measured.width,
        minY: el.y,
        maxY: el.y + measured.height,
      };
    }
    case "Pencil": {
      if (el.points && el.points.length > 0) {
        const xs = el.points.map((p) => p.x);
        const ys = el.points.map((p) => p.y);
        return {
          minX: Math.min(...xs),
          maxX: Math.max(...xs),
          minY: Math.min(...ys),
          maxY: Math.max(...ys),
        };
      }
      return null;
    }
    default:
      return null;
  }
}

/**
 * Test whether an element is inside the lasso polygon.
 *
 * Strategy: An element is considered "inside" if its center point is inside the
 * lasso polygon OR if all four corners of its bounding box are inside.
 * For pencil strokes, we test whether a majority of points are inside.
 */
export function isElementInsideLasso(
  el: Element,
  lassoPath: Position[],
): boolean {
  if (lassoPath.length < 3) return false;

  // Special handling for pencil: check if a majority of its points are inside
  if (el.type === "Pencil" && el.points && el.points.length > 0) {
    let insideCount = 0;
    for (const pt of el.points) {
      if (isPointInPolygon(pt, lassoPath)) insideCount++;
    }
    // Consider selected if > 50% of points are inside
    return insideCount > el.points.length * 0.5;
  }

  const bbox = getElementBBox(el);
  if (!bbox) return false;

  // Test center point
  const center: Position = {
    x: (bbox.minX + bbox.maxX) / 2,
    y: (bbox.minY + bbox.maxY) / 2,
  };

  if (isPointInPolygon(center, lassoPath)) return true;

  // Test all four corners
  const corners: Position[] = [
    { x: bbox.minX, y: bbox.minY },
    { x: bbox.maxX, y: bbox.minY },
    { x: bbox.maxX, y: bbox.maxY },
    { x: bbox.minX, y: bbox.maxY },
  ];

  const allInside = corners.every((c) => isPointInPolygon(c, lassoPath));
  return allInside;
}

// ─── Douglas-Peucker path simplification ───────────────────────────────────────

/**
 * Simplify a polyline/polygon path to reduce point count while preserving shape.
 * Uses the Douglas-Peucker algorithm.
 */
export function simplifyPath(
  points: Position[],
  tolerance: number = 2,
): Position[] {
  if (points.length <= 2) return points;

  // Find the point with maximum distance from the line between first and last
  let maxDist = 0;
  let maxIdx = 0;

  const first = points[0];
  const last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistance(points[i], first, last);
    if (d > maxDist) {
      maxDist = d;
      maxIdx = i;
    }
  }

  if (maxDist > tolerance) {
    const left = simplifyPath(points.slice(0, maxIdx + 1), tolerance);
    const right = simplifyPath(points.slice(maxIdx), tolerance);
    return [...left.slice(0, -1), ...right];
  }

  return [first, last];
}

function perpendicularDistance(
  point: Position,
  lineStart: Position,
  lineEnd: Position,
): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;

  if (dx === 0 && dy === 0) {
    return Math.hypot(point.x - lineStart.x, point.y - lineStart.y);
  }

  const num = Math.abs(
    dy * point.x - dx * point.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x,
  );
  const den = Math.hypot(dx, dy);

  return num / den;
}
