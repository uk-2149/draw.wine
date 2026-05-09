import { useEffect, useState, type ReactNode } from "react";
import {
  CircleHelp,
  X,
  Shapes,
  Paintbrush,
  Users,
  Download,
  Undo2,
  Smartphone,
} from "lucide-react";

const SHORTCUT_SECTIONS = [
  {
    title: "Tools",
    shortcuts: [
      { keys: ["S"], desc: "Select" },
      { keys: ["R"], desc: "Rectangle" },
      { keys: ["D"], desc: "Diamond" },
      { keys: ["C"], desc: "Circle" },
      { keys: ["A"], desc: "Arrow" },
      { keys: ["L"], desc: "Line" },
      { keys: ["P"], desc: "Pencil" },
      { keys: ["T"], desc: "Text" },
      { keys: ["I"], desc: "Image" },
      { keys: ["E"], desc: "Eraser" },
      { keys: ["Q"], desc: "Laser pointer" },
      { keys: ["Space"], desc: "Hand / pan" },
    ],
  },
  {
    title: "Selection",
    shortcuts: [
      { keys: ["Ctrl", "A"], desc: "Select all" },
      { keys: ["Ctrl", "D"], desc: "Deselect all" },
      { keys: ["Esc"], desc: "Deselect / cancel" },
      { keys: ["Shift", "Click"], desc: "Add to selection" },
      { keys: ["Del"], desc: "Delete selected" },
    ],
  },
  {
    title: "History",
    shortcuts: [
      { keys: ["Ctrl", "Z"], desc: "Undo" },
      { keys: ["Ctrl", "Shift", "Z"], desc: "Redo" },
      { keys: ["Ctrl", "Y"], desc: "Redo" },
    ],
  },
  {
    title: "File",
    shortcuts: [
      { keys: ["Ctrl", "S"], desc: "Save as JSON" },
      { keys: ["Ctrl", "Shift", "E"], desc: "Export drawing" },
      { keys: ["Ctrl", "O"], desc: "Import drawing" },
    ],
  },
  {
    title: "Canvas",
    shortcuts: [
      { keys: ["Scroll"], desc: "Zoom in / out" },
      { keys: ["\u2191 \u2193 \u2190 \u2192"], desc: "Pan canvas" },
      { keys: ["Alt", "Drag"], desc: "Pan canvas" },
      { keys: ["Middle click"], desc: "Pan canvas" },
    ],
  },
];

const FEATURE_LIST: { icon: ReactNode; title: string; desc: string }[] = [
  {
    icon: <Shapes className="h-5 w-5" />,
    title: "Drawing Tools",
    desc: "Rectangle, Diamond, Circle, Arrow, Line, Pencil and more with customisable stroke styles.",
  },
  {
    icon: <Paintbrush className="h-5 w-5" />,
    title: "Stroke Styles",
    desc: "Solid, dashed, dotted and bubbled patterns. Adjustable width and 10 curated colors.",
  },
  {
    icon: <Users className="h-5 w-5" />,
    title: "Real-time Collaboration",
    desc: "Create or join rooms to draw together. See live cursors and drawings.",
  },
  {
    icon: <Download className="h-5 w-5" />,
    title: "Export & Import",
    desc: "Export as PNG, JPG, SVG or JSON. Import JSON files to restore drawings.",
  },
  {
    icon: <Undo2 className="h-5 w-5" />,
    title: "Undo & Redo",
    desc: "Full history support with up to 50 undo steps.",
  },
  {
    icon: <Smartphone className="h-5 w-5" />,
    title: "PWA Support",
    desc: "Install as a desktop or mobile app for offline-capable drawing.",
  },
];

const Kbd = ({ children }: { children: string }) => (
  <kbd className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-[5px] text-[11px] font-semibold leading-none bg-muted border border-border/60 text-muted-foreground shadow-[0_1px_0_1px_rgba(0,0,0,0.05)]">
    {children}
  </kbd>
);

export const HelpButton = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"features" | "shortcuts">(
    "shortcuts",
  );

  // Toggle with ? key, close with Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen]);

  return (
    <>
      {/* Floating help button at bottom-right */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-5 right-5 z-50 flex h-11 w-11 items-center justify-center rounded-xl border border-border/60 bg-background/80 text-muted-foreground shadow-lg backdrop-blur-md transition-all hover:scale-105 hover:bg-muted hover:text-foreground active:scale-95"
        aria-label="Help & shortcuts"
        title="Help & shortcuts"
      >
        <CircleHelp className="h-5 w-5" />
      </button>

      {/* Modal overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsOpen(false);
          }}
        >
          <div className="relative mx-4 flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-lg font-semibold">draw.wine</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border px-5">
              <button
                onClick={() => setActiveTab("shortcuts")}
                className={`relative px-3 py-2.5 text-sm font-medium transition-colors ${
                  activeTab === "shortcuts"
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Shortcuts
                {activeTab === "shortcuts" && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-primary" />
                )}
              </button>
              <button
                onClick={() => setActiveTab("features")}
                className={`relative px-3 py-2.5 text-sm font-medium transition-colors ${
                  activeTab === "features"
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Features
                {activeTab === "features" && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-primary" />
                )}
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {activeTab === "shortcuts" ? (
                <div className="space-y-5">
                  {SHORTCUT_SECTIONS.map((section) => (
                    <div key={section.title}>
                      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {section.title}
                      </h3>
                      <div className="space-y-1.5">
                        {section.shortcuts.map((shortcut, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between rounded-lg px-2.5 py-1.5 transition-colors hover:bg-muted/50"
                          >
                            <span className="text-sm text-foreground/90">
                              {shortcut.desc}
                            </span>
                            <div className="flex items-center gap-1">
                              {shortcut.keys.map((key, j) => (
                                <span key={j} className="flex items-center">
                                  {j > 0 && (
                                    <span className="mx-0.5 text-[10px] text-muted-foreground">
                                      +
                                    </span>
                                  )}
                                  <Kbd>{key}</Kbd>
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {FEATURE_LIST.map((feature, i) => (
                    <div
                      key={i}
                      className="flex gap-3 rounded-xl border border-border/40 bg-muted/30 p-3 transition-colors hover:bg-muted/50"
                    >
                      <span className="mt-0.5 shrink-0 text-muted-foreground">
                        {feature.icon}
                      </span>
                      <div>
                        <h4 className="text-sm font-medium">{feature.title}</h4>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                          {feature.desc}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-border px-5 py-3">
              <p className="text-center text-xs text-muted-foreground">
                Press <Kbd>?</Kbd> to toggle this dialog
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
