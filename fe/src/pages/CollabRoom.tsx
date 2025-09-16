import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { PlayGround } from "./PlayGround";
import { useCollab } from "@/contexts/CollabContext";

const CollabRoom = () => {
  const [searchParams] = useSearchParams();
  const roomId = searchParams.get("room") || generateRoomId();
  const userName = searchParams.get("name") || "Anonymous User";
  const { state, joinRoom } = useCollab();

  useEffect(() => {
    if (roomId && state.isConnected && !state.isCollaborating) {
      console.log("Joining room:", roomId, "with name:", userName);
      joinRoom(roomId, userName);
    }
  }, [roomId, userName, state.isConnected, state.isCollaborating, joinRoom]);

  // Show loading state while connecting
  if (!state.isConnected) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-2 text-gray-600">
            Connecting to collaboration server...
          </p>
          {state.error && (
            <p className="mt-2 text-red-500 text-sm">Error: {state.error}</p>
          )}
        </div>
      </div>
    );
  }

  // Show joining state
  if (state.isConnected && !state.isCollaborating) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse rounded-full h-8 w-8 border-2 border-green-500 mx-auto"></div>
          <p className="mt-2 text-gray-600">Joining room: {roomId}...</p>
        </div>
      </div>
    );
  }

  return <PlayGround />;
};

function generateRoomId(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export default CollabRoom;
