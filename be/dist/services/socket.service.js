"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollabDrawingServer = void 0;
const socket_io_1 = require("socket.io");
const socket_event_1 = require("../events/socket.event");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const fe_url = process.env.NODE_ENV === "prod"
    ? process.env.FE_URL_PROD
    : "http://localhost:5173";
class CollabDrawingServer {
    constructor(httpServer) {
        this._io = new socket_io_1.Server(httpServer, {
            cors: {
                origin: fe_url,
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
