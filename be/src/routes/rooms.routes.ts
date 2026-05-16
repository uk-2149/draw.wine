import { Router } from "express";
import { sendInvitations } from "../controllers";
export const roomRouter = Router();

// POST /api/rooms/send-invitations
roomRouter.post("/send-invitations", sendInvitations);
