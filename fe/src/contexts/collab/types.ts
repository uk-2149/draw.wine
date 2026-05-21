import type { Dispatch, SetStateAction } from "react";
import type { Socket } from "socket.io-client";
import type { Element } from "@/types";

export type Collaborator = {
  id: string;
  name: string;
  color: string;
  cursor: { x: number; y: number };
};

export type CollabSettings = {
  onlyHostCanDraw: boolean;
  requireApproval: boolean;
};

export interface PendingJoinRequest {
  id: string;
  name: string;
  color: string;
  roomId: string;
}

export type CollaborativeOperation =
  | {
      type: "element_start";
      roomId?: string;
      elementId: string;
      authorId?: string;
      userId?: string;
      timestamp?: number;
      element?: Element;
      data?: {
        element?: Element;
        tool?: string;
      };
    }
  | {
      type: "element_create";
      roomId?: string;
      elementId?: string;
      authorId?: string;
      userId?: string;
      timestamp?: number;
      element?: Element;
      data?: {
        element?: Element;
      };
    }
  | {
      type: "element_update";
      roomId?: string;
      elementId: string;
      authorId?: string;
      userId?: string;
      timestamp?: number;
      data: Partial<Element>;
    }
  | {
      type: "element_complete";
      roomId?: string;
      elementId: string;
      authorId?: string;
      userId?: string;
      timestamp?: number;
      data: {
        element: Element;
      };
    }
  | {
      type: "element_delete";
      roomId?: string;
      elementId?: string;
      authorId?: string;
      userId?: string;
      timestamp?: number;
      data?: Record<string, never>;
    };

export interface CollabState {
  isConnected: boolean;
  isConnecting: boolean;
  isCollaborating: boolean;
  roomId: string | null;
  userId: string | null;
  pendingOperation: CollaborativeOperation | null;
  collaborators: Collaborator[];
  socket: Socket | null;
  error: string | null;
  hostId: string | null;
  settings: CollabSettings | null;
  isWaitingForApproval: boolean;
  joinRejected: boolean;
  pendingJoinRequests: PendingJoinRequest[];
  // Tier-related state
  expiresAt: number | null;
  maxUsers: number | null;
  isRoomExpired: boolean;
  isRoomFull: boolean;
}

export type CollabAction =
  | { type: "SOCKET_CONNECTING" }
  | { type: "SOCKET_CONNECTED"; payload: Socket }
  | { type: "SOCKET_DISCONNECTED" }
  | { type: "SOCKET_ERROR"; payload: string }
  | { type: "JOINING_ROOM"; payload: { roomId: string; userId: string } }
  | {
      type: "ROOM_JOINED";
      payload: {
        collaborators: Collaborator[];
        elements?: Element[];
        hostId?: string;
        settings?: CollabSettings;
        expiresAt?: number;
        maxUsers?: number;
      };
    }
  | { type: "WAITING_FOR_APPROVAL" }
  | { type: "JOIN_REJECTED" }
  | { type: "ROOM_EXPIRED" }
  | { type: "ROOM_FULL"; payload: { maxUsers: number } }
  | { type: "ADD_JOIN_REQUEST"; payload: PendingJoinRequest }
  | { type: "REMOVE_JOIN_REQUEST"; payload: string }
  | {
      type: "COLLABORATORS_UPDATED";
      payload: Collaborator[];
    }
  | { type: "LOCAL_OPERATION_SENT"; payload: CollaborativeOperation }
  | {
      type: "CURSOR_UPDATED";
      payload: { userId: string; cursor: { x: number; y: number } };
    }
  | { type: "LEAVE_ROOM" }
  | { type: "CLEAR_ERROR" };

export interface CollabContextType {
  state: CollabState;
  joinRoom: (
    roomId: string,
    userName: string,
    settings?: CollabSettings,
  ) => void;
  resolveJoinRequest: (guestId: string, action: "accept" | "reject") => void;
  leaveRoom: () => void;
  sendOperation: (operation: CollaborativeOperation) => void;
  updateCursor: (cursor: { x: number; y: number }) => void;
  updateDrawingStatus: (isDrawing: boolean, elementId?: string) => void;
  clearError: () => void;
  isUserInCurrentRoom: (userId?: string) => boolean;
  checkRoomStatus: (roomId: string, userId: string) => Promise<boolean>;
  getCurrentRoomInfo: () => {
    roomId: string | null;
    userId: string | null;
    collaboratorsCount: number;
  };
  isJoinSidebarOpen: boolean;
  setIsJoinSidebarOpen: Dispatch<SetStateAction<boolean>>;
}
