import { Router, Response } from "express";
import {
  Connection,
  PublicKey,
  ParsedInstruction,
  PartiallyDecodedInstruction,
} from "@solana/web3.js";
import { AuthenticatedRequest } from "../middleware";
import { treasury_wallet } from "../constants";
import { TierService } from "../services/tier.service";
import { Logger } from "../helpers";

export const paymentRouter = Router();
const connection = new Connection("https://api.devnet.solana.com", "confirmed");

// Expected SOL amount for premium upgrade (e.g. 0.1 SOL)
const PREMIUM_UPGRADE_LAMPORTS = 100_000_000;

/**
 * @swagger
 * /api/payment/verify-upgrade:
 *   post:
 *     summary: Verify a Solana transaction to upgrade user to premium
 *     tags: [Payment]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [signature]
 *             properties:
 *               signature:
 *                 type: string
 *                 description: Transaction signature of the SOL transfer
 *     responses:
 *       200:
 *         description: Successfully upgraded to premium
 *       400:
 *         description: Invalid transaction, insufficient funds, or missing signature
 *       401:
 *         description: Unauthorized (missing JWT)
 *       500:
 *         description: Internal verification error
 */
paymentRouter.post(
  "/verify-upgrade",
  async (req: AuthenticatedRequest, res: Response): Promise<any> => {
    try {
      const walletAddress = req.walletAddress;
      const { signature } = req.body;

      if (!walletAddress) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      Logger.info("Wallet address:", walletAddress);

      if (!signature) {
        return res
          .status(400)
          .json({ error: "Transaction signature is required" });
      }

      Logger.info(
        `Verifying transaction ${signature} for wallet ${walletAddress}`,
      );

      // Wait slightly to ensure RPC node has the transaction
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Verify it's a transfer to our treasury wallet
      // Look at postBalances - preBalances to see net change for treasury
      const parsedTx = await connection.getParsedTransaction(signature, {
        maxSupportedTransactionVersion: 0,
        commitment: "confirmed",
      });

      if (!parsedTx || !parsedTx.meta) {
        return res.status(400).json({
          error: "Transaction not found or not confirmed",
        });
      }

      if (parsedTx.meta.err) {
        return res.status(400).json({
          error: "Transaction failed on-chain",
        });
      }

      const instructions = parsedTx.transaction.message.instructions;

      Logger.info("Instructions:", JSON.stringify(instructions, null, 2));

      const transferInstruction = instructions.find(
        (ix): ix is ParsedInstruction =>
          "parsed" in ix &&
          ix.program === "system" &&
          ix.parsed?.type === "transfer" &&
          ix.parsed?.info?.destination === treasury_wallet,
      );

      if (!transferInstruction) {
        return res.status(400).json({
          error: "No valid transfer to treasury wallet found",
        });
      }

      const sender = transferInstruction.parsed.info.source;

      if (sender !== walletAddress) {
        return res.status(400).json({
          error: "Transaction sender mismatch",
        });
      }

      const lamports = Number(transferInstruction.parsed.info.lamports);

      Logger.info("Transfer sender:", sender);
      Logger.info("Transfer amount:", lamports);

      if (lamports < PREMIUM_UPGRADE_LAMPORTS) {
        return res.status(400).json({
          error: "Insufficient payment",
          expected: PREMIUM_UPGRADE_LAMPORTS,
          received: lamports,
        });
      }

      // Upgrade the user
      await TierService.upgradeUserToPremium(walletAddress);

      return res.json({
        success: true,
        message: "Upgraded to Premium successfully",
      });
    } catch (error) {
      Logger.error("Failed to verify transaction:", error);
      return res.status(500).json({ error: "Internal verification error" });
    }
  },
);
