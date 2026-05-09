export type ToolType =
  | "select"
  | "Rectangle"
  | "Diamond"
  | "Circle"
  | "Arrow"
  | "Line"
  | "Pencil"
  | "Text"
  | "Image"
  | "Eraser"
  | "Laser"
  | "Hand";

export interface DrawingContextType {
  selectedTool: ToolType;
  setSelectedTool: (tool: ToolType) => void;
  strokeColor: string;
  setStrokeColor: (color: string) => void;
  strokeWidth: number;
  setStrokeWidth: (width: number) => void;
  strokePattern: import("@/helpers/stroke.h").StrokePattern;
  setStrokePattern: (
    pattern: import("@/helpers/stroke.h").StrokePattern,
  ) => void;
  fillColor: string | null;
  setFillColor: (color: string | null) => void;
  activeElementTypes: ToolType[];
  setActiveElementTypes: (types: ToolType[]) => void;
}
