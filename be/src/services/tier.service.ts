import { RedisService } from "./redis.service";
import { getTierLimits, appMode } from "../constants/tier";
import { Logger } from "../helpers";

export class TierService {
  /**
   * Checks if a wallet is a premium user.
   */
  static async isPremiumUser(walletAddress?: string): Promise<boolean> {
    if (!walletAddress) {
      // Fallback to app mode for anonymous users (useful for dev environments where APP_MODE=premium)
      return appMode === "premium";
    }

    try {
      const client = await RedisService.getClient();
      const isPremium = await client.get(`premium_user:${walletAddress}`);
      
      if (isPremium === "true") return true;

      // Also fallback to app mode just in case
      return appMode === "premium";
    } catch (error) {
      Logger.error("Failed to check premium status:", error);
      return appMode === "premium";
    }
  }

  /**
   * Retrieves the current limits for a wallet.
   */
  static async getLimitsForUser(walletAddress?: string) {
    const isPremium = await this.isPremiumUser(walletAddress);
    return getTierLimits(isPremium);
  }

  /**
   * Upgrades a wallet to premium in Redis permanently.
   */
  static async upgradeUserToPremium(walletAddress: string): Promise<void> {
    try {
      const client = await RedisService.getClient();
      await client.set(`premium_user:${walletAddress}`, "true");
      Logger.success(`Wallet ${walletAddress} upgraded to Premium!`);
    } catch (error) {
      Logger.error(`Failed to upgrade wallet ${walletAddress} to premium:`, error);
      throw new Error("Failed to upgrade user");
    }
  }
}
