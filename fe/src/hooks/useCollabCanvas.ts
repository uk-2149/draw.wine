import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { Element, Position } from '@/types/index';
import { useCollab } from '@/contexts/CollabContext';

interface CollaborativeOperation {
  id: string;
  type: 'element_start' | 'element_update' | 'element_complete' | 'element_delete' | 'element_transform';
  elementId: string;
  authorId: string;
  timestamp: number;
  roomId: string;
  data: any;
  isTemporary?: boolean;
  serverId?: string; // Added for internal server dedup, ignored by client
}

interface Collaborator {
  id: string;
  name: string;
  color: string;
  cursor?: Position;
  isDrawing?: boolean;
  currentElementId?: string;
  joinedAt: number;
}

export const useCollaborativeCanvas = (roomId: string | null, userId: string | null) => {
  const [elements, setElements] = useState<Element[]>([]);
  const [collaborators, setCollaborators] = useState<Map<string, Collaborator>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  
  const socketRef = useRef<Socket | null>(null);
  const { state } = useCollab();

  useEffect(() => {
    if (!roomId || !userId || !state.currentUser || !state.currentRoom) {
      console.warn('Cannot connect to socket: Missing required data', {
        roomId,
        userId,
        hasCurrentUser: !!state.currentUser,
        hasCurrentRoom: !!state.currentRoom,
      });
      return;
    }

    console.log('Connecting to collaboration server...', {
      roomId,
      userId,
      userName: state.currentUser.name,
    });

    const socket = io('ws://localhost:3000', {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      auth: {
        roomId,
        userId,
        userName: state.currentUser.name,
      },
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to collaborative server', { roomId, userId });
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      console.log('Disconnected from collaborative server');
    });

    socket.on('connect_error', (error) => {
      console.error('Connection error:', error.message);
      setIsConnected(false);
    });

    socket.on('room-state', (data: { elements: Element[], collaborators: Collaborator[], version?: number }) => {
      console.log('Received room state:', data);
      setElements(data.elements || []);
      setCollaborators(new Map(data.collaborators?.map(c => [c.id, c]) || []));
    });

    socket.on('room-state-sync', (data: { elements: Element[], collaborators: Collaborator[], version?: number }) => {
      console.log('Received room state sync:', data);
      setElements(data.elements || []);
      setCollaborators(new Map(data.collaborators?.map(c => [c.id, c]) || []));
    });

    socket.on('operation', (operation: CollaborativeOperation) => {
      console.log('Received operation:', operation);
      handleRemoteOperation(operation);
    });

    socket.on('operations_batch', (operations: CollaborativeOperation[]) => {
      console.log('Received operations batch:', operations);
      operations.forEach(op => handleRemoteOperation(op));
    });

    socket.on('collaborator-joined', (collaborator: Collaborator) => {
      console.log('Collaborator joined:', collaborator);
      setCollaborators(prev => {
        const updated = new Map(prev);
        updated.set(collaborator.id, collaborator);
        return updated;
      });
    });

    socket.on('collaborator-left', (collaboratorId: string) => {
      console.log('Collaborator left:', collaboratorId);
      setCollaborators(prev => {
        const updated = new Map(prev);
        updated.delete(collaboratorId);
        return updated;
      });
    });

    socket.on('collaborator-cursor', (data: { userId: string; position: Position; timestamp: number }) => {
      setCollaborators(prev => {
        const collaborator = prev.get(data.userId);
        if (collaborator) {
          return new Map(prev.set(data.userId, { ...collaborator, cursor: data.position }));
        }
        return prev;
      });
    });

    socket.on('collaborator-drawing-status', (data: { userId: string; isDrawing: boolean; elementId?: string }) => {
      setCollaborators(prev => {
        const collaborator = prev.get(data.userId);
        if (collaborator) {
          return new Map(prev.set(data.userId, { 
            ...collaborator, 
            isDrawing: data.isDrawing,
            currentElementId: data.elementId 
          }));
        }
        return prev;
      });
    });

    return () => {
      console.log('Cleaning up socket connection');
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [roomId, userId, state.currentUser, state.currentRoom]);

  const handleRemoteOperation = useCallback((operation: CollaborativeOperation) => {
    if (operation.authorId === userId) {
      console.log('Ignoring own operation:', operation);
      return;
    }

    console.log('Processing remote operation:', operation);

    switch (operation.type) {
      case 'element_start':
        setElements(prev => {
          const existing = prev.find(el => el.id === operation.elementId);
          if (existing) {
            console.log('Element already exists, skipping:', operation.elementId);
            return prev;
          }
          const newElement = { 
            ...operation.data.element, 
            isTemporary: true, 
            authorId: operation.authorId 
          };
          console.log('Adding new element:', newElement);
          return [...prev, newElement];
        });
        break;

      case 'element_update':
        setElements(prev => {
          const updated = prev.map(el => 
            el.id === operation.elementId 
              ? { ...el, ...operation.data, lastModified: operation.timestamp }
              : el
          );
          console.log('Updated element:', operation.elementId, operation.data);
          return updated;
        });
        break;

      case 'element_complete':
        setElements(prev => {
          const updated = prev.map(el => 
            el.id === operation.elementId 
              ? { ...operation.data.element, isTemporary: false, authorId: operation.authorId }
              : el
          );
          console.log('Completed element:', operation.elementId);
          return updated;
        });
        break;

      case 'element_delete':
        setElements(prev => {
          const filtered = prev.filter(el => el.id !== operation.elementId);
          console.log('Deleted element:', operation.elementId);
          return filtered;
        });
        break;

      case 'element_transform':
        setElements(prev => {
          const updated = prev.map(el => 
            el.id === operation.elementId 
              ? { ...el, ...operation.data.transform, lastModified: operation.timestamp }
              : el
          );
          console.log('Transformed element:', operation.elementId, operation.data.transform);
          return updated;
        });
        break;

      default:
        console.warn('Unknown operation type:', operation.type);
    }
  }, [userId]);

  const sendOperation = useCallback((operation: Omit<CollaborativeOperation, 'id' | 'timestamp' | 'serverId'>) => {
    if (!socketRef.current || !isConnected || !userId || !roomId) {
      console.warn('Cannot send operation - not connected or missing data:', {
        hasSocket: !!socketRef.current,
        isConnected,
        userId,
        roomId,
      });
      return;
    }

    const fullOperation: CollaborativeOperation = {
      ...operation,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      roomId,
    };

    console.log('Sending operation:', fullOperation);
    socketRef.current.emit('operation', fullOperation);
  }, [isConnected, userId, roomId]);

  const updateCursor = useCallback((position: Position) => {
    if (socketRef.current && isConnected && userId) {
      socketRef.current.emit('cursor-update', {
        userId,
        position,
        timestamp: Date.now(),
      });
    }
  }, [isConnected, userId]);

  const updateDrawingStatus = useCallback((isDrawing: boolean, elementId?: string) => {
    if (socketRef.current && isConnected && userId) {
      socketRef.current.emit('drawing-status', {
        userId,
        isDrawing,
        elementId,
        timestamp: Date.now(),
      });
    }
  }, [isConnected, userId]);

  return {
    elements,
    setElements,
    collaborators: Array.from(collaborators.values()),
    isConnected,
    sendOperation,
    updateCursor,
    updateDrawingStatus,
    isCollaborating: !!roomId && !!state.currentRoom,
  };
};