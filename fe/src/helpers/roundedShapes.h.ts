/** Corner radius for rounded rectangle "curve" style (soft, Excalidraw-like). */
export function rectangleCurveRadius(absW: number, absH: number): number {
  const w = Math.abs(absW);
  const h = Math.abs(absH);
  const m = Math.min(w, h);
  if (m <= 0) return 0;
  return Math.min(m * 0.1, m / 2 - 0.25);
}

/** Corner radius for rounded diamond "curve" style. */
export function diamondCurveRadius(hw: number, hh: number): number {
  const edgeLen = Math.hypot(hw, hh);
  if (edgeLen <= 0) return 0;
  const cap = Math.min(hw, hh) * 0.46;
  return Math.max(0, Math.min(edgeLen * 0.1, cap, edgeLen / 2 - 0.5));
}

export function pointOnSegment(
  from: { x: number; y: number },
  to: { x: number; y: number },
  distance: number,
): { x: number; y: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  return {
    x: from.x + (dx / len) * distance,
    y: from.y + (dy / len) * distance,
  };
}

/**
 * Convex polygon with quadratic corner fillets (avoids Canvas `arcTo` bugs on
 * acute diamonds). Vertices visited clockwise starting at `vertices[0]`.
 */
export function addRoundedConvexPolygonPath(
  ctx: CanvasRenderingContext2D,
  vertices: { x: number; y: number }[],
  radius: number,
): void {
  const n = vertices.length;
  if (n < 3) return;

  const rawR = Math.max(0, radius);
  if (rawR <= 0.25) {
    ctx.moveTo(vertices[0].x, vertices[0].y);
    for (let i = 1; i < n; i++) ctx.lineTo(vertices[i].x, vertices[i].y);
    ctx.closePath();
    return;
  }

  /** Max fillet radius at vertex `i` so cut points stay on adjacent edges */
  let r = rawR;
  for (let i = 0; i < n; i++) {
    const curr = vertices[i];
    const prev = vertices[(i + n - 1) % n];
    const next = vertices[(i + 1) % n];
    const dIn = Math.hypot(curr.x - prev.x, curr.y - prev.y);
    const dOut = Math.hypot(next.x - curr.x, next.y - curr.y);
    const maxAt = Math.min(dIn, dOut) / 2 - 0.25;
    r = Math.min(r, Math.max(0, maxAt));
  }

  if (r <= 0.25) {
    ctx.moveTo(vertices[0].x, vertices[0].y);
    for (let i = 1; i < n; i++) ctx.lineTo(vertices[i].x, vertices[i].y);
    ctx.closePath();
    return;
  }

  const cutsIn = vertices.map((curr, i) => {
    const prev = vertices[(i + n - 1) % n];
    return pointOnSegment(curr, prev, r);
  });
  const cutsOut = vertices.map((curr, i) => {
    const next = vertices[(i + 1) % n];
    return pointOnSegment(curr, next, r);
  });

  ctx.moveTo(cutsIn[0].x, cutsIn[0].y);
  for (let i = 0; i < n; i++) {
    const curr = vertices[i];
    ctx.quadraticCurveTo(curr.x, curr.y, cutsOut[i].x, cutsOut[i].y);
    const nextIncoming = cutsIn[(i + 1) % n];
    ctx.lineTo(nextIncoming.x, nextIncoming.y);
  }
  ctx.closePath();
}

/**
 * Diamond path with optional rounded vertices (radius 0 = sharp polygon).
 */
export function addRoundedDiamondPath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  hw: number,
  hh: number,
  radius: number,
): void {
  const edgeLen = Math.hypot(hw, hh);
  if (!Number.isFinite(edgeLen) || edgeLen <= 0) return;

  const rawR = Math.max(0, radius);
  const maxByEdge = edgeLen / 2 - 0.5;
  const r = Math.min(rawR, Math.max(0, maxByEdge));

  const top = { x: cx, y: cy - hh };
  const right = { x: cx + hw, y: cy };
  const bottom = { x: cx, y: cy + hh };
  const left = { x: cx - hw, y: cy };
  const vertices = [top, right, bottom, left];

  addRoundedConvexPolygonPath(ctx, vertices, r);
}
