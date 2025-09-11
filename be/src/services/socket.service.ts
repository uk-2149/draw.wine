import express from 'express';
import { Server as httpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import helmet from 'helmet';
import * as cookie from 'cookie';
import jwt from 'jsonwebtoken';
import { performance } from 'perf_hooks';

import type { RoomState, DrawingOperation } from '../types';
import redisClient, { pub, sub } from '../utils/redisClient';

export class CollabDrawingServer {
    private static instance: CollabDrawingServer;
    private io: SocketServer;
    private redis: typeof redisClient;
    private db: any; // database
    public roomStates: Map<string, RoomState> = new Map();
    private userColors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F39C12', '#E74C3C', '#9B59B6'];

    // Performance optimization
    private operationQueues: Map<string, DrawingOperation[]> = new Map();
    private batchTimers: Map<string, NodeJS.Timeout> = new Map();
    private sequenceCounters: Map<string, number> = new Map();

    // Connection tracking
    private connections: Map<string, { userId: string; roomId: string; connectedAt: number }> = new Map();
    private roomConnections: Map<string, Set<string>> = new Map();

    constructor(server: httpServer) {
        this.io = new SocketServer(server, {
            cors: {
                origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
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
        // JWT authentication middleware
        this.io.use(async (socket: Socket, next) => {
            try {
                const cookies = socket.handshake.headers.cookie;
                if (!cookies) return next(new Error('No cookies found'));

                const parsedCookie = cookie.parse(cookies);
                const token = parsedCookie.token;

                if (!token) return next(new Error('Authentication token required'));

                const payload = jwt.verify(token, process.env.JWT_SECRET as string) as { userId: string };
                
                // Get roomId from handshake auth or query
                const roomId = socket.handshake.auth?.roomId || socket.handshake.query?.roomId as string;
                const userName = socket.handshake.auth?.userName || `User ${payload.userId.slice(-4)}`;
                
                if (!roomId) return next(new Error('Room ID required'));

                // Set socket data
                socket.data = {
                    userId: payload.userId,
                    roomId,
                    userName
                };
                
                next();
            } catch (error) {
                next(new Error('Invalid authentication token'));
            }
        });

        this.io.on('connection', (socket: Socket) => {
            const { userId, roomId, userName } = socket.data;

            if (!roomId || !userId) {
                socket.disconnect();
                return;
            }

            console.log(`User ${userId} connected to room ${roomId}`);

            // Join the room
            socket.join(roomId);

            // Track connection
            this.connections.set(socket.id, {
                userId,
                roomId,
                connectedAt: Date.now()
            });

            if (!this.roomConnections.has(roomId)) {
                this.roomConnections.set(roomId, new Set());
            }
            this.roomConnections.get(roomId)?.add(socket.id);

            // Send current room state and add collaborator
            this.handleUserJoin(socket, roomId, userId, userName || `User ${userId.slice(-4)}`);

            // Handle drawing operations
            socket.on('operation', async (operation: DrawingOperation) => {
                await this.processOperation(socket, operation);
            });

            // Handle cursor updates
            socket.on('cursor-update', async (data: {
                userId: string;
                position: { x: number; y: number };
                timestamp: number;
            }) => {
                await this.updateCollaboratorCursor(roomId, data.userId, data.position);
                socket.to(roomId).emit('collaborator-cursor', data);
            });

            // Handle drawing status
            socket.on('drawing-status', async (data: {
                userId: string;
                isDrawing: boolean;
                elementId?: string;
            }) => {
                await this.updateCollaboratorDrawingStatus(roomId, data.userId, data.isDrawing, data.elementId);
                socket.to(roomId).emit('collaborator-drawing-status', data);
            });

            socket.on('disconnect', () => {
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
            version: 0
        };

        this.roomStates.set(roomId, roomState);
        await this.updateRoomStateCache(roomId, roomState);

        return roomState;
    }

    private async updateRoomStateCache(roomId: string, roomState: RoomState) {
        this.roomStates.set(roomId, roomState);

        try {
            await this.redis.setex(
                `room:${roomId}:state`,
                3600, // 1 hour TTL
                JSON.stringify(roomState)
            );
        } catch (error) {
            console.error('Error updating room state in cache:', error);
        }
    }   

    private async addCollaborator(roomId: string, userId: string, userName: string) {
        const roomState = await this.getRoomState(roomId);
        
        const existingIndex = roomState.collaborators.findIndex(c => c.id === userId);

        // FIXED: Check if user doesn't exist (=== -1, not !== -1)
        if (existingIndex === -1) {
            const usedColors = roomState.collaborators.map(c => c.color);
            const availableColor = this.userColors.find(color => !usedColors.includes(color)) 
                || this.userColors[0];

            const newCollaborator: Collaborator = {
                id: userId,
                name: userName,
                color: availableColor,
                joinedAt: Date.now(),
            };

            roomState.collaborators.push(newCollaborator);
            await this.updateRoomStateCache(roomId, roomState);

            // FIXED: Emit correct event name
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
            // Don't persist cursor updates to Redis, keep in memory only
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
        sub.psubscribe('room:*:operation', (message: string, channel: string) => {
            try {
                const operation = JSON.parse(message) as DrawingOperation;
                // Broadcast to local connections (this prevents infinite loops)
                this.io.to(operation.roomId).emit('operation', operation);
            } catch (error) {
                console.error('Error processing Redis operation message:', error);
            }
        });

        // Subscribe to batched operations
        sub.psubscribe('room:*:operations_batch', (message: string, channel: string) => {
            try {
                const operations = JSON.parse(message) as DrawingOperation[];
                if (operations.length > 0) {
                    const roomId = operations[0].roomId;
                    this.io.to(roomId).emit('operations_batch', operations);
                }
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
