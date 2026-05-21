import express from "express";
import helmet from "helmet";
import cors, { CorsOptions } from "cors";
import compression from "compression";
import { createServer } from "http";
import { corsOptions, limiter, PORT } from "./constants";
import { CollabDrawingServer, RedisService } from "./services";
import { aiRouter, roomRouter, configRouter } from "./routes";
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
  app.use("/api/rooms", roomRouter);
  app.use("/api/ai", aiRouter);
  app.use("/api/config", configRouter);

  httpServer.listen(PORT, () =>
    Logger.info(`Server is running on port ${PORT}`),
  );
};
