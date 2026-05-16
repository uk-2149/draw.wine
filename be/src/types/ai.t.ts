export interface AiDrawingRequest {
  prompt: string;
  mode?: "vector" | "raster";
  model?: string;
}

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
  label?: string;
}

export interface AiDrawingResponse {
  elements: GeneratedElement[];
  isRaster?: boolean;
}

export interface AiChatRequest {
  prompt: string;
  model?: string;
  sessionId?: string; // optional session ID for conversation history
}

export interface AiChatResponse {
  message: string;
  sessionId?: string; // returned so frontend can track the session
}
