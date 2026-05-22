import express from "express";
import helmet from "helmet";
import cors, { CorsOptions } from "cors";
import compression from "compression";
import { createServer } from "http";
import { corsOptions, limiter, PORT } from "./constants";
import { CollabDrawingServer, RedisService } from "./services";
import { aiRouter, roomRouter, configRouter, authRouter, paymentRouter } from "./routes";
import { authMiddleware } from "./middleware";
import { Logger } from "./helpers";

export const initServer = async () => {
  try {
    Logger.info("Initializing connection to redis...");
    await RedisService.connect();
    Logger.info("Connected to redis successfully.");
  } catch (error) {
    Logger.error("Failed to initialize server:", error);
    process.exit(1);
  }
  const app = express();
  const httpServer = createServer(app);

  // Middlewares
  app.use(helmet());
  app.use(compression());
  app.use(express.json());
  app.use(cors(corsOptions as CorsOptions));
  app.use(limiter);

  try {
    await CollabDrawingServer.getInstance(httpServer);
    Logger.info("Socket server initialized successfully.");
  } catch (error) {
    Logger.error("Failed to initialize socket server:", error);
    process.exit(1);
  }
  app.use("/api/auth", authRouter);
  app.use("/api/payment", authMiddleware, paymentRouter);
  app.use("/api/rooms", roomRouter); // Might need auth for premium creations later
  app.use("/api/ai", authMiddleware, aiRouter);
  app.use("/api/config", authMiddleware, configRouter);

  httpServer.listen(PORT, () =>
    Logger.info(`Server is running on port ${PORT}`),
  );
};
