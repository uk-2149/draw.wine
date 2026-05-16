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
}

export interface AiDrawingResponse {
  elements: GeneratedElement[];
  isRaster?: boolean;
}

export interface AiChatRequest {
  prompt: string;
  model?: string;
}

export interface AiChatResponse {
  message: string;
}
