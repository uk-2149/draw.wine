import express, { Request, Response } from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import rateLimit from "express-rate-limit";
import { createServer } from "http";
import { CollabDrawingServer } from "./services/socket.service";
import roomRouter from "./routes/rooms.routes";
import dotenv from "dotenv";
dotenv.config();

const app = express();

// Create HTTP server FIRST
export const httpServer = createServer(app);

// Initialize collaborative server - this sets up Socket.IO
const collabServer = CollabDrawingServer.getInstance(httpServer);

const fe_url = process.env.FE_URL_PROD

// console.log(fe_url)
    

// Middleware
app.use(helmet());
app.use(compression());
app.use(express.json());
app.use(
  cors({
    origin: fe_url,
    methods: ["GET", "POST"],
    credentials: true,
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: "Too many requests from this IP" },
});
app.use(limiter);

// Health check route
app.get("/health", (req: Request, res: Response) => {
  const stats = collabServer.getConnectionStats();
  res.json({
    status: "healthy",
    timestamp: Date.now(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    connections: stats,
  });
});

app.use("/api/rooms", roomRouter);

const PORT = 3000;

httpServer.listen(PORT, () => console.log(`Server is running on port ${PORT}`));

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  httpServer.close(() => {
    process.exit(0);
  });
});
