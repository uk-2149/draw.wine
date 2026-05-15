import React from "react";
import { GeneralContext } from "./GeneralContext";

export const useGeneral = () => {
  const context = React.useContext(GeneralContext);
  if (!context) {
    throw new Error("useGeneral must be used within a GeneralProvider");
  }
  return context;
};
