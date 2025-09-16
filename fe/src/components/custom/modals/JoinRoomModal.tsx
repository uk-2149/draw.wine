import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";

interface JoinRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const JoinRoomModal = ({ isOpen, onClose }: JoinRoomModalProps) => {
  const [roomId, setRoomId] = useState("");
  const [userName, setUserName] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const navigate = useNavigate();

  const handleJoin = async () => {
    if (!roomId.trim() || !userName.trim()) return;

    setIsJoining(true);

    try {
      console.log("Joining room:", roomId.trim(), "as user:", userName.trim());

      // Navigate to collaboration room
      navigate(
        `/collab?room=${roomId.trim().toUpperCase()}&name=${encodeURIComponent(
          userName.trim()
        )}`
      );

      onClose();

      // Reset form
      setRoomId("");
      setUserName("");
    } catch (error) {
      console.error("Failed to join room:", error);
    } finally {
      setIsJoining(false);
    }
  };

  const handleRoomIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Convert to uppercase and limit to 6 characters (typical room ID format)
    const value = e.target.value.toUpperCase().slice(0, 6);
    setRoomId(value);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Join Collaboration Room</DialogTitle>
          <DialogDescription>
            Enter a room ID to join an existing collaboration session.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="room-id" className="text-right">
              Room ID
            </Label>
            <Input
              id="room-id"
              value={roomId}
              onChange={handleRoomIdChange}
              placeholder="ABC123"
              className="col-span-3"
              maxLength={6}
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="user-name" className="text-right">
              Your Name
            </Label>
            <Input
              id="user-name"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Anonymous Artist"
              className="col-span-3"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleJoin}
            disabled={!roomId.trim() || !userName.trim() || isJoining}
          >
            {isJoining ? "Joining..." : "Join Room"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
