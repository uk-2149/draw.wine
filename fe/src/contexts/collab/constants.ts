import type { CollabContextType, CollabState } from "./types";

export const defaultContextValue: CollabContextType | null = null;

export const initialState: CollabState = {
  isConnected: false,
  isConnecting: false,
  isCollaborating: false,
  roomId: null,
  userId: null,
  pendingOperation: null,
  collaborators: [],
  socket: null,
  error: null,
  hostId: null,
  settings: null,
  isWaitingForApproval: false,
  joinRejected: false,
  pendingJoinRequests: [],
};

const collaboratorColors = [
  "#ff6b6b", // red
  "#4ecdc4", // teal
  "#45b7d1", // blue
  "#96ceb4", // green
  "#feca57", // yellow-orange
  "#ff9ff3", // pink
  "#54a0ff", // light blue
  "#5f27cd", // purple
  "#01a3a4", // dark teal
  "#2ecc71", // emerald green
  "#e74c3c", // bright red
  "#f39c12", // orange
  "#8e44ad", // violet
  "#d35400", // pumpkin
  "#1abc9c", // turquoise
  "#3498db", // sky blue
  "#9b59b6", // lavender purple
  "#34495e", // dark slate
  "#16a085", // sea green
  "#27ae60", // jade green
  "#2980b9", // ocean blue
  "#c0392b", // crimson
  "#f1c40f", // sunflower yellow
];

export const getRandomColor = () => {
  return collaboratorColors[
    Math.floor(Math.random() * collaboratorColors.length)
  ];
};
