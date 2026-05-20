import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useRef,
  useState,
} from "react";
import { CanvasBoard } from "@/components/custom/canvas/CanvasBoard";
import { Toolbar } from "@/components/custom/general/Toolbar";
import { DrawingProvider } from "@/contexts/drawing/DrawingContext";
import { ThemeToggle } from "@/components/custom/ThemeToggle";
import { PropertiesPanel } from "@/components/custom/general/PropertiesPanel";
import { Left3bar } from "@/components/custom/general/Left3bar";
import { InstallButton } from "@/components/custom/general/InstallButton";
import { JoinRequestsSidebar } from "@/components/custom/general/JoinRequestsSidebar";
import { HelpButton } from "@/components/custom/general/HelpButton";
import { Aibutton } from "@/components/custom/ai/Aibutton";
import { AiChatSidebar } from "@/components/custom/ai/AiChatSidebar";
import { useGeneral } from "@/contexts/general/useGeneral";

type ToolbarDockSide = "top" | "right" | "bottom" | "left";

const TOOLBAR_MARGIN = 20;

const getNearestDockSide = (x: number, y: number): ToolbarDockSide => {
  const distances: Record<ToolbarDockSide, number> = {
    top: y,
    right: window.innerWidth - x,
    bottom: window.innerHeight - y,
    left: x,
  };

  return (Object.keys(distances) as ToolbarDockSide[]).reduce((nearest, side) =>
    distances[side] < distances[nearest] ? side : nearest,
  );
};

const getDockedToolbarStyle = (dockSide: ToolbarDockSide): CSSProperties => {
  switch (dockSide) {
    case "right":
      return {
        right: TOOLBAR_MARGIN,
        top: "50%",
        transform: "translateY(-50%)",
      };
    case "bottom":
      return {
        bottom: TOOLBAR_MARGIN,
        left: "50%",
        transform: "translateX(-50%)",
      };
    case "left":
      return {
        left: TOOLBAR_MARGIN,
        top: "50%",
        transform: "translateY(-50%)",
      };
    default:
      return {
        left: "50%",
        top: TOOLBAR_MARGIN,
        transform: "translateX(-50%)",
      };
  }
};

export const PlayGround = () => {
  const [isAiSidebarOpen, setIsAiSidebarOpen] = useState(false);
  const { currentStage } = useGeneral();
  const toolbarRef = useRef<HTMLDivElement>(null);
  const suppressToolbarClickRef = useRef(false);
  const toolbarDragRef = useRef<{
    offsetX: number;
    offsetY: number;
    moved: boolean;
  } | null>(null);
  const [toolbarDockSide, setToolbarDockSide] =
    useState<ToolbarDockSide>("top");
  const [toolbarDragPosition, setToolbarDragPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [suppressToolbarClick, setSuppressToolbarClick] = useState(false);

  // In PlayGround.tsx
  const [bgColor, setBgColor] = useState("#f8f5f0");
  const [bgOpacity, setBgOpacity] = useState(100);
  const [bgPattern, setBgPattern] = useState<
    "none" | "dots" | "grid" | "lines"
  >("dots");

  const toolbarOrientation =
    toolbarDockSide === "left" || toolbarDockSide === "right"
      ? "vertical"
      : "horizontal";
  const toolbarStyle: CSSProperties = toolbarDragPosition
    ? {
        left: toolbarDragPosition.x,
        top: toolbarDragPosition.y,
        transform: "none",
      }
    : getDockedToolbarStyle(toolbarDockSide);

  const handleToolbarPointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (event.button !== 0) return;
    const rect = toolbarRef.current?.getBoundingClientRect();
    if (!rect) return;
    toolbarDragRef.current = {
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      moved: false,
    };
    setToolbarDragPosition({ x: rect.left, y: rect.top });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleToolbarPointerMove = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (!toolbarDragRef.current) return;
    const nextX = event.clientX - toolbarDragRef.current.offsetX;
    const nextY = event.clientY - toolbarDragRef.current.offsetY;
    const previous = toolbarDragPosition;
    const moved =
      !previous ||
      Math.abs(previous.x - nextX) > 3 ||
      Math.abs(previous.y - nextY) > 3;
    toolbarDragRef.current.moved ||= moved;
    setToolbarDragPosition({
      x: Math.min(
        Math.max(TOOLBAR_MARGIN, nextX),
        window.innerWidth -
          (toolbarRef.current?.offsetWidth ?? 0) -
          TOOLBAR_MARGIN,
      ),
      y: Math.min(
        Math.max(TOOLBAR_MARGIN, nextY),
        window.innerHeight -
          (toolbarRef.current?.offsetHeight ?? 0) -
          TOOLBAR_MARGIN,
      ),
    });
  };

  const handleToolbarPointerUp = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    const rect = toolbarRef.current?.getBoundingClientRect();
    const didMove = toolbarDragRef.current?.moved ?? false;
    if (rect) {
      setToolbarDockSide(
        getNearestDockSide(rect.left + rect.width / 2, rect.top + rect.height / 2),
      );
    }
    toolbarDragRef.current = null;
    setToolbarDragPosition(null);
    suppressToolbarClickRef.current = didMove;
    setSuppressToolbarClick(didMove);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (didMove) {
      window.setTimeout(() => {
        suppressToolbarClickRef.current = false;
        setSuppressToolbarClick(false);
      }, 0);
    }
  };

  return (
    <DrawingProvider>
      <div className="h-screen w-full relative overflow-hidden bg-background text-foreground">
        <div className="absolute top-0 left-0 p-4 z-10">
          <Left3bar
            bgColor={bgColor}
            setBgColor={setBgColor}
            bgOpacity={bgOpacity}
            setBgOpacity={setBgOpacity}
            bgPattern={bgPattern}
            setBgPattern={setBgPattern}
          />
        </div>
        <div
          ref={toolbarRef}
          className="absolute z-20 cursor-grab touch-none active:cursor-grabbing"
          style={toolbarStyle}
          onPointerDown={handleToolbarPointerDown}
          onPointerMove={handleToolbarPointerMove}
          onPointerUp={handleToolbarPointerUp}
          onPointerCancel={handleToolbarPointerUp}
          onClickCapture={(event) => {
            if (!suppressToolbarClickRef.current && !suppressToolbarClick)
              return;
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          <Toolbar orientation={toolbarOrientation} />
        </div>
        <div className="absolute top-5 right-4 z-10 flex items-center gap-3">
          {currentStage === "lobby" && (
            <Aibutton onClick={() => setIsAiSidebarOpen(true)} />
          )}
          <ThemeToggle />
          <JoinRequestsSidebar />
          <InstallButton />
        </div>
        <PropertiesPanel />
        <CanvasBoard
          bgColor={bgColor}
          bgOpacity={bgOpacity}
          bgPattern={bgPattern}
        />
        <HelpButton />
        <AiChatSidebar
          isOpen={isAiSidebarOpen}
          onClose={() => setIsAiSidebarOpen(false)}
        />
      </div>
    </DrawingProvider>
  );
};
