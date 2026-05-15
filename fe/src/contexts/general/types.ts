export type GCType = {
  currentStage: "lobby" | "cg";
  setCurrentStage: (stage: string) => void;
};
