import React, { createContext, useState } from "react";
import type { ToolType, DrawingContextType } from "./types";
import type { StrokePattern } from "@/helpers/stroke.h";
import { defaultContextValue } from "./constants";

const TEXT_FONT_FAMILY_KEY = "draw-wine-text-font-family";

const getDefaultFontFamily = (): string => {
  if (typeof window === "undefined") return "Virgil";
  const stored = window.localStorage.getItem(TEXT_FONT_FAMILY_KEY);
  return stored || "Virgil";
};

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
  const [fontFamily, setFontFamilyState] = useState<string>(
    getDefaultFontFamily,
  );
  const [fontSize, setFontSize] = useState(20);
  const [fontWeight, setFontWeight] = useState<"normal" | "bold">("normal");
  const [fontStyle, setFontStyle] = useState<"normal" | "italic">("normal");
  const [textAlign, setTextAlign] = useState<"left" | "center" | "right">("left");
  const [activeElementTypes, setActiveElementTypes] = useState<ToolType[]>([]);

  const setFontFamily = (value: string) => {
    setFontFamilyState(value);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(TEXT_FONT_FAMILY_KEY, value);
    }
  };

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
        setActiveElementTypes,
      }}
    >
      {children}
    </DrawingContext.Provider>
  );
};
