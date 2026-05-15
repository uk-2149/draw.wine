import React, { createContext, useState } from "react";
import type { GCType } from "./types";
import { defaultContextValue } from "./constants";

// cg => collaborative ground

export const GeneralContext = createContext<GCType | null>(defaultContextValue);

export const GeneralProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [currentStage, setCurrentStage] = useState<"lobby" | "cg">("lobby");

  const setCurrentStageWrapper = (stage: string) => {
    if (stage === "lobby" || stage === "cg") {
      setCurrentStage(stage);
    } else {
      console.warn(`Invalid stage: ${stage}`);
    }
  };
  return (
    <GeneralContext.Provider
      value={{
        currentStage,
        setCurrentStage: setCurrentStageWrapper,
      }}
    >
      {children}
    </GeneralContext.Provider>
  );
};
