import express, { Request, Response } from "express";
import helmet from "helmet";
import cors, { CorsOptions } from "cors";
import compression from "compression";
import rateLimit from "express-rate-limit";
import { createServer } from "http";
import { CollabDrawingServer } from "./services/socket.service";
import roomRouter from "./routes/rooms.routes";
import dotenv from "dotenv";
import { allowedOrigins, PORT } from "./env/e";
import { Logger } from "./helpers/ext.h";
dotenv.config();

const app = express();

// Create HTTP server FIRST
export const httpServer = createServer(app);

// Initialize collaborative server - this sets up Socket.IO
const collabServer = CollabDrawingServer.getInstance(httpServer);

const corsOptions: CorsOptions = {
  origin: allowedOrigins,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true,
};

// Middleware
app.use(helmet());
app.use(compression());
app.use(express.json());
app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: "Too many requests from this IP" },
});
app.use(limiter);

app.use("/api/rooms", roomRouter);

httpServer.listen(PORT, () => Logger.info(`Server is running on port ${PORT}`));
