import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface JoinRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJoinRoom: (user: { id: string; name: string }) => void;
  roomId: string;
  roomName?: string;
}

export function JoinRoomModal({ isOpen, onClose, onJoinRoom, roomId, roomName }: JoinRoomModalProps) {
  const [userName, setUserName] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  const joinRoom = async () => {
    if (!userName.trim()) {
      alert('Please enter your name');
      return;
    }

    setIsJoining(true);
    try {
      // Generate a simple user ID
      const userId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const user = {
        id: userId,
        name: userName.trim()
      };

      // Store user info in localStorage for this session
      localStorage.setItem('collaborative-user', JSON.stringify(user));
      
      onJoinRoom(user);
      handleClose();
    } catch (error) {
      console.error('Error joining room:', error);
      alert('Failed to join room. Please try again.');
    } finally {
      setIsJoining(false);
    }
  };

  const handleClose = () => {
    setUserName('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Join Collaboration</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {roomName && (
            <div>
              <Label>Room Name</Label>
              <Input value={roomName} readOnly className="mt-1 bg-gray-50" />
            </div>
          )}
          <div>
            <Label htmlFor="userName">Your Name</Label>
            <Input
              id="userName"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Enter your name..."
              className="mt-1"
              maxLength={50}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isJoining && userName.trim()) {
                  joinRoom();
                }
              }}
              autoFocus
            />
          </div>
          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button 
              onClick={joinRoom} 
              disabled={isJoining || !userName.trim()}
            >
              {isJoining ? 'Joining...' : 'Join Room'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}