import { useCallback, useEffect, useRef, useState } from "react";
import { useDrawing } from "@/contexts/DrawingContext";
import rough from "roughjs";
import type { Position, Element } from "@/types";
import { useLaserTrail } from "./LaserTrail";
import { eraseElements, getResizeHandles } from "@/utils/canvas";
import { ImageLoader } from "@/utils/imageLoader";
import { isElementInViewport } from "@/utils/viewport";
import {
  loadFromLocalStorage,
  saveToLocalStorage,
} from "@/utils/StoreProgress";
import { AUTO_SAVE_INTERVAL, ERASER_RADIUS } from "@/constants/canvas";

export const CanvasBoard = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrame = useRef<number | null>(null);
  const { selectedTool, strokeColor, strokeWidth, setSelectedTool } =
    useDrawing();
  const [elements, setElements] = useState<Element[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
  const [startPan, setStartPan] = useState<Position>({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [currentElement, setCurrentElement] = useState<Element | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [isEditingText, setIsEditingText] = useState(false);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [selectedElement, setSelectedElement] = useState<Element | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  const [resizing, setResizing] = useState<{
    corner: string;
    elementId: string;
  } | null>(null);
  const [resizeStart, setResizeStart] = useState<Position | null>(null);
  const [eraserPos, setEraserPos] = useState<Position | null>(null);
  const [selectionArea, setSelectionArea] = useState<{
    start: Position;
    end: Position;
  } | null>(null);
  const [selectedElements, setSelectedElements] = useState<Element[]>([]);
  const laser = useLaserTrail();

  // Save in local storage and load from that
  useEffect(() => {
    const savedElements = loadFromLocalStorage();
    if (savedElements.length > 0) {
      setElements(savedElements);
    }

    const frameRef = animationFrame;

    // Cleanup image cache and animation frame when component unmounts
    return () => {
      ImageLoader.clear();
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      saveToLocalStorage(elements);
    }, AUTO_SAVE_INTERVAL);

    return () => clearInterval(interval);
  }, [elements]);

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Save context
    ctx.save();

    // Apply transform
    ctx.translate(position.x, position.y);
    ctx.scale(scale, scale);

    // Create rough canvas
    const rc = rough.canvas(canvas);

    // Draw elements
    elements.forEach((element) => {
      const options = {
        stroke: element.strokeColor,
        strokeWidth: element.strokeWidth,
        roughness: element.roughness || 1,
        seed: element.seed || 1,
      };

      switch (element.type) {
        case "Image": {
          if (element.imageUrl && element.width && element.height) {
            // Check if the image is in viewport before loading/drawing
            const isVisible = isElementInViewport(
              element,
              canvas.width / window.devicePixelRatio,
              canvas.height / window.devicePixelRatio,
              position,
              scale
            );

            if (isVisible) {
              // Get image synchronously from cache
              const img = ImageLoader.getFromCache(element.imageUrl);
              if (img) {
                ctx.drawImage(
                  img,
                  element.x,
                  element.y,
                  element.width!,
                  element.height!
                );
              } else {
                // Load the image if not in cache
                ImageLoader.load(element.imageUrl)
                  .then(() => {
                    // Trigger a redraw once the image is loaded
                    redrawCanvas();
                  })
                  .catch((error) => {
                    console.error("Error loading image:", error);
                  });
              }
            }
          }
          break;
        }
        case "Rectangle": {
          if (element.width && element.height) {
            rc.rectangle(
              element.x,
              element.y,
              element.width,
              element.height,
              options
            );
          }
          break;
        }
        case "Diamond": {
          if (element.width && element.height) {
            const points: [number, number][] = [
              [element.x + element.width / 2, element.y], // top
              [element.x + element.width, element.y + element.height / 2], // right
              [element.x + element.width / 2, element.y + element.height], // bottom
              [element.x, element.y + element.height / 2], // left
            ];
            rc.polygon(points, options);
          }
          break;
        }

        case "Line": {
          if (element.width !== undefined && element.height !== undefined) {
            rc.line(
              element.x,
              element.y,
              element.x + element.width,
              element.y + element.height,
              options
            );
          }
          break;
        }
        case "Pencil": {
          if (element.points && element.points.length > 0) {
            ctx.save();
            ctx.strokeStyle = element.strokeColor;
            ctx.lineWidth = element.strokeWidth;
            ctx.lineJoin = "round";
            ctx.lineCap = "round";
            ctx.globalCompositeOperation = "source-over";

            if (element.points.length === 1) {
              // Single point - draw a small circle
              ctx.beginPath();
              ctx.arc(
                element.points[0].x,
                element.points[0].y,
                element.strokeWidth / 2,
                0,
                2 * Math.PI
              );
              ctx.fill();
            } else if (element.points.length === 2) {
              // Two points - draw a straight line
              ctx.beginPath();
              ctx.moveTo(element.points[0].x, element.points[0].y);
              ctx.lineTo(element.points[1].x, element.points[1].y);
              ctx.stroke();
            } else {
              // Multiple points - draw smooth curve
              ctx.beginPath();
              ctx.moveTo(element.points[0].x, element.points[0].y);

              // Use quadratic curves for smoother drawing
              for (let i = 1; i < element.points.length - 1; i++) {
                const currentPoint = element.points[i];
                const nextPoint = element.points[i + 1];
                const cpx = (currentPoint.x + nextPoint.x) / 2;
                const cpy = (currentPoint.y + nextPoint.y) / 2;
                ctx.quadraticCurveTo(currentPoint.x, currentPoint.y, cpx, cpy);
              }

              // Draw to the last point
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
              options
            );
          }
          break;
        }
        case "Arrow": {
          if (element.width !== undefined && element.height !== undefined) {
            const endX = element.x + element.width;
            const endY = element.y + element.height;

            // Draw line
            rc.line(element.x, element.y, endX, endY, options);

            // Draw arrow head
            const angle = Math.atan2(element.height, element.width);
            const arrowLength = 20;
            const arrowAngle = Math.PI / 6;

            const arrow1X = endX - arrowLength * Math.cos(angle - arrowAngle);
            const arrow1Y = endY - arrowLength * Math.sin(angle - arrowAngle);
            const arrow2X = endX - arrowLength * Math.cos(angle + arrowAngle);
            const arrow2Y = endY - arrowLength * Math.sin(angle + arrowAngle);

            rc.line(endX, endY, arrow1X, arrow1Y, options);
            rc.line(endX, endY, arrow2X, arrow2Y, options);
          }
          break;
        }
        case "Text": {
          if (element.text && element.id !== editingTextId) {
            ctx.font = `${element.fontSize || 20}px ${
              element.fontFamily || "Virgil"
            }`;
            ctx.fillStyle = element.strokeColor || "#000";
            ctx.textBaseline = "top";
            ctx.fillText(element.text, element.x, element.y);
          }
          break;
        }
      }
    });

    // Draw selection area if active
    if (selectionArea) {
      ctx.save();
      ctx.strokeStyle = "#007acc";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      const width = selectionArea.end.x - selectionArea.start.x;
      const height = selectionArea.end.y - selectionArea.start.y;
      ctx.strokeRect(
        selectionArea.start.x,
        selectionArea.start.y,
        width,
        height
      );
      ctx.restore();
    }

    // Draw selection highlight for all selected elements
    if (selectedElements.length > 0) {
      ctx.save();
      ctx.strokeStyle = "#007acc";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      const padding = 10;

      selectedElements.forEach((element) => {
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
              ctx.strokeRect(
                minX - padding,
                minY - padding,
                maxX - minX + padding * 2,
                maxY - minY + padding * 2
              );
            }
            break;
          }
          case "Line": {
            // Show selection only for Line, not Arrow
            if (element.width !== undefined && element.height !== undefined) {
              const endX = element.x + element.width;
              const endY = element.y + element.height;
              const minX = Math.min(element.x, endX);
              const maxX = Math.max(element.x, endX);
              const minY = Math.min(element.y, endY);
              const maxY = Math.max(element.y, endY);
              ctx.strokeRect(
                minX - padding,
                minY - padding,
                maxX - minX + padding * 2,
                maxY - minY + padding * 2
              );
            }
            break;
          }
          case "Arrow": {
            // Do not draw selection rectangle for Arrow
            break;
          }
          case "Text": {
            if (element.text) {
              const textWidth =
                element.text.length * (element.fontSize || 20) * 0.6;
              const textHeight = element.fontSize || 20;
              ctx.strokeRect(
                element.x - padding,
                element.y - padding,
                textWidth + padding * 2,
                textHeight + padding * 2
              );
            }
            break;
          }
          case "Pencil": {
            if (element.points && element.points.length > 0) {
              const xs = element.points.map((p) => p.x);
              const ys = element.points.map((p) => p.y);
              const minX = Math.min(...xs);
              const maxX = Math.max(...xs);
              const minY = Math.min(...ys);
              const maxY = Math.max(...ys);
              ctx.strokeRect(
                minX - padding,
                minY - padding,
                maxX - minX + padding * 2,
                maxY - minY + padding * 2
              );
            }
            break;
          }
        }
      });
      ctx.restore();
    }

    // Draw laser trail
    if (selectedTool === "Laser") {
      ctx.save();

      // Draw the trail
      if (laser.trail.length > 1) {
        ctx.strokeStyle = "red";
        ctx.lineWidth = 4; // Increased line width for bolder laser trail
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        for (let i = 1; i < laser.trail.length; i++) {
          const prevPoint = laser.trail[i - 1];
          const currentPoint = laser.trail[i];

          ctx.globalAlpha = currentPoint.opacity;
          ctx.beginPath();
          ctx.moveTo(prevPoint.point.x, prevPoint.point.y);
          ctx.lineTo(currentPoint.point.x, currentPoint.point.y);
          ctx.stroke();
        }
      }

      // Draw current laser point if trail exists
      if (laser.trail.length > 0) {
        const lastPoint = laser.trail[laser.trail.length - 1].point;
        ctx.globalAlpha = 1;
        const gradient = ctx.createRadialGradient(
          lastPoint.x,
          lastPoint.y,
          0,
          lastPoint.x,
          lastPoint.y,
          5
        );
        gradient.addColorStop(0, "rgba(255, 0, 0, 1)");
        gradient.addColorStop(1, "rgba(255, 0, 0, 0)");

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(lastPoint.x, lastPoint.y, 10, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    // Restore context
    ctx.restore();
  }, [
    elements,
    position,
    scale,
    selectedElement,
    selectedElements,
    editingTextId,
    selectedTool,
    laser.trail,
    selectionArea,
  ]);

  // Initialize canvas size
  // Handle delete key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedElement &&
        !isEditingText
      ) {
        e.preventDefault();
        setElements((prev) =>
          prev.filter((el) => el.id !== selectedElement.id)
        );
        setSelectedElement(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedElement, isEditingText]);

  // Handle tool shortcuts
  useEffect(() => {
    const handleToolShortcuts = (e: KeyboardEvent) => {
      // Don't trigger shortcuts while editing text or if modifiers are pressed
      if (isEditingText || e.ctrlKey || e.altKey || e.metaKey) return;

      switch (e.key.toLowerCase()) {
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
      }
    };

    window.addEventListener("keydown", handleToolShortcuts);
    return () => window.removeEventListener("keydown", handleToolShortcuts);
  }, [isEditingText, setSelectedTool]);

  // Handle delete key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        !isEditingText &&
        (selectedElements.length > 0 || selectedElement)
      ) {
        e.preventDefault();
        setElements((prev) =>
          prev.filter((el) => {
            // Remove elements that are either in selectedElements array or match selectedElement
            return (
              !selectedElements.some((selected) => selected.id === el.id) &&
              (!selectedElement || el.id !== selectedElement.id)
            );
          })
        );
        setSelectedElements([]);
        setSelectedElement(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedElement, selectedElements, isEditingText]);

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
      if (ctx) {
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      }

      redrawCanvas();
    };

    updateCanvasSize();
    window.addEventListener("resize", updateCanvasSize);
    return () => window.removeEventListener("resize", updateCanvasSize);
  }, [redrawCanvas]);

  // Redraw canvas when elements change
  // Reference to track if component is mounted
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (isMounted.current) {
      requestAnimationFrame(redrawCanvas);
    }
  }, [elements, position, scale, redrawCanvas]);

  useEffect(() => {
    const element = canvasRef.current;
    if (!element) return;

    const handleWheelEvent = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.min(Math.max(scale * delta, 0.1), 5);

        const rect = element.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        setScale(newScale);
        setPosition((prev) => ({
          x: x - (x - prev.x) * delta,
          y: y - (y - prev.y) * delta,
        }));
      } else {
        setPosition((prev) => ({
          x: prev.x - e.deltaX,
          y: prev.y - e.deltaY,
        }));
      }
    };

    element.addEventListener("wheel", handleWheelEvent, { passive: false });
    return () => element.removeEventListener("wheel", handleWheelEvent);
  }, [scale]);

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
    [position, scale]
  );

  const startTextEditing = useCallback((element: Element) => {
    setIsEditingText(true);
    setEditingTextId(element.id);
    setSelectedElement(element);

    // Add a small delay to ensure the textarea gets focus
    setTimeout(() => {
      const textarea = document.querySelector(
        'textarea[data-text-editing="true"]'
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
          setElements((prev) =>
            prev.map((el) =>
              el.id === editingTextId ? { ...el, text: newText.trim() } : el
            )
          );
        } else {
          // Remove empty text elements
          setElements((prev) => prev.filter((el) => el.id !== editingTextId));
          setSelectedElement(null);
        }
      }

      setIsEditingText(false);
      setEditingTextId(null);
    },
    [editingTextId]
  );

  // Handle clicking outside text input to finish editing
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isEditingText) {
        const textarea = document.querySelector(
          'textarea[data-text-editing="true"]'
        ) as HTMLTextAreaElement;
        if (textarea && !textarea.contains(e.target as Node)) {
          finishTextEditing(textarea.value);
        }
      }
    };

    if (isEditingText) {
      // Add a small delay to prevent immediate triggering
      const timeoutId = setTimeout(() => {
        document.addEventListener("mousedown", handleClickOutside);
      }, 200);

      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isEditingText, finishTextEditing]);

  // Hit detection for elements
  const getElementAtPoint = useCallback(
    (point: Position): Element | null => {
      // Check in reverse order (top elements first)
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
              ) {
                return element;
              }
            }
            break;
          }
          case "Line":
          case "Arrow": {
            if (element.width !== undefined && element.height !== undefined) {
              // Simple line hit detection with some tolerance
              const tolerance = 10;
              const endX = element.x + element.width;
              const endY = element.y + element.height;

              // Distance from point to line
              const A = point.x - element.x;
              const B = point.y - element.y;
              const C = endX - element.x;
              const D = endY - element.y;

              const dot = A * C + B * D;
              const lenSq = C * C + D * D;

              if (lenSq === 0) continue;

              const param = dot / lenSq;

              let xx, yy;
              if (param < 0) {
                xx = element.x;
                yy = element.y;
              } else if (param > 1) {
                xx = endX;
                yy = endY;
              } else {
                xx = element.x + param * C;
                yy = element.y + param * D;
              }

              const dx = point.x - xx;
              const dy = point.y - yy;
              const distance = Math.sqrt(dx * dx + dy * dy);

              if (distance <= tolerance) {
                return element;
              }
            }
            break;
          }
          case "Text": {
            if (element.text) {
              // Approximate text bounds
              const textWidth =
                element.text.length * (element.fontSize || 20) * 0.6;
              const textHeight = element.fontSize || 20;

              if (
                point.x >= element.x &&
                point.x <= element.x + textWidth &&
                point.y >= element.y &&
                point.y <= element.y + textHeight
              ) {
                return element;
              }
            }
            break;
          }
          case "Pencil": {
            if (element.points && element.points.length > 0) {
              const tolerance = 10;

              for (const p of element.points) {
                const distance = Math.sqrt(
                  Math.pow(point.x - p.x, 2) + Math.pow(point.y - p.y, 2)
                );
                if (distance <= tolerance) {
                  return element;
                }
              }
            }
            break;
          }
        }
      }
      return null;
    },
    [elements]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Don't interfere with text editing
      if (isEditingText) {
        return;
      }

      if (e.button === 1 || (e.button === 0 && e.altKey)) {
        setIsPanning(true);
        setStartPan({ x: e.clientX - position.x, y: e.clientY - position.y });
        return;
      }

      const point = getTransformedPoint(e);

      // Handle select tool - check for element selection/dragging or start area selection
      if (selectedTool === "select") {
        const clickedElement = getElementAtPoint(point);

        if (clickedElement) {
          // Check if clicked element is part of multi-selection
          if (selectedElements.includes(clickedElement) && !e.shiftKey) {
            // Keep multi-selection and prepare for dragging
            setIsDragging(true);
            setDragOffset({
              x: point.x - clickedElement.x,
              y: point.y - clickedElement.y,
            });
          } else {
            // Select single element and prepare for dragging
            if (!e.shiftKey) {
              setSelectedElements([clickedElement]);
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
          // Start area selection
          setSelectionArea({ start: point, end: point });
          if (!e.shiftKey) {
            // Clear previous selection unless shift is held
            setSelectedElements([]);
            setSelectedElement(null);
          }
        }

        // Check if clicking on a resize handle
        const handles = getResizeHandles(selectedElement);
        for (const handle of handles) {
          const dx = point.x - handle.x;
          const dy = point.y - handle.y;
          if (Math.abs(dx) < 8 && Math.abs(dy) < 8 && selectedElement) {
            setResizing({
              corner: handle.corner,
              elementId: selectedElement.id,
            });
            setResizeStart(point);
            return;
          }
        }
        return;
      }

      // Handle Text tool - create text immediately and start editing
      if (selectedTool === "Text") {
        const newElement: Element = {
          id: Date.now().toString(),
          type: selectedTool,
          x: point.x,
          y: point.y,
          strokeColor,
          strokeWidth,
          roughness: 1,
          seed: Math.floor(Math.random() * 1000),
          text: "Type here...",
          fontSize: 20,
          fontFamily: "Virgil",
        };

        setElements((prev) => [...prev, newElement]);
        startTextEditing(newElement);
        return;
      }

      // Handle Image tool - trigger file input
      if (selectedTool === "Image") {
        const input = document.getElementById(
          "imageUpload"
        ) as HTMLInputElement;
        input?.click();
        return;
      }

      // Handle Eraser tool - immediate erasing on mousedown
      if (selectedTool === "Eraser") {
        const point = getTransformedPoint(e);
        setEraserPos(point);
        setElements((prev) => eraseElements(prev, point, ERASER_RADIUS));
        return;
      }

      // Handle other drawing tools
      setDrawing(true);
      setSelectedElement(null); // Clear selection when drawing

      const newElement: Element = {
        id: Date.now().toString(),
        type: selectedTool,
        x: point.x,
        y: point.y,
        strokeColor,
        strokeWidth,
        roughness: 1,
        seed: Math.floor(Math.random() * 1000),
        points: selectedTool === "Pencil" ? [point] : undefined,
      };

      setCurrentElement(newElement);
      setElements((prev) => [...prev, newElement]);
    },
    [
      position,
      selectedTool,
      strokeColor,
      strokeWidth,
      getTransformedPoint,
      getElementAtPoint,
      startTextEditing,
      isEditingText,
      selectedElement,
      selectedElements,
    ]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const point = getTransformedPoint(e);
      if (isPanning) {
        requestAnimationFrame(() => {
          const newX = e.clientX - startPan.x;
          const newY = e.clientY - startPan.y;
          setPosition({ x: newX, y: newY });
        });
        return;
      }

      // Laser tool: handle trail
      if (selectedTool === "Laser") {
        if (e.buttons === 1) {
          // Only add points when mouse button is pressed
          laser.addPoint(point);
        } else {
          laser.clearTrail();
        }
        return;
      }

      // Eraser tool: show cursor and erase elements
      if (selectedTool === "Eraser") {
        setEraserPos(point);
        if (e.buttons === 1) {
          // Mouse is pressed
          setElements((prev) => eraseElements(prev, point, ERASER_RADIUS));
        }
        return;
      }

      // Handle area selection
      if (selectionArea) {
        setSelectionArea((prev) => ({
          start: prev!.start,
          end: point,
        }));
        // Find elements within selection area
        const selectionRect = {
          left: Math.min(selectionArea.start.x, point.x),
          right: Math.max(selectionArea.start.x, point.x),
          top: Math.min(selectionArea.start.y, point.y),
          bottom: Math.max(selectionArea.start.y, point.y),
        };

        const elementsInSelection = elements.filter((el) => {
          switch (el.type) {
            case "Rectangle":
            case "Diamond":
            case "Circle":
            case "Image": {
              if (el.width && el.height) {
                const elRect = {
                  left: Math.min(el.x, el.x + el.width),
                  right: Math.max(el.x, el.x + el.width),
                  top: Math.min(el.y, el.y + el.height),
                  bottom: Math.max(el.y, el.y + el.height),
                };
                return (
                  elRect.left <= selectionRect.right &&
                  elRect.right >= selectionRect.left &&
                  elRect.top <= selectionRect.bottom &&
                  elRect.bottom >= selectionRect.top
                );
              }
              return false;
            }
            case "Line":
            case "Arrow": {
              if (el.width !== undefined && el.height !== undefined) {
                const endX = el.x + el.width;
                const endY = el.y + el.height;
                const elRect = {
                  left: Math.min(el.x, endX),
                  right: Math.max(el.x, endX),
                  top: Math.min(el.y, endY),
                  bottom: Math.max(el.y, endY),
                };
                return (
                  elRect.left <= selectionRect.right &&
                  elRect.right >= selectionRect.left &&
                  elRect.top <= selectionRect.bottom &&
                  elRect.bottom >= selectionRect.top
                );
              }
              return false;
            }
            case "Text": {
              if (el.text) {
                const textWidth = el.text.length * (el.fontSize || 20) * 0.6;
                const textHeight = el.fontSize || 20;
                const elRect = {
                  left: el.x,
                  right: el.x + textWidth,
                  top: el.y,
                  bottom: el.y + textHeight,
                };
                return (
                  elRect.left <= selectionRect.right &&
                  elRect.right >= selectionRect.left &&
                  elRect.top <= selectionRect.bottom &&
                  elRect.bottom >= selectionRect.top
                );
              }
              return false;
            }
            case "Pencil": {
              if (el.points && el.points.length > 0) {
                const xs = el.points.map((p) => p.x);
                const ys = el.points.map((p) => p.y);
                const elRect = {
                  left: Math.min(...xs),
                  right: Math.max(...xs),
                  top: Math.min(...ys),
                  bottom: Math.max(...ys),
                };
                return (
                  elRect.left <= selectionRect.right &&
                  elRect.right >= selectionRect.left &&
                  elRect.top <= selectionRect.bottom &&
                  elRect.bottom >= selectionRect.top
                );
              }
              return false;
            }
            default:
              return false;
          }
        });
        setSelectedElements(elementsInSelection);
        return;
      }

      // Handle element dragging
      if (isDragging) {
        const newX = point.x - dragOffset.x;
        const newY = point.y - dragOffset.y;

        setElements((prev) =>
          prev.map((el) => {
            if (selectedElements.some((selected) => selected.id === el.id)) {
              if (el.type === "Pencil" && el.points) {
                // For pencil, move all points
                const deltaX = newX - el.x;
                const deltaY = newY - el.y;
                return {
                  ...el,
                  x: newX,
                  y: newY,
                  points: el.points.map((p) => ({
                    x: p.x + deltaX,
                    y: p.y + deltaY,
                  })),
                };
              } else {
                // For other elements, just move the position
                return { ...el, x: newX, y: newY };
              }
            }
            return el;
          })
        );

        // Update selected element reference
        setSelectedElement((prev) =>
          prev ? { ...prev, x: newX, y: newY } : null
        );
        return;
      }

      // Handle resizing
      if (resizing && resizeStart && selectedElement) {
        // Use 'point' from top-level declaration
        setElements((prev) => {
          let updatedElement: Element | null = null;
          const updated = prev.map((el) => {
            if (el.id !== resizing.elementId) return el;
            switch (el.type) {
              case "Image": {
                // For images, maintain aspect ratio
                const aspectRatio = el.aspectRatio || 1;
                let newWidth = 0;
                let newHeight = 0;
                let newX = el.x;
                let newY = el.y;

                switch (resizing.corner) {
                  case "tl": {
                    newWidth = el.x + (el.width || 0) - point.x;
                    newHeight = newWidth / aspectRatio;
                    newX = point.x;
                    newY = el.y + (el.height || 0) - newHeight;
                    break;
                  }
                  case "tr": {
                    newWidth = point.x - el.x;
                    newHeight = newWidth / aspectRatio;
                    newY = el.y + (el.height || 0) - newHeight;
                    break;
                  }
                  case "br": {
                    newWidth = point.x - el.x;
                    newHeight = newWidth / aspectRatio;
                    break;
                  }
                  case "bl": {
                    newWidth = el.x + (el.width || 0) - point.x;
                    newHeight = newWidth / aspectRatio;
                    newX = point.x;
                    break;
                  }
                }

                if (newWidth > 10 && newHeight > 10) {
                  // Prevent too small sizes
                  updatedElement = {
                    ...el,
                    x: newX,
                    y: newY,
                    width: newWidth,
                    height: newHeight,
                  };
                  return updatedElement;
                }
                return el;
              }
              case "Rectangle":
              case "Diamond":
              case "Circle": {
                let newX = el.x;
                let newY = el.y;
                let newWidth = el.width || 0;
                let newHeight = el.height || 0;

                switch (resizing.corner) {
                  case "tl": {
                    newWidth += newX - point.x;
                    newHeight += newY - point.y;
                    newX = point.x;
                    newY = point.y;
                    break;
                  }
                  case "tr": {
                    newWidth = point.x - newX;
                    newHeight += newY - point.y;
                    newY = point.y;
                    break;
                  }
                  case "br": {
                    newWidth = point.x - newX;
                    newHeight = point.y - newY;
                    break;
                  }
                  case "bl": {
                    newWidth += newX - point.x;
                    newHeight = point.y - newY;
                    newX = point.x;
                    break;
                  }
                }
                switch (resizing.corner) {
                  case "tl":
                    newWidth += newX - point.x;
                    newHeight += newY - point.y;
                    newX = point.x;
                    newY = point.y;
                    break;
                  case "tr":
                    newWidth = point.x - newX;
                    newHeight += newY - point.y;
                    newY = point.y;
                    break;
                  case "br":
                    newWidth = point.x - newX;
                    newHeight = point.y - newY;
                    break;
                  case "bl":
                    newWidth += newX - point.x;
                    newX = point.x;
                    newHeight = point.y - newY;
                    break;
                }
                updatedElement = {
                  ...el,
                  x: newX,
                  y: newY,
                  width: newWidth,
                  height: newHeight,
                };
                return updatedElement;
              }
              case "Line":
              case "Arrow": {
                updatedElement = {
                  ...el,
                  x: resizing.corner === "start" ? point.x : el.x,
                  y: resizing.corner === "start" ? point.y : el.y,
                  width:
                    resizing.corner === "start"
                      ? el.x + (el.width || 0) - point.x
                      : point.x - el.x,
                  height:
                    resizing.corner === "start"
                      ? el.y + (el.height || 0) - point.y
                      : point.y - el.y,
                  type: el.type,
                };
                return updatedElement;
              }
              default:
                return el;
            }
          });
          // Update selectedElement to match the resized shape
          if (updatedElement) setSelectedElement(updatedElement);
          return updated;
        });
        return;
      }

      // Handle drawing for non-select tools
      if (!drawing || !currentElement) return;

      setElements((prev) => {
        const index = prev.findIndex((el) => el.id === currentElement.id);
        const updated = [...prev];

        switch (currentElement.type) {
          case "Rectangle": {
            updated[index] = {
              ...currentElement,
              width: point.x - currentElement.x,
              height: point.y - currentElement.y,
            };
            break;
          }
          case "Diamond": {
            updated[index] = {
              ...currentElement,
              width: point.x - currentElement.x,
              height: point.y - currentElement.y,
            };
            break;
          }

          case "Line": {
            updated[index] = {
              ...currentElement,
              width: point.x - currentElement.x,
              height: point.y - currentElement.y,
            };
            break;
          }
          case "Pencil": {
            const currentPoints = updated[index].points || [];
            const lastPoint = currentPoints[currentPoints.length - 1];

            // Calculate distance from last point
            const distance = lastPoint
              ? Math.sqrt(
                  Math.pow(point.x - lastPoint.x, 2) +
                    Math.pow(point.y - lastPoint.y, 2)
                )
              : 0;

            // Add point if it's far enough from the last point (reduces jitter)
            // Reduced threshold for smoother drawing
            if (!lastPoint || distance > 1) {
              updated[index] = {
                ...updated[index],
                points: [...currentPoints, point],
              };
            }
            break;
          }

          case "Circle": {
            updated[index] = {
              ...currentElement,
              width: point.x - currentElement.x,
              height: point.y - currentElement.y,
            };
            break;
          }
          case "Arrow": {
            updated[index] = {
              ...currentElement,
              width: point.x - currentElement.x,
              height: point.y - currentElement.y,
            };
            break;
          }
        }

        return updated;
      });
    },
    [
      drawing,
      currentElement,
      isPanning,
      startPan.x,
      startPan.y,
      getTransformedPoint,
      isDragging,
      selectedElement,
      dragOffset,
      resizing,
      resizeStart,
      selectedTool,
      laser,
    ]
  );

  const handleMouseUp = useCallback(() => {
    setDrawing(false);
    setCurrentElement(null);
    setIsPanning(false);
    setIsDragging(false);
    setResizing(null);
    setResizeStart(null);
    setSelectionArea(null);
    // Switch back to select tool after drawing a shape (not for select, Text, Pencil or Eraser)
    if (
      selectedTool !== "select" &&
      selectedTool !== "Eraser" &&
      selectedTool !== "Pencil" &&
      selectedTool !== "Laser"
    ) {
      setSelectedTool("select");
    }
  }, [selectedTool, setSelectedTool]);

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      // Only handle double-click for text editing when using select tool
      if (selectedTool !== "select") return;

      const point = getTransformedPoint(e);
      const clickedElement = getElementAtPoint(point);

      if (clickedElement && clickedElement.type === "Text") {
        startTextEditing(clickedElement);
      } else {
        setSelectedTool("Text");
      }
    },
    [
      selectedTool,
      getTransformedPoint,
      getElementAtPoint,
      startTextEditing,
      setSelectedTool,
    ]
  );

  // Handle image upload
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

            // Get the visible canvas area (accounting for scale and position)
            const visibleWidth = canvas.width / window.devicePixelRatio / scale;
            const visibleHeight =
              canvas.height / window.devicePixelRatio / scale;

            // Calculate maximum dimensions (50% of visible area)
            const maxWidth = visibleWidth * 0.5;
            const maxHeight = visibleHeight * 0.5;

            // Calculate dimensions maintaining aspect ratio
            const aspectRatio = img.width / img.height;
            let newWidth = img.width;
            let newHeight = img.height;

            if (newWidth > maxWidth) {
              newWidth = maxWidth;
              newHeight = newWidth / aspectRatio;
            }
            if (newHeight > maxHeight) {
              newHeight = maxHeight;
              newWidth = newHeight * aspectRatio;
            }

            // Calculate center position in visible area
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
              strokeColor: strokeColor,
              strokeWidth: strokeWidth,
              imageUrl: imageUrl,
              aspectRatio: aspectRatio,
            };

            setElements((prev) => [...prev, newElement]);
            setSelectedElement(newElement);
            setSelectedTool("select"); // Switch to select tool after placing image
          };
          img.src = imageUrl;
        };
        reader.readAsDataURL(file);
      }
    },
    [strokeColor, strokeWidth, setSelectedTool, scale, position, canvasRef]
  );

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-hidden bg-dot-pattern"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDoubleClick={handleDoubleClick}
      style={{
        cursor: isPanning
          ? "grabbing"
          : selectedTool === "Pencil"
          ? "crosshair"
          : selectedTool === "Eraser"
          ? "none"
          : "default",
      }}
    >
      <input
        type="file"
        accept="image/*"
        className="hidden"
        id="imageUpload"
        onChange={handleImageUpload}
      />
      <canvas ref={canvasRef} className="absolute top-0 left-0" />

      {/* Text Input Overlay */}
      {isEditingText && selectedElement && selectedElement.type === "Text" && (
        <textarea
          data-text-editing="true"
          className="absolute z-50 resize-none border-2 border-blue-500 rounded-md px-2 py-1 
                     bg-white shadow-lg outline-none text-black
                     animate-in fade-in duration-150"
          style={{
            left: `${Math.max(0, selectedElement.x * scale + position.x)}px`,
            top: `${Math.max(0, selectedElement.y * scale + position.y)}px`,
            fontSize: `${selectedElement.fontSize || 20}px`,
            fontFamily: "Virgil, Arial, sans-serif",
            width: "200px",
            minHeight: "40px",
            lineHeight: "1.2",
            pointerEvents: "auto",
          }}
          defaultValue={selectedElement.text || ""}
          placeholder="Type your text..."
          autoFocus
          onMouseDown={(e) => {
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.stopPropagation();
          }}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Escape") {
              finishTextEditing("");
            } else if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              finishTextEditing(e.currentTarget.value);
            }
          }}
          onFocus={(e) => {
            e.currentTarget.select();
          }}
        />
      )}

      {/* Resize Handles */}
      {selectedTool === "select" &&
        selectedElement &&
        ["Rectangle", "Diamond", "Circle", "Line", "Arrow", "Image"].includes(
          selectedElement.type
        ) &&
        getResizeHandles(selectedElement).map((handle, idx) => (
          <div
            key={idx}
            style={{
              position: "absolute",
              left: `${handle.x * scale + position.x - 6}px`,
              top: `${handle.y * scale + position.y - 6}px`,
              width: "12px",
              height: "12px",
              background: "#fff",
              border: "2px solid #007acc",
              borderRadius: "3px",
              cursor: handle.cursor,
              zIndex: 100,
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
              if (selectedElement) {
                setResizing({
                  corner: handle.corner,
                  elementId: selectedElement.id,
                });
                setResizeStart(getTransformedPoint(e));
              }
            }}
          />
        ))}

      {/* Eraser Cursor Overlay */}
      {selectedTool === "Eraser" && eraserPos && (
        <div
          style={{
            position: "absolute",
            left: `${eraserPos.x * scale + position.x - ERASER_RADIUS}px`,
            top: `${eraserPos.y * scale + position.y - ERASER_RADIUS}px`,
            width: `${ERASER_RADIUS * 2}px`,
            height: `${ERASER_RADIUS * 2}px`,
            border: "2px solid #007acc",
            borderRadius: "50%",
            background: "rgba(255,255,255,0.1)",
            pointerEvents: "none",
            zIndex: 200,
          }}
        />
      )}
    </div>
  );
};
