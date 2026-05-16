import express from "express";
import helmet from "helmet";
import cors, { CorsOptions } from "cors";
import compression from "compression";
import { createServer } from "http";
import { corsOptions, limiter, PORT } from "./constants";
import { CollabDrawingServer } from "./services";
import { aiRouter, roomRouter } from "./routes";
import { Logger } from "./helpers";

export const initServer = async () => {
  const app = express();
  const httpServer = createServer(app);

  // Middlewares
  app.use(helmet());
  app.use(compression());
  app.use(express.json());
  app.use(cors(corsOptions as CorsOptions));
  app.use(limiter);

  CollabDrawingServer.getInstance(httpServer);
  app.use("/api/rooms", roomRouter);
  app.use("/api/ai", aiRouter);

  httpServer.listen(PORT, () =>
    Logger.info(`Server is running on port ${PORT}`),
  );
};
