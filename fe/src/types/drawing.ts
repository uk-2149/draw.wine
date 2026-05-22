export type ToolType =
  | "select"
  | "Lasso"
  | "Rectangle"
  | "Diamond"
  | "Circle"
  | "Arrow"
  | "Line"
  | "Pencil"
  | "Text"
  | "Image"
  | "Icon"
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
  edgeStyle: "sharp" | "curve";
  setEdgeStyle: (style: "sharp" | "curve") => void;
  fontFamily: string;
  setFontFamily: (fontFamily: string) => void;
  fontSize: number;
  setFontSize: (size: number) => void;
  fontWeight: "normal" | "bold";
  setFontWeight: (weight: "normal" | "bold") => void;
  fontStyle: "normal" | "italic";
  setFontStyle: (style: "normal" | "italic") => void;
  textAlign: "left" | "center" | "right";
  setTextAlign: (align: "left" | "center" | "right") => void;
  activeElementTypes: ToolType[];
  setActiveElementTypes: (types: ToolType[]) => void;
}
