import { CorsOptions } from "cors";
import { allowedOrigins } from "./e";
import { rateLimit } from "express-rate-limit";

export const corsOptions: CorsOptions = {
  origin: allowedOrigins,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true,
};
export const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: "Too many requests from this IP" },
});
