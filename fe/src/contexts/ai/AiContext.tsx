import React from "react";
import type {
  AiContextType,
  AiResult,
  AiStatus,
  AiMode,
  AiModel,
} from "./types";
import { defaultContextValue } from "./constants";

export const AiContext =
  React.createContext<AiContextType>(defaultContextValue);

export const AiProvider = ({ children }: { children: React.ReactNode }) => {
  const [model, setModel] = React.useState<AiModel | null>("gemini-2.5-flash");
  const [mode, setMode] = React.useState<AiMode>("vector");
  const [prompt, setPrompt] = React.useState("");
  const [result, setResult] = React.useState<AiResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [state, setState] = React.useState<AiStatus>("idle");
  const [sessionId, setSessionId] = React.useState<string | null>(null);

  const reset = () => {
    setPrompt("");
    setResult(null);
    setError(null);
    setState("idle");
  };

  const startRequest = (nextPrompt?: string, nextMode?: AiMode) => {
    if (typeof nextPrompt === "string") {
      setPrompt(nextPrompt);
    }
    if (nextMode) {
      setMode(nextMode);
    }
    setResult(null);
    setError(null);
    setState("loading");
  };

  const finishRequest = (nextResult: AiResult | null) => {
    setResult(nextResult);
    setError(null);
    setState("success");
  };

  const failRequest = (message: string) => {
    setResult(null);
    setError(message);
    setState("error");
  };

  const contextValue: AiContextType = {
    model,
    mode,
    prompt,
    result,
    error,
    state,
    sessionId,
    setModel,
    setMode,
    setPrompt,
    setResult,
    setError,
    setState,
    setSessionId,
    reset,
    startRequest,
    finishRequest,
    failRequest,
  };

  return (
    <AiContext.Provider value={contextValue}>{children}</AiContext.Provider>
  );
};
