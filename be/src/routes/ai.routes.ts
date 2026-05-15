import { Router } from "express";
import { chatWithAi, generateDrawing } from "../controllers/ai.controller";
import { aiLimiter } from "../constants/ext";

export const aiRouter = Router();

// POST /api/ai/generate
aiRouter.post("/generate", aiLimiter, generateDrawing);

// POST /api/ai/chat
aiRouter.post("/chat", aiLimiter, chatWithAi);
