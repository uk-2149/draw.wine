import React from "react";
import { CollabContext } from "./CollabContext";

export const useCollab = () => {
  const context = React.useContext(CollabContext);
  if (!context) {
    throw new Error("useCollab must be used within a CollabProvider");
  }
  return context;
};
