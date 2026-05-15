export type AiStatus = "idle" | "loading" | "success" | "error";
export type AiMode = "vector" | "raster";
export type AiModel = "gemini-2.5-flash" | "gemini-2.5-pro";

export interface GeneratedElement {
  type: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  text?: string;
  fontSize?: number;
  strokeColor?: string;
  fillColor?: string;
  strokeWidth?: number;
  edgeStyle?: "sharp" | "curve";
  imageUrl?: string;
}

export interface AiDrawingResponse {
  elements: GeneratedElement[];
  isRaster?: boolean;
}

export type AiResult = AiDrawingResponse;

export interface AiContextType {
  model: AiModel | null;
  mode: AiMode;
  prompt: string;
  result: AiResult | null;
  error: string | null;
  state: AiStatus;
  setModel: (model: AiModel | null) => void;
  setMode: (mode: AiMode) => void;
  setPrompt: (prompt: string) => void;
  setResult: (result: AiResult | null) => void;
  setError: (error: string | null) => void;
  setState: (state: AiStatus) => void;
  reset: () => void;
  startRequest: (prompt?: string, mode?: AiMode) => void;
  finishRequest: (result: AiResult | null) => void;
  failRequest: (message: string) => void;
}
