import type { Element } from "@/types/element";

// ─── Exported types ────────────────────────────────────────────────────────────

export interface ConnectionPoint {
  elementId: string;
  /**
   * Normalized [0,1] position on the shape's bounding box.
   * Re-projected onto the perimeter when the shape moves.
   * top-center = { x:0.5, y:0 }   right-center = { x:1, y:0.5 }
   */
  point: { x: number; y: number };
}

export interface SnapTarget {
  x: number;
  y: number;
  connection: ConnectionPoint;
}

// ─── Internal geometry helpers ─────────────────────────────────────────────────

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

function nearestOnSegment(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
): { x: number; y: number } {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { x: ax, y: ay };
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / lenSq, 0, 1);
  return { x: ax + t * dx, y: ay + t * dy };
}

function nearestOnRect(
  px: number, py: number,
  rx: number, ry: number, rw: number, rh: number,
): { x: number; y: number; nx: number; ny: number } {
  const edges = [
    { ax: rx,      ay: ry,      bx: rx + rw, by: ry      }, // top
    { ax: rx + rw, ay: ry,      bx: rx + rw, by: ry + rh }, // right
    { ax: rx + rw, ay: ry + rh, bx: rx,      by: ry + rh }, // bottom
    { ax: rx,      ay: ry + rh, bx: rx,      by: ry      }, // left
  ];
  let best = { x: rx, y: ry, dist: Infinity, nx: 0, ny: 0 };
  for (const seg of edges) {
    const p = nearestOnSegment(px, py, seg.ax, seg.ay, seg.bx, seg.by);
    const dist = Math.hypot(px - p.x, py - p.y);
    if (dist < best.dist) {
      best = {
        x: p.x, y: p.y, dist,
        nx: rw > 0 ? (p.x - rx) / rw : 0,
        ny: rh > 0 ? (p.y - ry) / rh : 0,
      };
    }
  }
  return best;
}

function nearestOnEllipse(
  px: number, py: number,
  cx: number, cy: number, rx: number, ry: number,
): { x: number; y: number; nx: number; ny: number } {
  const STEPS = 64;
  let best = { x: cx + rx, y: cy, dist: Infinity, angle: 0 };
  for (let i = 0; i < STEPS; i++) {
    const angle = (2 * Math.PI * i) / STEPS;
    const ex = cx + rx * Math.cos(angle);
    const ey = cy + ry * Math.sin(angle);
    const dist = Math.hypot(px - ex, py - ey);
    if (dist < best.dist) best = { x: ex, y: ey, dist, angle };
  }
  // Refine around best angle
  for (let di = -10; di <= 10; di++) {
    const angle = best.angle + (di * (2 * Math.PI)) / (STEPS * 10);
    const ex = cx + rx * Math.cos(angle);
    const ey = cy + ry * Math.sin(angle);
    const dist = Math.hypot(px - ex, py - ey);
    if (dist < best.dist) best = { x: ex, y: ey, dist, angle };
  }
  // Bounding box origin for this ellipse
  const box = cx - rx, boy = cy - ry;
  const bw = rx * 2, bh = ry * 2;
  return {
    x: best.x, y: best.y,
    nx: bw > 0 ? (best.x - box) / bw : 0.5,
    ny: bh > 0 ? (best.y - boy) / bh : 0.5,
  };
}

function nearestOnDiamond(
  px: number, py: number,
  x: number, y: number, w: number, h: number,
): { x: number; y: number; nx: number; ny: number } {
  const cx = x + w / 2, cy = y + h / 2;
  const top    = { x: cx,     y };
  const right  = { x: x + w,  y: cy };
  const bottom = { x: cx,     y: y + h };
  const left   = { x,         y: cy };
  const edges  = [
    { a: top,    b: right  },
    { a: right,  b: bottom },
    { a: bottom, b: left   },
    { a: left,   b: top    },
  ];
  let best = { x: cx, y, dist: Infinity, nx: 0.5, ny: 0 };
  for (const edge of edges) {
    const p = nearestOnSegment(px, py, edge.a.x, edge.a.y, edge.b.x, edge.b.y);
    const dist = Math.hypot(px - p.x, py - p.y);
    if (dist < best.dist) {
      best = {
        x: p.x, y: p.y, dist,
        nx: w > 0 ? (p.x - x) / w : 0.5,
        ny: h > 0 ? (p.y - y) / h : 0.5,
      };
    }
  }
  return best;
}

// ─── Public API ────────────────────────────────────────────────────────────────

/** Screen-pixel radius within which a shape perimeter snaps the cursor. */
const SNAP_RADIUS_PX = 20;

/**
 * Find the nearest connection snap on any shape perimeter near [point].
 * Pass the line/arrow's own id as [excludeId] so it doesn't snap to itself.
 */
export function findSnapTarget(
  point: { x: number; y: number },
  elements: Element[],
  excludeId: string,
  scale: number,
): SnapTarget | null {
  const snapRadius = SNAP_RADIUS_PX / scale;
  let bestDist = snapRadius;
  let bestSnap: SnapTarget | null = null;

  for (const el of elements) {
    if (el.id === excludeId) continue;

    switch (el.type) {
      case "Rectangle":
      case "Image": {
        if (el.width === undefined || el.height === undefined) break;
        const rw = Math.abs(el.width), rh = Math.abs(el.height);
        const rx = el.width  < 0 ? el.x + el.width  : el.x;
        const ry = el.height < 0 ? el.y + el.height : el.y;
        if (
          point.x < rx - snapRadius || point.x > rx + rw + snapRadius ||
          point.y < ry - snapRadius || point.y > ry + rh + snapRadius
        ) break;
        const p = nearestOnRect(point.x, point.y, rx, ry, rw, rh);
        const dist = Math.hypot(point.x - p.x, point.y - p.y);
        if (dist < bestDist) {
          bestDist = dist;
          bestSnap = { x: p.x, y: p.y, connection: { elementId: el.id, point: { x: p.nx, y: p.ny } } };
        }
        break;
      }

      case "Diamond": {
        if (el.width === undefined || el.height === undefined) break;
        const dw = Math.abs(el.width), dh = Math.abs(el.height);
        const dx = el.width  < 0 ? el.x + el.width  : el.x;
        const dy = el.height < 0 ? el.y + el.height : el.y;
        if (
          point.x < dx - snapRadius || point.x > dx + dw + snapRadius ||
          point.y < dy - snapRadius || point.y > dy + dh + snapRadius
        ) break;
        const p = nearestOnDiamond(point.x, point.y, dx, dy, dw, dh);
        const dist = Math.hypot(point.x - p.x, point.y - p.y);
        if (dist < bestDist) {
          bestDist = dist;
          bestSnap = { x: p.x, y: p.y, connection: { elementId: el.id, point: { x: p.nx, y: p.ny } } };
        }
        break;
      }

      case "Circle": {
        if (el.width === undefined || el.height === undefined) break;
        const ew = Math.abs(el.width), eh = Math.abs(el.height);
        const ecx = el.x + el.width  / 2;
        const ecy = el.y + el.height / 2;
        const erx = ew / 2, ery = eh / 2;
        if (Math.hypot(point.x - ecx, point.y - ecy) > Math.max(erx, ery) + snapRadius) break;
        const p = nearestOnEllipse(point.x, point.y, ecx, ecy, erx, ery);
        const dist = Math.hypot(point.x - p.x, point.y - p.y);
        if (dist < bestDist) {
          bestDist = dist;
          bestSnap = { x: p.x, y: p.y, connection: { elementId: el.id, point: { x: p.nx, y: p.ny } } };
        }
        break;
      }

      default:
        break;
    }
  }

  return bestSnap;
}

/**
 * Re-project a stored normalized connection point back to absolute canvas
 * coordinates, given the shape's current position/size.
 * Called when a connected shape moves so the arrow endpoint follows it.
 */
export function getConnectionCoordsForElement(
  el: Element,
  normalizedPoint: { x: number; y: number },
): { x: number; y: number } {
  switch (el.type) {
    case "Rectangle":
    case "Image": {
      if (el.width === undefined || el.height === undefined) return { x: el.x, y: el.y };
      const rw = Math.abs(el.width), rh = Math.abs(el.height);
      const rx = el.width  < 0 ? el.x + el.width  : el.x;
      const ry = el.height < 0 ? el.y + el.height : el.y;
      return { x: rx + normalizedPoint.x * rw, y: ry + normalizedPoint.y * rh };
    }

    case "Diamond": {
      if (el.width === undefined || el.height === undefined) return { x: el.x, y: el.y };
      const dw = Math.abs(el.width), dh = Math.abs(el.height);
      const dx = el.width  < 0 ? el.x + el.width  : el.x;
      const dy = el.height < 0 ? el.y + el.height : el.y;
      // Re-project bbox point → nearest diamond perimeter point
      const bpx = dx + normalizedPoint.x * dw;
      const bpy = dy + normalizedPoint.y * dh;
      const p = nearestOnDiamond(bpx, bpy, dx, dy, dw, dh);
      return { x: p.x, y: p.y };
    }

    case "Circle": {
      if (el.width === undefined || el.height === undefined) return { x: el.x, y: el.y };
      const ew = Math.abs(el.width), eh = Math.abs(el.height);
      const ecx = el.x + el.width  / 2;
      const ecy = el.y + el.height / 2;
      const erx = ew / 2, ery = eh / 2;
      const box = el.width  < 0 ? el.x + el.width  : el.x;
      const boy = el.height < 0 ? el.y + el.height : el.y;
      const bpx = box + normalizedPoint.x * ew;
      const bpy = boy + normalizedPoint.y * eh;
      const p = nearestOnEllipse(bpx, bpy, ecx, ecy, erx, ery);
      return { x: p.x, y: p.y };
    }

    default:
      return { x: el.x, y: el.y };
  }
}