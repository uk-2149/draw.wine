import { useEffect, useRef, useState } from "react";
import type { Position } from "@/types";

interface LaserPoint {
  point: Position;
  opacity: number;
  timestamp: number;
  color: string;
}

const NEON_RED = "#ff0000"; // Bright red

export function useLaserTrail() {
  const [trail, setTrail] = useState<LaserPoint[]>([]);
  const animationFrame = useRef<number | null>(null);
  const lastPoint = useRef<Position | null>(null);

  useEffect(() => {
    const animate = () => {
      const now = Date.now();
      setTrail((prevTrail) =>
        prevTrail
          .map((point) => ({
            ...point,
            opacity: Math.max(0, 1 - (now - point.timestamp) / 3000), // Fade over 3 seconds
          }))
          .filter((point) => point.opacity > 0)
      );

      // Always keep animation frame running
      animationFrame.current = requestAnimationFrame(animate);
    };

    // Start animation immediately
    if (!animationFrame.current) {
      animationFrame.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current);
        animationFrame.current = null;
      }
    };
  }, [trail]);

  const addPoint = (point: Position) => {
    if (!lastPoint.current) {
      lastPoint.current = point;
      setTrail((prev) => [
        ...prev,
        {
          point,
          opacity: 1,
          timestamp: Date.now(),
          color: NEON_RED,
        },
      ]);
      return;
    }

    // Calculate distance from last point
    const dx = point.x - lastPoint.current.x;
    const dy = point.y - lastPoint.current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Add interpolated points for smoother movement
    if (distance > 2) {
      // Smaller threshold for smoother movement
      const numPoints = Math.max(1, Math.floor(distance / 2)); // Add a point every 2 pixels
      const points: Position[] = [];

      // Create interpolated points
      for (let i = 1; i <= numPoints; i++) {
        points.push({
          x: lastPoint.current.x + (dx * i) / numPoints,
          y: lastPoint.current.y + (dy * i) / numPoints,
        });
      }

      lastPoint.current = point;

      setTrail((prev) => {
        // Keep more points for longer trail
        const recentPoints = prev.filter(
          (p) => Date.now() - p.timestamp < 2000
        ); // 2 second trail length

        // Add new interpolated points
        const newPoints = points.map((p, i) => ({
          point: p,
          opacity: 1,
          timestamp: Date.now() + i * 50, // Stagger timestamps for smoother fade
          color: NEON_RED,
        }));

        return [...recentPoints, ...newPoints];
      });
    }
  };

  const clearTrail = () => {
    setTrail([]);
    lastPoint.current = null;
    if (animationFrame.current) {
      cancelAnimationFrame(animationFrame.current);
      animationFrame.current = null;
    }
  };

  return {
    trail,
    addPoint,
    clearTrail,
  };
}
