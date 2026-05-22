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
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./swagger";
import path from "path";

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
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://unpkg.com"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "https://unpkg.com"],
        },
      },
    })
  );
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

  // Serve Swagger UI for REST APIs at /api
  app.use("/api", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  // Serve AsyncAPI json specification
  app.get("/asyncapi.json", (req, res) => {
    res.sendFile(path.join(__dirname, "asyncapi.json"));
  });

  // Serve AsyncAPI UI for WebSocket events at /ws
  app.get("/ws", (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>WebSocket Documentation</title>
          <link rel="icon" href="data:,">
          <style>body { margin: 0; padding: 0; }</style>
      </head>
      <body>
          <script src="https://unpkg.com/@asyncapi/web-component@1.0.0-next.47/lib/asyncapi-web-component.js"></script>
          <asyncapi-component schemaUrl="/asyncapi.json" cssImportPath="https://unpkg.com/@asyncapi/react-component@1.0.0-next.47/styles/default.min.css"></asyncapi-component>
      </body>
      </html>
    `);
  });

  httpServer.listen(PORT, () =>
    Logger.info(`Server is running on port ${PORT}`),
  );
};
