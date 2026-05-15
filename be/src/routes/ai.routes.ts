import { Router } from "express";
import { generateDrawing } from "../controllers/ai.controller";
import { aiLimiter } from "../constants/ext";

export const aiRouter = Router();

// POST /api/ai/generate
aiRouter.post("/generate", aiLimiter, generateDrawing);
