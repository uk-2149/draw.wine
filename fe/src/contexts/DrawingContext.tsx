import { createContext, useContext, useState } from "react";
import type { ToolType, DrawingContextType } from "@/types/drawing";
import type { StrokePattern } from "@/helpers/stroke.h";

const DrawingContext = createContext<DrawingContextType | null>(null);

export const DrawingProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [selectedTool, setSelectedTool] = useState<ToolType>("select");
  const [strokeColor, setStrokeColor] = useState("#000000");
  const [strokeWidth, setStrokeWidth] = useState(1);
  const [strokePattern, setStrokePattern] = useState<StrokePattern>("solid");
  const [fillColor, setFillColor] = useState<string | null>(null);
  const [activeElementTypes, setActiveElementTypes] = useState<ToolType[]>([]);

  return (
    <DrawingContext.Provider
      value={{
        selectedTool,
        setSelectedTool,
        strokeColor,
        setStrokeColor,
        strokeWidth,
        setStrokeWidth,
        strokePattern,
        setStrokePattern,
        fillColor,
        setFillColor,
        activeElementTypes,
        setActiveElementTypes,
      }}
    >
      {children}
    </DrawingContext.Provider>
  );
};

export const useDrawing = () => {
  const context = useContext(DrawingContext);
  if (!context) {
    throw new Error("useDrawing must be used within a DrawingProvider");
  }
  return context;
};
