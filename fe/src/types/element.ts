export interface Position {
  x: number;
  y: number;
}

export interface Element {
  id: string;
  type: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  points?: Position[];
  strokeColor: string;
  fillColor?: string;
  strokeWidth: number;
  strokePattern?: import("@/helpers/stroke.h").StrokePattern;
  roughness?: number;
  seed?: number;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: "normal" | "bold";
  fontStyle?: "normal" | "italic";
  textAlign?: "left" | "center" | "right";
  authorId?: string;
  isTemporary?: boolean;
  iconSvg?: string; // Raw SVG string if it's an Icon
  imageUrl?: string; // URL or base64 string for the image
  aspectRatio?: number; // To maintain image proportions while resizing
  edgeStyle?: "sharp" | "curve"; // Edge style for Rectangle/Diamond
  startConnection?: { elementId: string; point: { x: number; y: number } };
  endConnection?:   { elementId: string; point: { x: number; y: number } };
  bendPoint?: { x: number; y: number };
}
