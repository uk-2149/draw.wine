import { useCallback, useEffect, useRef, useState } from "react";
import { useDrawing } from "@/contexts/DrawingContext";
import rough from "roughjs";
import type { Position, Element } from "@/types";

export const CanvasBoard = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { selectedTool, strokeColor, strokeWidth } = useDrawing();
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

  // Initialize canvas size
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
  }, []);

  // Redraw canvas when elements change
  useEffect(() => {
    redrawCanvas();
  }, [elements, position, scale]);

  const redrawCanvas = () => {
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

    // Draw selection highlight
    if (selectedElement) {
      ctx.save();
      ctx.strokeStyle = "#007acc";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);

      const padding = 10;

      switch (selectedElement.type) {
        case "Rectangle":
        case "Diamond":
        case "Circle": {
          if (selectedElement.width && selectedElement.height) {
            const minX = Math.min(
              selectedElement.x,
              selectedElement.x + selectedElement.width
            );
            const maxX = Math.max(
              selectedElement.x,
              selectedElement.x + selectedElement.width
            );
            const minY = Math.min(
              selectedElement.y,
              selectedElement.y + selectedElement.height
            );
            const maxY = Math.max(
              selectedElement.y,
              selectedElement.y + selectedElement.height
            );

            ctx.strokeRect(
              minX - padding,
              minY - padding,
              maxX - minX + padding * 2,
              maxY - minY + padding * 2
            );
          }
          break;
        }
        case "Line":
        case "Arrow": {
          if (
            selectedElement.width !== undefined &&
            selectedElement.height !== undefined
          ) {
            const endX = selectedElement.x + selectedElement.width;
            const endY = selectedElement.y + selectedElement.height;

            const minX = Math.min(selectedElement.x, endX);
            const maxX = Math.max(selectedElement.x, endX);
            const minY = Math.min(selectedElement.y, endY);
            const maxY = Math.max(selectedElement.y, endY);

            ctx.strokeRect(
              minX - padding,
              minY - padding,
              maxX - minX + padding * 2,
              maxY - minY + padding * 2
            );
          }
          break;
        }
        case "Text": {
          if (selectedElement.text) {
            const textWidth =
              selectedElement.text.length *
              (selectedElement.fontSize || 20) *
              0.6;
            const textHeight = selectedElement.fontSize || 20;

            ctx.strokeRect(
              selectedElement.x - padding,
              selectedElement.y - padding,
              textWidth + padding * 2,
              textHeight + padding * 2
            );
          }
          break;
        }
        case "Pencil": {
          if (selectedElement.points && selectedElement.points.length > 0) {
            const xs = selectedElement.points.map((p) => p.x);
            const ys = selectedElement.points.map((p) => p.y);
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

      ctx.restore();
    }

    // Restore context
    ctx.restore();
  };

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
          case "Circle": {
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

      // Handle select tool - check for element selection/dragging
      if (selectedTool === "select") {
        const clickedElement = getElementAtPoint(point);

        if (clickedElement) {
          // Select element and prepare for dragging (including text elements)
          setSelectedElement(clickedElement);
          setIsDragging(true);
          setDragOffset({
            x: point.x - clickedElement.x,
            y: point.y - clickedElement.y,
          });
        } else {
          // Clear selection if clicking on empty space
          setSelectedElement(null);
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
    ]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning) {
        const newX = e.clientX - startPan.x;
        const newY = e.clientY - startPan.y;
        setPosition({ x: newX, y: newY });
        return;
      }

      const point = getTransformedPoint(e);

      // Handle element dragging
      if (isDragging && selectedElement) {
        const newX = point.x - dragOffset.x;
        const newY = point.y - dragOffset.y;

        setElements((prev) =>
          prev.map((el) => {
            if (el.id === selectedElement.id) {
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
    ]
  );

  const handleMouseUp = useCallback(() => {
    setDrawing(false);
    setCurrentElement(null);
    setIsPanning(false);
    setIsDragging(false);
  }, []);

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      // Only handle double-click for text editing when using select tool
      if (selectedTool !== "select") return;

      const point = getTransformedPoint(e);
      const clickedElement = getElementAtPoint(point);

      if (clickedElement && clickedElement.type === "Text") {
        startTextEditing(clickedElement);
      }
    },
    [selectedTool, getTransformedPoint, getElementAtPoint, startTextEditing]
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
          : "default",
      }}
    >
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
    </div>
  );
};
