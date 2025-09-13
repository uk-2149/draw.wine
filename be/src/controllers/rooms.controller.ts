import { Request, Response } from "express";
import { generateToken, verifyJWT } from "../utils/jwt";
import { v4 as uuidv4 } from 'uuid';
import { httpServer } from "../index";
import type { RoomState } from "../types";
import { CollabDrawingServer } from "../services/socket.service";

export const CreateRoom = async (req: Request, res: Response) => {
    try {
        const { username, name, isPublic = true } = req.body;
        const userId = uuidv4();
        const token = generateToken(username);

        // Store username and userId in cookie as JSON string
        res.cookie('user', JSON.stringify({ token, userId }), {
          httpOnly: true,
          secure: true,
          sameSite: 'none',
          maxAge: 24 * 60 * 60 * 1000, // 1 day
        });

        const roomId = uuidv4();

        // Save the room in the database
        const roomState: RoomState = {
            id: roomId,
            name: name.trim(),
            elements: {},
            collaborators: [],
            isPublic: isPublic,
            lastModified: Date.now(),
            createdBy: username,
            createdAt: new Date().toISOString(),
            version: 0
        };

        CollabDrawingServer.getInstance(httpServer).roomStates.set(roomId, roomState);
        CollabDrawingServer.getInstance(httpServer).roomConnections.set(roomId, new Set())

        res.status(201).json({ 
            id: roomId, 
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
    const server = CollabDrawingServer.getInstance(httpServer);
    const roomState = server.roomStates.get(roomId);

    if (!roomState) {
      return res.status(404).json({ error: "Room not found" });
    }

    res.json({
      id: roomState.id,
      name: roomState.name,
      isPublic: roomState.isPublic,
      createdBy: roomState.createdBy,
      createdAt: roomState.createdAt,
      collaborators: roomState.collaborators,
      connectionCount: server.roomConnections.get(roomId)?.size || 0
    });
  } catch (error) {
    console.error("Error getting room info:", error);
    res.status(500).json({ error: "Failed to get room info" });
  }
};
