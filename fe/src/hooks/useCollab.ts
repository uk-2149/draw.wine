import { CollabContext } from "@/contexts/CollabContext";
import React from "react";

export const useCollab = () => {
  const context = React.useContext(CollabContext);
  if (!context) {
    throw new Error("useCollab must be used within a CollabProvider");
  }
  return context;
};
