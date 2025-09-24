import { useCollab } from "@/contexts/CollabContext";
import { PlayGround } from "@/pages/PlayGround";
import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

export const CollabRoom = () => {
  const [searchParams] = useSearchParams();
  const roomId = searchParams.get("roomId") || generateRoomId();
  const userName = searchParams.get("name") || "Guest";
  const { joinRoom, state } = useCollab();

  useEffect(() => {
    if (roomId && state.isConnected) {
      joinRoom(roomId, userName);
    }
  }, [roomId, state.isConnected, joinRoom, userName]);

  if (!state.isConnected) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-2">Connecting to collaboration server...</p>
        </div>
      </div>
    );
  }

  return <PlayGround />;
};
function generateRoomId() {
  return Math.random().toString(36).substring(2, 8);
}
