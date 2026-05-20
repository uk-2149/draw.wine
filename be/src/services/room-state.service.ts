import { Room } from "../types";
import { RedisService } from "./redis.service";

const ROOM_TTL = 24 * 60 * 60; // 24h
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
      ROOM_TTL,
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
    await client.lpush(OPS_KEY(roomId), raw); // Add to the head of the list
    await client.ltrim(OPS_KEY(roomId), 0, maxOps - 1); // Keep only the latest maxOps operations
    await client.expire(OPS_KEY(roomId), ROOM_TTL); // Reset TTL on each operation
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
        multi.set(key, JSON.stringify(updated), "EX", ROOM_TTL);
      } else {
        multi.del(key);
      }
      const result = await multi.exec();
      if (result === null) continue; // Retry if the transaction failed due to a concurrent modification
      return updated;
    }
    throw new Error("atomicUpdate : max retries exceeded");
  }
}
