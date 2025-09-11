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
  strokeWidth: number;
  roughness?: number;
  seed?: number;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  imageUrl?: string; // URL or base64 string for the image
  aspectRatio?: number; // To maintain image proportions while resizing
}


export interface DrawingOperation {
    id: string;
    type: 'element_start' | 'element_update' | 'element_complete' | 'element_delete' | 'element_transform';
    elementId: string;
    authorId: string;
    timestamp: number;
    roomId: string;
    data: any;
    isTemporary?: boolean;
}

export interface RoomState {
    id: string;
    elements: { [key: string]: Element };
    collaborators: Array<{
        id: string;
        name: string;
        color: string;
        cursor?: { x: number; y: number };
        isDrawing?: boolean;
        currentElementId?: string;
        joinedAt: number;
    }>;
    lastModified: number;
    version: number;
}

export interface AuthPayload {
  userId: string;
  roomId: string;
  userName?: string;
  role?: string;
}

export interface DatabaseOperation {
  id: string;
  roomId: string;
  operationType: string;
  elementId: string;
  authorId: string;
  timestamp: number;
  sequenceNumber: number;
  operationData: any;
}