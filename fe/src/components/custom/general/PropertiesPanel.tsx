import { useDrawing } from "@/contexts/DrawingContext";
import type { CSSProperties } from "react";
import { cn } from "@/helpers/cn.h";
import { STROKE_COLORS, STROKE_WIDTHS } from "@/constants/ext";
import { STROKE_PATTERNS } from "@/helpers/stroke.h";

/** Dashed frame with solid sharp 90° at top-left. */
const EdgeSharpGlyph = () => (
  <svg width="26" height="26" viewBox="0 0 32 32" fill="none" aria-hidden>
    <path
      d="M17 10H23V23H10V17"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray="3 2.65"
    />
    <path
      d="M10 17V10H17"
      stroke="currentColor"
      strokeWidth="2.05"
      strokeLinecap="square"
      strokeLinejoin="miter"
    />
  </svg>
);

/** Same dashed outline; solid quadratic fillet at top-left (rounded). */
const EdgeCurveGlyph = () => (
  <svg width="26" height="26" viewBox="0 0 32 32" fill="none" aria-hidden>
    <path
      d="M17 10H23V23H10V17"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray="3 2.65"
    />
    <path
      d="M10 17Q10 10 17 10"
      stroke="currentColor"
      strokeWidth="2.05"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const StrokePatternPreview = ({
  pattern,
}: {
  pattern: (typeof STROKE_PATTERNS)[number]["value"];
}) => {
  switch (pattern) {
    case "longDash":
      return (
        <div className="flex w-full items-center gap-1">
          <span className="h-[3px] flex-[2] rounded-full bg-current" />
          <span className="h-[3px] flex-[2] rounded-full bg-current" />
          <span className="h-[3px] flex-[2] rounded-full bg-current" />
        </div>
      );
    case "shortDash":
      return (
        <div className="flex w-full items-center gap-1">
          <span className="h-[3px] flex-1 rounded-full bg-current" />
          <span className="h-[3px] flex-1 rounded-full bg-current" />
          <span className="h-[3px] flex-1 rounded-full bg-current" />
          <span className="h-[3px] flex-1 rounded-full bg-current" />
        </div>
      );
    case "dotted":
      return (
        <div className="flex w-full items-center justify-between px-0.5">
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
        </div>
      );
    case "bubbled":
      return (
        <div className="flex w-full items-center justify-between px-0.5">
          <span className="h-2.5 w-2.5 rounded-full bg-current" />
          <span className="h-2 w-2 rounded-full bg-current" />
          <span className="h-2.5 w-2.5 rounded-full bg-current" />
          <span className="h-2 w-2 rounded-full bg-current" />
        </div>
      );
    default:
      return <span className="h-[3px] w-full rounded-full bg-current" />;
  }
};

export const PropertiesPanel = () => {
  const {
    selectedTool,
    strokeColor,
    setStrokeColor,
    strokeWidth,
    setStrokeWidth,
    strokePattern,
    setStrokePattern,
    fillColor,
    setFillColor,
    edgeStyle,
    setEdgeStyle,
    activeElementTypes,
  } = useDrawing();

  const isFillable = (type: string) =>
    type === "Rectangle" || type === "Diamond" || type === "Circle";

  const isEdgeable = (type: string) =>
    type === "Rectangle" || type === "Diamond";

  const showFill =
    isFillable(selectedTool) ||
    (selectedTool === "select" && activeElementTypes.some(isFillable));

  const showEdges =
    isEdgeable(selectedTool) ||
    (selectedTool === "select" && activeElementTypes.some(isEdgeable));

  const showStroke =
    (selectedTool !== "select" &&
      selectedTool !== "Eraser" &&
      selectedTool !== "Image" &&
      selectedTool !== "Hand") ||
    (selectedTool === "select" &&
      activeElementTypes.length > 0 &&
      activeElementTypes.some(
        (t) => t !== "Eraser" && t !== "Image" && t !== "Hand",
      ));

  if (!showStroke && !showFill && !showEdges) {
    return null;
  }

  return (
    <div className="bg-background/80 backdrop-blur-md border border-border p-4 rounded-xl shadow-lg w-[280px] flex flex-col space-y-5">
      {/* Stroke Color Section */}
      {showStroke && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Stroke
          </h3>
          <div className="grid grid-cols-5 gap-2">
            {STROKE_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => setStrokeColor(color)}
                className={cn(
                  "w-8 h-8 rounded-md transition-all hover:scale-110 stroke-color-swatch",
                  strokeColor === color
                    ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                    : "border border-border/50",
                )}
                style={{ "--stroke-color": color } as CSSProperties}
                title={color}
                aria-label={`Select color ${color}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Stroke Width Section */}
      {showStroke && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Stroke Width
          </h3>
          <div className="flex bg-muted/50 rounded-lg p-1 border">
            {STROKE_WIDTHS.map((width) => (
              <button
                key={width.value}
                onClick={() => setStrokeWidth(width.value)}
                className={cn(
                  "flex-1 flex items-center justify-center p-2 rounded-md transition-colors",
                  strokeWidth === width.value
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
                title={`${width.value}px`}
                aria-label={`Select stroke width ${width.value}`}
              >
                {width.icon}
              </button>
            ))}
          </div>
        </div>
      )}

      {showStroke && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Stroke Style
          </h3>
          <div className="grid grid-cols-5 gap-2">
            {STROKE_PATTERNS.map((pattern) => (
              <button
                key={pattern.value}
                onClick={() => setStrokePattern(pattern.value)}
                className={cn(
                  "group relative flex aspect-square items-center justify-center rounded-xl border bg-muted/50 transition-all hover:-translate-y-0.5 hover:bg-muted/70",
                  strokePattern === pattern.value
                    ? "border-border bg-background text-foreground shadow-sm ring-2 ring-primary ring-offset-2 ring-offset-background"
                    : "border-border/50 text-foreground",
                )}
                title={pattern.label}
                aria-label={`Select ${pattern.label.toLowerCase()} stroke`}
              >
                <span className="flex h-5 w-8 items-center justify-center text-current">
                  <StrokePatternPreview pattern={pattern.value} />
                </span>
                <span className="sr-only">{pattern.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Fill Color Section */}
      {showFill && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Fill
          </h3>
          <div className="grid grid-cols-5 gap-2">
            <button
              onClick={() => setFillColor(null)}
              className={cn(
                "w-8 h-8 rounded-md transition-all hover:scale-110 flex items-center justify-center",
                fillColor === null
                  ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                  : "border border-border/50 text-muted-foreground",
              )}
              title="No fill"
              aria-label="Disable fill"
            >
              ×
            </button>

            {STROKE_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => setFillColor(color)}
                className={cn(
                  "w-8 h-8 rounded-md transition-all hover:scale-110 stroke-color-swatch",
                  fillColor === color
                    ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                    : "border border-border/50",
                )}
                style={{ "--stroke-color": color } as CSSProperties}
                title={color}
                aria-label={`Select fill color ${color}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Edges Section */}
      {showEdges && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Edges
          </h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setEdgeStyle("sharp")}
              className={cn(
                "flex-1 flex items-center justify-center h-11 rounded-xl border transition-colors shadow-sm",
                edgeStyle === "sharp"
                  ? "bg-background border-border  text-neutral-900 dark:text-violet-100"
                  : "bg-muted/40 border-border/55 hover:bg-muted/55 dark:bg-muted/20 dark:border-border/60 text-muted-foreground hover:text-foreground",
              )}
              title="Sharp corners"
              aria-label="Select sharp edges"
              aria-pressed={edgeStyle === "sharp"}
            >
              <EdgeSharpGlyph />
            </button>
            <button
              type="button"
              onClick={() => setEdgeStyle("curve")}
              className={cn(
                "flex-1 flex items-center justify-center h-11 rounded-xl border transition-colors shadow-sm",
                edgeStyle === "curve"
                  ? "bg-background border-border  text-neutral-900 dark:text-violet-100"
                  : "bg-muted/40 border-border/55 hover:bg-muted/55 dark:bg-muted/20 dark:border-border/60 text-muted-foreground hover:text-foreground",
              )}
              title="Rounded corners"
              aria-label="Select curved edges"
              aria-pressed={edgeStyle === "curve"}
            >
              <EdgeCurveGlyph />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
