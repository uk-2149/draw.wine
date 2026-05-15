import React from "react";
import { DrawingContext } from "./DrawingContext";

export const useDrawing = () => {
  const context = React.useContext(DrawingContext);
  if (!context) {
    throw new Error("useDrawing must be used within a DrawingProvider");
  }
  return context;
};
