import { useDrawing } from "@/contexts/drawing/useDrawing";
import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useState,
  useRef,
  useEffect,
} from "react";
import { cn } from "@/helpers/cn.h";
import { STROKE_COLORS, STROKE_WIDTHS } from "@/constants/ext";
import { TEXT_FONT_FAMILIES } from "@/constants/toolbar";
import { STROKE_PATTERNS } from "@/helpers/stroke.h";
import { X } from "lucide-react";

const CONTROL_SURFACE =
  "border border-border/45 bg-muted/30 text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]";
const CONTROL_INTERACTIVE =
  "transition-all duration-150 hover:border-border/70 hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50";
const CONTROL_ACTIVE =
  "border-ring/70 bg-card text-foreground shadow-sm ring-2 ring-violet-500 ring-offset-1 ring-offset-background";
const PANEL_SECTION = "space-y-2";
const SWATCH_CLASS =
  "h-8 w-8 shrink-0 rounded-lg transition-all duration-150 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50";
const PANEL_MARGIN = 12;
const PANEL_MIN_WIDTH = 292;
const PANEL_MIN_HEIGHT = 220;
const PANEL_DEFAULT_WIDTH = 292;
const PANEL_DEFAULT_TOP = 88;
const PANEL_DEFAULT_LEFT = 16;

const isInteractivePanelTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  !!target.closest(
    "button,input,textarea,select,label,[role='button'],[data-no-panel-drag='true']",
  );

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
          "flex h-9 w-full items-center justify-between rounded-lg px-3 text-xs",
          CONTROL_SURFACE,
          CONTROL_INTERACTIVE,
          open && CONTROL_ACTIVE,
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
        <div className="absolute top-full left-0 right-0 mt-1 z-50 overflow-hidden rounded-lg border border-border/50 bg-popover shadow-md animate-in fade-in slide-in-from-top-1 duration-150">
          {TEXT_FONT_FAMILIES.map((font) => (
            <button
              key={font.value}
              onClick={() => {
                setFontFamily(font.value);
                setOpen(false);
              }}
              className={cn(
                "w-full px-3 py-2 text-left text-xs transition-colors",
                fontFamily === font.value
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent/70 hover:text-accent-foreground",
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
  <h3 className="text-[11px] font-semibold text-muted-foreground/75 uppercase tracking-[0.14em]">
    {children}
  </h3>
);

/* ─── Thin Divider ─────────────────────────────────────────────────────── */

const PanelDivider = () => (
  <div className="-mx-4 h-px bg-border/35" aria-hidden />
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
      "relative cursor-pointer overflow-hidden",
      SWATCH_CLASS,
      active
        ? CONTROL_ACTIVE
        : "border border-border/50 hover:border-border/80",
    )}
    title={label}
    aria-label={label}
    style={{
      background:
        "conic-gradient(from 180deg at 50% 50%, #ff4d4d, #ffcc4d, #7dff7d, #4dd2ff, #7a7aff, #d84dff, #ff4d4d)",
    }}
  >
    <span
      className="absolute inset-[6px] rounded-md border border-background/70 shadow-sm"
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

interface PropertiesPanelProps {
  className?: string;
}

export const PropertiesPanel = ({ className }: PropertiesPanelProps) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const panelDragRef = useRef<{
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const panelResizeRef = useRef<{
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
  } | null>(null);
  const [panelPosition, setPanelPosition] = useState({
    x: PANEL_DEFAULT_LEFT,
    y: PANEL_DEFAULT_TOP,
  });
  const [panelSize, setPanelSize] = useState<{
    width: number;
    height: number | null;
  }>({
    width: PANEL_DEFAULT_WIDTH,
    height: null,
  });

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

  const clampPanelPosition = (x: number, y: number) => {
    const rect = panelRef.current?.getBoundingClientRect();
    const width = rect?.width ?? panelSize.width;
    const height = rect?.height ?? panelSize.height ?? PANEL_MIN_HEIGHT;
    return {
      x: Math.min(
        Math.max(PANEL_MARGIN, x),
        Math.max(PANEL_MARGIN, window.innerWidth - width - PANEL_MARGIN),
      ),
      y: Math.min(
        Math.max(PANEL_MARGIN, y),
        Math.max(PANEL_MARGIN, window.innerHeight - height - PANEL_MARGIN),
      ),
    };
  };

  const handlePanelPointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (event.button !== 0 || isInteractivePanelTarget(event.target)) return;
    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) return;
    panelDragRef.current = {
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const handlePanelResizePointerDown = (
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) return;
    panelResizeRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startWidth: rect.width,
      startHeight: rect.height,
    };
    event.currentTarget.parentElement?.setPointerCapture(event.pointerId);
    event.stopPropagation();
    event.preventDefault();
  };

  const handlePanelPointerMove = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (panelResizeRef.current) {
      const nextWidth = Math.min(
        Math.max(
          PANEL_MIN_WIDTH,
          panelResizeRef.current.startWidth +
            event.clientX -
            panelResizeRef.current.startX,
        ),
        window.innerWidth - panelPosition.x - PANEL_MARGIN,
      );
      const nextHeight = Math.min(
        Math.max(
          PANEL_MIN_HEIGHT,
          panelResizeRef.current.startHeight +
            event.clientY -
            panelResizeRef.current.startY,
        ),
        window.innerHeight - panelPosition.y - PANEL_MARGIN,
      );
      setPanelSize({ width: nextWidth, height: nextHeight });
      return;
    }

    if (!panelDragRef.current) return;
    setPanelPosition(
      clampPanelPosition(
        event.clientX - panelDragRef.current.offsetX,
        event.clientY - panelDragRef.current.offsetY,
      ),
    );
  };

  const handlePanelPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    panelDragRef.current = null;
    panelResizeRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  if (!showStroke && !showFill && !showEdges && !showTextFont) {
    return null;
  }

  return (
    <div
      ref={panelRef}
      className={cn(
        "absolute z-20 flex min-h-0 cursor-grab flex-col gap-4 overflow-auto rounded-2xl border border-border/45 bg-background/92 p-4 text-foreground shadow-lg shadow-black/5 backdrop-blur-md active:cursor-grabbing dark:shadow-black/25",
        className,
      )}
      style={{
        left: panelPosition.x,
        top: panelPosition.y,
        width: panelSize.width,
        height: panelSize.height ?? undefined,
      }}
      onPointerDown={handlePanelPointerDown}
      onPointerMove={handlePanelPointerMove}
      onPointerUp={handlePanelPointerUp}
      onPointerCancel={handlePanelPointerUp}
    >

      {/* ── Stroke Color ─────────────────────────────────────────── */}
      {showStroke && (
        <div className={PANEL_SECTION}>
          <SectionLabel>Stroke</SectionLabel>
          <div className="grid grid-cols-7 gap-1.5">
            {STROKE_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => setStrokeColor(color)}
                className={cn(
                  SWATCH_CLASS,
                  "stroke-color-swatch",
                  strokeColor === color
                    ? CONTROL_ACTIVE
                    : "border border-border/50 hover:border-border/80",
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
        <div className={PANEL_SECTION}>
          <SectionLabel>Width</SectionLabel>
          <div className="grid h-11 grid-cols-3 gap-1 rounded-xl border border-border/45 bg-muted/25 p-1">
            {STROKE_WIDTHS.map((width) => (
              <button
                key={width.value}
                onClick={() => setStrokeWidth(width.value)}
                className={cn(
                  "flex h-full items-center justify-center rounded-lg",
                  CONTROL_INTERACTIVE,
                  strokeWidth === width.value
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground",
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
        <div className={PANEL_SECTION}>
          <SectionLabel>Style</SectionLabel>
          <div className="grid grid-cols-5 gap-2">
            {STROKE_PATTERNS.map((pattern) => (
              <button
                key={pattern.value}
                onClick={() => setStrokePattern(pattern.value)}
                className={cn(
                  "group relative flex h-11 items-center justify-center rounded-xl",
                  CONTROL_SURFACE,
                  CONTROL_INTERACTIVE,
                  strokePattern === pattern.value
                    ? CONTROL_ACTIVE
                    : "",
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
        <div className={PANEL_SECTION}>
          <SectionLabel>Fill</SectionLabel>
          <div className="grid grid-cols-7 gap-1.5">
            <button
              onClick={() => setFillColor(null)}
              className={cn(
                SWATCH_CLASS,
                "flex items-center justify-center",
                fillColor === null
                  ? CONTROL_ACTIVE
                  : "border border-dashed border-border/55 text-muted-foreground hover:border-border/80",
              )}
              title="No fill"
              aria-label="Disable fill"
            >
              <X className="h-4 w-4" />
            </button>
            {STROKE_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => setFillColor(color)}
                className={cn(
                  SWATCH_CLASS,
                  "stroke-color-swatch",
                  fillColor === color
                    ? CONTROL_ACTIVE
                    : "border border-border/50 hover:border-border/80",
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
        <div className={PANEL_SECTION}>
          <SectionLabel>Edges</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setEdgeStyle("sharp")}
              className={cn(
                "flex h-11 items-center justify-center rounded-xl",
                CONTROL_SURFACE,
                CONTROL_INTERACTIVE,
                edgeStyle === "sharp" ? CONTROL_ACTIVE : "",
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
                "flex h-11 items-center justify-center rounded-xl",
                CONTROL_SURFACE,
                CONTROL_INTERACTIVE,
                edgeStyle === "curve" ? CONTROL_ACTIVE : "",
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
          <div className={PANEL_SECTION}>
            <SectionLabel>Font</SectionLabel>
            <FontDropdown fontFamily={fontFamily} setFontFamily={setFontFamily} />
          </div>

          {/* Font Size */}
          <div className={PANEL_SECTION}>
            <SectionLabel>Size</SectionLabel>
            <div className="grid grid-cols-[repeat(4,1fr)_3.5rem] gap-1.5">
              {FONT_SIZE_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => setFontSize(preset.value)}
                  className={cn(
                    "flex h-9 items-center justify-center rounded-lg border text-[11px] font-semibold",
                    CONTROL_INTERACTIVE,
                    fontSize === preset.value
                      ? CONTROL_ACTIVE
                      : "border-border/45 bg-muted/30 text-muted-foreground",
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
                className="h-9 w-full rounded-lg border border-border/45 bg-muted/30 px-1.5 text-center text-[11px] text-foreground outline-none transition-all focus:border-ring/70 focus:ring-2 focus:ring-ring/50"
                aria-label="Custom font size"
              />
            </div>
          </div>

          {/* Style + Align (combined row) */}
          <div className={PANEL_SECTION}>
            <SectionLabel>Style &amp; Align</SectionLabel>
            <div className="grid grid-cols-[1fr_1fr_auto_1fr_1fr_1fr] gap-1.5">
              {/* Bold */}
              <button
                onClick={() =>
                  setFontWeight(fontWeight === "bold" ? "normal" : "bold")
                }
                className={cn(
                  "flex h-9 items-center justify-center rounded-lg border text-[13px]",
                  CONTROL_INTERACTIVE,
                  fontWeight === "bold"
                    ? CONTROL_ACTIVE
                    : "border-border/45 bg-muted/30 text-muted-foreground",
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
                  "flex h-9 items-center justify-center rounded-lg border text-[13px]",
                  CONTROL_INTERACTIVE,
                  fontStyle === "italic"
                    ? CONTROL_ACTIVE
                    : "border-border/45 bg-muted/30 text-muted-foreground",
                )}
                title="Italic"
                aria-label="Toggle italic"
                aria-pressed={fontStyle === "italic"}
              >
                <span className="italic text-sm">I</span>
              </button>

              {/* Divider pip */}
              <div className="my-1 w-px bg-border/45" aria-hidden />

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
                    "flex h-9 items-center justify-center rounded-lg border",
                    CONTROL_INTERACTIVE,
                    textAlign === align.value
                      ? CONTROL_ACTIVE
                      : "border-border/45 bg-muted/30 text-muted-foreground",
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
      <button
        type="button"
        aria-label="Resize properties panel"
        data-no-panel-drag="true"
        className="absolute bottom-1.5 right-1.5 h-4 w-4 cursor-nwse-resize rounded-sm text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        onPointerDown={handlePanelResizePointerDown}
      >
        <span className="absolute bottom-1 right-1 h-2.5 w-2.5 border-b border-r border-current" />
      </button>
    </div>
  );
};
