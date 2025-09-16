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

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateRoomModal = ({ isOpen, onClose }: CreateRoomModalProps) => {
  const [roomName, setRoomName] = useState("");
  const [userName, setUserName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const navigate = useNavigate();

  const handleCreate = async () => {
    if (!roomName.trim() || !userName.trim()) return;

    setIsCreating(true);

    try {
      const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();

      console.log("Creating room:", roomId, "with name:", roomName.trim());

      // Navigate to collaboration room
      navigate(
        `/collab?room=${roomId}&name=${encodeURIComponent(userName.trim())}`
      );

      onClose();

      // Reset form
      setRoomName("");
      setUserName("");
    } catch (error) {
      console.error("Failed to create room:", error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create Collaboration Room</DialogTitle>
          <DialogDescription>
            Create a new room to collaborate with others in real-time.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="room-name" className="text-right">
              Room Name
            </Label>
            <Input
              id="room-name"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="My Drawing Room"
              className="col-span-3"
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
            onClick={handleCreate}
            disabled={!roomName.trim() || !userName.trim() || isCreating}
          >
            {isCreating ? "Creating..." : "Create Room"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
