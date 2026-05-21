import { Server as SocketServer } from "socket.io";
import { Logger } from "../helpers";
import { RoomStateManager } from "./room-state.service";

const CHECK_INTERVAL_MS = 30_000; // 30 seconds

/**
 * Periodically checks active Socket.IO rooms for expiry.
 * When a room has exceeded its tier-based TTL, notifies all
 * connected clients and forces them out of the room.
 */
export class RoomExpiryService {
  private intervalId: ReturnType<typeof setInterval> | null = null;

  start(io: SocketServer): void {
    if (this.intervalId) return; // already running

    Logger.info("[RoomExpiry] Starting room expiry checker...");

    this.intervalId = setInterval(async () => {
      try {
        await this.checkRooms(io);
      } catch (error) {
        Logger.error("[RoomExpiry] Error during room expiry check:", error);
      }
    }, CHECK_INTERVAL_MS);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      Logger.info("[RoomExpiry] Stopped room expiry checker.");
    }
  }

  private async checkRooms(io: SocketServer): Promise<void> {
    // Iterate all Socket.IO rooms (skip per-socket rooms)
    const rooms = io.sockets.adapter.rooms;

    for (const [roomId, socketIds] of rooms.entries()) {
      // Socket.IO creates a room per socket.id — skip those
      if (socketIds.size === 1 && socketIds.has(roomId)) continue;

      const expired = await RoomStateManager.isRoomExpired(roomId);
      if (!expired) continue;

      Logger.info(
        `[RoomExpiry] Room ${roomId} has expired. Notifying ${socketIds.size} client(s).`,
      );

      // Notify all sockets in the room
      io.to(roomId).emit("room_expired", { roomId });

      // Force all sockets to leave the room
      for (const socketId of socketIds) {
        const socket = io.sockets.sockets.get(socketId);
        if (socket) {
          socket.leave(roomId);
        }
      }

      // Clean up Redis state
      await RoomStateManager.deleteRoom(roomId);
    }
  }
}

export const roomExpiryService = new RoomExpiryService();
