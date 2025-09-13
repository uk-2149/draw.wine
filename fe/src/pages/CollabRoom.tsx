import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { JoinRoomModal } from "../components/modals/JoinRoomModal";
import { PlayGround } from "./PlayGround";
import { useCollab } from "../contexts/CollabContext";
import axios from "axios";
import { useCollaborativeCanvas } from "../hooks/useCollabCanvas";

export default function CollabRoom() {
  const [searchParams] = useSearchParams();
  const roomId = searchParams.get("roomId");
  const navigate = useNavigate();
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [roomInfo, setRoomInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { state, dispatch } = useCollab();

  // Initialize useCollaborativeCanvas with roomId and userId
  const { elements, setElements, collaborators, isConnected, sendOperation, updateCursor, updateDrawingStatus, isCollaborating } = useCollaborativeCanvas(
    roomId,
    state.currentUser?.id || null
  );

  useEffect(() => {
    const initRoom = async () => {
      if (!roomId) {
        setError("No room ID provided in query parameters");
        setLoading(false);
        return;
      }

      try {
        // Fetch room info from backend
        const { data: room } = await axios.get(`http://localhost:3000/api/rooms/${roomId}`);
        if (!room || !room.id) {
          throw new Error("Invalid room data received");
        }
        setRoomInfo(room);

        // Check if user exists in localStorage for auto-join
        const savedUser = localStorage.getItem("collaborative-user");
        if (savedUser) {
          try {
            const user = JSON.parse(savedUser);
            if (!user.id || !user.name) {
              throw new Error("Invalid user data in localStorage");
            }

            dispatch({
              type: "START_COLLABORATION",
              payload: { room, user, isCreator: false },
            });

            console.log("User auto-joined:", user, room);
            setShowJoinModal(false);
          } catch (err) {
            console.error("Error parsing saved user:", err);
            localStorage.removeItem("collaborative-user"); // Clear invalid data
            setShowJoinModal(true);
          }
        } else {
          setShowJoinModal(true);
        }
      } catch (error) {
        console.error("Error fetching room info:", error);
        setError("Failed to load room. It may not exist or is inaccessible.");
        setShowJoinModal(true);
      } finally {
        setLoading(false);
      }
    };

    initRoom();
  }, [roomId, dispatch]);

  const handleJoinRoom = (user: { id: string; name: string }) => {
    if (!roomId) {
      setError("Cannot join room: No room ID provided");
      return;
    }

    if (!roomInfo) {
      setError("Cannot join room: Room information not available");
      return;
    }

    // Save user to localStorage for future auto-join
    localStorage.setItem("collaborative-user", JSON.stringify(user));

    dispatch({
      type: "START_COLLABORATION",
      payload: { room: roomInfo, user, isCreator: false },
    });

    setShowJoinModal(false);
    setError(null);

    console.log("User joined:", user, roomInfo);
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4">Loading room...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500">{error}</p>
          <button
            onClick={() => navigate("/")}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  if (showJoinModal) {
    return (
      <>
        <div className="h-screen w-full flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Join Collaboration</h2>
            <p className="text-gray-600 mb-4">
              Enter your name to join this collaborative drawing session
            </p>
          </div>
        </div>
        <JoinRoomModal
          isOpen={showJoinModal}
          onClose={() => navigate("/")}
          onJoinRoom={handleJoinRoom}
          roomId={roomId!}
          roomName={roomInfo?.name || `Room ${roomId.slice(-8)}`}
        />
      </>
    );
  }

  // Render playground only if collaboration is fully initialized
  if (isCollaborating && state.currentUser && state.currentRoom && isConnected) {
    return (
      <PlayGround />
    );
  }

  // Fallback for unexpected state
  return (
    <div className="h-screen w-full flex items-center justify-center">
      <div className="text-center">
        <p>Unable to join room. Please try again.</p>
        <button
          onClick={() => navigate("/")}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Go Home
        </button>
      </div>
    </div>
  );
}