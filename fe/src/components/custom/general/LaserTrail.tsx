import { useEffect, useRef, useState } from "react";
import type { Position } from "@/types";
import type { LaserPoint } from "@/types/components";
import { NEON_RED } from "@/constants/ext";

export function useLaserTrail() {
  const [trail, setTrail] = useState<LaserPoint[]>([]);
  const animationFrame = useRef<number | null>(null);
  const lastPointRef = useRef<{ point: Position; timestamp: number } | null>(
    null,
  );
  const currentSessionId = useRef<string>(crypto.randomUUID());

  useEffect(() => {
    const animate = () => {
      const now = Date.now();
      setTrail((prevTrail) =>
        prevTrail
          .map((point) => ({
            ...point,
            opacity: Math.max(0, 1 - (now - point.timestamp) / 2700),
          }))
          .filter((point) => point.opacity > 0.05),
      );
      animationFrame.current = requestAnimationFrame(animate);
    };

    animationFrame.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current);
        animationFrame.current = null;
      }
    };
  }, []);

  const addPoint = (point: Position, color: string = NEON_RED) => {
    const now = Date.now();

    // If the last point was >300ms ago or too far away, start a new stroke segment
    const lastTrailPoint = lastPointRef.current;
    const timeSinceLast = lastTrailPoint
      ? now - lastTrailPoint.timestamp
      : Infinity;
    if (timeSinceLast > 150) {
      currentSessionId.current = crypto.randomUUID();
    }

    setTrail((prev) => {
      const recentPoints = prev.filter((p) => now - p.timestamp < 2000);
      return [
        ...recentPoints,
        {
          point,
          opacity: 1,
          timestamp: now,
          color,
          sessionId: currentSessionId.current,
        },
      ];
    });

    lastPointRef.current = { point, timestamp: now };
  };

  const clearTrail = () => {
    setTrail([]);
    lastPointRef.current = null;
    if (animationFrame.current) {
      cancelAnimationFrame(animationFrame.current);
      animationFrame.current = null;
    }
  };

  // Generate smooth SVG path using Catmull-Rom spline
  const getSmoothPath = () => {
    if (trail.length < 2) return "";

    const points = trail.map((t) => t.point);

    // For Catmull-Rom spline, we need at least 4 points
    // Duplicate first and last points for better behavior
    const allPoints = [points[0], ...points, points[points.length - 1]];

    let path = `M ${allPoints[1].x} ${allPoints[1].y}`;

    for (let i = 1; i < allPoints.length - 2; i++) {
      const p0 = allPoints[i - 1];
      const p1 = allPoints[i];
      const p2 = allPoints[i + 1];
      const p3 = allPoints[i + 2];

      // Catmull-Rom to Bezier conversion
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }

    return path;
  };

  return {
    trail,
    addPoint,
    clearTrail,
    getSmoothPath,
  };
}
