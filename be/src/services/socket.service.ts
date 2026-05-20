import { Server as SocketServer } from "socket.io";
import { Server as HTTPServer } from "http";
import { ExecSocketEvents } from "../events";
import { allowedOrigins } from "../constants";
import { Logger } from "../helpers";
import { RedisService } from "./redis.service";
import { createAdapter } from "@socket.io/redis-adapter";

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
    this.setupSocketEvents();
  }

  public static async getInstance(
    httpServer: HTTPServer,
  ): Promise<CollabDrawingServer> {
    if (!CollabDrawingServer.instance) {
      CollabDrawingServer.instance = new CollabDrawingServer(httpServer);

      await CollabDrawingServer.instance.setupRedisAdapter();
      CollabDrawingServer.instance.setupSocketEvents();
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
    ExecSocketEvents(io);
  }

  public getConnectionStats() {
    return {
      totalConnections: this._io.engine.clientsCount,
      totalRooms: this._io.sockets.adapter.rooms.size,
    };
  }
}
