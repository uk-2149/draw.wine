import { Router } from "express";
import { getAppConfig } from "../controllers/config.controller";

export const configRouter = Router();

/**
 * @swagger
 * /api/config:
 *   get:
 *     summary: Get application configuration including tier details
 *     tags: [Configuration]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Application configuration object
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tier:
 *                   type: string
 *                 maxUsersPerRoom:
 *                   type: number
 */
configRouter.get("/", getAppConfig);
