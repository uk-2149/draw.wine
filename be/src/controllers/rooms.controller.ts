import { Request, Response } from "express";
import { verifyJWT } from "../utils/jwt";
import { v4 as uuidv4 } from 'uuid';
import { httpServer } from "../index";
import type { RoomState } from "../types";
import { CollabDrawingServer } from "../services/socket.service";

export const CreateRoom = async (req: Request, res: Response) => {
    try {
        const { name, isPublic = true } = req.body;
        const token = req.cookies.token;
        const userId = verifyJWT(token, "access") as string;

        const roomId = uuidv4();

        // Save the room in the database
        
        const roomState: RoomState = {
            id: roomId,
            elements: {},
            collaborators: [],
            lastModified: Date.now(),
            version: 0
        }

        CollabDrawingServer.getInstance(httpServer).roomStates.set(roomId, roomState);

        res.status(201).json({ 
            roomId, 
            name: name.trim(), 
            isPublic,
            createdBy: userId,
            createdAt: new Date().toISOString()
        });

    } catch (error) {
        console.error("Error creating room:", error);
        res.status(500).json({ error: "Failed to create room" });
    }
}

export const getRoomInfo = async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;

    if (!roomId || typeof roomId !== 'string') {
      return res.status(400).json({ error: 'Invalid room ID' });
    }

    // Get room from db

    // mock (will be changed later)
    res.json({
      roomId,
      name: `Room ${roomId.slice(-8)}`,
      isPublic: true,
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting room info:', error);
    res.status(500).json({ error: 'Failed to get room info' });
  }
}