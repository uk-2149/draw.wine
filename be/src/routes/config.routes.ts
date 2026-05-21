import { Router } from "express";
import { getAppConfig } from "../controllers/config.controller";

export const configRouter = Router();

// GET /api/config
configRouter.get("/", getAppConfig);
