import { useDrawing } from "@/contexts/drawing/useDrawing";
import { type CSSProperties, useState, useRef, useEffect } from "react";
import { cn } from "@/helpers/cn.h";
import { STROKE_COLORS, STROKE_WIDTHS } from "@/constants/ext";
import { TEXT_FONT_FAMILIES } from "@/constants/toolbar";
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

/* ─── Font Family Dropdown ─────────────────────────────────────────────── */

const FontDropdown = ({
  fontFamily,
  setFontFamily,
}: {
  fontFamily: string;
  setFontFamily: (f: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const currentFont = TEXT_FONT_FAMILIES.find((f) => f.value === fontFamily);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-all",
          "bg-muted/40 border-border/50 text-foreground hover:bg-muted/70",
          open && "ring-2 ring-primary ring-offset-1 ring-offset-background",
        )}
        style={{ fontFamily }}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="truncate">{currentFont?.label || fontFamily}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          className={cn(
            "ml-2 shrink-0 transition-transform",
            open && "rotate-180",
          )}
        >
          <path
            d="M3 4.5L6 7.5L9 4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          {TEXT_FONT_FAMILIES.map((font) => (
            <button
              key={font.value}
              onClick={() => {
                setFontFamily(font.value);
                setOpen(false);
              }}
              className={cn(
                "w-full text-left px-3 py-2 text-sm transition-colors",
                fontFamily === font.value
                  ? "bg-primary/10 text-foreground font-medium"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              )}
              style={{ fontFamily: font.value }}
              role="option"
              aria-selected={fontFamily === font.value}
            >
              {font.label}
              {fontFamily === font.value && (
                <span className="float-right text-primary">✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/* ─── Font Size Presets ────────────────────────────────────────────────── */

const FONT_SIZE_PRESETS = [
  { label: "S", value: 14 },
  { label: "M", value: 20 },
  { label: "L", value: 28 },
  { label: "XL", value: 36 },
] as const;

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
    fontFamily,
    setFontFamily,
    fontSize,
    setFontSize,
    fontWeight,
    setFontWeight,
    fontStyle,
    setFontStyle,
    textAlign,
    setTextAlign,
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

  const showTextFont =
    selectedTool === "Text" ||
    (selectedTool === "select" &&
      activeElementTypes.some((type) => type === "Text"));

  if (!showStroke && !showFill && !showEdges && !showTextFont) {
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

      {/* ── Text Controls ────────────────────────────────────────── */}
      {showTextFont && (
        <>
          {/* Font Family Dropdown */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Font
            </h3>
            <FontDropdown
              fontFamily={fontFamily}
              setFontFamily={setFontFamily}
            />
          </div>

          {/* Font Size */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Size
            </h3>
            <div className="flex items-center gap-1.5">
              {FONT_SIZE_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => setFontSize(preset.value)}
                  className={cn(
                    "flex-1 flex items-center justify-center py-1.5 rounded-md border text-xs font-medium transition-all",
                    fontSize === preset.value
                      ? "bg-background border-border shadow-sm text-foreground ring-1 ring-primary"
                      : "bg-muted/40 border-border/50 text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                  )}
                  title={`${preset.value}px`}
                  aria-label={`Font size ${preset.label}`}
                >
                  {preset.label}
                </button>
              ))}
              <input
                type="number"
                value={fontSize}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (val > 0 && val <= 200) setFontSize(val);
                }}
                min={8}
                max={200}
                className="w-14 rounded-md border border-border/50 bg-muted/40 px-2 py-1.5 text-xs text-center text-foreground outline-none focus:ring-1 focus:ring-primary"
                aria-label="Custom font size"
              />
            </div>
          </div>

          {/* Text Style: Bold, Italic */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Style
            </h3>
            <div className="flex gap-1.5">
              <button
                onClick={() =>
                  setFontWeight(fontWeight === "bold" ? "normal" : "bold")
                }
                className={cn(
                  "flex-1 flex items-center justify-center py-2 rounded-md border text-sm transition-all",
                  fontWeight === "bold"
                    ? "bg-background border-border shadow-sm text-foreground ring-1 ring-primary font-bold"
                    : "bg-muted/40 border-border/50 text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                )}
                title="Bold"
                aria-label="Toggle bold"
                aria-pressed={fontWeight === "bold"}
              >
                <span className="font-bold">B</span>
              </button>
              <button
                onClick={() =>
                  setFontStyle(fontStyle === "italic" ? "normal" : "italic")
                }
                className={cn(
                  "flex-1 flex items-center justify-center py-2 rounded-md border text-sm transition-all",
                  fontStyle === "italic"
                    ? "bg-background border-border shadow-sm text-foreground ring-1 ring-primary"
                    : "bg-muted/40 border-border/50 text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                )}
                title="Italic"
                aria-label="Toggle italic"
                aria-pressed={fontStyle === "italic"}
              >
                <span className="italic">I</span>
              </button>
            </div>
          </div>

          {/* Text Alignment */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Align
            </h3>
            <div className="flex gap-1.5">
              {(
                [
                  {
                    value: "left" as const,
                    label: "Left",
                    icon: (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M2 3h12M2 6.5h8M2 10h10M2 13.5h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    ),
                  },
                  {
                    value: "center" as const,
                    label: "Center",
                    icon: (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M2 3h12M4 6.5h8M3 10h10M5 13.5h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    ),
                  },
                  {
                    value: "right" as const,
                    label: "Right",
                    icon: (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M2 3h12M6 6.5h8M4 10h10M8 13.5h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    ),
                  },
                ] as const
              ).map((align) => (
                <button
                  key={align.value}
                  onClick={() => setTextAlign(align.value)}
                  className={cn(
                    "flex-1 flex items-center justify-center py-2 rounded-md border text-sm transition-all",
                    textAlign === align.value
                      ? "bg-background border-border shadow-sm text-foreground ring-1 ring-primary"
                      : "bg-muted/40 border-border/50 text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                  )}
                  title={align.label}
                  aria-label={`Align ${align.label.toLowerCase()}`}
                  aria-pressed={textAlign === align.value}
                >
                  {align.icon}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
