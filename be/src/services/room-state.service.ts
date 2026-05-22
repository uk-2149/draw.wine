import { Room } from "../types";
import { tierConfig } from "../constants";
import { RedisService } from "./redis.service";

const getDynamicTtl = (room?: Room | null): number => {
  if (room && room.expiresAt) {
    const remaining = Math.max(1, Math.floor((room.expiresAt - Date.now()) / 1000));
    return remaining;
  }
  return tierConfig.roomTtlSeconds;
};

const SNAPSHOT_KEY = (id: string) => `room:${id}:snapshot`;
const OPS_KEY = (id: string) => `room:${id}:ops`;
export class RoomStateManager {
  static async getRoom(roomId: string): Promise<Room | null> {
    const client = await RedisService.getClient();
    const raw = await client.get(SNAPSHOT_KEY(roomId));
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as Room;
  }
  static async setRoom(roomId: string, room: Room): Promise<void> {
    const client = await RedisService.getClient();
    await client.set(
      SNAPSHOT_KEY(roomId),
      JSON.stringify(room),
      "EX",
      getDynamicTtl(room),
    );
  }
  static async deleteRoom(roomId: string): Promise<void> {
    const client = await RedisService.getClient();
    await client.del(SNAPSHOT_KEY(roomId));
    await client.del(OPS_KEY(roomId));
  }
  static async appendOp(roomId: string, op: any, maxOps = 1000): Promise<void> {
    const client = await RedisService.getClient();
    const raw = JSON.stringify(op);
    const room = await this.getRoom(roomId);
    if (!room) return;
    
    await client.lpush(OPS_KEY(roomId), raw); // Add to the head of the list
    await client.ltrim(OPS_KEY(roomId), 0, maxOps - 1); // Keep only the latest maxOps operations
    await client.expire(OPS_KEY(roomId), getDynamicTtl(room)); // Reset TTL on each operation
  }
  static async atomicUpdate(
    roomId: string,
    updateFn: (room: Room | null) => Promise<Room> | Room | null,
    maxRetries = 5,
  ): Promise<Room | null> {
    const client = await RedisService.getClient();
    const key = SNAPSHOT_KEY(roomId);

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      await client.watch(key);
      const raw = await client.get(key);
      const room: Room | null = raw ? (JSON.parse(raw) as Room) : null;

      const updated = await updateFn(room);
      const multi = client.multi();

      if (updated !== null) {
        multi.set(key, JSON.stringify(updated), "EX", getDynamicTtl(updated));
      } else {
        multi.del(key);
      }
      const result = await multi.exec();
      if (result === null) continue; // Retry if the transaction failed due to a concurrent modification
      return updated;
    }
    throw new Error("atomicUpdate : max retries exceeded");
  }

  /**
   * Check if a room has exceeded its tier-based lifetime.
   * Returns true if the room is expired based on createdAt + configured TTL.
   */
  static async isRoomExpired(roomId: string): Promise<boolean> {
    const room = await this.getRoom(roomId);
    if (!room) return true; // no room ⇒ treat as expired
    const expiresAt = room.expiresAt ?? room.createdAt + tierConfig.roomTtlSeconds * 1000;
    return Date.now() >= expiresAt;
  }

  /**
   * Returns the number of seconds remaining before the room expires.
   * Returns 0 if expired or room not found.
   */
  static async getRoomTimeRemaining(roomId: string): Promise<number> {
    const room = await this.getRoom(roomId);
    if (!room) return 0;
    const expiresAt = room.expiresAt ?? room.createdAt + tierConfig.roomTtlSeconds * 1000;
    const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
    return remaining;
  }
}

