import { use, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, Check } from 'lucide-react';
import type { Room } from '@/types/index';
import axios from 'axios';
import { useCollab } from '@/contexts/CollabContext';

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRoomCreated: (room: Room, user: { id: string; name: string }, isCreator: boolean) => void;
}

export function CreateRoomModal({ isOpen, onClose, onRoomCreated }: CreateRoomModalProps) {
  const [roomName, setRoomName] = useState('');
  const [userName, setUserName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createdRoom, setCreatedRoom] = useState<Room | null>(null);
  const [createdUser, setCreatedUser] = useState<{ id: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const { state } = useCollab();

  const createRoom = async () => {
    if (!roomName.trim() || !userName.trim()) {
      alert('Please enter both room name and your name');
      return;
    }

    setIsCreating(true);
    try {
      const response = await axios.post('http://localhost:3000/api/rooms', {
          name: roomName.trim(),
          username: userName.trim(),
          isPublic: true
      })

      if (!response) {
        throw new Error('Failed to create room');
      }

      console.log('Room created:', response.data);

      const roomData = await response.data;
      const room: Room = {
        ...roomData,
        inviteLink: `${window.location.origin}/collab?roomId=${roomData.id}`
      };

      const user = {
        id: roomData.createdBy,
        name: userName.trim()
      };

      setCreatedRoom(room);
      setCreatedUser(user);
      onRoomCreated(room, user, true); // isCreator = true

      console.log(state.collaborators);

    } catch (error) {
      console.error('Error creating room:', error);
      alert('Failed to create room. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const copyInviteLink = async () => {
    if (createdRoom?.inviteLink) {
      try {
        await navigator.clipboard.writeText(createdRoom.inviteLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (error) {
        console.error('Failed to copy:', error);
        const textArea = document.createElement('textarea');
        textArea.value = createdRoom.inviteLink;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  };

  const startCollaboration = () => {
    onClose();
  };

  const handleClose = () => {
    setRoomName('');
    setUserName('');
    setCreatedRoom(null);
    setCreatedUser(null);
    setCopied(false);
    onClose();
  };

  // Rest of the component remains the same...
  if (createdRoom && createdUser) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Room Created Successfully!</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Room Name</Label>
              <Input value={createdRoom.name} readOnly className="mt-1" />
            </div>
            <div>
              <Label>Your Name</Label>
              <Input value={createdUser.name} readOnly className="mt-1" />
            </div>
            <div>
              <Label>Invite Link</Label>
              <div className="flex mt-1">
                <Input
                  value={createdRoom.inviteLink}
                  readOnly
                  className="flex-1 rounded-r-none"
                />
                <Button
                  onClick={copyInviteLink}
                  variant="outline"
                  className="rounded-l-none border-l-0"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Share this link with others to invite them to collaborate
              </p>
            </div>
            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={handleClose}>
                Close
              </Button>
              <Button onClick={startCollaboration}>
                Start Collaborating
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Start Collaboration</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="userName">Your Name</Label>
            <Input
              id="userName"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Enter your name..."
              className="mt-1"
              maxLength={50}
            />
          </div>
          <div>
            <Label htmlFor="roomName">Room Name</Label>
            <Input
              id="roomName"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="Enter room name..."
              className="mt-1"
              maxLength={100}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isCreating && roomName.trim() && userName.trim()) {
                  createRoom();
                }
              }}
            />
          </div>
          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button 
              onClick={createRoom} 
              disabled={isCreating || !roomName.trim() || !userName.trim()}
            >
              {isCreating ? 'Creating...' : 'Create Room'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}