import { useDrawing } from "@/contexts/drawing/useDrawing";
import { type CSSProperties, useState, useRef, useEffect } from "react";
import { cn } from "@/helpers/cn.h";
import { STROKE_COLORS, STROKE_WIDTHS } from "@/constants/ext";
import { TEXT_FONT_FAMILIES } from "@/constants/toolbar";
import { STROKE_PATTERNS } from "@/helpers/stroke.h";

/** Dashed frame with solid sharp 90° at top-left. */
const EdgeSharpGlyph = () => (
  <svg width="22" height="22" viewBox="0 0 32 32" fill="none" aria-hidden>
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
  <svg width="22" height="22" viewBox="0 0 32 32" fill="none" aria-hidden>
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
          <span className="h-[2.5px] flex-[2] rounded-full bg-current" />
          <span className="h-[2.5px] flex-[2] rounded-full bg-current" />
          <span className="h-[2.5px] flex-[2] rounded-full bg-current" />
        </div>
      );
    case "shortDash":
      return (
        <div className="flex w-full items-center gap-1">
          <span className="h-[2.5px] flex-1 rounded-full bg-current" />
          <span className="h-[2.5px] flex-1 rounded-full bg-current" />
          <span className="h-[2.5px] flex-1 rounded-full bg-current" />
          <span className="h-[2.5px] flex-1 rounded-full bg-current" />
        </div>
      );
    case "dotted":
      return (
        <div className="flex w-full items-center justify-between px-0.5">
          <span className="h-1 w-1 rounded-full bg-current" />
          <span className="h-1 w-1 rounded-full bg-current" />
          <span className="h-1 w-1 rounded-full bg-current" />
          <span className="h-1 w-1 rounded-full bg-current" />
        </div>
      );
    case "bubbled":
      return (
        <div className="flex w-full items-center justify-between px-0.5">
          <span className="h-2 w-2 rounded-full bg-current" />
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          <span className="h-2 w-2 rounded-full bg-current" />
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
        </div>
      );
    default:
      return <span className="h-[2.5px] w-full rounded-full bg-current" />;
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
          "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-xs transition-all",
          "bg-muted/30 border-border/40 text-foreground hover:bg-muted/50",
          open && "ring-1 ring-violet-500 ring-offset-1 ring-offset-background border-transparent",
        )}
        style={{ fontFamily }}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="truncate">{currentFont?.label || fontFamily}</span>
        <svg
          width="10"
          height="10"
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
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-popover border border-border/50 rounded-lg shadow-md overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          {TEXT_FONT_FAMILIES.map((font) => (
            <button
              key={font.value}
              onClick={() => {
                setFontFamily(font.value);
                setOpen(false);
              }}
              className={cn(
                "w-full text-left px-2.5 py-1.5 text-xs transition-colors",
                fontFamily === font.value
                  ? "bg-violet-50 dark:bg-violet-950 text-foreground font-medium"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              )}
              style={{ fontFamily: font.value }}
              role="option"
              aria-selected={fontFamily === font.value}
            >
              {font.label}
              {fontFamily === font.value && (
                <span className="float-right text-violet-500">✓</span>
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

/* ─── Section Label ────────────────────────────────────────────────────── */

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-[10px] font-medium text-muted-foreground/70 uppercase tracking-[0.07em] mb-1.5">
    {children}
  </h3>
);

/* ─── Thin Divider ─────────────────────────────────────────────────────── */

const PanelDivider = () => (
  <div className="-mx-[14px] h-px bg-border/30" aria-hidden />
);

/* ─── Color Swatch ─────────────────────────────────────────────────────── */

const ColorPickerSwatch = ({
  label,
  value,
  onChange,
  active,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  active: boolean;
}) => (
  <label
    className={cn(
      "relative w-[26px] h-[26px] rounded-md transition-all hover:scale-110 cursor-pointer overflow-hidden flex-shrink-0",
      active
        ? "ring-2 ring-violet-500 ring-offset-1 ring-offset-background"
        : "border border-border/40",
    )}
    title={label}
    aria-label={label}
    style={{
      background:
        "conic-gradient(from 180deg at 50% 50%, #ff4d4d, #ffcc4d, #7dff7d, #4dd2ff, #7a7aff, #d84dff, #ff4d4d)",
    }}
  >
    <span
      className="absolute inset-[5px] rounded-sm border border-white/70"
      style={{ backgroundColor: value }}
      aria-hidden
    />
    <input
      type="color"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="absolute inset-0 opacity-0 cursor-pointer"
      aria-label={label}
    />
  </label>
);

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

  const isCustomStroke = !STROKE_COLORS.includes(strokeColor);
  const isCustomFill = !!fillColor && !STROKE_COLORS.includes(fillColor);

  if (!showStroke && !showFill && !showEdges && !showTextFont) {
    return null;
  }

  return (
    <div className="bg-white/90 dark:bg-background/90 backdrop-blur-sm border border-border/40 p-[14px] rounded-xl shadow-sm w-[256px] flex flex-col gap-[14px]">

      {/* ── Stroke Color ─────────────────────────────────────────── */}
      {showStroke && (
        <div>
          <SectionLabel>Stroke</SectionLabel>
          <div className="flex flex-wrap gap-[5px]">
            {STROKE_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => setStrokeColor(color)}
                className={cn(
                  "w-[26px] h-[26px] rounded-md transition-all hover:scale-110 stroke-color-swatch flex-shrink-0",
                  strokeColor === color
                    ? "ring-2 ring-violet-500 ring-offset-1 ring-offset-background"
                    : "border border-border/40",
                )}
                style={{ "--stroke-color": color } as CSSProperties}
                title={color}
                aria-label={`Select color ${color}`}
              />
            ))}
            <ColorPickerSwatch
              label="Custom stroke color"
              value={strokeColor}
              onChange={setStrokeColor}
              active={isCustomStroke}
            />
          </div>
        </div>
      )}

      {/* ── Stroke Width ─────────────────────────────────────────── */}
      {showStroke && (
        <div>
          <SectionLabel>Width</SectionLabel>
          <div className="flex bg-muted/40 rounded-lg p-[3px] gap-[2px] border border-border/40">
            {STROKE_WIDTHS.map((width) => (
              <button
                key={width.value}
                onClick={() => setStrokeWidth(width.value)}
                className={cn(
                  "flex-1 flex items-center justify-center py-1.5 rounded-md transition-colors",
                  strokeWidth === width.value
                    ? "bg-white dark:bg-background shadow-sm text-foreground border border-border/30"
                    : "text-muted-foreground hover:text-foreground",
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

      {/* ── Stroke Style ─────────────────────────────────────────── */}
      {showStroke && (
        <div>
          <SectionLabel>Style</SectionLabel>
          <div className="grid grid-cols-5 gap-[5px]">
            {STROKE_PATTERNS.map((pattern) => (
              <button
                key={pattern.value}
                onClick={() => setStrokePattern(pattern.value)}
                className={cn(
                  "group relative flex aspect-square items-center justify-center rounded-lg border transition-all",
                  strokePattern === pattern.value
                    ? "border-border/60 bg-white dark:bg-background text-foreground shadow-sm ring-[1.5px] ring-violet-500 ring-offset-1 ring-offset-background"
                    : "border-border/40 bg-muted/30 text-muted-foreground hover:bg-white dark:hover:bg-background hover:text-foreground",
                )}
                title={pattern.label}
                aria-label={`Select ${pattern.label.toLowerCase()} stroke`}
              >
                <span className="flex h-4 w-7 items-center justify-center text-current">
                  <StrokePatternPreview pattern={pattern.value} />
                </span>
                <span className="sr-only">{pattern.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Divider before Fill ───────────────────────────────────── */}
      {showFill && showStroke && <PanelDivider />}

      {/* ── Fill Color ───────────────────────────────────────────── */}
      {showFill && (
        <div>
          <SectionLabel>Fill</SectionLabel>
          <div className="flex flex-wrap gap-[5px]">
            <button
              onClick={() => setFillColor(null)}
              className={cn(
                "w-[26px] h-[26px] rounded-md transition-all hover:scale-110 flex items-center justify-center text-base leading-none flex-shrink-0",
                fillColor === null
                  ? "ring-2 ring-violet-500 ring-offset-1 ring-offset-background"
                  : "border border-dashed border-border/50 text-muted-foreground hover:border-border",
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
                  "w-[26px] h-[26px] rounded-md transition-all hover:scale-110 stroke-color-swatch flex-shrink-0",
                  fillColor === color
                    ? "ring-2 ring-violet-500 ring-offset-1 ring-offset-background"
                    : "border border-border/40",
                )}
                style={{ "--stroke-color": color } as CSSProperties}
                title={color}
                aria-label={`Select fill color ${color}`}
              />
            ))}
            <ColorPickerSwatch
              label="Custom fill color"
              value={fillColor || "#ffffff"}
              onChange={(value) => setFillColor(value)}
              active={isCustomFill}
            />
          </div>
        </div>
      )}

      {/* ── Edges ────────────────────────────────────────────────── */}
      {showEdges && (
        <div>
          <SectionLabel>Edges</SectionLabel>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setEdgeStyle("sharp")}
              className={cn(
                "flex-1 flex items-center justify-center h-[38px] rounded-[9px] border transition-all",
                edgeStyle === "sharp"
                  ? "bg-white dark:bg-background border-border/60 shadow-sm ring-[1.5px] ring-violet-500 ring-offset-1 ring-offset-background text-foreground"
                  : "bg-muted/30 border-border/40 text-muted-foreground hover:bg-white dark:hover:bg-background hover:text-foreground",
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
                "flex-1 flex items-center justify-center h-[38px] rounded-[9px] border transition-all",
                edgeStyle === "curve"
                  ? "bg-white dark:bg-background border-border/60 shadow-sm ring-[1.5px] ring-violet-500 ring-offset-1 ring-offset-background text-foreground"
                  : "bg-muted/30 border-border/40 text-muted-foreground hover:bg-white dark:hover:bg-background hover:text-foreground",
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

      {/* ── Divider before Text ───────────────────────────────────── */}
      {showTextFont && (showStroke || showFill || showEdges) && <PanelDivider />}

      {/* ── Text Controls ────────────────────────────────────────── */}
      {showTextFont && (
        <>
          {/* Font Family */}
          <div>
            <SectionLabel>Font</SectionLabel>
            <FontDropdown fontFamily={fontFamily} setFontFamily={setFontFamily} />
          </div>

          {/* Font Size */}
          <div>
            <SectionLabel>Size</SectionLabel>
            <div className="flex items-center gap-[5px]">
              {FONT_SIZE_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => setFontSize(preset.value)}
                  className={cn(
                    "flex-1 flex items-center justify-center h-[28px] rounded-[7px] border text-[11px] font-medium transition-all",
                    fontSize === preset.value
                      ? "bg-white dark:bg-background border-border/60 shadow-sm text-foreground ring-[1.5px] ring-violet-500 ring-offset-1 ring-offset-background"
                      : "bg-muted/30 border-border/40 text-muted-foreground hover:bg-white dark:hover:bg-background hover:text-foreground",
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
                className="w-12 rounded-[7px] border border-border/40 bg-muted/30 px-1.5 h-[28px] text-[11px] text-center text-foreground outline-none focus:ring-[1.5px] focus:ring-violet-500 focus:border-transparent"
                aria-label="Custom font size"
              />
            </div>
          </div>

          {/* Style + Align (combined row) */}
          <div>
            <SectionLabel>Style &amp; Align</SectionLabel>
            <div className="flex gap-[5px]">
              {/* Bold */}
              <button
                onClick={() =>
                  setFontWeight(fontWeight === "bold" ? "normal" : "bold")
                }
                className={cn(
                  "flex-1 flex items-center justify-center h-[30px] rounded-[7px] border text-[13px] transition-all",
                  fontWeight === "bold"
                    ? "bg-white dark:bg-background border-border/60 shadow-sm text-foreground ring-[1.5px] ring-violet-500 ring-offset-1 ring-offset-background"
                    : "bg-muted/30 border-border/40 text-muted-foreground hover:bg-white dark:hover:bg-background hover:text-foreground",
                )}
                title="Bold"
                aria-label="Toggle bold"
                aria-pressed={fontWeight === "bold"}
              >
                <span className="font-bold text-sm">B</span>
              </button>

              {/* Italic */}
              <button
                onClick={() =>
                  setFontStyle(fontStyle === "italic" ? "normal" : "italic")
                }
                className={cn(
                  "flex-1 flex items-center justify-center h-[30px] rounded-[7px] border text-[13px] transition-all",
                  fontStyle === "italic"
                    ? "bg-white dark:bg-background border-border/60 shadow-sm text-foreground ring-[1.5px] ring-violet-500 ring-offset-1 ring-offset-background"
                    : "bg-muted/30 border-border/40 text-muted-foreground hover:bg-white dark:hover:bg-background hover:text-foreground",
                )}
                title="Italic"
                aria-label="Toggle italic"
                aria-pressed={fontStyle === "italic"}
              >
                <span className="italic text-sm">I</span>
              </button>

              {/* Divider pip */}
              <div className="w-px bg-border/40 self-stretch my-0.5" aria-hidden />

              {/* Align buttons */}
              {(
                [
                  {
                    value: "left" as const,
                    label: "Left",
                    icon: (
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                        <path
                          d="M2 3h12M2 6.5h8M2 10h10M2 13.5h6"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                      </svg>
                    ),
                  },
                  {
                    value: "center" as const,
                    label: "Center",
                    icon: (
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                        <path
                          d="M2 3h12M4 6.5h8M3 10h10M5 13.5h6"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                      </svg>
                    ),
                  },
                  {
                    value: "right" as const,
                    label: "Right",
                    icon: (
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                        <path
                          d="M2 3h12M6 6.5h8M4 10h10M8 13.5h6"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                      </svg>
                    ),
                  },
                ] as const
              ).map((align) => (
                <button
                  key={align.value}
                  onClick={() => setTextAlign(align.value)}
                  className={cn(
                    "flex-1 flex items-center justify-center h-[30px] rounded-[7px] border transition-all",
                    textAlign === align.value
                      ? "bg-white dark:bg-background border-border/60 shadow-sm text-foreground ring-[1.5px] ring-violet-500 ring-offset-1 ring-offset-background"
                      : "bg-muted/30 border-border/40 text-muted-foreground hover:bg-white dark:hover:bg-background hover:text-foreground",
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