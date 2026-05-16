import { Router } from "express";

import { aiLimiter } from "../constants";
import { chatWithAi, generateDrawing } from "../controllers";

export const aiRouter = Router();

// POST /api/ai/generate
aiRouter.post("/generate", aiLimiter, generateDrawing);

// POST /api/ai/chat
aiRouter.post("/chat", aiLimiter, chatWithAi);
