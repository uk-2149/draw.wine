import { Router, Request, Response } from "express";
import crypto from "crypto";
import nacl from "tweetnacl";
import bs58 from "bs58";
import jwt from "jsonwebtoken";
import { RedisService } from "../services";
import { jwt_secret } from "../constants";
import { Logger } from "../helpers";

export const authRouter = Router();

/**
 * @swagger
 * /api/auth/nonce:
 *   post:
 *     summary: Generate an authentication nonce for Solana wallet login
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [publicKey]
 *             properties:
 *               publicKey:
 *                 type: string
 *                 description: The base58 encoded Solana public key
 *     responses:
 *       200:
 *         description: Successfully generated a nonce
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 nonce:
 *                   type: string
 *       400:
 *         description: Missing publicKey
 */
authRouter.post("/nonce", async (req: Request, res: Response): Promise<any> => {
  try {
    const { publicKey } = req.body;
    if (!publicKey) {
      return res.status(400).json({ error: "publicKey is required" });
    }

    const nonce = crypto.randomBytes(32).toString("hex");
    const key = `auth_nonce:${publicKey}`;
    
    const client = await RedisService.getClient();
    await client.setex(key, 300, nonce); // 5 minute expiration

    res.json({ nonce });
  } catch (error) {
    Logger.error("Failed to generate nonce:", error);
    res.status(500).json({ error: "Failed to generate nonce" });
  }
});

/**
 * @swagger
 * /api/auth/verify:
 *   post:
 *     summary: Verify wallet signature and issue JWT
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [publicKey, signature, message]
 *             properties:
 *               publicKey:
 *                 type: string
 *               signature:
 *                 type: string
 *                 description: Base58 encoded signature of the message
 *               message:
 *                 type: string
 *                 description: The exact message containing the nonce that was signed
 *     responses:
 *       200:
 *         description: Successfully authenticated, returns JWT token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *       400:
 *         description: Missing fields or invalid format
 *       401:
 *         description: Invalid signature or expired nonce
 */
authRouter.post("/verify", async (req: Request, res: Response): Promise<any> => {
  try {
    const { publicKey, signature, message } = req.body;

    if (!publicKey || !signature || !message) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Extract nonce from message
    const nonceMatch = message.match(/Nonce: ([a-f0-9]+)/);
    if (!nonceMatch || !nonceMatch[1]) {
      return res.status(400).json({ error: "Invalid message format" });
    }
    const nonce = nonceMatch[1];

    // Verify nonce exists in Redis
    const client = await RedisService.getClient();
    const key = `auth_nonce:${publicKey}`;
    const storedNonce = await client.get(key);

    if (storedNonce !== nonce) {
      return res.status(401).json({ error: "Invalid or expired nonce" });
    }

    // Prevent replay attacks by deleting nonce after use
    await client.del(key);

    // Verify cryptographic signature
    const verified = nacl.sign.detached.verify(
      new TextEncoder().encode(message),
      bs58.decode(signature),
      bs58.decode(publicKey)
    );

    if (!verified) {
      return res.status(401).json({ error: "Invalid signature" });
    }

    // Generate JWT
    const token = jwt.sign(
      { wallet: publicKey },
      jwt_secret,
      { expiresIn: "7d" }
    );

    res.json({ token });
  } catch (error) {
    Logger.error("Verification failed:", error);
    res.status(500).json({ error: "Verification failed" });
  }
});
