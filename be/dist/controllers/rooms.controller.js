"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRoomInfo = exports.CreateRoom = void 0;
const jwt_1 = require("../utils/jwt");
const uuid_1 = require("uuid");
const index_1 = require("../index");
const socket_service_1 = require("../services/socket.service");
const CreateRoom = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { username, name, isPublic = true } = req.body;
        const userId = (0, uuid_1.v4)();
        const token = (0, jwt_1.generateToken)(username);
        // Store username and userId in cookie as JSON string
        res.cookie('user', JSON.stringify({ token, userId }), {
            httpOnly: true,
            secure: true,
            sameSite: 'none',
            maxAge: 24 * 60 * 60 * 1000, // 1 day
        });
        const roomId = (0, uuid_1.v4)();
        // Save the room in the database
        const roomState = {
            id: roomId,
            name: name.trim(),
            elements: {},
            collaborators: [],
            isPublic: isPublic,
            lastModified: Date.now(),
            createdBy: username,
            createdAt: new Date().toISOString(),
            version: 0
        };
        socket_service_1.CollabDrawingServer.getInstance(index_1.httpServer).roomStates.set(roomId, roomState);
        socket_service_1.CollabDrawingServer.getInstance(index_1.httpServer).roomConnections.set(roomId, new Set());
        res.status(201).json({
            id: roomId,
            name: name.trim(),
            isPublic,
            createdBy: userId,
            createdAt: new Date().toISOString()
        });
    }
    catch (error) {
        console.error("Error creating room:", error);
        res.status(500).json({ error: "Failed to create room" });
    }
});
exports.CreateRoom = CreateRoom;
const getRoomInfo = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { roomId } = req.params;
        const server = socket_service_1.CollabDrawingServer.getInstance(index_1.httpServer);
        const roomState = server.roomStates.get(roomId);
        if (!roomState) {
            return res.status(404).json({ error: "Room not found" });
        }
        res.json({
            id: roomState.id,
            name: roomState.name,
            isPublic: roomState.isPublic,
            createdBy: roomState.createdBy,
            createdAt: roomState.createdAt,
            collaborators: roomState.collaborators,
            connectionCount: ((_a = server.roomConnections.get(roomId)) === null || _a === void 0 ? void 0 : _a.size) || 0
        });
    }
    catch (error) {
        console.error("Error getting room info:", error);
        res.status(500).json({ error: "Failed to get room info" });
    }
});
exports.getRoomInfo = getRoomInfo;
