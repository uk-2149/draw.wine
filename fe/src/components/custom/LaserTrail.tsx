import { useEffect, useRef, useState } from "react";
import type { Position } from "@/types";

interface LaserPoint {
  point: Position;
  opacity: number;
  timestamp: number;
}

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
            opacity: Math.max(0, 1 - (now - point.timestamp) / 500), // Fade over 0.5 seconds
          }))
          .filter((point) => point.opacity > 0)
      );

      if (trail.length > 0) {
        animationFrame.current = requestAnimationFrame(animate);
      }
    };

    if (trail.length > 0 && !animationFrame.current) {
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
        { point, opacity: 1, timestamp: Date.now() },
      ]);
      return;
    }

    // Calculate distance from last point to avoid too many points
    const dx = point.x - lastPoint.current.x;
    const dy = point.y - lastPoint.current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 5) {
      // Only add points if they're far enough apart
      lastPoint.current = point;
      setTrail((prev) => [
        ...prev,
        { point, opacity: 1, timestamp: Date.now() },
      ]);
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
