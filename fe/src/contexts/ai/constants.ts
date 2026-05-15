import type { AiContextType } from "./types";

export const defaultContextValue: AiContextType = {
  model: null,
  mode: "vector",
  prompt: "",
  result: null,
  error: null,
  state: "idle",
  setModel: () => null,
  setMode: () => null,
  setPrompt: () => null,
  setResult: () => null,
  setError: () => null,
  setState: () => null,
  reset: () => null,
  startRequest: () => null,
  finishRequest: () => null,
  failRequest: () => null,
};
