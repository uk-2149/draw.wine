import React, {
  useCallback,
  useEffect,
  useMemo,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useDrawing } from "@/contexts/drawing/useDrawing";
import { Button } from "@/components/ui/button";
import { Minus, Plus, Redo2, Undo2 } from "lucide-react";

import rough from "roughjs";
import type { Position, Element } from "@/types/element";
import type { GeneratedElement } from "@/contexts/ai/types";
import type { CollaborativeOperationPayload } from "@/types/collaboration";
import { useLaserTrail } from "../general/LaserTrail";
import { eraseElements } from "@/helpers/canvas.h";
import { ImageLoader } from "@/helpers/imageLoader.h";
import { useTheme } from "@/contexts/theme/useTheme";
import { isElementInViewport } from "@/helpers/viewport.h";
import {
  loadFromLocalStorage,
  saveToLocalStorage,
} from "@/helpers/storeProgress.h";
import { AUTO_SAVE_INTERVAL, ERASER_RADIUS } from "@/constants/canvas";
import { useCollab } from "@/contexts/collab/useCollab";
import { cn } from "@/helpers/cn.h";
import { useCanvasBoardState } from "@/hooks/useCanvasBoardState";
import { ConnectionStatus } from "./ConnectionStatus";
import { CollabCursor } from "./CollabCursor";
import {
  drawBubbledPolyline,
  getStrokeDash,
  type StrokePattern,
} from "@/helpers/stroke.h";
import {
  addRoundedDiamondPath,
  diamondCurveRadius,
  rectangleCurveRadius,
} from "@/helpers/roundedShapes.h";
import {
  findSnapTarget,
  getConnectionCoordsForElement,
} from "@/helpers/connectionSnap.h";

const MAX_HISTORY = 50;
const MIN_SCALE = 0.1;
const MAX_SCALE = 5;
// How many screen-pixels away from an edge counts as "on the edge"
const EDGE_HIT_PX = 8;
// Corner zone: if within this many px of a corner, treat as corner resize
const CORNER_HIT_PX = 14;

const cloneElementsSnapshot = (els: Element[]): Element[] =>
  els.map((el) => ({
    ...el,
    points: el.points ? el.points.map((p) => ({ ...p })) : undefined,
  }));

// ─── Edge/corner hit-detection helpers ────────────────────────────────────────

type HandleCorner =
  | "tl"
  | "tc"
  | "tr"
  | "ml"
  | "mr"
  | "bl"
  | "bc"
  | "br"
  | "start"
  | "end"; // for lines/arrows

interface EdgeHit {
  corner: HandleCorner;
  cursor: string;
}

/**
 * Given a canvas-space point and a bounding rect (also in canvas space),
 * returns which edge/corner the point is near, or null if it's not near any.
 * `hitPx` is the tolerance in screen pixels; pass `scale` so we convert correctly.
 */
function getEdgeHit(
  point: Position,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  scale: number,
): EdgeHit | null {
  const edgeTol = EDGE_HIT_PX / scale;
  const cornerTol = CORNER_HIT_PX / scale;

  const { minX, minY, maxX, maxY } = bounds;

  const nearLeft =
    Math.abs(point.x - minX) <= edgeTol &&
    point.y >= minY - edgeTol &&
    point.y <= maxY + edgeTol;
  const nearRight =
    Math.abs(point.x - maxX) <= edgeTol &&
    point.y >= minY - edgeTol &&
    point.y <= maxY + edgeTol;
  const nearTop =
    Math.abs(point.y - minY) <= edgeTol &&
    point.x >= minX - edgeTol &&
    point.x <= maxX + edgeTol;
  const nearBottom =
    Math.abs(point.y - maxY) <= edgeTol &&
    point.x >= minX - edgeTol &&
    point.x <= maxX + edgeTol;

  if (!nearLeft && !nearRight && !nearTop && !nearBottom) return null;

  const nearCornerLeft = Math.abs(point.x - minX) <= cornerTol;
  const nearCornerRight = Math.abs(point.x - maxX) <= cornerTol;
  const nearCornerTop = Math.abs(point.y - minY) <= cornerTol;
  const nearCornerBottom = Math.abs(point.y - maxY) <= cornerTol;

  // Corners first (priority)
  if (nearCornerTop && nearCornerLeft)
    return { corner: "tl", cursor: "nwse-resize" };
  if (nearCornerTop && nearCornerRight)
    return { corner: "tr", cursor: "nesw-resize" };
  if (nearCornerBottom && nearCornerLeft)
    return { corner: "bl", cursor: "nesw-resize" };
  if (nearCornerBottom && nearCornerRight)
    return { corner: "br", cursor: "nwse-resize" };

  // Edges
  if (nearTop) return { corner: "tc", cursor: "ns-resize" };
  if (nearBottom) return { corner: "bc", cursor: "ns-resize" };
  if (nearLeft) return { corner: "ml", cursor: "ew-resize" };
  if (nearRight) return { corner: "mr", cursor: "ew-resize" };

  return null;
}

/** Get the bounding rect for a single resizable element (in canvas coords, with selection padding) */
function getElementBounds(
  element: Element,
  padding = 6,
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  switch (element.type) {
    case "Rectangle":
    case "Diamond":
    case "Circle":
    case "Image": {
      if (element.width !== undefined && element.height !== undefined) {
        return {
          minX: Math.min(element.x, element.x + element.width) - padding,
          maxX: Math.max(element.x, element.x + element.width) + padding,
          minY: Math.min(element.y, element.y + element.height) - padding,
          maxY: Math.max(element.y, element.y + element.height) + padding,
        };
      }
      return null;
    }
    default:
      return null;
  }
}

/** Apply a resize delta from an 8-point handle to a rect-like element */
function applyHandleResize(
  el: Element,
  corner: HandleCorner,
  point: Position,
): Partial<Element> {
  if (corner === "start" || corner === "end") {
    // Line / Arrow
    if (corner === "start") {
      return {
        x: point.x,
        y: point.y,
        width: el.x + (el.width ?? 0) - point.x,
        height: el.y + (el.height ?? 0) - point.y,
      };
    } else {
      return { width: point.x - el.x, height: point.y - el.y };
    }
  }

  let newX = el.x,
    newY = el.y;
  let newW = el.width ?? 0,
    newH = el.height ?? 0;
  const r = el.x + newW,
    b = el.y + newH;

  switch (corner) {
    case "tl":
      newX = point.x;
      newY = point.y;
      newW = r - point.x;
      newH = b - point.y;
      break;
    case "tc":
      newY = point.y;
      newH = b - point.y;
      break;
    case "tr":
      newY = point.y;
      newW = point.x - el.x;
      newH = b - point.y;
      break;
    case "ml":
      newX = point.x;
      newW = r - point.x;
      break;
    case "mr":
      newW = point.x - el.x;
      break;
    case "bl":
      newX = point.x;
      newW = r - point.x;
      newH = point.y - el.y;
      break;
    case "bc":
      newH = point.y - el.y;
      break;
    case "br":
      newW = point.x - el.x;
      newH = point.y - el.y;
      break;
  }

  // For images maintain aspect ratio on corner handles
  if (
    el.type === "Image" &&
    el.aspectRatio &&
    ["tl", "tr", "bl", "br"].includes(corner)
  ) {
    const ar = el.aspectRatio;
    if (Math.abs(newW) > Math.abs(newH / ar)) {
      newH = newW / ar;
      if (corner === "tl") newY = b - newH;
      if (corner === "tr") newY = b - newH;
    } else {
      newW = newH * ar;
      if (corner === "tl") newX = r - newW;
      if (corner === "bl") newX = r - newW;
    }
  }

  return { x: newX, y: newY, width: newW, height: newH };
}

/** Apply 8-handle group resize delta */
function applyGroupHandleResize(
  corner: HandleCorner,
  point: Position,
  originalBounds: { minX: number; minY: number; maxX: number; maxY: number },
) {
  const ob = originalBounds;
  let { minX, minY, maxX, maxY } = ob;

  switch (corner) {
    case "tl":
      minX = point.x;
      minY = point.y;
      break;
    case "tc":
      minY = point.y;
      break;
    case "tr":
      maxX = point.x;
      minY = point.y;
      break;
    case "ml":
      minX = point.x;
      break;
    case "mr":
      maxX = point.x;
      break;
    case "bl":
      minX = point.x;
      maxY = point.y;
      break;
    case "bc":
      maxY = point.y;
      break;
    case "br":
      maxX = point.x;
      maxY = point.y;
      break;
    default:
      break;
  }

  const width = Math.max(10, maxX - minX);
  const height = Math.max(10, maxY - minY);
  const scaleX = ob.maxX - ob.minX > 0 ? width / (ob.maxX - ob.minX) : 1;
  const scaleY = ob.maxY - ob.minY > 0 ? height / (ob.maxY - ob.minY) : 1;

  return { minX, minY, scaleX, scaleY };
}

/** Check if a canvas-space point is inside a bounding box (with padding) */
function isPointInBounds(
  point: Position,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  padding = 10,
) {
  return (
    point.x >= bounds.minX - padding &&
    point.x <= bounds.maxX + padding &&
    point.y >= bounds.minY - padding &&
    point.y <= bounds.maxY + padding
  );
}

export const CanvasBoard = () => {
  const {
    selectedTool,
    strokeColor,
    strokeWidth,
    strokePattern,
    fillColor,
    edgeStyle,
    setSelectedTool,
    setStrokeColor,
    setStrokeWidth,
    setStrokePattern,
    setFillColor,
    setEdgeStyle,
    setActiveElementTypes,
  } = useDrawing();

  const {
    state,
    sendOperation,
    updateCursor,
    updateDrawingStatus,
    isJoinSidebarOpen,
  } = useCollab();
  const { theme } = useTheme();

  const {
    canvasRef,
    containerRef,
    animationFrame,
    isMounted,
    localElements,
    setLocalElements,
    collaborativeElements,
    setCollaborativeElements,
    drawing,
    setDrawing,
    position,
    setPosition,
    startPan,
    setStartPan,
    scale,
    setScale,
    currentElement,
    setCurrentElement,
    isPanning,
    setIsPanning,
    isEditingText,
    setIsEditingText,
    editingTextId,
    setEditingTextId,
    selectedElement,
    setSelectedElement,
    isDragging,
    setIsDragging,
    dragOffset,
    setDragOffset,
    resizing,
    setResizing,
    resizeStart,
    setResizeStart,
    eraserPos,
    setEraserPos,
    selectionArea,
    setSelectionArea,
    selectedElements,
    setSelectedElements,
    collaborativeLaserTrails,
    setCollaborativeLaserTrails,
  } = useCanvasBoardState();

  const laser = useLaserTrail();
  const [resizeSnapshot, setResizeSnapshot] = useState<{
    elements: Element[];
    bounds: { minX: number; minY: number; maxX: number; maxY: number };
  } | null>(null);

  const [snapHighlight, setSnapHighlight] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const [draggingBendPoint, setDraggingBendPoint] = useState<string | null>(
    null,
  ); // elementId

  // ─── Bounding box helpers ───────────────────────────────────────────────────

  const getSelectionBounds = useCallback((elementsToMeasure: Element[]) => {
    if (!elementsToMeasure.length) return null;

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    elementsToMeasure.forEach((el) => {
      switch (el.type) {
        case "Rectangle":
        case "Diamond":
        case "Circle":
        case "Image": {
          if (el.width !== undefined && el.height !== undefined) {
            minX = Math.min(minX, el.x, el.x + el.width);
            maxX = Math.max(maxX, el.x, el.x + el.width);
            minY = Math.min(minY, el.y, el.y + el.height);
            maxY = Math.max(maxY, el.y, el.y + el.height);
          }
          break;
        }
        case "Line":
        case "Arrow": {
          if (el.width !== undefined && el.height !== undefined) {
            minX = Math.min(minX, el.x, el.x + el.width);
            maxX = Math.max(maxX, el.x, el.x + el.width);
            minY = Math.min(minY, el.y, el.y + el.height);
            maxY = Math.max(maxY, el.y, el.y + el.height);
          }
          break;
        }
        case "Text": {
          if (el.text) {
            const textWidth = el.text.length * (el.fontSize || 20) * 0.6;
            const textHeight = el.fontSize || 20;
            minX = Math.min(minX, el.x);
            maxX = Math.max(maxX, el.x + textWidth);
            minY = Math.min(minY, el.y);
            maxY = Math.max(maxY, el.y + textHeight);
          }
          break;
        }
        case "Pencil": {
          if (el.points && el.points.length > 0) {
            const xs = el.points.map((p) => p.x);
            const ys = el.points.map((p) => p.y);
            minX = Math.min(minX, ...xs);
            maxX = Math.max(maxX, ...xs);
            minY = Math.min(minY, ...ys);
            maxY = Math.max(maxY, ...ys);
          }
          break;
        }
      }
    });

    if (minX === Infinity || minY === Infinity) return null;
    return { minX, minY, maxX, maxY };
  }, []);

  const groupBounds = useMemo(
    () => getSelectionBounds(selectedElements),
    [getSelectionBounds, selectedElements],
  );

  // Cursor driven by edge-hover detection (set during mousemove)
  const [hoverCursor, setHoverCursor] = useState<string>("default");

  // ─── Collaboration helpers ──────────────────────────────────────────────────

  const isCollaborating = state.isCollaborating;
  const isHost = state.userId === state.hostId;
  const canDraw =
    !state.settings?.onlyHostCanDraw || isHost || !isCollaborating;
  const collaborators = state.collaborators;
  const isConnected = state.isConnected;

  const elements = useMemo(
    () =>
      isCollaborating
        ? [...localElements, ...collaborativeElements]
        : localElements,
    [isCollaborating, localElements, collaborativeElements],
  );

  const setElements = isCollaborating
    ? setCollaborativeElements
    : setLocalElements;

  // ─── History ────────────────────────────────────────────────────────────────

  const [undoStack, setUndoStack] = useState<Element[][]>([]);
  const [redoStack, setRedoStack] = useState<Element[][]>([]);
  const pendingHistoryRef = useRef<{
    snapshot: Element[];
    didMutate: boolean;
  } | null>(null);

  const isTabPressedRef = useRef(false);
  const draggingBendPointRef = useRef<string | null>(null);
  const bendGrabOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const beginHistoryAction = useCallback(() => {
    if (isCollaborating) return;
    if (pendingHistoryRef.current) return;
    pendingHistoryRef.current = {
      snapshot: cloneElementsSnapshot(localElements),
      didMutate: false,
    };
  }, [isCollaborating, localElements]);

  const markHistoryActionMutated = useCallback(() => {
    if (isCollaborating) return;
    if (pendingHistoryRef.current) pendingHistoryRef.current.didMutate = true;
  }, [isCollaborating]);

  const commitHistoryAction = useCallback(() => {
    if (isCollaborating) {
      pendingHistoryRef.current = null;
      return;
    }
    const pending = pendingHistoryRef.current;
    if (!pending) return;
    pendingHistoryRef.current = null;
    if (!pending.didMutate) return;
    setUndoStack((prev) => {
      const next = [...prev, pending.snapshot];
      return next.length > MAX_HISTORY
        ? next.slice(next.length - MAX_HISTORY)
        : next;
    });
    setRedoStack([]);
  }, [isCollaborating]);

  const recordHistorySnapshot = useCallback(
    (snapshot: Element[]) => {
      if (isCollaborating) return;
      setUndoStack((prev) => {
        const next = [...prev, cloneElementsSnapshot(snapshot)];
        return next.length > MAX_HISTORY
          ? next.slice(next.length - MAX_HISTORY)
          : next;
      });
      setRedoStack([]);
    },
    [isCollaborating],
  );

  const undo = useCallback(() => {
    if (isCollaborating) return;
    pendingHistoryRef.current = null;
    setUndoStack((prevUndo) => {
      if (prevUndo.length === 0) return prevUndo;
      const snapshot = prevUndo[prevUndo.length - 1];
      setRedoStack((prevRedo) => {
        const next = [...prevRedo, cloneElementsSnapshot(localElements)];
        return next.length > MAX_HISTORY
          ? next.slice(next.length - MAX_HISTORY)
          : next;
      });
      setLocalElements(cloneElementsSnapshot(snapshot));
      setSelectedElement(null);
      setSelectedElements([]);
      return prevUndo.slice(0, -1);
    });
  }, [
    isCollaborating,
    localElements,
    setLocalElements,
    setSelectedElement,
    setSelectedElements,
  ]);

  const redo = useCallback(() => {
    if (isCollaborating) return;
    pendingHistoryRef.current = null;
    setRedoStack((prevRedo) => {
      if (prevRedo.length === 0) return prevRedo;
      const snapshot = prevRedo[prevRedo.length - 1];
      setUndoStack((prevUndo) => {
        const next = [...prevUndo, cloneElementsSnapshot(localElements)];
        return next.length > MAX_HISTORY
          ? next.slice(next.length - MAX_HISTORY)
          : next;
      });
      setLocalElements(cloneElementsSnapshot(snapshot));
      setSelectedElement(null);
      setSelectedElements([]);
      return prevRedo.slice(0, -1);
    });
  }, [
    isCollaborating,
    localElements,
    setLocalElements,
    setSelectedElement,
    setSelectedElements,
  ]);

  const zoomBy = useCallback(
    (factor: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const nextScale = Math.min(
        Math.max(scale * factor, MIN_SCALE),
        MAX_SCALE,
      );
      const delta = nextScale / scale;
      if (delta === 1) return;
      const rect = canvas.getBoundingClientRect();
      const x = rect.width / 2;
      const y = rect.height / 2;
      setScale(nextScale);
      setPosition((prev) => ({
        x: x - (x - prev.x) * delta,
        y: y - (y - prev.y) * delta,
      }));
    },
    [canvasRef, scale, setPosition, setScale],
  );

  // ─── Collaborative operations ────────────────────────────────────────────────

  const applyCollaborativeOperation = useCallback(
    (operation: CollaborativeOperationPayload) => {
      if (!operation || !operation.type) return;
      switch (operation.type) {
        case "element_create":
        case "element_start": {
          const element = operation.data?.element || operation.element;
          if (element) {
            setCollaborativeElements((prev) => {
              const exists = prev.find((el) => el.id === element.id);
              if (exists) return prev;
              return [...prev, { ...element, isTemporary: true }];
            });
          }
          break;
        }
        case "element_update": {
          setCollaborativeElements((prev) =>
            prev.map((el) =>
              el.id === operation.elementId ? { ...el, ...operation.data } : el,
            ),
          );
          break;
        }
        case "element_complete": {
          const completeElement = operation.data?.element;
          if (completeElement) {
            setCollaborativeElements((prev) =>
              prev.map((el) =>
                el.id === operation.elementId
                  ? { ...el, ...completeElement, isTemporary: false }
                  : el,
              ),
            );
          }
          break;
        }
        case "element_delete": {
          setCollaborativeElements((prev) =>
            prev.filter((el) => el.id !== operation.elementId),
          );
          break;
        }
      }
    },
    [],
  );

  useEffect(() => {
    if (isCollaborating) {
      console.log("=== CANVAS ELEMENTS DEBUG ===");
      console.log("Local elements count:", localElements.length);
      console.log(
        "Collaborative elements count:",
        collaborativeElements.length,
      );
      console.log("Total elements count:", elements.length);
    }
  }, [
    isCollaborating,
    localElements.length,
    collaborativeElements.length,
    collaborativeElements,
    elements.length,
  ]);

  useEffect(() => {
    const handleCollabOperation = (
      event: CustomEvent<CollaborativeOperationPayload>,
    ) => {
      const operation = event.detail;
      if (operation.authorId && operation.authorId === state.userId) return;
      if (!operation || !operation.type) return;
      applyCollaborativeOperation(operation);
    };

    const handleRoomJoined = (event: CustomEvent<{ elements?: Element[] }>) => {
      const { elements } = event.detail;
      if (elements && elements.length > 0) setCollaborativeElements(elements);
    };

    if (isCollaborating) {
      window.addEventListener(
        "collab_operation",
        handleCollabOperation as EventListener,
      );
      window.addEventListener("room_joined", handleRoomJoined as EventListener);

      const handleLaserPoint = (
        event: CustomEvent<{
          userId: string;
          point: { x: number; y: number };
          timestamp: number;
          color?: string;
        }>,
      ) => {
        const { userId, point, timestamp, color } = event.detail;
        setCollaborativeLaserTrails((prev) => {
          const newTrails = new Map(prev);
          const userTrail = newTrails.get(userId) || [];
          const newPoint = {
            point,
            opacity: 1,
            timestamp,
            color: color || "#00ff00",
          };
          const recentPoints = userTrail.filter(
            (p) => timestamp - p.timestamp < 2000,
          );
          newTrails.set(userId, [...recentPoints, newPoint]);
          return newTrails;
        });
      };

      const handleLaserClear = (event: CustomEvent<{ userId: string }>) => {
        const { userId } = event.detail;
        setCollaborativeLaserTrails((prev) => {
          const newTrails = new Map(prev);
          newTrails.delete(userId);
          return newTrails;
        });
      };

      window.addEventListener(
        "collab_laser_point",
        handleLaserPoint as EventListener,
      );
      window.addEventListener(
        "collab_laser_clear",
        handleLaserClear as EventListener,
      );

      return () => {
        window.removeEventListener(
          "collab_operation",
          handleCollabOperation as EventListener,
        );
        window.removeEventListener(
          "room_joined",
          handleRoomJoined as EventListener,
        );
        window.removeEventListener(
          "collab_laser_point",
          handleLaserPoint as EventListener,
        );
        window.removeEventListener(
          "collab_laser_clear",
          handleLaserClear as EventListener,
        );
      };
    }
  }, [applyCollaborativeOperation, isCollaborating]);

  // ─── Persist / load ──────────────────────────────────────────────────────────

  useEffect(() => {
    const savedElements = loadFromLocalStorage();
    if (savedElements.length > 0 && !isCollaborating)
      setLocalElements(savedElements);
    const frameRef = animationFrame;
    return () => {
      ImageLoader.clear();
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [isCollaborating]);

  useEffect(() => {
    if (!isCollaborating && localElements.length > 0) {
      const interval = setInterval(
        () => saveToLocalStorage(localElements),
        AUTO_SAVE_INTERVAL,
      );
      return () => clearInterval(interval);
    }
  }, [localElements, isCollaborating]);

  // Save viewport to local storage for external scripts (like AI insertion)
  useEffect(() => {
    try {
      localStorage.setItem(
        "drawine_canvas_viewport",
        JSON.stringify({ position, scale }),
      );
    } catch (error) {
      console.error("Error saving viewport to localStorage:", error);
    }
  }, [position, scale]);

  // Listen for AI generation
  useEffect(() => {
    const handleAiElements = (event: Event) => {
      const customEvent = event as CustomEvent<{
        generatedElements: GeneratedElement[];
      }>;
      const generatedElements = customEvent.detail?.generatedElements;

      if (!generatedElements || generatedElements.length === 0) return;

      const canvas = canvasRef.current;
      const cw = canvas
        ? canvas.width / window.devicePixelRatio
        : window.innerWidth;
      const ch = canvas
        ? canvas.height / window.devicePixelRatio
        : window.innerHeight;

      // Calculate the center of the current viewport precisely
      const centerX = (-position.x + cw / 2) / scale;
      const centerY = (-position.y + ch / 2) / scale;

      const getElementBounds = (elem: GeneratedElement) => {
        const type = elem.type || "Rectangle";
        const x = elem.x ?? 0;
        const y = elem.y ?? 0;
        const fontSize = elem.fontSize ?? 20;

        if (type === "Text") {
          const text = elem.text || "AI Generated";
          const textWidth = text.length * fontSize * 0.6;
          return {
            minX: x,
            maxX: x + textWidth,
            minY: y,
            maxY: y + fontSize,
          };
        }

        const width =
          elem.width ?? (type === "Line" || type === "Arrow" ? 120 : 120);
        const height =
          elem.height ?? (type === "Line" || type === "Arrow" ? 0 : 80);

        if (type === "Line" || type === "Arrow") {
          const x2 = x + width;
          const y2 = y + height;
          return {
            minX: Math.min(x, x2),
            maxX: Math.max(x, x2),
            minY: Math.min(y, y2),
            maxY: Math.max(y, y2),
          };
        }

        const x2 = x + width;
        const y2 = y + height;
        return {
          minX: Math.min(x, x2),
          maxX: Math.max(x, x2),
          minY: Math.min(y, y2),
          maxY: Math.max(y, y2),
        };
      };

      const bounds = generatedElements.reduce(
        (acc, elem) => {
          const next = getElementBounds(elem);
          return {
            minX: Math.min(acc.minX, next.minX),
            minY: Math.min(acc.minY, next.minY),
            maxX: Math.max(acc.maxX, next.maxX),
            maxY: Math.max(acc.maxY, next.maxY),
          };
        },
        {
          minX: Number.POSITIVE_INFINITY,
          minY: Number.POSITIVE_INFINITY,
          maxX: Number.NEGATIVE_INFINITY,
          maxY: Number.NEGATIVE_INFINITY,
        },
      );

      const boundsCenterX = (bounds.minX + bounds.maxX) / 2;
      const boundsCenterY = (bounds.minY + bounds.maxY) / 2;
      const offsetX = centerX - boundsCenterX;
      const offsetY = centerY - boundsCenterY;

      const newElements: Element[] = generatedElements.map((elem, index) => {
        const isImage = elem.type === "Image";
        const isText = elem.type === "Text";

        const baseElement: Element = {
          id: `ai-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 6)}`,
          type: elem.type || "Rectangle",
          x: (elem.x ?? 0) + offsetX,
          y: (elem.y ?? 0) + offsetY,
          width: elem.width ?? (isText ? undefined : 120),
          height: elem.height ?? (isText ? undefined : 80),
          strokeColor: elem.strokeColor || strokeColor,
          fillColor: elem.fillColor,
          strokeWidth: elem.strokeWidth ?? strokeWidth,
          strokePattern: "solid",
          roughness: 1,
          seed: Math.floor(Math.random() * 2 ** 31),
          edgeStyle: elem.edgeStyle || edgeStyle,
        };

        if (isText) {
          baseElement.text = elem.text || "AI Generated";
          baseElement.fontSize = elem.fontSize || 20;
          baseElement.fontFamily = "Virgil";
        }

        if (isImage) {
          baseElement.imageUrl = elem.text || elem.imageUrl || "";
          baseElement.aspectRatio = (elem.width || 1) / (elem.height || 1);
          delete baseElement.text;
        }

        if (elem.type === "Line" || elem.type === "Arrow") {
          baseElement.points = [
            { x: 0, y: 0 },
            { x: elem.width || 100, y: elem.height || 0 },
          ];
        }

        return baseElement;
      });

      console.log("CanvasBoard mapped new AI elements:", newElements);

      if (isCollaborating) {
        setCollaborativeElements((prev) => [...prev, ...newElements]);
        if (sendOperation && state.roomId) {
          newElements.forEach((el) => {
            sendOperation({
              type: "element_complete",
              elementId: el.id,
              data: { element: el },
              roomId: state.roomId!,
              authorId: state.userId!,
            });
          });
        }
      } else {
        setLocalElements((prev) => [...prev, ...newElements]);
        setTimeout(() => {
          saveToLocalStorage([...localElements, ...newElements]);
        }, 0);
      }
    };

    window.addEventListener("ai-elements-generated", handleAiElements);
    return () =>
      window.removeEventListener("ai-elements-generated", handleAiElements);
  }, [
    isCollaborating,
    localElements,
    position,
    scale,
    sendOperation,
    state.roomId,
    state.userId,
    setCollaborativeElements,
    setLocalElements,
    strokeColor,
    strokeWidth,
    edgeStyle,
  ]);

  // Listen for external canvas element updates (from import)
  useEffect(() => {
    const handleCanvasElementsUpdate = () => {
      if (!isCollaborating) {
        const updatedElements = loadFromLocalStorage();
        setLocalElements(updatedElements);
      }
    };
    window.addEventListener(
      "canvas-elements-updated",
      handleCanvasElementsUpdate,
    );
    return () =>
      window.removeEventListener(
        "canvas-elements-updated",
        handleCanvasElementsUpdate,
      );
  }, [isCollaborating]);

  // ─── Sync selected element properties ────────────────────────────────────────

  useLayoutEffect(() => {
    setActiveElementTypes(
      selectedElements.map(
        (el) => el.type as import("@/types/drawing").ToolType,
      ),
    );
    if (selectedElements.length !== 1) return;
    const selected = selectedElements[0];
    setStrokeColor(selected.strokeColor);
    setStrokeWidth(selected.strokeWidth);
    setStrokePattern(selected.strokePattern || "solid");
    setFillColor(selected.fillColor || null);
    setEdgeStyle(selected.edgeStyle || "sharp");
  }, [
    selectedElements,
    setActiveElementTypes,
    setEdgeStyle,
    setFillColor,
    setStrokeColor,
    setStrokePattern,
    setStrokeWidth,
  ]);

  useEffect(() => {
    if (selectedElements.length > 0) {
      setElements((prev) => {
        let hasChanges = false;
        const next = prev.map((el) => {
          if (selectedElements.some((selected) => selected.id === el.id)) {
            const updatedEl = { ...el };
            let elChanged = false;
            if (el.strokeColor !== strokeColor) {
              updatedEl.strokeColor = strokeColor;
              elChanged = true;
            }
            if (el.strokeWidth !== strokeWidth) {
              updatedEl.strokeWidth = strokeWidth;
              elChanged = true;
            }
            if (el.strokePattern !== strokePattern) {
              updatedEl.strokePattern = strokePattern;
              elChanged = true;
            }
            if (
              (el.type === "Rectangle" ||
                el.type === "Diamond" ||
                el.type === "Circle") &&
              el.fillColor !== fillColor
            ) {
              updatedEl.fillColor = fillColor || undefined;
              elChanged = true;
            }
            if (
              (el.type === "Rectangle" || el.type === "Diamond") &&
              el.edgeStyle !== edgeStyle
            ) {
              updatedEl.edgeStyle = edgeStyle;
              elChanged = true;
            }

            if (elChanged) {
              hasChanges = true;
              return updatedEl;
            }
          }
          return el;
        });

        if (hasChanges) {
          if (isCollaborating && sendOperation && state.roomId) {
            next
              .filter((el) => selectedElements.some((s) => s.id === el.id))
              .forEach((updatedEl) => {
                sendOperation({
                  type: "element_update",
                  elementId: updatedEl.id,
                  data: updatedEl,
                  roomId: state.roomId!,
                  authorId: state.userId!,
                });
              });
          }
          setTimeout(() => {
            setSelectedElements(
              next.filter((el) => selectedElements.some((s) => s.id === el.id)),
            );
          }, 0);
        }
        return hasChanges ? next : prev;
      });
    }
  }, [strokeColor, strokeWidth, strokePattern, fillColor, edgeStyle]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Redraw ──────────────────────────────────────────────────────────────────

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(position.x, position.y);
    ctx.scale(scale, scale);

    const rc = rough.canvas(canvas);

    const isDark =
      theme === "dark" ||
      (theme === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);

    const getStrokeColor = (color: string) => {
      if (isDark && (color === "#000000" || color === "#000")) return "#ffffff";
      if (!isDark && (color === "#ffffff" || color === "#fff"))
        return "#000000";
      return color;
    };

    const drawPatternedPolyline = (
      points: Array<{ x: number; y: number }>,
      color: string,
      width: number,
      pattern: StrokePattern,
    ) => {
      if (pattern === "bubbled") {
        drawBubbledPolyline(ctx, points, width, color);
        return;
      }
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.setLineDash(getStrokeDash(pattern, width) || []);
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let index = 1; index < points.length; index++)
        ctx.lineTo(points[index].x, points[index].y);
      ctx.stroke();
      ctx.restore();
    };

    // ── Draw all elements ──
    elements.forEach((element) => {
      const strokePatternValue: StrokePattern =
        element.strokePattern || "solid";
      const strokeDash = getStrokeDash(strokePatternValue, element.strokeWidth);
      const baseOptions = {
        stroke: getStrokeColor(element.strokeColor),
        strokeWidth: element.strokeWidth,
        roughness: element.roughness || 1,
        seed: element.seed || 1,
        strokeLineDash: strokeDash,
      };

      const options =
        element.fillColor &&
        (element.type === "Rectangle" ||
          element.type === "Diamond" ||
          element.type === "Circle")
          ? {
              ...baseOptions,
              fill: getStrokeColor(element.fillColor) + "80",
              fillStyle: "solid" as const,
            }
          : baseOptions;

      if (
        isCollaborating &&
        element.isTemporary &&
        element.authorId !== state.userId
      ) {
        ctx.save();
        ctx.globalAlpha = 0.7;
      }

      switch (element.type) {
        case "Image": {
          if (element.imageUrl && element.width && element.height) {
            const isVisible = isElementInViewport(
              element,
              canvas.width / window.devicePixelRatio,
              canvas.height / window.devicePixelRatio,
              position,
              scale,
            );
            if (isVisible) {
              const img = ImageLoader.getFromCache(element.imageUrl);
              if (img) {
                ctx.drawImage(
                  img,
                  element.x,
                  element.y,
                  element.width!,
                  element.height!,
                );
              } else {
                ImageLoader.load(element.imageUrl)
                  .then(() => redrawCanvas())
                  .catch((error) =>
                    console.error("Error loading image:", error),
                  );
              }
            }
          }
          break;
        }
        case "Rectangle": {
          if (element.width && element.height) {
            if (element.edgeStyle === "curve") {
              // Draw rounded rectangle directly on canvas for curve style
              ctx.save();
              ctx.strokeStyle = getStrokeColor(element.strokeColor);
              ctx.lineWidth = element.strokeWidth;
              ctx.lineJoin = "round";
              ctx.lineCap = "round";
              ctx.setLineDash(strokeDash || []);

              if (element.fillColor) {
                ctx.fillStyle = getStrokeColor(element.fillColor) + "80"; // 50% transparency
              }

              const rw = Math.abs(element.width);
              const rh = Math.abs(element.height);
              const rx =
                element.width < 0 ? element.x + element.width : element.x;
              const ry =
                element.height < 0 ? element.y + element.height : element.y;
              const borderRadius = rectangleCurveRadius(rw, rh);
              if (ctx.roundRect) {
                ctx.beginPath();
                ctx.roundRect(rx, ry, rw, rh, borderRadius);
                if (element.fillColor) {
                  ctx.fill();
                }
                ctx.stroke();
              } else {
                ctx.strokeRect(rx, ry, rw, rh);
                if (element.fillColor) {
                  ctx.fillRect(rx, ry, rw, rh);
                }
              }
              ctx.restore();
            } else {
              // Draw rough rectangle for sharp style
              rc.rectangle(
                element.x,
                element.y,
                element.width,
                element.height,
                options,
              );
            }
          }
          break;
        }
        case "Diamond": {
          if (element.width && element.height) {
            const width = Math.abs(element.width);
            const height = Math.abs(element.height);
            const x = element.width < 0 ? element.x + element.width : element.x;
            const y =
              element.height < 0 ? element.y + element.height : element.y;
            const cx = x + width / 2;
            const cy = y + height / 2;
            const hw = width / 2;
            const hh = height / 2;

            if (element.edgeStyle === "curve") {
              ctx.save();
              ctx.strokeStyle = getStrokeColor(element.strokeColor);
              ctx.lineWidth = element.strokeWidth;
              ctx.lineJoin = "round";
              ctx.lineCap = "round";
              ctx.setLineDash(strokeDash || []);

              if (element.fillColor) {
                ctx.fillStyle = getStrokeColor(element.fillColor) + "80";
              }

              const radius = diamondCurveRadius(hw, hh);
              ctx.beginPath();
              addRoundedDiamondPath(ctx, cx, cy, hw, hh, radius);
              if (element.fillColor) {
                ctx.fill();
              }
              ctx.stroke();
              ctx.restore();
            } else {
              const points: [number, number][] = [
                [cx, y],
                [x + width, cy],
                [cx, y + height],
                [x, cy],
              ];
              rc.polygon(points, options);
            }
          }
          break;
        }
        case "Line": {
          if (element.width !== undefined && element.height !== undefined) {
            const endX = element.x + element.width;
            const endY = element.y + element.height;
            if (element.bendPoint) {
              ctx.save();
              ctx.strokeStyle = getStrokeColor(element.strokeColor);
              ctx.lineWidth = element.strokeWidth;
              ctx.lineCap = "round";
              ctx.setLineDash(strokeDash || []);
              ctx.beginPath();
              ctx.moveTo(element.x, element.y);
              ctx.quadraticCurveTo(
                element.bendPoint.x,
                element.bendPoint.y,
                endX,
                endY,
              );
              ctx.stroke();
              ctx.restore();
            } else if (strokePatternValue === "bubbled") {
              drawPatternedPolyline(
                [
                  { x: element.x, y: element.y },
                  { x: endX, y: endY },
                ],
                getStrokeColor(element.strokeColor),
                element.strokeWidth,
                strokePatternValue,
              );
            } else {
              rc.line(element.x, element.y, endX, endY, options);
            }
          }
          break;
        }
        case "Pencil": {
          if (element.points && element.points.length > 0) {
            ctx.save();
            ctx.strokeStyle = getStrokeColor(element.strokeColor);
            ctx.lineWidth = element.strokeWidth;
            ctx.lineJoin = "round";
            ctx.lineCap = "round";
            ctx.globalCompositeOperation = "source-over";
            ctx.setLineDash(strokeDash || []);
            if (strokePatternValue === "bubbled") {
              drawPatternedPolyline(
                element.points,
                getStrokeColor(element.strokeColor),
                element.strokeWidth,
                strokePatternValue,
              );
              ctx.restore();
              break;
            }
            if (element.points.length === 1) {
              ctx.beginPath();
              ctx.arc(
                element.points[0].x,
                element.points[0].y,
                element.strokeWidth / 2,
                0,
                2 * Math.PI,
              );
              ctx.fill();
            } else if (element.points.length === 2) {
              ctx.beginPath();
              ctx.moveTo(element.points[0].x, element.points[0].y);
              ctx.lineTo(element.points[1].x, element.points[1].y);
              ctx.stroke();
            } else {
              ctx.beginPath();
              ctx.moveTo(element.points[0].x, element.points[0].y);
              for (let i = 1; i < element.points.length - 1; i++) {
                const currentPoint = element.points[i];
                const nextPoint = element.points[i + 1];
                ctx.quadraticCurveTo(
                  currentPoint.x,
                  currentPoint.y,
                  (currentPoint.x + nextPoint.x) / 2,
                  (currentPoint.y + nextPoint.y) / 2,
                );
              }
              const lastPoint = element.points[element.points.length - 1];
              ctx.lineTo(lastPoint.x, lastPoint.y);
              ctx.stroke();
            }
            ctx.restore();
          }
          break;
        }
        case "Circle": {
          if (element.width && element.height) {
            rc.ellipse(
              element.x + element.width / 2,
              element.y + element.height / 2,
              Math.abs(element.width),
              Math.abs(element.height),
              options,
            );
          }
          break;
        }
        case "Arrow": {
          if (element.width !== undefined && element.height !== undefined) {
            const endX = element.x + element.width;
            const endY = element.y + element.height;

            if (element.bendPoint) {
              ctx.save();
              ctx.strokeStyle = getStrokeColor(element.strokeColor);
              ctx.lineWidth = element.strokeWidth;
              ctx.lineCap = "round";
              ctx.setLineDash(strokeDash || []);
              ctx.beginPath();
              ctx.moveTo(element.x, element.y);
              ctx.quadraticCurveTo(
                element.bendPoint.x,
                element.bendPoint.y,
                endX,
                endY,
              );
              ctx.stroke();
              // Arrow head tangent from bezier end
              const tx = endX - element.bendPoint.x;
              const ty = endY - element.bendPoint.y;
              const angle = Math.atan2(ty, tx);
              const arrowLength = 20;
              const arrowAngle = Math.PI / 6;
              rc.line(
                endX,
                endY,
                endX - arrowLength * Math.cos(angle - arrowAngle),
                endY - arrowLength * Math.sin(angle - arrowAngle),
                options,
              );
              rc.line(
                endX,
                endY,
                endX - arrowLength * Math.cos(angle + arrowAngle),
                endY - arrowLength * Math.sin(angle + arrowAngle),
                options,
              );
              ctx.restore();
            } else {
              if (strokePatternValue === "bubbled") {
                drawPatternedPolyline(
                  [
                    { x: element.x, y: element.y },
                    { x: endX, y: endY },
                  ],
                  getStrokeColor(element.strokeColor),
                  element.strokeWidth,
                  strokePatternValue,
                );
              } else {
                rc.line(element.x, element.y, endX, endY, options);
              }
              const angle = Math.atan2(element.height, element.width);
              const arrowLength = 20;
              const arrowAngle = Math.PI / 6;
              rc.line(
                endX,
                endY,
                endX - arrowLength * Math.cos(angle - arrowAngle),
                endY - arrowLength * Math.sin(angle - arrowAngle),
                options,
              );
              rc.line(
                endX,
                endY,
                endX - arrowLength * Math.cos(angle + arrowAngle),
                endY - arrowLength * Math.sin(angle + arrowAngle),
                options,
              );
            }
          }
          break;
        }
        case "Text": {
          if (element.text && element.id !== editingTextId) {
            ctx.font = `${element.fontSize || 20}px ${element.fontFamily || "Virgil"}`;
            ctx.fillStyle = getStrokeColor(element.strokeColor || "#000");
            ctx.textBaseline = "top";
            ctx.fillText(element.text, element.x, element.y);
          }
          break;
        }
      }

      if (
        isCollaborating &&
        element.isTemporary &&
        element.authorId !== state.userId
      )
        ctx.restore();
    });

    const selectionStroke = "rgba(79, 143, 247, 0.92)";
    const selectionPad = 10;
    const selectionCornerSoft = 6;

    // ── Draw individual selection outlines for each selected element ──
    if (selectedElements.length > 0) {
      ctx.save();
      const padding = 6;

      // Draw individual thin dotted outline for each selected element
      selectedElements.forEach((element) => {
        ctx.strokeStyle = selectionStroke;
        ctx.lineWidth = 1 / scale; // stay thin regardless of zoom
        ctx.setLineDash([4 / scale, 3 / scale]);

        switch (element.type) {
          case "Rectangle": {
            if (element.width && element.height) {
              const minX = Math.min(element.x, element.x + element.width);
              const maxX = Math.max(element.x, element.x + element.width);
              const minY = Math.min(element.y, element.y + element.height);
              const maxY = Math.max(element.y, element.y + element.height);
              const bx = minX - selectionPad;
              const by = minY - selectionPad;
              const bw = maxX - minX + selectionPad * 2;
              const bh = maxY - minY + selectionPad * 2;
              const rr =
                element.edgeStyle === "curve"
                  ? rectangleCurveRadius(bw, bh)
                  : Math.min(selectionCornerSoft, Math.min(bw, bh) * 0.08);

              ctx.beginPath();
              if (ctx.roundRect) {
                ctx.roundRect(bx, by, bw, bh, rr);
              } else {
                ctx.rect(bx, by, bw, bh);
              }
              ctx.stroke();
            }
            break;
          }
          case "Diamond": {
            if (element.width && element.height) {
              const minX = Math.min(element.x, element.x + element.width);
              const maxX = Math.max(element.x, element.x + element.width);
              const minY = Math.min(element.y, element.y + element.height);
              const maxY = Math.max(element.y, element.y + element.height);
              const cx = (minX + maxX) / 2;
              const cy = (minY + maxY) / 2;
              const hw = (maxX - minX) / 2 + selectionPad;
              const hh = (maxY - minY) / 2 + selectionPad;
              const cornerR =
                element.edgeStyle === "curve" ? diamondCurveRadius(hw, hh) : 0;

              ctx.beginPath();
              addRoundedDiamondPath(ctx, cx, cy, hw, hh, cornerR);
              ctx.stroke();
            }
            break;
          }
          case "Circle": {
            if (element.width && element.height) {
              const minX = Math.min(element.x, element.x + element.width);
              const maxX = Math.max(element.x, element.x + element.width);
              const minY = Math.min(element.y, element.y + element.height);
              const maxY = Math.max(element.y, element.y + element.height);
              const cx = (minX + maxX) / 2;
              const cy = (minY + maxY) / 2;
              const rx = (maxX - minX) / 2 + selectionPad;
              const ry = (maxY - minY) / 2 + selectionPad;

              ctx.beginPath();
              ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
              ctx.stroke();
            }
            break;
          }
          case "Image": {
            if (element.width !== undefined && element.height !== undefined) {
              const minX = Math.min(element.x, element.x + element.width);
              const maxX = Math.max(element.x, element.x + element.width);
              const minY = Math.min(element.y, element.y + element.height);
              const maxY = Math.max(element.y, element.y + element.height);
              const bx = minX - selectionPad;
              const by = minY - selectionPad;
              const bw = maxX - minX + selectionPad * 2;
              const bh = maxY - minY + selectionPad * 2;
              const rr = rectangleCurveRadius(bw, bh) * 0.5;

              ctx.beginPath();
              if (ctx.roundRect) {
                ctx.roundRect(bx, by, bw, bh, rr);
              } else {
                ctx.rect(bx, by, bw, bh);
              }
              ctx.stroke();
            }
            break;
          }
          case "Line":
          case "Arrow": {
            if (element.width !== undefined && element.height !== undefined) {
              const endX = element.x + element.width;
              const endY = element.y + element.height;
              const dotR = Math.max(6.5, selectionPad * 0.65);

              ctx.beginPath();
              ctx.arc(element.x, element.y, dotR, 0, 2 * Math.PI);
              ctx.stroke();
              ctx.beginPath();
              ctx.arc(endX, endY, dotR, 0, 2 * Math.PI);
              ctx.stroke();
            }
            break;
          }
          case "Text": {
            if (element.text) {
              const textWidth =
                element.text.length * (element.fontSize || 20) * 0.6;
              const textHeight = element.fontSize || 20;
              ctx.beginPath();
              ctx.rect(
                element.x - selectionPad,
                element.y - selectionPad,
                textWidth + selectionPad * 2,
                textHeight + selectionPad * 2,
              );
              ctx.stroke();
            }
            break;
          }
          case "Pencil": {
            if (element.points && element.points.length > 0) {
              const xs = element.points.map((p) => p.x);
              const ys = element.points.map((p) => p.y);
              const minX = Math.min(...xs),
                maxX = Math.max(...xs);
              const minY = Math.min(...ys),
                maxY = Math.max(...ys);
              ctx.strokeRect(
                minX - padding,
                minY - padding,
                maxX - minX + padding * 2,
                maxY - minY + padding * 2,
              );
              ctx.stroke();
            }
            break;
          }
        }
      });

      // Draw thicker group bounding box when multiple selected
      if (selectedElements.length > 1 && groupBounds) {
        ctx.strokeStyle = "#007acc";
        ctx.lineWidth = 1.5 / scale;
        ctx.setLineDash([6 / scale, 4 / scale]);
        const gp = 14;
        ctx.strokeRect(
          groupBounds.minX - gp,
          groupBounds.minY - gp,
          groupBounds.maxX - groupBounds.minX + gp * 2,
          groupBounds.maxY - groupBounds.minY + gp * 2,
        );
      }

      ctx.restore();
    }

    // ── Draw selection area while dragging ──
    if (selectionArea) {
      ctx.save();
      ctx.strokeStyle = "#007acc";
      ctx.lineWidth = 1.5 / scale;
      ctx.fillStyle = "rgba(0, 122, 204, 0.06)";
      ctx.setLineDash([5 / scale, 5 / scale]);
      const width = selectionArea.end.x - selectionArea.start.x;
      const height = selectionArea.end.y - selectionArea.start.y;
      ctx.strokeRect(
        selectionArea.start.x,
        selectionArea.start.y,
        width,
        height,
      );
      ctx.fillRect(selectionArea.start.x, selectionArea.start.y, width, height);
      ctx.restore();
    }

    // ── Laser trails ──
    const drawLaserTrail = (
      trail: Array<{ point: { x: number; y: number }; opacity?: number }>,
      color: string,
      opacity: number,
    ) => {
      if (trail.length < 2) return;
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      const drawSmoothPath = () => {
        const points = trail.map((t) => t.point);
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        if (points.length === 2) {
          ctx.lineTo(points[1].x, points[1].y);
        } else {
          for (let i = 0; i < points.length - 2; i++) {
            const p1 = points[i + 1];
            const p2 = points[i + 2];
            ctx.quadraticCurveTo(
              p1.x,
              p1.y,
              (p1.x + p2.x) / 2,
              (p1.y + p2.y) / 2,
            );
          }
          const lastPoint = points[points.length - 1];
          const secondLastPoint = points[points.length - 2];
          ctx.quadraticCurveTo(
            secondLastPoint.x,
            secondLastPoint.y,
            lastPoint.x,
            lastPoint.y,
          );
        }
      };
      ctx.shadowBlur = 20;
      ctx.lineWidth = 15;
      ctx.strokeStyle = color;
      ctx.shadowColor = color;
      ctx.globalAlpha = opacity * 0.3;
      drawSmoothPath();
      ctx.stroke();
      ctx.shadowBlur = 10;
      ctx.lineWidth = 8;
      ctx.globalAlpha = opacity * 0.6;
      drawSmoothPath();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.lineWidth = 3;
      ctx.globalAlpha = opacity;
      ctx.strokeStyle = "#ffffff";
      drawSmoothPath();
      ctx.stroke();
      ctx.restore();
    };

    if (selectedTool === "Laser" && laser.trail.length > 0) {
      const trailColor = laser.trail[laser.trail.length - 1].color || "#ff0000";
      drawLaserTrail(laser.trail, trailColor, 1.0);
      ctx.save();
      const lastPoint = laser.trail[laser.trail.length - 1].point;
      ctx.globalAlpha = 1;
      const gradient = ctx.createRadialGradient(
        lastPoint.x,
        lastPoint.y,
        0,
        lastPoint.x,
        lastPoint.y,
        5,
      );
      gradient.addColorStop(0, trailColor);
      gradient.addColorStop(
        1,
        trailColor.length === 7 ? trailColor + "00" : "rgba(255,0,0,0)",
      );
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(lastPoint.x, lastPoint.y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    collaborativeLaserTrails.forEach((trail) => {
      if (trail.length > 0) {
        const trailColor = trail[trail.length - 1].color || "#00ff00";
        drawLaserTrail(trail, trailColor, 0.8);
        ctx.save();
        const lastPoint = trail[trail.length - 1].point;
        ctx.globalAlpha = 0.8;
        const gradient = ctx.createRadialGradient(
          lastPoint.x,
          lastPoint.y,
          0,
          lastPoint.x,
          lastPoint.y,
          5,
        );
        gradient.addColorStop(0, trailColor);
        gradient.addColorStop(
          1,
          trailColor.length === 7 ? trailColor + "00" : "rgba(0,255,0,0)",
        );
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(lastPoint.x, lastPoint.y, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    });

    ctx.restore();
  }, [
    collaborativeLaserTrails,
    elements,
    position,
    scale,
    selectedElements,
    groupBounds,
    editingTextId,
    selectedTool,
    laser.trail,
    selectionArea,
    isCollaborating,
    state.userId,
    theme,
  ]);

  useEffect(() => {
    redrawCanvas();
  }, [theme, redrawCanvas]);

  // ─── Keyboard shortcuts ───────────────────────────────────────────────────────

  useEffect(() => {
    const handleToolShortcuts = (e: KeyboardEvent) => {
      if (isEditingText || e.ctrlKey || e.altKey || e.metaKey) return;
      switch (e.key.toLowerCase()) {
        case " ":
          e.preventDefault();
          setSelectedTool("Hand");
          break;
        case "s":
          setSelectedTool("select");
          break;
        case "p":
          setSelectedTool("Pencil");
          break;
        case "t":
          setSelectedTool("Text");
          break;
        case "r":
          setSelectedTool("Rectangle");
          break;
        case "c":
          setSelectedTool("Circle");
          break;
        case "l":
          setSelectedTool("Line");
          break;
        case "a":
          setSelectedTool("Arrow");
          break;
        case "d":
          setSelectedTool("Diamond");
          break;
        case "q":
          setSelectedTool("Laser");
          break;
        case "e":
          setSelectedTool("Eraser");
          break;
        case "i":
          setSelectedTool("Image");
          break;
      }
    };
    window.addEventListener("keydown", handleToolShortcuts);
    return () => window.removeEventListener("keydown", handleToolShortcuts);
  }, [isEditingText, setSelectedTool]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditingText) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable)
        return;
      const isMod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (e.key === "Escape") {
        e.preventDefault();
        setSelectedElements([]);
        setSelectedElement(null);
        setSelectedTool("select");
        return;
      }
      if (!isMod) return;
      if (key === "a") {
        e.preventDefault();
        setSelectedTool("select");
        setSelectedElements([...elements]);
        if (elements.length === 1) setSelectedElement(elements[0]);
        return;
      }
      if (key === "d") {
        e.preventDefault();
        setSelectedElements([]);
        setSelectedElement(null);
        return;
      }

      if (key === "z") {
        e.preventDefault();

        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }

        return;
      }

      if (key === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isEditingText,
    redo,
    undo,
    elements,
    setSelectedElements,
    setSelectedElement,
    setSelectedTool,
  ]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        !isEditingText &&
        (selectedElements.length > 0 || selectedElement)
      ) {
        e.preventDefault();
        if (!isCollaborating) recordHistorySnapshot(localElements);
        setElements((prev) =>
          prev.filter(
            (el) =>
              !selectedElements.some((selected) => selected.id === el.id) &&
              (!selectedElement || el.id !== selectedElement.id),
          ),
        );
        setSelectedElements([]);
        setSelectedElement(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    selectedElement,
    selectedElements,
    isEditingText,
    isCollaborating,
    localElements,
    recordHistorySnapshot,
    setElements,
  ]);

  useEffect(() => {
    const handleTabKey = (e: KeyboardEvent) => {
      if (isEditingText) return;
      if (e.key === "Tab") {
        e.preventDefault();
        isTabPressedRef.current = true;
      }
    };
    const handleTabKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Tab") isTabPressedRef.current = false;
    };
    window.addEventListener("keydown", handleTabKey);
    window.addEventListener("keyup", handleTabKeyUp);
    return () => {
      window.removeEventListener("keydown", handleTabKey);
      window.removeEventListener("keyup", handleTabKeyUp);
    };
  }, [isEditingText]);

  useEffect(() => {
    const handleArrowKeys = (e: KeyboardEvent) => {
      if (isEditingText) return;
      const ARROW_PAN_SPEED = 50;
      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          setPosition((prev) => ({ ...prev, y: prev.y + ARROW_PAN_SPEED }));
          break;
        case "ArrowDown":
          e.preventDefault();
          setPosition((prev) => ({ ...prev, y: prev.y - ARROW_PAN_SPEED }));
          break;
        case "ArrowLeft":
          e.preventDefault();
          setPosition((prev) => ({ ...prev, x: prev.x + ARROW_PAN_SPEED }));
          break;
        case "ArrowRight":
          e.preventDefault();
          setPosition((prev) => ({ ...prev, x: prev.x - ARROW_PAN_SPEED }));
          break;
      }
    };
    window.addEventListener("keydown", handleArrowKeys);
    return () => window.removeEventListener("keydown", handleArrowKeys);
  }, [isEditingText]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const updateCanvasSize = () => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      redrawCanvas();
    };
    updateCanvasSize();
    window.addEventListener("resize", updateCanvasSize);
    return () => window.removeEventListener("resize", updateCanvasSize);
  }, [redrawCanvas]);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, [isMounted]);
  useEffect(() => {
    if (isMounted.current) requestAnimationFrame(redrawCanvas);
  }, [elements, position, scale, redrawCanvas]);

  useEffect(() => {
    const element = canvasRef.current;
    if (!element) return;
    const handleWheelEvent = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const factor = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.min(
          Math.max(scale * factor, MIN_SCALE),
          MAX_SCALE,
        );
        const delta = newScale / scale;
        const rect = element.getBoundingClientRect();
        setScale(newScale);
        setPosition((prev) => ({
          x: e.clientX - rect.left - (e.clientX - rect.left - prev.x) * delta,
          y: e.clientY - rect.top - (e.clientY - rect.top - prev.y) * delta,
        }));
      } else {
        setPosition((prev) => ({ x: prev.x - e.deltaX, y: prev.y - e.deltaY }));
      }
    };
    element.addEventListener("wheel", handleWheelEvent, { passive: false });
    return () => element.removeEventListener("wheel", handleWheelEvent);
  }, [scale]);

  // ─── Coordinate transform ─────────────────────────────────────────────────────

  const getTransformedPoint = useCallback(
    (e: React.MouseEvent): Position => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left - position.x) / scale,
        y: (e.clientY - rect.top - position.y) / scale,
      };
    },
    [position, scale],
  );

  // ─── Text editing ─────────────────────────────────────────────────────────────

  const startTextEditing = useCallback((element: Element) => {
    setIsEditingText(true);
    setEditingTextId(element.id);
    setSelectedElement(element);
    setTimeout(() => {
      const textarea = document.querySelector(
        'textarea[data-text-editing="true"]',
      ) as HTMLTextAreaElement;
      if (textarea) {
        textarea.focus();
        textarea.select();
      }
    }, 50);
  }, []);

  const finishTextEditing = useCallback(
    (newText: string) => {
      if (editingTextId) {
        if (newText.trim()) {
          const updatedElement = elements.find((el) => el.id === editingTextId);
          if (updatedElement) {
            if ((updatedElement.text || "") !== newText.trim())
              markHistoryActionMutated();
            const completedElement = {
              ...updatedElement,
              text: newText.trim(),
              isTemporary: false,
            };
            setElements((prev) =>
              prev.map((el) =>
                el.id === editingTextId ? completedElement : el,
              ),
            );
            if (isCollaborating && sendOperation && state.roomId) {
              sendOperation({
                type: "element_complete",
                roomId: state.roomId,
                elementId: editingTextId,
                authorId: state.userId!,
                data: { element: completedElement },
              });
            }
          }
        } else {
          markHistoryActionMutated();
          setElements((prev) => prev.filter((el) => el.id !== editingTextId));
          setSelectedElement(null);
          if (isCollaborating && sendOperation && state.roomId) {
            sendOperation({
              type: "element_delete",
              roomId: state.roomId,
              elementId: editingTextId,
              authorId: state.userId!,
              data: {},
            });
          }
        }
      }
      setIsEditingText(false);
      setEditingTextId(null);
      setSelectedTool("select");
      commitHistoryAction();
    },
    [
      editingTextId,
      elements,
      isCollaborating,
      markHistoryActionMutated,
      commitHistoryAction,
      sendOperation,
      setElements,
      state.roomId,
      state.userId,
    ],
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isEditingText) {
        const textarea = document.querySelector(
          'textarea[data-text-editing="true"]',
        ) as HTMLTextAreaElement;
        if (textarea && !textarea.contains(e.target as Node))
          finishTextEditing(textarea.value);
      }
    };
    if (isEditingText) {
      const timeoutId = setTimeout(
        () => document.addEventListener("mousedown", handleClickOutside),
        200,
      );
      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isEditingText, finishTextEditing]);

  // ─── Hit detection ────────────────────────────────────────────────────────────

  const getElementAtPoint = useCallback(
    (point: Position): Element | null => {
      for (let i = elements.length - 1; i >= 0; i--) {
        const element = elements[i];
        switch (element.type) {
          case "Rectangle":
          case "Diamond":
          case "Circle":
          case "Image": {
            if (element.width && element.height) {
              const minX = Math.min(element.x, element.x + element.width);
              const maxX = Math.max(element.x, element.x + element.width);
              const minY = Math.min(element.y, element.y + element.height);
              const maxY = Math.max(element.y, element.y + element.height);
              if (
                point.x >= minX &&
                point.x <= maxX &&
                point.y >= minY &&
                point.y <= maxY
              )
                return element;
            }
            break;
          }
          case "Line":
          case "Arrow": {
            if (element.width !== undefined && element.height !== undefined) {
              const tolerance = 10;
              const endX = element.x + element.width;
              const endY = element.y + element.height;

              if (element.bendPoint) {
                // Sample the quadratic bezier for hit detection
                const steps = 30;
                for (let s = 0; s <= steps; s++) {
                  const t = s / steps;
                  const bx =
                    (1 - t) * (1 - t) * element.x +
                    2 * (1 - t) * t * element.bendPoint.x +
                    t * t * endX;
                  const by =
                    (1 - t) * (1 - t) * element.y +
                    2 * (1 - t) * t * element.bendPoint.y +
                    t * t * endY;
                  if (
                    Math.sqrt((point.x - bx) ** 2 + (point.y - by) ** 2) <=
                    tolerance
                  )
                    return element;
                }
                break;
              }

              // Straight-line proximity check (no bend)
              const A = point.x - element.x,
                B = point.y - element.y;
              const C = endX - element.x,
                D = endY - element.y;
              const dot = A * C + B * D;
              const lenSq = C * C + D * D;
              if (lenSq === 0) continue;
              const param = dot / lenSq;
              const xx =
                param < 0
                  ? element.x
                  : param > 1
                    ? endX
                    : element.x + param * C;
              const yy =
                param < 0
                  ? element.y
                  : param > 1
                    ? endY
                    : element.y + param * D;
              if (
                Math.sqrt((point.x - xx) ** 2 + (point.y - yy) ** 2) <=
                tolerance
              )
                return element;
            }
            break;
          }
          case "Text": {
            if (element.text) {
              const textWidth =
                element.text.length * (element.fontSize || 20) * 0.6;
              const textHeight = element.fontSize || 20;
              if (
                point.x >= element.x &&
                point.x <= element.x + textWidth &&
                point.y >= element.y &&
                point.y <= element.y + textHeight
              )
                return element;
            }
            break;
          }
          case "Pencil": {
            if (element.points && element.points.length > 0) {
              for (const p of element.points) {
                if (
                  Math.sqrt((point.x - p.x) ** 2 + (point.y - p.y) ** 2) <= 10
                )
                  return element;
              }
            }
            break;
          }
        }
      }
      return null;
    },
    [elements],
  );

  // ─── Mouse down ───────────────────────────────────────────────────────────────

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (isEditingText) return;
      if (draggingBendPointRef.current) return;

      if (
        e.button === 1 ||
        (e.button === 0 && e.altKey) ||
        selectedTool === "Hand"
      ) {
        setIsPanning(true);
        setStartPan({ x: e.clientX - position.x, y: e.clientY - position.y });
        return;
      }

      if (!canDraw) return;

      const point = getTransformedPoint(e);

      // ── Bend point drag ──
      if (selectedTool === "select" && selectedElements.length === 1) {
        const el = selectedElements[0];
        if ((el.type === "Line" || el.type === "Arrow") && el.bendPoint) {
          const tol = 10 / scale;
          if (
            Math.hypot(point.x - el.bendPoint.x, point.y - el.bendPoint.y) <=
            tol
          ) {
            beginHistoryAction();
            setDraggingBendPoint(el.id);
            return;
          }
        }
      }

      if (selectedTool === "select") {
        // ── Check edge/corner hit on single element bounds ──
        if (selectedElements.length === 1) {
          const elBounds = getElementBounds(selectedElements[0]);
          if (elBounds) {
            const hit = getEdgeHit(point, elBounds, scale);
            if (hit) {
              beginHistoryAction();
              setResizing({
                corner: hit.corner,
                elementId: selectedElements[0].id,
              });
              setResizeStart(point);
              return;
            }
          }
          // Lines/Arrows: endpoint hit detection
          const el = selectedElements[0];
          if (
            (el.type === "Line" || el.type === "Arrow") &&
            el.width !== undefined &&
            el.height !== undefined
          ) {
            const tol = 10 / scale;
            const startDist = Math.hypot(point.x - el.x, point.y - el.y);
            const endDist = Math.hypot(
              point.x - (el.x + el.width),
              point.y - (el.y + el.height),
            );
            if (startDist <= tol) {
              beginHistoryAction();
              setResizing({ corner: "start", elementId: el.id });
              setResizeStart(point);
              return;
            }
            if (endDist <= tol) {
              beginHistoryAction();
              setResizing({ corner: "end", elementId: el.id });
              setResizeStart(point);
              return;
            }
          }
        }

        // ── Check edge/corner hit on group bounds ──
        if (selectedElements.length > 1 && groupBounds) {
          const groupPadded = {
            minX: groupBounds.minX - 14,
            minY: groupBounds.minY - 14,
            maxX: groupBounds.maxX + 14,
            maxY: groupBounds.maxY + 14,
          };
          const hit = getEdgeHit(point, groupPadded, scale);
          if (hit) {
            beginHistoryAction();
            setResizing({ corner: hit.corner, elementId: "group" });
            setResizeStart(point);
            setResizeSnapshot({
              elements: cloneElementsSnapshot(selectedElements),
              bounds: groupBounds,
            });
            return;
          }

          // ── Click inside group bounds → drag group ──
          if (isPointInBounds(point, groupBounds)) {
            beginHistoryAction();
            setIsDragging(true);
            setDragOffset({
              x: point.x - groupBounds.minX,
              y: point.y - groupBounds.minY,
            });
            return;
          }
        }

        // ── Check individual element hit ──
        const clickedElement = getElementAtPoint(point);

        if (clickedElement) {
          beginHistoryAction();
          if (
            selectedElements.some((s) => s.id === clickedElement.id) &&
            !e.shiftKey
          ) {
            // Already selected: just set up drag
            setIsDragging(true);
            setDragOffset({
              x: point.x - clickedElement.x,
              y: point.y - clickedElement.y,
            });
          } else {
            if (!e.shiftKey) {
              setSelectedElements([clickedElement]);
              setStrokeColor(clickedElement.strokeColor || strokeColor);
              setStrokeWidth(clickedElement.strokeWidth || strokeWidth);
              setStrokePattern(clickedElement.strokePattern || "solid");
              setFillColor(clickedElement.fillColor || null);
              setEdgeStyle(clickedElement.edgeStyle || "sharp");
            } else {
              setSelectedElements((prev) => [...prev, clickedElement]);
            }
            setSelectedElement(clickedElement);
            setIsDragging(true);
            setDragOffset({
              x: point.x - clickedElement.x,
              y: point.y - clickedElement.y,
            });
          }
        } else {
          // ── Start area selection ──
          setSelectionArea({ start: point, end: point });
          setSelectedElement(null);
          if (!e.shiftKey) setSelectedElements([]);
        }
        return;
      }

      // ── Text tool ──
      if (selectedTool === "Text") {
        beginHistoryAction();
        const elementId = isCollaborating
          ? `${state.userId || "local"}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
          : Date.now().toString();
        const startSnap =
          selectedTool === "Text" || selectedTool === "Arrow"
            ? findSnapTarget(point, elements, "", scale)
            : null;
        const newElement: Element = {
          id: elementId,
          type: selectedTool,
          x: startSnap ? startSnap.x : point.x,
          y: startSnap ? startSnap.y : point.y,
          startConnection: startSnap ? startSnap.connection : undefined,
          strokeColor,
          strokeWidth,
          strokePattern,
          roughness: 1,
          seed: Math.floor(Math.random() * 1000),
          text: "Type here...",
          fontSize: 20,
          fontFamily: "Virgil",
          authorId: isCollaborating ? state.userId || "local" : "local",
          isTemporary: true,
        };
        setElements((prev) => [...prev, newElement]);
        markHistoryActionMutated();
        startTextEditing(newElement);
        if (isCollaborating && sendOperation && state.roomId) {
          sendOperation({
            type: "element_start",
            roomId: state.roomId,
            elementId: newElement.id,
            authorId: state.userId!,
            data: { element: newElement, tool: selectedTool },
          });
        }
        return;
      }

      if (selectedTool === "Image") {
        const input = document.getElementById(
          "imageUpload",
        ) as HTMLInputElement;
        input?.click();
        return;
      }

      if (selectedTool === "Eraser") {
        beginHistoryAction();
        setEraserPos(point);
        const newElements = eraseElements(elements, point, ERASER_RADIUS);
        if (newElements.length !== elements.length) markHistoryActionMutated();
        setElements(newElements);
        if (isCollaborating && sendOperation && state.roomId) {
          elements
            .filter((el) => !newElements.includes(el))
            .forEach((el) => {
              sendOperation({
                type: "element_delete",
                roomId: state.roomId ?? undefined,
                elementId: el.id,
                authorId: state.userId ?? undefined,
                data: {},
              });
            });
        }
        return;
      }

      // ── Drawing tools ──
      beginHistoryAction();
      setDrawing(true);
      setSelectedElement(null);
      const newElement: Element = {
        id: Date.now().toString(),
        type: selectedTool,
        x: point.x,
        y: point.y,
        strokeColor,
        fillColor:
          (selectedTool === "Rectangle" ||
            selectedTool === "Diamond" ||
            selectedTool === "Circle") &&
          fillColor
            ? fillColor
            : undefined,
        strokeWidth,
        strokePattern,
        roughness: 1,
        seed: Math.floor(Math.random() * 1000),
        points: selectedTool === "Pencil" ? [point] : undefined,
        edgeStyle:
          selectedTool === "Rectangle" || selectedTool === "Diamond"
            ? edgeStyle
            : undefined,
        authorId: isCollaborating ? state.userId || "local" : "local",
        isTemporary: true,
      };
      setCurrentElement(newElement);
      setElements((prev) => [...prev, newElement]);
      markHistoryActionMutated();
      if (isCollaborating && sendOperation && state.roomId) {
        sendOperation({
          type: "element_start",
          roomId: state.roomId,
          elementId: newElement.id,
          authorId: state.userId!,
          data: { element: newElement, tool: selectedTool },
        });
        updateDrawingStatus(true, newElement.id);
      }
    },
    [
      isEditingText,
      getTransformedPoint,
      isCollaborating,
      position,
      selectedTool,
      getElementAtPoint,
      strokeColor,
      fillColor,
      edgeStyle,
      strokeWidth,
      strokePattern,
      elements,
      beginHistoryAction,
      markHistoryActionMutated,
      sendOperation,
      state.userId,
      state.roomId,
      setElements,
      updateDrawingStatus,
      selectedElements,
      groupBounds,
      startTextEditing,
      setSelectedElement,
      scale,
      canDraw,
      draggingBendPoint,
    ],
  );

  // ─── Mouse move ───────────────────────────────────────────────────────────────

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const point = getTransformedPoint(e);

      if (isCollaborating && !isPanning && !drawing) updateCursor(point);

      // ── Bend point drag ──
      if (draggingBendPointRef.current) {
        const activeBendId = draggingBendPointRef.current;
        markHistoryActionMutated();
        // point is where the cursor is; subtract offset to get desired on-curve midpoint
        const onCurveX = point.x - bendGrabOffsetRef.current.x;
        const onCurveY = point.y - bendGrabOffsetRef.current.y;
        // Invert from on-curve midpoint (t=0.5) back to quadratic bezier control point:
        // onCurve = 0.25*start + 0.5*control + 0.25*end
        // => control = 2*onCurve - 0.5*start - 0.5*end
        setElements((prev) =>
          prev.map((el) => {
            if (el.id !== activeBendId) return el;
            const elEndX = el.x + (el.width ?? 0);
            const elEndY = el.y + (el.height ?? 0);
            const controlX = 2 * onCurveX - 0.5 * el.x - 0.5 * elEndX;
            const controlY = 2 * onCurveY - 0.5 * el.y - 0.5 * elEndY;
            return { ...el, bendPoint: { x: controlX, y: controlY } };
          }),
        );
        setSelectedElements((prev) =>
          prev.map((el) => {
            if (el.id !== activeBendId) return el;
            const elEndX = el.x + (el.width ?? 0);
            const elEndY = el.y + (el.height ?? 0);
            const controlX = 2 * onCurveX - 0.5 * el.x - 0.5 * elEndX;
            const controlY = 2 * onCurveY - 0.5 * el.y - 0.5 * elEndY;
            return { ...el, bendPoint: { x: controlX, y: controlY } };
          }),
        );
        return;
      }

      // ── Edge-hover cursor detection (select tool, nothing being dragged/resized) ──
      if (
        selectedTool === "select" &&
        !isDragging &&
        !resizing &&
        !drawing &&
        !isPanning &&
        e.buttons === 0
      ) {
        let edgeCursor = "default";

        if (selectedElements.length === 1) {
          const elBounds = getElementBounds(selectedElements[0]);
          if (elBounds) {
            const hit = getEdgeHit(point, elBounds, scale);
            if (hit) edgeCursor = hit.cursor;
          }
          const el = selectedElements[0];
          if (
            !edgeCursor &&
            (el.type === "Line" || el.type === "Arrow") &&
            el.width !== undefined &&
            el.height !== undefined
          ) {
            const tol = 10 / scale;
            if (
              Math.hypot(point.x - el.x, point.y - el.y) <= tol ||
              Math.hypot(
                point.x - (el.x + el.width),
                point.y - (el.y + el.height),
              ) <= tol
            ) {
              edgeCursor = "crosshair";
            }
          }
        }

        if (!edgeCursor || edgeCursor === "default") {
          if (selectedElements.length > 1 && groupBounds) {
            const groupPadded = {
              minX: groupBounds.minX - 14,
              minY: groupBounds.minY - 14,
              maxX: groupBounds.maxX + 14,
              maxY: groupBounds.maxY + 14,
            };
            const hit = getEdgeHit(point, groupPadded, scale);
            if (hit) edgeCursor = hit.cursor;
            else if (isPointInBounds(point, groupBounds)) edgeCursor = "grab";
          }
        }

        setHoverCursor(edgeCursor);
      } else if (isDragging) {
        setHoverCursor("grabbing");
      } else if (!resizing) {
        setHoverCursor("default");
      }

      if (isTabPressedRef.current && e.buttons & 1) {
        requestAnimationFrame(() => {
          setPosition((prev) => ({
            x: prev.x + e.movementX,
            y: prev.y + e.movementY,
          }));
        });
        return;
      }

      if (isPanning) {
        requestAnimationFrame(() =>
          setPosition({ x: e.clientX - startPan.x, y: e.clientY - startPan.y }),
        );
        return;
      }

      if (selectedTool === "Laser") {
        if (e.buttons === 1) {
          const isDark = document.documentElement.classList.contains("dark");
          const getStrokeColor = (c: string) =>
            isDark && (c === "#000000" || c === "#000")
              ? "#ffffff"
              : !isDark && (c === "#ffffff" || c === "#fff")
                ? "#000000"
                : c;
          const laserColor = getStrokeColor(strokeColor);
          laser.addPoint(point, laserColor);
          if (isCollaborating && updateCursor && state.roomId && state.socket) {
            updateCursor({ x: point.x, y: point.y });
            state.socket.emit("laser_point", {
              roomId: state.roomId,
              point,
              userId: state.userId,
              timestamp: Date.now(),
              color: laserColor,
            });
          }
        }
        return;
      }

      if (selectedTool === "Eraser") {
        setEraserPos(point);
        if (e.buttons === 1) {
          const newElements = eraseElements(elements, point, ERASER_RADIUS);
          if (newElements.length !== elements.length)
            markHistoryActionMutated();
          setElements(newElements);
          if (isCollaborating && sendOperation && state.roomId) {
            elements
              .filter((el) => !newElements.includes(el))
              .forEach((el) => {
                sendOperation({
                  type: "element_delete",
                  roomId: state.roomId!,
                  elementId: el.id,
                  authorId: state.userId!,
                  data: {},
                });
              });
          }
        }
        return;
      }

      // ── Area selection drag ──
      if (
        selectedTool === "select" &&
        e.buttons === 1 &&
        !isDragging &&
        !resizing
      ) {
        setSelectionArea((prev) => ({
          start: prev?.start || point,
          end: point,
        }));
        const selRect = {
          left: Math.min(selectionArea?.start.x || point.x, point.x),
          right: Math.max(selectionArea?.start.x || point.x, point.x),
          top: Math.min(selectionArea?.start.y || point.y, point.y),
          bottom: Math.max(selectionArea?.start.y || point.y, point.y),
        };
        const inSel = elements.filter((el) => {
          switch (el.type) {
            case "Rectangle":
            case "Diamond":
            case "Circle":
            case "Image": {
              if (el.width && el.height) {
                const r = {
                  left: Math.min(el.x, el.x + el.width),
                  right: Math.max(el.x, el.x + el.width),
                  top: Math.min(el.y, el.y + el.height),
                  bottom: Math.max(el.y, el.y + el.height),
                };
                return (
                  r.left <= selRect.right &&
                  r.right >= selRect.left &&
                  r.top <= selRect.bottom &&
                  r.bottom >= selRect.top
                );
              }
              return false;
            }
            case "Line":
            case "Arrow": {
              if (el.width !== undefined && el.height !== undefined) {
                const endX = el.x + el.width,
                  endY = el.y + el.height;
                const r = {
                  left: Math.min(el.x, endX),
                  right: Math.max(el.x, endX),
                  top: Math.min(el.y, endY),
                  bottom: Math.max(el.y, endY),
                };
                return (
                  r.left <= selRect.right &&
                  r.right >= selRect.left &&
                  r.top <= selRect.bottom &&
                  r.bottom >= selRect.top
                );
              }
              return false;
            }
            case "Text": {
              if (el.text) {
                const r = {
                  left: el.x,
                  right: el.x + el.text.length * (el.fontSize || 20) * 0.6,
                  top: el.y,
                  bottom: el.y + (el.fontSize || 20),
                };
                return (
                  r.left <= selRect.right &&
                  r.right >= selRect.left &&
                  r.top <= selRect.bottom &&
                  r.bottom >= selRect.top
                );
              }
              return false;
            }
            case "Pencil": {
              if (el.points && el.points.length > 0) {
                const xs = el.points.map((p) => p.x),
                  ys = el.points.map((p) => p.y);
                const r = {
                  left: Math.min(...xs),
                  right: Math.max(...xs),
                  top: Math.min(...ys),
                  bottom: Math.max(...ys),
                };
                return (
                  r.left <= selRect.right &&
                  r.right >= selRect.left &&
                  r.top <= selRect.bottom &&
                  r.bottom >= selRect.top
                );
              }
              return false;
            }
            default:
              return false;
          }
        });
        setSelectedElements(inSel);
        setSelectedElement(inSel.length === 1 ? inSel[0] : null);
        return;
      }

      // ── Element drag ──
      if (isDragging && selectedElements.length > 0) {
        markHistoryActionMutated();
        const selectedIds = selectedElements.map((s) => s.id);

        setElements((prev) => {
          // For multi-select we anchored on groupBounds.minX/minY.
          // For single select we anchored on element.x/y.
          // Recompute delta by finding how much the first selected element moves.
          const anchorEl = prev.find((el) => selectedIds.includes(el.id));
          if (!anchorEl) return prev;

          // let deltaX: number, deltaY: number;
          // if (selectedIds.length > 1 && groupBounds) {
          //   // dragOffset stored as (point - groupBounds.minX, point - groupBounds.minY)
          //   deltaX =
          //     point.x -
          //     dragOffset.x -
          //     anchorEl.x +
          //     (groupBounds.minX - anchorEl.x); // simplify:
          //   // Actually: we want new groupBounds.minX = point.x - dragOffset.x
          //   // anchorEl.x + delta = anchorEl.x + (newMinX - oldMinX)
          //   // delta = newMinX - oldMinX
          //   // This is tricky because groupBounds is stale. Use a simpler mouse-move delta approach:
          //   deltaX = e.movementX / scale;
          //   deltaY = e.movementY / scale;
          // } else {
          //   // Single element anchor
          //   const newX = point.x - dragOffset.x;
          //   const newY = point.y - dragOffset.y;
          //   deltaX = newX - anchorEl.x;
          //   deltaY = newY - anchorEl.y;
          // }
          const deltaX = e.movementX / scale;
          const deltaY = e.movementY / scale;

          if (deltaX === 0 && deltaY === 0) return prev;

          const updated = prev.map((el) => {
            if (!selectedIds.includes(el.id)) return el;
            const newEl = { ...el, x: el.x + deltaX, y: el.y + deltaY };
            if (el.type === "Pencil" && el.points) {
              newEl.points = el.points.map((p) => ({
                x: p.x + deltaX,
                y: p.y + deltaY,
              }));
            }
            // Translate bend point with the element
            if (el.bendPoint) {
              newEl.bendPoint = {
                x: el.bendPoint.x + deltaX,
                y: el.bendPoint.y + deltaY,
              };
            }
            if (
              isCollaborating &&
              sendOperation &&
              state.roomId &&
              state.userId
            ) {
              sendOperation({
                type: "element_update",
                roomId: state.roomId!,
                elementId: el.id,
                authorId: state.userId!,
                data: {
                  x: newEl.x,
                  y: newEl.y,
                  ...(newEl.points ? { points: newEl.points } : {}),
                },
              });
            }
            return newEl;
          });

          // After the setElements call that moves selected elements, also update connected lines:
          setElements((prev) => {
            const movedIds = new Set(selectedIds);
            return prev.map((el) => {
              if (el.type !== "Arrow" && el.type !== "Line") return el;
              let updated = { ...el };
              let changed = false;

              if (
                el.startConnection &&
                movedIds.has(el.startConnection.elementId)
              ) {
                const shape = prev.find(
                  (s) => s.id === el.startConnection!.elementId,
                );
                if (shape) {
                  // const coords = getConnectionCoordsForElement(
                  //   shape,
                  //   el.startConnection.point,
                  // );
                  // Temporarily apply delta to shape to get new coords
                  const newCoords = getConnectionCoordsForElement(
                    { ...shape, x: shape.x + deltaX, y: shape.y + deltaY },
                    el.startConnection.point,
                  );
                  const oldEndX = el.x + (el.width ?? 0);
                  const oldEndY = el.y + (el.height ?? 0);
                  updated = {
                    ...updated,
                    x: newCoords.x,
                    y: newCoords.y,
                    width: oldEndX - newCoords.x,
                    height: oldEndY - newCoords.y,
                  };
                  changed = true;
                }
              }

              if (
                el.endConnection &&
                movedIds.has(el.endConnection.elementId)
              ) {
                const shape = prev.find(
                  (s) => s.id === el.endConnection!.elementId,
                );
                if (shape) {
                  const newCoords = getConnectionCoordsForElement(
                    { ...shape, x: shape.x + deltaX, y: shape.y + deltaY },
                    el.endConnection.point,
                  );
                  updated = {
                    ...updated,
                    width: newCoords.x - updated.x,
                    height: newCoords.y - updated.y,
                  };
                  changed = true;
                }
              }

              return changed ? updated : el;
            });
          });

          setSelectedElements(
            updated.filter((el) => selectedIds.includes(el.id)),
          );
          setSelectedElement((prev) =>
            prev ? (updated.find((el) => el.id === prev.id) ?? prev) : null,
          );
          return updated;
        });
        return;
      }

      // ── Resize ──
      if (resizing && resizeStart) {
        markHistoryActionMutated();

        if (resizing.elementId === "group" && resizeSnapshot) {
          const { minX, minY, scaleX, scaleY } = applyGroupHandleResize(
            resizing.corner as HandleCorner,
            point,
            resizeSnapshot.bounds,
          );

          const updatedSelectedElements = cloneElementsSnapshot(
            resizeSnapshot.elements,
          ).map((el) => {
            const updated = {
              ...el,
              x: minX + (el.x - resizeSnapshot.bounds.minX) * scaleX,
              y: minY + (el.y - resizeSnapshot.bounds.minY) * scaleY,
            } as Element;
            if (el.width !== undefined && el.height !== undefined) {
              updated.width = el.width * scaleX;
              updated.height = el.height * scaleY;
            }
            if (el.type === "Pencil" && el.points) {
              updated.points = el.points.map((p) => ({
                x: minX + (p.x - resizeSnapshot.bounds.minX) * scaleX,
                y: minY + (p.y - resizeSnapshot.bounds.minY) * scaleY,
              }));
            }
            return updated;
          });

          setSelectedElements(updatedSelectedElements);
          setElements((prev) =>
            prev.map(
              (el) => updatedSelectedElements.find((u) => u.id === el.id) || el,
            ),
          );
          return;
        }

        // Single element resize
        setElements((prev) => {
          let updatedElement: Element | null = null;
          const updated = prev.map((el) => {
            if (el.id !== resizing.elementId) return el;

            const patch = applyHandleResize(
              el,
              resizing.corner as HandleCorner,
              point,
            );

            // ── Snap logic: mutate patch FIRST, then build updatedElement ──
            if (
              (el.type === "Arrow" || el.type === "Line") &&
              (resizing.corner === "start" || resizing.corner === "end")
            ) {
              const snap = findSnapTarget(point, elements, el.id, scale);
              if (snap) {
                if (resizing.corner === "end") {
                  patch.width = snap.x - el.x;
                  patch.height = snap.y - el.y;
                  patch.endConnection = snap.connection;
                } else {
                  const oldEndX = el.x + (el.width ?? 0);
                  const oldEndY = el.y + (el.height ?? 0);
                  patch.x = snap.x;
                  patch.y = snap.y;
                  patch.width = oldEndX - snap.x;
                  patch.height = oldEndY - snap.y;
                  patch.startConnection = snap.connection;
                }
                setSnapHighlight({ x: snap.x, y: snap.y });
              } else {
                if (resizing.corner === "end") patch.endConnection = undefined;
                else patch.startConnection = undefined;
                setSnapHighlight(null);
              }
            }

            // ← Build updatedElement AFTER snap has modified patch
            updatedElement = { ...el, ...patch };

            if (
              isCollaborating &&
              sendOperation &&
              state.roomId &&
              state.userId
            ) {
              sendOperation({
                type: "element_update",
                roomId: state.roomId!,
                elementId: el.id,
                authorId: state.userId!,
                data: patch,
              });
            }
            return updatedElement;
          });

          if (updatedElement) {
            setSelectedElement(updatedElement);
            setSelectedElements([updatedElement]);
          }
          return updated;
        });

        return;
      }

      // ── Active drawing ──
      if (!drawing || !currentElement) return;
      markHistoryActionMutated();
      setElements((prev) => {
        const index = prev.findIndex((el) => el.id === currentElement.id);
        if (index === -1) return prev;
        const updated = [...prev];
        switch (currentElement.type) {
          case "Rectangle":
          case "Diamond":
          case "Circle":
            updated[index] = {
              ...currentElement,
              width: point.x - currentElement.x,
              height: point.y - currentElement.y,
            };
            break;

          case "Arrow":
          case "Line": {
            const snap =
              currentElement.type === "Arrow" || currentElement.type === "Line"
                ? findSnapTarget(point, elements, currentElement.id, scale)
                : null;

            const endX = snap ? snap.x : point.x;
            const endY = snap ? snap.y : point.y;

            if (snap) {
              setSnapHighlight({ x: snap.x, y: snap.y });
            } else {
              setSnapHighlight(null);
            }

            updated[index] = {
              ...currentElement,
              width: endX - currentElement.x,
              height: endY - currentElement.y,
              endConnection: snap ? snap.connection : undefined,
            };

            if (
              isCollaborating &&
              sendOperation &&
              state.roomId &&
              state.userId
            ) {
              sendOperation({
                type: "element_update",
                roomId: state.roomId!,
                elementId: currentElement.id,
                authorId: state.userId!,
                data: {
                  width: endX - currentElement.x,
                  height: endY - currentElement.y,
                },
              });
            }
            break;
          }
          case "Pencil": {
            const currentPoints = updated[index].points || [];
            const lastPoint = currentPoints[currentPoints.length - 1];
            const distance = lastPoint
              ? Math.sqrt(
                  (point.x - lastPoint.x) ** 2 + (point.y - lastPoint.y) ** 2,
                )
              : 0;
            if (!lastPoint || distance > 1) {
              const newPoints = [...currentPoints, point];
              updated[index] = { ...updated[index], points: newPoints };
              if (
                isCollaborating &&
                sendOperation &&
                state.roomId &&
                state.userId
              ) {
                sendOperation({
                  type: "element_update",
                  roomId: state.roomId!,
                  elementId: currentElement.id,
                  authorId: state.userId!,
                  data: { points: newPoints },
                });
              }
            }
            break;
          }
        }
        return updated;
      });
    },
    [
      getTransformedPoint,
      isCollaborating,
      updateCursor,
      drawing,
      isPanning,
      startPan,
      selectedTool,
      strokeColor,
      laser,
      elements,
      currentElement,
      isDragging,
      dragOffset,
      resizing,
      resizeStart,
      resizeSnapshot,
      selectionArea,
      selectedElements,
      groupBounds,
      sendOperation,
      state.roomId,
      state.socket,
      state.userId,
      markHistoryActionMutated,
      setElements,
      setSelectedElement,
      scale,
      setHoverCursor,
      draggingBendPoint, // ← ADD THIS
    ],
  );

  // ─── Mouse up ─────────────────────────────────────────────────────────────────

  const handleMouseUp = useCallback(() => {
    setSnapHighlight(null);
    draggingBendPointRef.current = null; // ← clear ref
    setDraggingBendPoint(null);
    //     if (draggingBendPoint) {
    //       draggingBendPointRef.current = null;   // ← clear ref
    // setDraggingBendPoint(null);
    //       commitHistoryAction();
    //       return;
    //     }
    if (
      drawing &&
      currentElement &&
      isCollaborating &&
      sendOperation &&
      state.roomId
    ) {
      setElements((prev) => {
        const latestElement = prev.find((el) => el.id === currentElement.id);
        const completedElement = {
          ...(latestElement || currentElement),
          isTemporary: false,
        };
        sendOperation({
          type: "element_complete",
          roomId: state.roomId!,
          elementId: currentElement.id,
          authorId: state.userId!,
          data: { element: completedElement },
        });
        return prev.map((el) =>
          el.id === currentElement.id ? completedElement : el,
        );
      });
      updateDrawingStatus(false);
    }

    setDrawing(false);
    setCurrentElement(null);
    setIsPanning(false);
    setIsDragging(false);
    setResizing(null);
    setResizeStart(null);
    setResizeSnapshot(null);
    setSelectionArea(null);

    if (
      drawing &&
      selectedTool !== "select" &&
      selectedTool !== "Eraser" &&
      selectedTool !== "Pencil" &&
      selectedTool !== "Laser"
    ) {
      setSelectedTool("select");
    }
    if (!isEditingText) commitHistoryAction();
  }, [
    drawing,
    draggingBendPoint,
    commitHistoryAction,
    currentElement,
    isCollaborating,
    sendOperation,
    state.roomId,
    state.userId,
    updateDrawingStatus,
    setElements,
    selectedTool,
    setSelectedTool,
    isEditingText,
    commitHistoryAction,
  ]);

  // ─── Double click ─────────────────────────────────────────────────────────────

  const handleDoubleClick = useCallback(
  (e: React.MouseEvent) => {
    if (!canDraw) return;
    if (selectedTool !== "select") return;
    const point = getTransformedPoint(e);
    const clickedElement = getElementAtPoint(point);
    if (clickedElement) {
      if (clickedElement.type === "Text") {
        if (!clickedElement.isTemporary) beginHistoryAction();
        startTextEditing(clickedElement);
      }
    } else {
      // Create a text element immediately at the click position and open it
      beginHistoryAction();
      const elementId = isCollaborating
        ? `${state.userId || "local"}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        : Date.now().toString();
      const newElement: Element = {
        id: elementId,
        type: "Text",
        x: point.x,
        y: point.y,
        strokeColor,
        strokeWidth,
        strokePattern,
        roughness: 1,
        seed: Math.floor(Math.random() * 1000),
        text: "Type here...",
        fontSize: 20,
        fontFamily: "Virgil",
        authorId: isCollaborating ? state.userId || "local" : "local",
        isTemporary: true,
      };
      setElements((prev) => [...prev, newElement]);
      markHistoryActionMutated();
      setSelectedTool("Text");
      startTextEditing(newElement);
      if (isCollaborating && sendOperation && state.roomId) {
        sendOperation({
          type: "element_start",
          roomId: state.roomId,
          elementId: newElement.id,
          authorId: state.userId!,
          data: { element: newElement, tool: "Text" },
        });
      }
    }
  },
  [
    selectedTool,
    getTransformedPoint,
    getElementAtPoint,
    beginHistoryAction,
    startTextEditing,
    setSelectedTool,
    isCollaborating,
    state.userId,
    state.roomId,
    strokeColor,
    strokeWidth,
    strokePattern,
    setElements,
    markHistoryActionMutated,
    sendOperation,
    canDraw,
  ],
);

  // ─── Image upload ─────────────────────────────────────────────────────────────

  const handleImageUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const imageUrl = event.target?.result as string;
          const img = new Image();
          img.onload = () => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const visibleWidth = canvas.width / window.devicePixelRatio / scale;
            const visibleHeight =
              canvas.height / window.devicePixelRatio / scale;
            const maxWidth = visibleWidth * 0.5,
              maxHeight = visibleHeight * 0.5;
            const aspectRatio = img.width / img.height;
            let newWidth = img.width,
              newHeight = img.height;
            if (newWidth > maxWidth) {
              newWidth = maxWidth;
              newHeight = newWidth / aspectRatio;
            }
            if (newHeight > maxHeight) {
              newHeight = maxHeight;
              newWidth = newHeight * aspectRatio;
            }
            const centerX = -position.x / scale + (visibleWidth - newWidth) / 2;
            const centerY =
              -position.y / scale + (visibleHeight - newHeight) / 2;
            const newElement: Element = {
              id: Date.now().toString(),
              type: "Image",
              x: centerX,
              y: centerY,
              width: newWidth,
              height: newHeight,
              strokeColor,
              strokeWidth,
              imageUrl,
              aspectRatio,
            };
            setElements((prev) => {
              if (!isCollaborating) recordHistorySnapshot(prev);
              return [...prev, newElement];
            });
            setSelectedElement(newElement);
            setSelectedTool("select");
            if (isCollaborating)
              sendOperation({
                type: "element_create",
                element: newElement,
                roomId: state.roomId ?? undefined,
                userId: state.userId ?? undefined,
              });
          };
          img.src = imageUrl;
        };
        reader.readAsDataURL(file);
      }
    },
    [
      strokeColor,
      strokeWidth,
      setSelectedTool,
      scale,
      position,
      canvasRef,
      isCollaborating,
      sendOperation,
      recordHistorySnapshot,
      setElements,
      state.roomId,
      state.userId,
    ],
  );

  // ─── Reset on collab end ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!isCollaborating) {
      setCollaborativeElements([]);
      setCurrentElement(null);
      setSelectedElement(null);
      setSelectedElements([]);
      setDrawing(false);
      setIsPanning(false);
      setIsDragging(false);
      setResizing(null);
      setResizeStart(null);
      setEraserPos(null);
      setSelectionArea(null);
      setEditingTextId(null);
      setIsEditingText(false);
    }
  }, [isCollaborating]);

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div
      ref={containerRef}
      className={cn("h-full w-full overflow-hidden bg-dot-pattern")}
      style={{
        cursor: isPanning
          ? "grabbing"
          : selectedTool === "Hand"
            ? "grab"
            : selectedTool === "Pencil"
              ? "crosshair"
              : selectedTool === "Eraser"
                ? "none"
                : selectedTool === "select"
                  ? hoverCursor
                  : "default",
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDoubleClick={handleDoubleClick}
    >
      <input
        type="file"
        accept="image/*"
        className="hidden"
        id="imageUpload"
        onChange={handleImageUpload}
      />
      <canvas ref={canvasRef} className="absolute top-0 left-0" />

      {isCollaborating && (
        <>
          <ConnectionStatus
            isConnected={isConnected}
            collaborators={collaborators}
            visible={!isJoinSidebarOpen}
          />
          {collaborators.map(
            (collaborator) =>
              collaborator.cursor &&
              collaborator.id !== state.userId && (
                <CollabCursor
                  key={collaborator.id}
                  collaborator={collaborator}
                  position={position}
                  scale={scale}
                />
              ),
          )}
        </>
      )}

      {/* Text Input Overlay */}
      {isEditingText && selectedElement && selectedElement.type === "Text" && (
        <textarea
          data-text-editing="true"
          className="absolute z-50 resize-none border-2 border-blue-500 rounded-md px-2 py-1 
                     bg-background shadow-lg outline-none text-foreground
                     animate-in fade-in duration-150 canvas-text-overlay pointer-events-auto"
          style={
            {
              "--text-left": `${Math.max(0, selectedElement.x * scale + position.x)}px`,
              "--text-top": `${Math.max(0, selectedElement.y * scale + position.y)}px`,
              "--text-size": `${selectedElement.fontSize || 20}px`,
            } as React.CSSProperties
          }
          defaultValue={selectedElement.text || ""}
          placeholder="Type your text..."
          autoFocus
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Escape") finishTextEditing("");
            else if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              finishTextEditing(e.currentTarget.value);
            }
          }}
          onFocus={(e) => e.currentTarget.select()}
        />
      )}

      {/* Eraser Cursor */}
      {selectedTool === "Eraser" && eraserPos && (
        <div
          className="canvas-eraser-cursor"
          style={
            {
              left: `${eraserPos.x * scale + position.x - ERASER_RADIUS}px`,
              top: `${eraserPos.y * scale + position.y - ERASER_RADIUS}px`,
              width: `${ERASER_RADIUS * 2}px`,
              height: `${ERASER_RADIUS * 2}px`,
            } as React.CSSProperties
          }
        />
      )}

      {/* Corner resize dots — 4 corners, no edge-mid points */}
      {selectedTool === "select" &&
        selectedElements.length > 0 &&
        (() => {
          // Compute live bounds from current selectedElements state
          const bounds = (() => {
            let minX = Infinity,
              minY = Infinity,
              maxX = -Infinity,
              maxY = -Infinity;
            selectedElements.forEach((el) => {
              switch (el.type) {
                case "Rectangle":
                case "Diamond":
                case "Circle":
                case "Image":
                  if (el.width !== undefined && el.height !== undefined) {
                    minX = Math.min(minX, el.x, el.x + el.width);
                    maxX = Math.max(maxX, el.x, el.x + el.width);
                    minY = Math.min(minY, el.y, el.y + el.height);
                    maxY = Math.max(maxY, el.y, el.y + el.height);
                  }
                  break;
                case "Line":
                case "Arrow":
                  if (el.width !== undefined && el.height !== undefined) {
                    minX = Math.min(minX, el.x, el.x + el.width);
                    maxX = Math.max(maxX, el.x, el.x + el.width);
                    minY = Math.min(minY, el.y, el.y + el.height);
                    maxY = Math.max(maxY, el.y, el.y + el.height);
                  }
                  break;
                case "Text":
                  if (el.text) {
                    minX = Math.min(minX, el.x);
                    maxX = Math.max(
                      maxX,
                      el.x + el.text.length * (el.fontSize || 20) * 0.6,
                    );
                    minY = Math.min(minY, el.y);
                    maxY = Math.max(maxY, el.y + (el.fontSize || 20));
                  }
                  break;
                case "Pencil":
                  if (el.points?.length) {
                    el.points.forEach((p) => {
                      minX = Math.min(minX, p.x);
                      maxX = Math.max(maxX, p.x);
                      minY = Math.min(minY, p.y);
                      maxY = Math.max(maxY, p.y);
                    });
                  }
                  break;
              }
            });
            if (minX === Infinity) return null;
            return { minX, minY, maxX, maxY };
          })();

          if (!bounds) return null;

          // ── Line / Arrow: show only start + end endpoint dots ──
          if (
            selectedElements.length === 1 &&
            (selectedElements[0].type === "Line" ||
              selectedElements[0].type === "Arrow")
          ) {
            const el = selectedElements[0];
            if (el.width === undefined || el.height === undefined) return null;
            const endX = el.x + el.width;
            const endY = el.y + el.height;
            const endpoints = [
              {
                x: el.x,
                y: el.y,
                corner: "start" as const,
                cursor: "crosshair",
              },
              { x: endX, y: endY, corner: "end" as const, cursor: "crosshair" },
            ];
            return endpoints.map((c) => (
              <div
                key={c.corner}
                className="absolute z-40 pointer-events-auto"
                style={{
                  left: `${c.x * scale + position.x - 5}px`,
                  top: `${c.y * scale + position.y - 5}px`,
                  width: "12px",
                  height: "12px",
                  cursor: c.cursor,
                  borderRadius: "50px",
                  border: "2px solid #007acc",
                  background: "white",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  beginHistoryAction();
                  const canvasPoint = getTransformedPoint(e);
                  setResizing({ corner: c.corner, elementId: el.id });
                  setResizeStart(canvasPoint);
                }}
              />
            ));
          }
          const PAD = 6; // matches canvas drawing padding
          const corners = [
            {
              x: bounds.minX - PAD,
              y: bounds.minY - PAD,
              cursor: "nwse-resize",
              corner: "tl",
            },
            {
              x: bounds.maxX + PAD,
              y: bounds.minY - PAD,
              cursor: "nesw-resize",
              corner: "tr",
            },
            {
              x: bounds.minX - PAD,
              y: bounds.maxY + PAD,
              cursor: "nesw-resize",
              corner: "bl",
            },
            {
              x: bounds.maxX + PAD,
              y: bounds.maxY + PAD,
              cursor: "nwse-resize",
              corner: "br",
            },
          ] as const;

          return corners.map((c) => (
            <div
              key={c.corner}
              className="absolute z-40 pointer-events-auto"
              style={{
                left: `${c.x * scale + position.x - 5}px`,
                top: `${c.y * scale + position.y - 5}px`,
                width: "10px",
                height: "10px",
                cursor: c.cursor,
                borderRadius: "2px",
                border: "2px solid #007acc",
                background: "white",
                boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                beginHistoryAction();
                const canvasPoint = getTransformedPoint(e);
                if (selectedElements.length > 1 && bounds) {
                  setResizing({ corner: c.corner, elementId: "group" });
                  setResizeStart(canvasPoint);
                  setResizeSnapshot({
                    elements: cloneElementsSnapshot(selectedElements),
                    bounds,
                  });
                } else if (selectedElements.length === 1) {
                  setResizing({
                    corner: c.corner,
                    elementId: selectedElements[0].id,
                  });
                  setResizeStart(canvasPoint);
                }
              }}
            />
          ));
        })()}

      {/* Bend point handle */}
      {selectedTool === "select" &&
        selectedElements.length === 1 &&
        (selectedElements[0].type === "Line" ||
          selectedElements[0].type === "Arrow") &&
        (() => {
          const el = selectedElements[0];
          const endX = el.x + (el.width ?? 0);
          const endY = el.y + (el.height ?? 0);
          // Show handle at the actual curve midpoint (t=0.5 on quadratic bezier),
          // not at the off-curve control point
          const midX = el.bendPoint
            ? 0.25 * el.x + 0.5 * el.bendPoint.x + 0.25 * endX
            : el.x + (el.width ?? 0) / 2;
          const midY = el.bendPoint
            ? 0.25 * el.y + 0.5 * el.bendPoint.y + 0.25 * endY
            : el.y + (el.height ?? 0) / 2;
          return (
            <div
              className="absolute z-40 pointer-events-auto"
              style={{
                left: `${midX * scale + position.x - 6}px`,
                top: `${midY * scale + position.y - 6}px`,
                width: "12px",
                height: "12px",
                cursor: "grab",
                borderRadius: "50%",
                border: "2px solid #007acc",
                background: el.bendPoint ? "#007acc" : "white",
                boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                beginHistoryAction();
                const canvasPoint = getTransformedPoint(e);
                const elEndX = el.x + (el.width ?? 0);
                const elEndY = el.y + (el.height ?? 0);
                // The handle is shown at the on-curve midpoint (t=0.5).
                // Compute where the control point WOULD be if dragged to canvasPoint:
                //   controlPoint = 2*onCurvePoint - 0.5*start - 0.5*end
                // We store offset as: canvasPoint (on-curve) - onCurvePoint,
                // then in mousemove: controlPoint = 2*(point - offset) - 0.5*start - 0.5*end
                const onCurveX = el.bendPoint
                  ? 0.25 * el.x + 0.5 * el.bendPoint.x + 0.25 * elEndX
                  : el.x + (el.width ?? 0) / 2;
                const onCurveY = el.bendPoint
                  ? 0.25 * el.y + 0.5 * el.bendPoint.y + 0.25 * elEndY
                  : el.y + (el.height ?? 0) / 2;
                bendGrabOffsetRef.current = {
                  x: canvasPoint.x - onCurveX,
                  y: canvasPoint.y - onCurveY,
                };
                draggingBendPointRef.current = el.id;
                setDraggingBendPoint(el.id);
              }}
            />
          );
        })()}

      {/* Snap highlight ring */}
      {snapHighlight && (
        <div
          className="absolute z-50 pointer-events-none"
          style={{
            left: `${snapHighlight.x * scale + position.x - 10}px`,
            top: `${snapHighlight.y * scale + position.y - 10}px`,
            width: "20px",
            height: "20px",
            borderRadius: "50%",
            border: "2px solid #22c55e",
            background: "rgba(34,197,94,0.15)",
          }}
        />
      )}
      {/* Bottom Controls */}
      <div
        className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 bg-background/80 backdrop-blur-md border border-border rounded-xl shadow-lg flex items-center gap-1 p-1"
        onMouseDown={(e) => e.stopPropagation()}
        onMouseUp={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={undo}
          disabled={isCollaborating || undoStack.length === 0 || isEditingText}
          aria-label="Undo"
          title="Undo (Ctrl/Cmd+Z)"
        >
          <Undo2 />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={redo}
          disabled={isCollaborating || redoStack.length === 0 || isEditingText}
          aria-label="Redo"
          title="Redo (Ctrl/Cmd+Shift+Z / Ctrl/Cmd+Y)"
        >
          <Redo2 />
        </Button>
        <div className="mx-1 h-6 w-px bg-border" />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => zoomBy(0.9)}
          disabled={scale <= MIN_SCALE}
          aria-label="Zoom out"
          title="Zoom out"
        >
          <Minus />
        </Button>
        <div className="px-2 text-sm font-medium tabular-nums min-w-[64px] text-center">
          {Math.round(scale * 100)}%
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => zoomBy(1.1)}
          disabled={scale >= MAX_SCALE}
          aria-label="Zoom in"
          title="Zoom in"
        >
          <Plus />
        </Button>
      </div>
    </div>
  );
};
