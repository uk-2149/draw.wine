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
import { Copy, Check } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateRoomModal = ({ isOpen, onClose }: CreateRoomModalProps) => {
  const [roomName, setRoomName] = useState("");
  const [userName, setUserName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedRoomId, setCopiedRoomId] = useState(false);
  const navigate = useNavigate();

  const handleCreate = async () => {
    if (!roomName.trim() || !userName.trim()) return;

    setIsCreating(true);

    try {
      const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
      setRoomId(newRoomId);

      console.log("Creating room:", newRoomId, "with name:", roomName.trim());
    } catch (error) {
      console.error("Failed to create room:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleStartCollab = () => {
    if (!roomId) return;

    // Navigate to collaboration room
    navigate(`/collab?room=${roomId}&name=${encodeURIComponent(userName.trim())}`);

    // Reset form
    setRoomName("");
    setUserName("");
  };

  const handleCopyInvite = async () => {
    if (!roomId) return;
    const inviteUrl = `${window.location.origin}/collab?room=${roomId}&name=`;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyRoomId = async () => {
    if (!roomId) return;
    await navigator.clipboard.writeText(roomId);
    setCopiedRoomId(true);
    setTimeout(() => setCopiedRoomId(false), 2000);
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

          {/* oomId + invite link */}
          {roomId && (
            <>
              {/* Room ID field */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="room-id" className="text-right">
                  Room ID
                </Label>
                <div className="col-span-3 flex items-center gap-2">
                  <Input id="room-id" readOnly value={roomId} className="flex-1" />
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="icon" variant="outline" onClick={handleCopyRoomId}>
                          {copiedRoomId ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{copiedRoomId ? "Copied!" : "Copy Room ID"}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>

              {/* Invite Link field */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="invite-link" className="text-right">
                  Invite Link
                </Label>
                <div className="col-span-3 flex items-center gap-2">
                  <Input
                    id="invite-link"
                    readOnly
                    value={`${window.location.origin}/collab?room=${roomId}&name=`}
                    className="flex-1"
                  />
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="icon" variant="outline" onClick={handleCopyInvite}>
                          {copied ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{copied ? "Copied!" : "Copy link"}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>

          {roomId ? (
            <Button onClick={handleStartCollab}>Start Collaboration</Button>
          ) : (
            <Button
              onClick={handleCreate}
              disabled={!roomName.trim() || !userName.trim() || isCreating}
            >
              {isCreating ? "Creating..." : "Create Room"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
