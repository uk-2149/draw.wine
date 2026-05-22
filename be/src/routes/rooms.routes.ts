import { Router } from "express";
import { sendInvitations } from "../controllers";
export const roomRouter = Router();

/**
 * @swagger
 * /api/rooms/send-invitations:
 *   post:
 *     summary: Send email invitations to join a room
 *     tags: [Rooms]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [roomId, emails]
 *             properties:
 *               roomId:
 *                 type: string
 *               roomName:
 *                 type: string
 *               emails:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Invitations sent successfully
 *       400:
 *         description: Missing required fields
 *       500:
 *         description: Internal server error
 */
roomRouter.post("/send-invitations", sendInvitations);
