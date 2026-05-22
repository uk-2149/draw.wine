import Redis from "ioredis";
import { redis_url } from "../constants";
export class RedisService {
  private static client: Redis | null = null;
  private static subscriber: Redis | null = null;

  static async connect() {
    if (this.client) {
      return;
    }
    this.client = new Redis(redis_url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      lazyConnect: true,
      family: 6, // Force IPv6 – IPv4 route to Redis Cloud is unreachable from this network
    });

    this.subscriber = this.client.duplicate();
    await Promise.all([this.client.connect(), this.subscriber.connect()]);
  }

  static async getClient() {
    if (!this.client) {
      throw new Error("Redis client is not connected. Call connect() first.");
    }
    return this.client;
  }
  static async getSubscriber() {
    if (!this.subscriber) {
      throw new Error(
        "Redis subscriber is not connected. Call connect() first.",
      );
    }
    return this.subscriber;
  }
}
