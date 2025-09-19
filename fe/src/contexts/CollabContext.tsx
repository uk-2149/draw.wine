import React, { useReducer, useEffect, useContext } from "react";
import { io, Socket } from "socket.io-client";

const be_url =
  import.meta.env.VITE_ENV === "prod"
    ? import.meta.env.VITE_BE_URL
    : "http://localhost:3000";

interface CollabState {
  isConnected: boolean;
  isConnecting: boolean;
  isCollaborating: boolean;
  roomId: string | null;
  userId: string | null;
  collaborators: Array<{
    id: string;
    name: string;
    color: string;
    cursor: { x: number; y: number };
  }>;
  socket: Socket | null;
  error: string | null;
}

type CollabAction =
  | { type: "SOCKET_CONNECTING" }
  | { type: "SOCKET_CONNECTED"; payload: Socket }
  | { type: "SOCKET_DISCONNECTED" }
  | { type: "SOCKET_ERROR"; payload: string }
  | { type: "JOINING_ROOM"; payload: { roomId: string; userId: string } }
  | { type: "ROOM_JOINED"; payload: { collaborators: any[]; elements?: any[] } }
  | { type: "COLLABORATORS_UPDATED"; payload: any[] }
  | {
      type: "CURSOR_UPDATED";
      payload: { userId: string; cursor: { x: number; y: number } };
    }
  | { type: "LEAVE_ROOM" }
  | { type: "CLEAR_ERROR" };

interface CollabContextType {
  state: CollabState;
  joinRoom: (roomId: string, userName: string) => void;
  leaveRoom: () => void;
  sendOperation: (operation: any) => void;
  updateCursor: (cursor: { x: number; y: number }) => void;
  updateDrawingStatus: (isDrawing: boolean, elementId?: string) => void;
  clearError: () => void;
}

const initialState: CollabState = {
  isConnected: false,
  isConnecting: false,
  isCollaborating: false,
  roomId: null,
  userId: null,
  collaborators: [],
  socket: null,
  error: null,
};

const collabReducer = (
  state: CollabState,
  action: CollabAction
): CollabState => {
  switch (action.type) {
    case "SOCKET_CONNECTING":
      return {
        ...state,
        isConnecting: true,
        error: null,
      };

    case "SOCKET_CONNECTED":
      return {
        ...state,
        isConnected: true,
        isConnecting: false,
        socket: action.payload,
        error: null,
      };

    case "SOCKET_DISCONNECTED":
      return {
        ...state,
        isConnected: false,
        isConnecting: false,
        isCollaborating: false,
        socket: null,
        roomId: null,
        userId: null,
        collaborators: [],
        error: null,
      };

    case "SOCKET_ERROR":
      return {
        ...state,
        isConnecting: false,
        error: action.payload,
      };

    case "JOINING_ROOM":
      return {
        ...state,
        roomId: action.payload.roomId,
        userId: action.payload.userId,
        error: null,
      };

    case "ROOM_JOINED":
      return {
        ...state,
        isCollaborating: true,
        collaborators: action.payload.collaborators,
        error: null,
      };

    case "COLLABORATORS_UPDATED":
      return {
        ...state,
        collaborators: action.payload,
      };

    case "CURSOR_UPDATED":
      return {
        ...state,
        collaborators: state.collaborators.map((collab) =>
          collab.id === action.payload.userId
            ? { ...collab, cursor: action.payload.cursor }
            : collab
        ),
      };

    case "LEAVE_ROOM":
      return {
        ...state,
        isCollaborating: false,
        roomId: null,
        userId: null,
        collaborators: [],
      };

    case "CLEAR_ERROR":
      return {
        ...state,
        error: null,
      };

    default:
      return state;
  }
};

export const CollabContext = React.createContext<CollabContextType | null>(
  null
);

export const CollabProvider = ({ children }: { children: React.ReactNode }) => {
  const [state, dispatch] = useReducer(collabReducer, initialState);

  useEffect(() => {
    dispatch({ type: "SOCKET_CONNECTING" });

    const socket = io(be_url, {
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      console.log("Socket connected:", socket.id);
      dispatch({ type: "SOCKET_CONNECTED", payload: socket });
    });

    socket.on("disconnect", (reason) => {
      console.log("Socket disconnected:", reason);
      dispatch({ type: "SOCKET_DISCONNECTED" });
    });

    socket.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
      dispatch({ type: "SOCKET_ERROR", payload: error.message });
    });

    // colaboration events
    socket.on("room_joined", (data) => {
      console.log("Joined room:", data);
      dispatch({
        type: "ROOM_JOINED",
        payload: {
          collaborators: data.collaborators || [],
          elements: data.elements || [],
        },
      });

      // Dispatch custom event for CanvasBoard to handle elements
      window.dispatchEvent(new CustomEvent("room_joined", { detail: data }));
    });

    socket.on("collaborators_updated", (collaborators) => {
      console.log("Collaborators updated:", collaborators);
      dispatch({ type: "COLLABORATORS_UPDATED", payload: collaborators });
    });

    socket.on("cursor_moved", ({ userId, position }) => {
      dispatch({
        type: "CURSOR_UPDATED",
        payload: { userId, cursor: position },
      });
    });

    socket.on("operation_applied", (data) => {
      // Dispatch custom event for drawing components to handle
      window.dispatchEvent(
        new CustomEvent("collab_operation", { detail: data })
      );
    });

    // Handle laser tool events
    socket.on("laser_point", ({ userId, point, timestamp }) => {
      if (userId !== state.userId) {
        window.dispatchEvent(
          new CustomEvent("collab_laser_point", {
            detail: { userId, point, timestamp },
          })
        );
      }
    });

    socket.on("laser_clear", ({ userId }) => {
      if (userId !== state.userId) {
        window.dispatchEvent(
          new CustomEvent("collab_laser_clear", {
            detail: { userId },
          })
        );
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const joinRoom = (roomId: string, userName: string) => {
    if (!state.socket || !state.isConnected) {
      console.error("Socket not connected");
      return;
    }
    const userId = `user_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 8)}`;
    const userColor = getRandomColor();

    dispatch({ type: "JOINING_ROOM", payload: { roomId, userId } });

    const _socket = state.socket;
    _socket.emit("join_room", {
      roomId,
      user: {
        id: userId,
        name: userName || `Anonymous ${userId.slice(-4)}`,
        color: userColor,
      },
    });
  };

  const leaveRoom = () => {
    if (state.socket && state.roomId) {
      state.socket.emit("leave_room", { roomId: state.roomId });
    }
    dispatch({ type: "LEAVE_ROOM" });
  };

  const sendOperation = (operation: any) => {
    if (!state.socket || !state.roomId || !state.isCollaborating) {
      console.warn("Cannot send operation: not in collaboration mode", {
        hasSocket: !!state.socket,
        roomId: state.roomId,
        isCollaborating: state.isCollaborating,
      });
      return;
    }

    console.log("Sending operation:", operation.type, operation);

    state.socket.emit("drawing_operation", {
      roomId: state.roomId,
      operation: {
        ...operation,
        userId: state.userId,
        timestamp: Date.now(),
      },
    });
  };

  const updateCursor = (cursor: { x: number; y: number }) => {
    if (!state.socket || !state.roomId || !state.isCollaborating) {
      return;
    }

    // Throttle cursor updates
    if (
      (updateCursor as any).lastUpdate &&
      Date.now() - (updateCursor as any).lastUpdate < 50
    ) {
      return;
    }
    (updateCursor as any).lastUpdate = Date.now();

    state.socket.emit("cursor_update", {
      roomId: state.roomId,
      position: cursor,
    });
  };

  const updateDrawingStatus = (isDrawing: boolean, elementId?: string) => {
    // This function can be used to track drawing status for collaborators
    // For now, it's a placeholder - you could emit socket events here if needed
    console.log("Drawing status updated:", { isDrawing, elementId });
  };

  const clearError = () => {
    dispatch({ type: "CLEAR_ERROR" });
  };

  const contextValue: CollabContextType = {
    state,
    joinRoom,
    leaveRoom,
    sendOperation,
    updateCursor,
    updateDrawingStatus,
    clearError,
  };

  return (
    <CollabContext.Provider value={contextValue}>
      {children}
    </CollabContext.Provider>
  );
};

// Custom hook with error handling
export const useCollab = () => {
  const context = useContext(CollabContext);
  if (!context) {
    throw new Error("useCollab must be used within a CollabProvider");
  }
  return context;
};

const getRandomColor = () => {
  const colors = [
    "#ff6b6b",
    "#4ecdc4",
    "#45b7d1",
    "#96ceb4",
    "#feca57",
    "#ff9ff3",
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};
