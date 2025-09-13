"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.CollabDrawingServer = void 0;
const socket_io_1 = require("socket.io");
const cookie = __importStar(require("cookie"));
const perf_hooks_1 = require("perf_hooks");
const redisClient_1 = __importStar(require("../utils/redisClient"));
const jwt_1 = require("../utils/jwt");
class CollabDrawingServer {
    constructor(server) {
        var _a;
        // private db: any; // database
        this.roomStates = new Map();
        this.userColors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F39C12', '#E74C3C', '#9B59B6'];
        // Performance optimization
        this.operationQueues = new Map();
        this.batchTimers = new Map();
        // Connection tracking
        this.connections = new Map();
        this.roomConnections = new Map();
        this.serverId = process.env.INSTANCE_ID || 'default-server';
        console.log("Server ID:", this.serverId);
        this.io = new socket_io_1.Server(server, {
            cors: {
                origin: ((_a = process.env.ALLOWED_ORIGINS) === null || _a === void 0 ? void 0 : _a.split(',')) || ['http://localhost:5173'],
                methods: ['GET', 'POST'],
                credentials: true
            },
            transports: ['websocket'],
            pingTimeout: 60000,
            pingInterval: 25000
        });
        // Initialize Redis
        this.redis = redisClient_1.default;
        // Setup all handlers
        this.setupSocketHandlers();
        this.setupRedisSubscriptions();
        this.setupCleanupTasks();
    }
    static getInstance(server) {
        if (!CollabDrawingServer.instance) {
            CollabDrawingServer.instance = new CollabDrawingServer(server);
        }
        return CollabDrawingServer.instance;
    }
    setupSocketHandlers() {
        console.log("Setting up socket handlers...");
        // JWT authentication middleware (updated for guest support)
        this.io.use((socket, next) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            try {
                let token;
                let userId;
                let userName;
                const cookies = socket.handshake.headers.cookie;
                if (cookies) {
                    const parsedCookie = cookie.parse(cookies);
                    if (parsedCookie.user) {
                        try {
                            const userObj = JSON.parse(parsedCookie.user);
                            token = userObj.token;
                            userId = userObj.userId;
                        }
                        catch (err) {
                            // Malformed cookie, fallback to auth
                        }
                    }
                }
                // If no valid cookie/token, fallback to auth for guests
                if (!token || !userId) {
                    userId = (_a = socket.handshake.auth) === null || _a === void 0 ? void 0 : _a.userId;
                    userName = (_b = socket.handshake.auth) === null || _b === void 0 ? void 0 : _b.userName;
                    if (!userId) {
                        return next(new Error('userId required'));
                    }
                    if (!userName) {
                        userName = `Guest-${userId.slice(-4)}`;
                    }
                }
                else {
                    // Authenticated user
                    userName = (0, jwt_1.verifyJWT)(token);
                }
                // Get roomId from handshake auth or query
                const roomId = ((_c = socket.handshake.auth) === null || _c === void 0 ? void 0 : _c.roomId) || ((_d = socket.handshake.query) === null || _d === void 0 ? void 0 : _d.roomId);
                if (!roomId)
                    return next(new Error('Room ID required'));
                console.log('roomId:', roomId);
                console.log('userId:', userId);
                // Set socket data
                socket.data = {
                    userId,
                    roomId,
                    userName: userName
                };
                next();
            }
            catch (error) {
                next(new Error('Authentication failed'));
            }
        }));
        this.io.on('connection', (socket) => {
            var _a;
            const { userId, roomId, userName } = socket.data;
            console.log('roomId:', roomId);
            console.log('userId:', userId);
            if (!roomId || !userId) {
                socket.disconnect();
                return;
            }
            console.log(`User ${userId} connected to room ${roomId}`);
            socket.join(roomId);
            this.connections.set(socket.id, {
                userId,
                roomId,
                connectedAt: Date.now()
            });
            if (!this.roomConnections.has(roomId)) {
                this.roomConnections.set(roomId, new Set());
            }
            (_a = this.roomConnections.get(roomId)) === null || _a === void 0 ? void 0 : _a.add(socket.id);
            this.handleUserJoin(socket, roomId, userId, userName || `User ${userId.slice(-4)}`);
            // Periodically emit room state to all clients in the room
            const intervalId = setInterval(() => __awaiter(this, void 0, void 0, function* () {
                const roomState = yield this.getRoomState(roomId);
                this.io.to(roomId).emit('room-state-sync', {
                    elements: Object.values(roomState.elements),
                    collaborators: roomState.collaborators,
                    version: roomState.version
                });
            }), 7000); // every 7 seconds
            socket.on('operation', (operation) => __awaiter(this, void 0, void 0, function* () {
                yield this.processOperation(socket, operation);
            }));
            socket.on('cursor-update', (data) => __awaiter(this, void 0, void 0, function* () {
                yield this.updateCollaboratorCursor(roomId, data.userId, data.position);
                socket.to(roomId).emit('collaborator-cursor', data);
            }));
            socket.on('drawing-status', (data) => __awaiter(this, void 0, void 0, function* () {
                yield this.updateCollaboratorDrawingStatus(roomId, data.userId, data.isDrawing, data.elementId);
                socket.to(roomId).emit('collaborator-drawing-status', data);
            }));
            socket.on('disconnect', () => {
                clearInterval(intervalId);
                this.handleUserDisconnect(socket, roomId, userId);
            });
        });
    }
    handleUserJoin(socket, roomId, userId, userName) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Get or create room state
                const roomState = yield this.getRoomState(roomId);
                // Send current room state
                socket.emit('room-state', {
                    elements: Object.values(roomState.elements),
                    collaborators: roomState.collaborators,
                    version: roomState.version
                });
                // Add user to collaborators if not exists
                yield this.addCollaborator(roomId, userId, userName);
            }
            catch (error) {
                console.error('Error handling user join:', error);
                socket.emit('error', { message: 'Failed to join room' });
            }
        });
    }
    processOperation(socket, operation) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const startTime = perf_hooks_1.performance.now();
                // Add serverId for deduplication
                operation.serverId = this.serverId;
                // Validate operation
                if (!this.validateOperation(operation)) {
                    socket.emit('operation_error', {
                        operationId: operation.id,
                        error: 'Invalid operation'
                    });
                    return;
                }
                // For high-frequency operations, use batching
                if (this.shouldBatchOperations(operation)) {
                    this.batchOperation(operation);
                }
                else {
                    yield this.processOperationImmediate(socket, operation);
                }
                const processingTime = perf_hooks_1.performance.now() - startTime;
                if (processingTime > 100) {
                    console.warn(`Slow operation: ${processingTime.toFixed(2)}ms for ${operation.type}`);
                }
            }
            catch (error) {
                console.error('Error processing operation:', error);
                socket.emit('operation_error', {
                    operationId: operation.id,
                    error: error.message
                });
            }
        });
    }
    processOperationImmediate(socket, operation) {
        return __awaiter(this, void 0, void 0, function* () {
            // Get room state
            const roomState = yield this.getRoomState(operation.roomId);
            // Apply operation
            const updatedState = this.applyOperationToState(roomState, operation);
            // Update room state in cache
            yield this.updateRoomStateCache(operation.roomId, updatedState);
            // Broadcast operation to other users in room
            socket.to(operation.roomId).emit('operation', operation);
            // Publish to Redis for other server instances
            yield redisClient_1.pub.publish(`room:${operation.roomId}:operation`, JSON.stringify(operation));
            // Send acknowledgment
            socket.emit('operation_ack', operation.id);
        });
    }
    applyOperationToState(roomState, operation) {
        const newState = Object.assign(Object.assign({}, roomState), { elements: Object.assign({}, roomState.elements) });
        switch (operation.type) {
            case 'element_start':
                newState.elements[operation.elementId] = Object.assign(Object.assign({}, operation.data.element), { authorId: operation.authorId, isTemporary: true });
                break;
            case 'element_update':
                if (newState.elements[operation.elementId]) {
                    newState.elements[operation.elementId] = Object.assign(Object.assign(Object.assign({}, newState.elements[operation.elementId]), operation.data), { lastModified: operation.timestamp });
                }
                break;
            case 'element_complete':
                newState.elements[operation.elementId] = Object.assign(Object.assign({}, operation.data.element), { authorId: operation.authorId, isTemporary: false });
                break;
            case 'element_delete':
                delete newState.elements[operation.elementId];
                break;
            case 'element_transform':
                if (newState.elements[operation.elementId]) {
                    newState.elements[operation.elementId] = Object.assign(Object.assign(Object.assign({}, newState.elements[operation.elementId]), operation.data.transform), { lastModified: operation.timestamp });
                }
                break;
        }
        newState.lastModified = operation.timestamp;
        newState.version++;
        return newState;
    }
    shouldBatchOperations(operation) {
        return operation.type === 'element_update' && operation.data.points;
    }
    batchOperation(operation) {
        var _a;
        const key = `${operation.roomId}:${operation.elementId}`;
        if (!this.operationQueues.has(key)) {
            this.operationQueues.set(key, []);
        }
        (_a = this.operationQueues.get(key)) === null || _a === void 0 ? void 0 : _a.push(operation);
        // Clear existing timer
        if (this.batchTimers.has(key)) {
            clearTimeout(this.batchTimers.get(key));
        }
        // Set new timer
        this.batchTimers.set(key, setTimeout(() => {
            this.processBatch(key);
        }, 50));
    }
    processBatch(key) {
        return __awaiter(this, void 0, void 0, function* () {
            const operations = this.operationQueues.get(key);
            if (!operations || !operations.length)
                return;
            try {
                const roomId = operations[0].roomId;
                const roomState = yield this.getRoomState(roomId);
                let updatedState = roomState;
                operations.forEach(op => {
                    // Add serverId to each operation in batch
                    op.serverId = this.serverId;
                    updatedState = this.applyOperationToState(updatedState, op);
                });
                // Update room state in cache
                yield this.updateRoomStateCache(roomId, updatedState);
                // Broadcast batch
                this.io.to(roomId).emit('operations_batch', operations);
                // Publish to Redis
                yield redisClient_1.pub.publish(`room:${roomId}:operations_batch`, JSON.stringify(operations));
                console.log(`Processed batch of ${operations.length} operations for room ${roomId}`);
            }
            catch (error) {
                console.error('Error processing batch:', error);
            }
            finally {
                this.operationQueues.delete(key);
                this.batchTimers.delete(key);
            }
        });
    }
    getRoomState(roomId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.roomStates.has(roomId)) {
                return this.roomStates.get(roomId);
            }
            try {
                const cached = yield this.redis.get(`room:${roomId}:state`);
                if (cached) {
                    const roomState = JSON.parse(cached);
                    this.roomStates.set(roomId, roomState);
                    return roomState;
                }
            }
            catch (error) {
                console.error('Error getting room state from cache:', error);
            }
            const roomState = {
                id: roomId,
                elements: {},
                collaborators: [],
                lastModified: Date.now(),
                createdAt: new Date().toISOString(),
                createdBy: '',
                isPublic: true,
                name: '',
                version: 0
            };
            this.roomStates.set(roomId, roomState);
            yield this.updateRoomStateCache(roomId, roomState);
            return roomState;
        });
    }
    updateRoomStateCache(roomId, roomState) {
        return __awaiter(this, void 0, void 0, function* () {
            this.roomStates.set(roomId, roomState);
            try {
                yield this.redis.set(`room:${roomId}:state`, JSON.stringify(roomState), { EX: 3600 } // 1 hour TTL
                );
            }
            catch (error) {
                console.error('Error updating room state in cache:', error);
            }
        });
    }
    addCollaborator(roomId, userId, userName) {
        return __awaiter(this, void 0, void 0, function* () {
            const roomState = yield this.getRoomState(roomId);
            const existingIndex = roomState.collaborators.findIndex(c => c.id === userId);
            if (existingIndex === -1) {
                const usedColors = roomState.collaborators.map(c => c.color);
                const availableColor = this.userColors.find(color => !usedColors.includes(color))
                    || this.userColors[0];
                const newCollaborator = {
                    id: userId,
                    name: userName,
                    color: availableColor,
                    joinedAt: Date.now(),
                    // Optional fields will be undefined initially
                    cursor: undefined,
                    isDrawing: undefined,
                    currentElementId: undefined
                };
                roomState.collaborators.push(newCollaborator);
                yield this.updateRoomStateCache(roomId, roomState);
                this.io.to(roomId).emit('collaborator-joined', newCollaborator);
            }
        });
    }
    removeCollaborator(roomId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const roomState = yield this.getRoomState(roomId);
            roomState.collaborators = roomState.collaborators.filter(c => c.id !== userId);
            yield this.updateRoomStateCache(roomId, roomState);
            this.io.to(roomId).emit('collaborator-left', userId);
        });
    }
    updateCollaboratorCursor(roomId, userId, cursor) {
        return __awaiter(this, void 0, void 0, function* () {
            const roomState = yield this.getRoomState(roomId);
            const collaborator = roomState.collaborators.find(c => c.id === userId);
            if (collaborator) {
                collaborator.cursor = cursor;
                // No need to update cache for transient cursor data
            }
        });
    }
    updateCollaboratorDrawingStatus(roomId, userId, isDrawing, elementId) {
        return __awaiter(this, void 0, void 0, function* () {
            const roomState = yield this.getRoomState(roomId);
            const collaborator = roomState.collaborators.find(c => c.id === userId);
            if (collaborator) {
                collaborator.isDrawing = isDrawing;
                collaborator.currentElementId = elementId;
                // No need to update cache for transient status
            }
        });
    }
    handleUserDisconnect(socket, roomId, userId) {
        var _a, _b;
        console.log(`User ${userId} disconnected from room ${roomId}`);
        // Remove from connections tracking
        this.connections.delete(socket.id);
        // Remove from room connections
        if (this.roomConnections.has(roomId)) {
            (_a = this.roomConnections.get(roomId)) === null || _a === void 0 ? void 0 : _a.delete(socket.id);
            // If no more connections in room, clean up
            if (((_b = this.roomConnections.get(roomId)) === null || _b === void 0 ? void 0 : _b.size) === 0) {
                this.roomConnections.delete(roomId);
            }
        }
        // Remove collaborator
        this.removeCollaborator(roomId, userId);
    }
    validateOperation(operation) {
        return !!(operation.id &&
            operation.type &&
            operation.elementId &&
            operation.authorId &&
            operation.roomId &&
            operation.timestamp &&
            operation.timestamp > 0);
    }
    setupRedisSubscriptions() {
        // Subscribe to operations from other server instances
        redisClient_1.sub.subscribe('room:*:operation', (message, channel) => {
            try {
                const operation = JSON.parse(message);
                // Skip if from this server instance
                if (operation.serverId === this.serverId)
                    return;
                // Broadcast to local connections
                this.io.to(operation.roomId).emit('operation', operation);
            }
            catch (error) {
                console.error('Error processing Redis operation message:', error);
            }
        });
        // Subscribe to batched operations
        redisClient_1.sub.subscribe('room:*:operations_batch', (message, channel) => {
            try {
                const operations = JSON.parse(message);
                if (operations.length > 0 && operations[0].serverId === this.serverId)
                    return;
                const roomId = operations[0].roomId;
                this.io.to(roomId).emit('operations_batch', operations);
            }
            catch (error) {
                console.error('Error processing Redis batch message:', error);
            }
        });
        redisClient_1.sub.on('error', (err) => {
            console.error('Redis subscriber error:', err);
        });
        console.log('Redis subscriptions set up successfully');
    }
    setupCleanupTasks() {
        // Clean up stale connections every 5 minutes
        setInterval(() => {
            this.cleanupStaleConnections();
        }, 300000);
        // Clean up empty rooms every 10 minutes
        setInterval(() => {
            this.cleanupEmptyRooms();
        }, 600000);
    }
    cleanupStaleConnections() {
        const now = Date.now();
        const staleThreshold = 300000; // 5 minutes
        for (const [socketId, connection] of this.connections) {
            if (now - connection.connectedAt > staleThreshold) {
                this.connections.delete(socketId);
            }
        }
    }
    cleanupEmptyRooms() {
        for (const [roomId, connections] of this.roomConnections) {
            if (connections.size === 0) {
                this.roomStates.delete(roomId);
                console.log(`Cleaned up empty room: ${roomId}`);
            }
        }
    }
    getConnectionStats() {
        return {
            totalConnections: this.connections.size,
            totalRooms: this.roomStates.size,
            roomConnections: Array.from(this.roomConnections.entries()).map(([roomId, sockets]) => ({
                roomId,
                connections: sockets.size
            }))
        };
    }
}
exports.CollabDrawingServer = CollabDrawingServer;
