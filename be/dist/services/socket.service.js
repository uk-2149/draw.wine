"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollabDrawingServer = void 0;
const socket_io_1 = require("socket.io");
const socket_event_1 = require("../events/socket.event");
class CollabDrawingServer {
    constructor(httpServer) {
        this._io = new socket_io_1.Server(httpServer, {
            cors: {
                origin: "http://localhost:5173",
                credentials: true,
            },
        });
        this.setupSocketEvents();
    }
    static getInstance(httpServer) {
        if (!CollabDrawingServer.instance) {
            CollabDrawingServer.instance = new CollabDrawingServer(httpServer);
        }
        return CollabDrawingServer.instance;
    }
    setupSocketEvents() {
        const io = this._io;
        (0, socket_event_1.ExecSocketEvents)(io);
    }
    getConnectionStats() {
        return {
            totalConnections: this._io.engine.clientsCount,
            totalRooms: this._io.sockets.adapter.rooms.size,
        };
    }
}
exports.CollabDrawingServer = CollabDrawingServer;
