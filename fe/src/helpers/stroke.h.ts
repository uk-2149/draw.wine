export type StrokePattern =
  | "solid"
  | "longDash"
  | "shortDash"
  | "dotted"
  | "bubbled";

export const STROKE_PATTERNS = [
  { value: "solid", label: "Solid" },
  { value: "longDash", label: "Long dash" },
  { value: "shortDash", label: "Short dash" },
  { value: "dotted", label: "Dotted" },
  { value: "bubbled", label: "Bubbled" },
] as const;

export const getStrokeDash = (
  pattern: StrokePattern | undefined,
  strokeWidth: number,
): number[] | undefined => {
  switch (pattern) {
    case "longDash":
      return [strokeWidth * 5, strokeWidth * 3];
    case "shortDash":
      return [strokeWidth * 2.5, strokeWidth * 2];
    case "dotted":
      return [strokeWidth * 0.6, strokeWidth * 2.4];
    case "bubbled":
      return [strokeWidth * 0.8, strokeWidth * 2.6];
    default:
      return undefined;
  }
};

export const drawBubbledPolyline = (
  ctx: CanvasRenderingContext2D,
  points: Array<{ x: number; y: number }>,
  strokeWidth: number,
  color: string,
) => {
  if (points.length === 0) return;

  const bubbleRadius = Math.max(strokeWidth * 0.45, 1.8);
  const spacing = Math.max(strokeWidth * 1.6, bubbleRadius * 2.8);

  const drawBubble = (x: number, y: number) => {
    ctx.beginPath();
    ctx.arc(x, y, bubbleRadius, 0, Math.PI * 2);
    ctx.fill();
  };

  ctx.save();
  ctx.fillStyle = color;
  ctx.lineWidth = 0;

  if (points.length === 1) {
    drawBubble(points[0].x, points[0].y);
    ctx.restore();
    return;
  }

  let firstSegment = true;
  for (let index = 0; index < points.length - 1; index++) {
    const start = points[index];
    const end = points[index + 1];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(length / spacing));

    for (let step = 0; step <= steps; step++) {
      if (!firstSegment && step === 0) continue;
      const progress = step / steps;
      drawBubble(start.x + dx * progress, start.y + dy * progress);
    }

    firstSegment = false;
  }

  ctx.restore();
};
