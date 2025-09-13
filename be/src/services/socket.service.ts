import { Server as httpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import * as cookie from 'cookie';
import { performance } from 'perf_hooks';

import type { RoomState, DrawingOperation, Collaborator } from '../types/index';
import redisClient, { pub, sub } from '../utils/redisClient';
import { verifyJWT } from '../utils/jwt';
import { userInfo } from 'os';

export class CollabDrawingServer {
    private static instance: CollabDrawingServer;
    private io: SocketServer;
    private redis: typeof redisClient;
    // private db: any; // database
    public roomStates: Map<string, RoomState> = new Map();
    private userColors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F39C12', '#E74C3C', '#9B59B6'];

    // Performance optimization
    private operationQueues: Map<string, DrawingOperation[]> = new Map();
    private batchTimers: Map<string, NodeJS.Timeout> = new Map();

    // Connection tracking
    private connections: Map<string, { userId: string; roomId: string; connectedAt: number }> = new Map();
    public roomConnections: Map<string, Set<string>> = new Map();

    // Instance ID for multi-server deduplication
    private serverId: string;

    constructor(server: httpServer) {
        this.serverId = process.env.INSTANCE_ID || 'default-server';
        console.log("Server ID:", this.serverId);
        this.io = new SocketServer(server, {
            cors: {
                origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'],
                methods: ['GET', 'POST'],
                credentials: true
            },
            transports: ['websocket'],
            pingTimeout: 60000,
            pingInterval: 25000
        });

        // Initialize Redis
        this.redis = redisClient;

        // Setup all handlers
        this.setupSocketHandlers();
        this.setupRedisSubscriptions();
        this.setupCleanupTasks();
    }

    public static getInstance(server: httpServer): CollabDrawingServer {
        if (!CollabDrawingServer.instance) {
            CollabDrawingServer.instance = new CollabDrawingServer(server);
        }
        return CollabDrawingServer.instance;
    }

    private setupSocketHandlers() {

        console.log("Setting up socket handlers...");
        // JWT authentication middleware (updated for guest support)
        this.io.use(async (socket: Socket, next) => {
            try {
                let token: string | undefined;
                let userId: string | undefined;
                let userName: string | undefined;

                const cookies = socket.handshake.headers.cookie;
                if (cookies) {
                    const parsedCookie = cookie.parse(cookies);
                    if (parsedCookie.user) {
                        try {
                            const userObj = JSON.parse(parsedCookie.user);
                            token = userObj.token;
                            userId = userObj.userId;
                        } catch (err) {
                            // Malformed cookie, fallback to auth
                        }
                    }
                }

                // If no valid cookie/token, fallback to auth for guests
                if (!token || !userId) {
                    userId = socket.handshake.auth?.userId as string;
                    userName = socket.handshake.auth?.userName as string;
                    if (!userId) {
                        return next(new Error('userId required'));
                    }
                    if (!userName) {
                        userName = `Guest-${userId.slice(-4)}`;
                    }
                } else {
                    // Authenticated user
                    userName = verifyJWT(token) as string;
                }

                // Get roomId from handshake auth or query
                const roomId = socket.handshake.auth?.roomId || socket.handshake.query?.roomId as string;
                if (!roomId) return next(new Error('Room ID required'));

                console.log('roomId:', roomId);
                console.log('userId:', userId);

                // Set socket data
                socket.data = {
                    userId,
                    roomId,
                    userName: userName!
                };
                next();
            } catch (error) {
                next(new Error('Authentication failed'));
            }
        });

        this.io.on('connection', (socket: Socket) => {
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
            this.roomConnections.get(roomId)?.add(socket.id);
            this.handleUserJoin(socket, roomId, userId, userName || `User ${userId.slice(-4)}`);
            // Periodically emit room state to all clients in the room
            const intervalId = setInterval(async () => {
                const roomState = await this.getRoomState(roomId);
                this.io.to(roomId).emit('room-state-sync', {
                    elements: Object.values(roomState.elements),
                    collaborators: roomState.collaborators,
                    version: roomState.version
                });
            }, 7000); // every 7 seconds
            socket.on('operation', async (operation: DrawingOperation) => {
                await this.processOperation(socket, operation);
            });
            socket.on('cursor-update', async (data: { userId: string; position: { x: number; y: number }; timestamp: number; }) => {
                await this.updateCollaboratorCursor(roomId, data.userId, data.position);
                socket.to(roomId).emit('collaborator-cursor', data);
            });
            socket.on('drawing-status', async (data: { userId: string; isDrawing: boolean; elementId?: string; }) => {
                await this.updateCollaboratorDrawingStatus(roomId, data.userId, data.isDrawing, data.elementId);
                socket.to(roomId).emit('collaborator-drawing-status', data);
            });
            socket.on('disconnect', () => {
                clearInterval(intervalId);
                this.handleUserDisconnect(socket, roomId, userId);
            });
        });
    }

    private async handleUserJoin(socket: Socket, roomId: string, userId: string, userName: string) {
        try {
            // Get or create room state
            const roomState = await this.getRoomState(roomId);
            
            // Send current room state
            socket.emit('room-state', {
                elements: Object.values(roomState.elements),
                collaborators: roomState.collaborators,
                version: roomState.version
            });
            
            // Add user to collaborators if not exists
            await this.addCollaborator(roomId, userId, userName);
            
        } catch (error) {
            console.error('Error handling user join:', error);
            socket.emit('error', { message: 'Failed to join room' });
        }
    }

    private async processOperation(socket: Socket, operation: DrawingOperation) {
        try {
            const startTime = performance.now();

            // Add serverId for deduplication
            (operation as any).serverId = this.serverId;

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
            } else {
                await this.processOperationImmediate(socket, operation);
            }

            const processingTime = performance.now() - startTime;
            if (processingTime > 100) {
                console.warn(`Slow operation: ${processingTime.toFixed(2)}ms for ${operation.type}`);
            }
        } catch (error: any) {
            console.error('Error processing operation:', error);
            socket.emit('operation_error', { 
                operationId: operation.id, 
                error: error.message 
            });
        }
    }

    private async processOperationImmediate(socket: Socket, operation: DrawingOperation) {
        // Get room state
        const roomState = await this.getRoomState(operation.roomId);

        // Apply operation
        const updatedState = this.applyOperationToState(roomState, operation);

        // Update room state in cache
        await this.updateRoomStateCache(operation.roomId, updatedState);

        // Broadcast operation to other users in room
        socket.to(operation.roomId).emit('operation', operation);

        // Publish to Redis for other server instances
        await pub.publish(
            `room:${operation.roomId}:operation`, 
            JSON.stringify(operation)
        );

        // Send acknowledgment
        socket.emit('operation_ack', operation.id);
    }

    private applyOperationToState(roomState: RoomState, operation: DrawingOperation): RoomState {
        const newState = {
            ...roomState,
            elements: { ...roomState.elements },
        };

        switch (operation.type) {
            case 'element_start':
                newState.elements[operation.elementId] = {
                    ...operation.data.element,
                    authorId: operation.authorId,
                    isTemporary: true,
                };
                break;

            case 'element_update':
                if (newState.elements[operation.elementId]) {
                    newState.elements[operation.elementId] = {
                        ...newState.elements[operation.elementId],
                        ...operation.data,
                        lastModified: operation.timestamp,
                    };
                }
                break;

            case 'element_complete':
                newState.elements[operation.elementId] = {
                    ...operation.data.element,
                    authorId: operation.authorId,
                    isTemporary: false,
                };
                break;

            case 'element_delete':
                delete newState.elements[operation.elementId];
                break;

            case 'element_transform':
                if (newState.elements[operation.elementId]) {
                    newState.elements[operation.elementId] = {
                        ...newState.elements[operation.elementId],
                        ...operation.data.transform,
                        lastModified: operation.timestamp,
                    };
                }
                break;
        }

        newState.lastModified = operation.timestamp;
        newState.version++;

        return newState;
    }

    private shouldBatchOperations(operation: DrawingOperation): boolean {
        return operation.type === 'element_update' && operation.data.points;
    }

    private batchOperation(operation: DrawingOperation) {
        const key = `${operation.roomId}:${operation.elementId}`;

        if (!this.operationQueues.has(key)) {
            this.operationQueues.set(key, []);
        }

        this.operationQueues.get(key)?.push(operation);

        // Clear existing timer
        if (this.batchTimers.has(key)) {
            clearTimeout(this.batchTimers.get(key)!);
        }

        // Set new timer
        this.batchTimers.set(key, setTimeout(() => {
            this.processBatch(key);
        }, 50));
    }

    private async processBatch(key: string) {
        const operations = this.operationQueues.get(key);
        if (!operations || !operations.length) return;

        try {
            const roomId = operations[0].roomId;
            const roomState = await this.getRoomState(roomId);

            let updatedState = roomState;
            operations.forEach(op => {
                // Add serverId to each operation in batch
                (op as any).serverId = this.serverId;
                updatedState = this.applyOperationToState(updatedState, op);
            });

            // Update room state in cache
            await this.updateRoomStateCache(roomId, updatedState);

            // Broadcast batch
            this.io.to(roomId).emit('operations_batch', operations);

            // Publish to Redis
            await pub.publish(
                `room:${roomId}:operations_batch`, 
                JSON.stringify(operations)
            );

            console.log(`Processed batch of ${operations.length} operations for room ${roomId}`);
        } catch (error) {
            console.error('Error processing batch:', error);
        } finally {
            this.operationQueues.delete(key);
            this.batchTimers.delete(key);
        }
    }

    public async getRoomState(roomId: string): Promise<RoomState> {
        if (this.roomStates.has(roomId)) {
            return this.roomStates.get(roomId)!;
        }

        try {
            const cached = await this.redis.get(`room:${roomId}:state`);
            if (cached) {
                const roomState = JSON.parse(cached) as RoomState;
                this.roomStates.set(roomId, roomState);
                return roomState;
            }
        } catch (error) {
            console.error('Error getting room state from cache:', error);
        }

        const roomState: RoomState = {
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
        await this.updateRoomStateCache(roomId, roomState);

        return roomState;
    }

    private async updateRoomStateCache(roomId: string, roomState: RoomState) {
        this.roomStates.set(roomId, roomState);

        try {
             await this.redis.set(
  `room:${roomId}:state`,
  JSON.stringify(roomState),
  { EX: 3600 } // 1 hour TTL

            );
        } catch (error) {
            console.error('Error updating room state in cache:', error);
        }
    }   

    private async addCollaborator(roomId: string, userId: string, userName: string) {
        const roomState = await this.getRoomState(roomId);
        
        const existingIndex = roomState.collaborators.findIndex(c => c.id === userId);

        if (existingIndex === -1) {
            const usedColors = roomState.collaborators.map(c => c.color);
            const availableColor = this.userColors.find(color => !usedColors.includes(color)) 
                || this.userColors[0];

            const newCollaborator: Collaborator = {
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
            await this.updateRoomStateCache(roomId, roomState);

            this.io.to(roomId).emit('collaborator-joined', newCollaborator);
        }
    } 

    private async removeCollaborator(roomId: string, userId: string) {
        const roomState = await this.getRoomState(roomId);
        roomState.collaborators = roomState.collaborators.filter(c => c.id !== userId);
        await this.updateRoomStateCache(roomId, roomState);
        
        this.io.to(roomId).emit('collaborator-left', userId);
    }

    private async updateCollaboratorCursor(
        roomId: string, 
        userId: string, 
        cursor: { x: number; y: number }
    ) {
        const roomState = await this.getRoomState(roomId);
        const collaborator = roomState.collaborators.find(c => c.id === userId);
        
        if (collaborator) {
            collaborator.cursor = cursor;
            // No need to update cache for transient cursor data
        }
    }

    private async updateCollaboratorDrawingStatus(
        roomId: string,
        userId: string,
        isDrawing: boolean,
        elementId?: string
    ) {
        const roomState = await this.getRoomState(roomId);
        const collaborator = roomState.collaborators.find(c => c.id === userId);
        
        if (collaborator) {
            collaborator.isDrawing = isDrawing;
            collaborator.currentElementId = elementId;
            // No need to update cache for transient status
        }
    }

    private handleUserDisconnect(socket: Socket, roomId: string, userId: string) {
        console.log(`User ${userId} disconnected from room ${roomId}`);

        // Remove from connections tracking
        this.connections.delete(socket.id);

        // Remove from room connections
        if (this.roomConnections.has(roomId)) {
            this.roomConnections.get(roomId)?.delete(socket.id);
            
            // If no more connections in room, clean up
            if (this.roomConnections.get(roomId)?.size === 0) {
                this.roomConnections.delete(roomId);
            }
        }

        // Remove collaborator
        this.removeCollaborator(roomId, userId);
    }

    private validateOperation(operation: DrawingOperation): boolean {
        return !!(
            operation.id &&
            operation.type &&
            operation.elementId &&
            operation.authorId &&
            operation.roomId &&
            operation.timestamp &&
            operation.timestamp > 0
        );
    }

    private setupRedisSubscriptions() {
        // Subscribe to operations from other server instances
        sub.subscribe('room:*:operation', (message: string, channel: string) => {
            try {
                const operation: any = JSON.parse(message);
                // Skip if from this server instance
                if (operation.serverId === this.serverId) return;
                // Broadcast to local connections
                this.io.to(operation.roomId).emit('operation', operation);
            } catch (error) {
                console.error('Error processing Redis operation message:', error);
            }
        });

        // Subscribe to batched operations
        sub.subscribe('room:*:operations_batch', (message: string, channel: string) => {
            try {
                const operations: any[] = JSON.parse(message);
                if (operations.length > 0 && operations[0].serverId === this.serverId) return;
                const roomId = operations[0].roomId;
                this.io.to(roomId).emit('operations_batch', operations);
            } catch (error) {
                console.error('Error processing Redis batch message:', error);
            }
        });

        sub.on('error', (err) => {
            console.error('Redis subscriber error:', err);
        });

        console.log('Redis subscriptions set up successfully');
    }

    private setupCleanupTasks() {
        // Clean up stale connections every 5 minutes
        setInterval(() => {
            this.cleanupStaleConnections();
        }, 300000);

        // Clean up empty rooms every 10 minutes
        setInterval(() => {
            this.cleanupEmptyRooms();
        }, 600000);
    }

    private cleanupStaleConnections() {
        const now = Date.now();
        const staleThreshold = 300000; // 5 minutes
        
        for (const [socketId, connection] of this.connections) {
            if (now - connection.connectedAt > staleThreshold) {
                this.connections.delete(socketId);
            }
        }
    }

    private cleanupEmptyRooms() {
        for (const [roomId, connections] of this.roomConnections) {
            if (connections.size === 0) {
                this.roomStates.delete(roomId);
                console.log(`Cleaned up empty room: ${roomId}`);
            }
        }
    }

    public getConnectionStats() {
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