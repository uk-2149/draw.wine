import { RedisService } from "./redis.service";
import { tierConfig } from "../constants";
import { Logger } from "../helpers";

/**
 * Redis-backed AI usage tracker.
 * Tracks per-identifier (IP) AI requests on a calendar-month basis.
 * Key pattern: ai_quota:<identifier>:<YYYY-MM>
 */
export class AiQuotaService {
  private static getMonthKey(identifier: string): string {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return `ai_quota:${identifier}:${month}`;
  }

  /**
   * Returns seconds until the end of the current calendar month.
   */
  private static getMonthTtlSeconds(): number {
    const now = new Date();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0);
    return Math.ceil((endOfMonth.getTime() - now.getTime()) / 1000) + 86400; // +1 day safety margin
  }

  /**
   * Check quota and increment usage. Returns whether the request is allowed.
   */
  static async checkAndIncrement(identifier: string, limit: number): Promise<{
    allowed: boolean;
    used: number;
    limit: number;
    remaining: number;
  }> {
    const key = this.getMonthKey(identifier);

    try {
      const client = await RedisService.getClient();
      const currentStr = await client.get(key);
      const current = currentStr ? parseInt(currentStr, 10) : 0;

      if (current >= limit) {
        Logger.info(`[AiQuota] Quota exhausted for ${identifier}: ${current}/${limit}`);
        return { allowed: false, used: current, limit, remaining: 0 };
      }

      // Increment and set TTL
      const newCount = await client.incr(key);
      // Set expiry only on first increment (when key was just created)
      if (newCount === 1) {
        await client.expire(key, this.getMonthTtlSeconds());
      }

      const remaining = Math.max(0, limit - newCount);
      return { allowed: true, used: newCount, limit, remaining };
    } catch (error) {
      Logger.error("[AiQuota] Error checking quota:", error);
      // Fail open — allow the request if Redis is unavailable
      return { allowed: true, used: 0, limit, remaining: limit };
    }
  }

  /**
   * Get current usage without incrementing.
   */
  static async getUsage(identifier: string, limit: number = 50): Promise<{
    used: number;
    limit: number;
    remaining: number;
  }> {
    const key = this.getMonthKey(identifier);

    try {
      const client = await RedisService.getClient();
      const currentStr = await client.get(key);
      const used = currentStr ? parseInt(currentStr, 10) : 0;
      return { used, limit, remaining: Math.max(0, limit - used) };
    } catch (error) {
      Logger.error("[AiQuota] Error getting usage:", error);
      return { used: 0, limit, remaining: limit };
    }
  }
}
