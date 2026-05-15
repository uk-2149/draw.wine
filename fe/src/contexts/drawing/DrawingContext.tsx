import React, { createContext, useState } from "react";
import type { ToolType, DrawingContextType } from "./types";
import type { StrokePattern } from "@/helpers/stroke.h";
import { defaultContextValue } from "./constants";

export const DrawingContext = createContext<DrawingContextType | null>(
  defaultContextValue,
);

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
  const [edgeStyle, setEdgeStyle] = useState<"sharp" | "curve">("sharp");
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
        edgeStyle,
        setEdgeStyle,
        activeElementTypes,
        setActiveElementTypes,
      }}
    >
      {children}
    </DrawingContext.Provider>
  );
};
