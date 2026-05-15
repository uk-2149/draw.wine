import React from "react";
import { AiContext } from "./AiContext";

export const useAi = () => {
  const context = React.useContext(AiContext);
  if (!context) {
    throw new Error("useAi must be used within an AiProvider");
  }
  return context;
};
