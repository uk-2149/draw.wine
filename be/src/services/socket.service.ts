import { Server as SocketServer } from "socket.io";
import { Server as HTTPServer } from "http";
import { ExecSocketEvents } from "../events";
import { allowedOrigins } from "../constants";
import { Logger } from "../helpers";
import { RedisService } from "./redis.service";
import { createAdapter } from "@socket.io/redis-adapter";
import { roomExpiryService } from "./room-expiry.service";
import jwt from "jsonwebtoken";
import { jwt_secret } from "../constants";
import { TierService } from "./tier.service";

export class CollabDrawingServer {
  private static instance: CollabDrawingServer;
  private _io: SocketServer;

  private constructor(httpServer: HTTPServer) {
    this._io = new SocketServer(httpServer, {
      cors: {
        origin: allowedOrigins,
        credentials: true,
      },
    });
  }

  public static async getInstance(
    httpServer: HTTPServer,
  ): Promise<CollabDrawingServer> {
    if (!CollabDrawingServer.instance) {
      CollabDrawingServer.instance = new CollabDrawingServer(httpServer);

      await CollabDrawingServer.instance.setupRedisAdapter();
      CollabDrawingServer.instance.setupSocketEvents();

      // Start the room expiry checker
      roomExpiryService.start(CollabDrawingServer.instance._io);
    }
    return CollabDrawingServer.instance;
  }

  private async setupRedisAdapter() {
    try {
      const client = await RedisService.getClient();
      const subscriber = await RedisService.getSubscriber();

      this._io.adapter(createAdapter(client, subscriber));
      Logger.info("Redis adapter for Socket.IO has been set up successfully.");
    } catch (error) {
      Logger.error("Failed to set up Redis adapter for Socket.IO:", error);
      throw error;
    }
  }
  private setupSocketEvents() {
    const io = this._io;

    io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth?.token;
        if (token) {
          try {
            const decoded = jwt.verify(token, jwt_secret) as { wallet: string };
            socket.data.wallet = decoded.wallet;
            socket.data.isPremium = await TierService.isPremiumUser(decoded.wallet);
            Logger.info(`Socket authenticated for wallet: ${decoded.wallet}`);
          } catch (err) {
            Logger.warn("Invalid socket token provided, proceeding as anonymous.");
            socket.data.isPremium = await TierService.isPremiumUser(); // fallback to global default
          }
        } else {
          socket.data.isPremium = await TierService.isPremiumUser();
        }
        next();
      } catch (err) {
        next(new Error("Internal error during authentication"));
      }
    });

    ExecSocketEvents(io);
  }

  public getConnectionStats() {
    return {
      totalConnections: this._io.engine.clientsCount,
      totalRooms: this._io.sockets.adapter.rooms.size,
    };
  }
}
