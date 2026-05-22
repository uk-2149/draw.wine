import { Server as SocketServer, Socket } from "socket.io";
import type { User, Room } from "../types";
import { Logger } from "../helpers";
import { RoomStateManager } from "../services/room-state.service";
import { getTierLimits } from "../constants";

// Room state is persisted in Redis with tier-based TTL
// No per-instance cleanup needed

export const ExecSocketEvents = (io: SocketServer) => {
  io.on("connection", (socket: Socket) => {
    console.log(`New client connected: ${socket.id}`);

    socket.on(
      "join_room",
      async ({
        roomId,
        user,
        settings,
      }: {
        roomId: string;
        user: Omit<User, "socketId" | "joinedAt">;
        settings?: { onlyHostCanDraw: boolean; requireApproval: boolean };
      }) => {
        try {
          Logger.info(`User ${user.name} joining room ${roomId}`);

          const limits = getTierLimits(socket.data.isPremium);

          // Check if room has expired before allowing join
          const existingRoom = await RoomStateManager.getRoom(roomId);
          if (existingRoom) {
            const isExpired = await RoomStateManager.isRoomExpired(roomId);
            if (isExpired) {
              socket.emit("room_expired", { roomId });
              return;
            }

            // Check room capacity before joining. Use the room's stored maxUsers, or fallback to current limits.
            const currentMax = existingRoom.maxUsers || limits.maxUsersPerRoom;
            const currentUserCount = Object.keys(
              existingRoom.users || {},
            ).length;
            if (currentUserCount >= currentMax) {
              socket.emit("room_full", {
                roomId,
                maxUsers: currentMax,
              });
              return;
            }
          }

          socket.join(roomId);

          const now = Date.now();
          const updated = await RoomStateManager.atomicUpdate(
            roomId,
            (current) => {
              let room = current;
              if (!room) {
                room = {
                  id: roomId,
                  users: {},
                  elements: [],
                  lastActivity: now,
                  createdAt: now,
                  expiresAt: now + limits.roomTtlSeconds * 1000,
                  maxUsers: limits.maxUsersPerRoom,
                  hostId: user.id,
                  settings: settings || {
                    onlyHostCanDraw: false,
                    requireApproval: false,
                  },
                  pendingUsers: {},
                } as any;
              }

              // Clean previous socket entries for this user ID
              room!.users = room!.users || {};
              for (const uid of Object.keys(room!.users)) {
                if (
                  room!.users[uid].socketId === socket.id ||
                  uid === user.id
                ) {
                  delete room!.users[uid];
                }
              }

              // Check if approval is required
              if (
                room!.settings?.requireApproval &&
                user.id !== room!.hostId &&
                !room!.users[user.id]
              ) {
                room!.pendingUsers = room!.pendingUsers || {};
                room!.pendingUsers[user.id] = { user, socketId: socket.id };
                return room!;
              }

              // Add user to room
              room!.users[user.id] = {
                ...user,
                socketId: socket.id,
                joinedAt: Date.now(),
                color: user.color || getRandomColor(),
              } as User;

              room!.lastActivity = Date.now();
              return room!;
            },
          );

          if (!updated) {
            socket.emit("error", { message: "Failed to join room" });
            return;
          }

          // If user was placed into pending, emit waiting_for_approval
          if (
            updated.pendingUsers &&
            updated.pendingUsers[user.id] &&
            user.id !== updated.hostId
          ) {
            socket.emit("waiting_for_approval", { roomId });
            // Notify host if connected
            const host = updated.users[updated.hostId!];
            if (host) {
              io.to(host.socketId).emit("join_request", {
                roomId,
                guest: {
                  id: user.id,
                  name: user.name,
                  color: user.color || getRandomColor(),
                },
              });
            }
            return;
          }

          // Build collaborators array
          const collaborators = collaboratorsFromRoom(updated);

          // Send current room state to new user
          socket.emit("room_joined", {
            roomId,
            elements: updated.elements,
            collaborators,
            hostId: updated.hostId,
            settings: updated.settings,
            expiresAt: updated.expiresAt,
            maxUsers: updated.maxUsers ?? limits.maxUsersPerRoom,
            tierMode: limits.collaborativeSaveEnabled ? "premium" : "free",
          });

          // Notify other users about new collaborator
          socket.to(roomId).emit("collaborators_updated", collaborators);

          Logger.info(
            `Room ${roomId} now has ${Object.keys(updated.users).length} users`,
          );
        } catch (error) {
          Logger.error("Error joining room:", error);
          socket.emit("error", { message: "Failed to join room" });
        }
      },
    );

    socket.on(
      "handle_join_request",
      async ({
        roomId,
        guestId,
        action,
      }: {
        roomId: string;
        guestId: string;
        action: "accept" | "reject";
      }) => {
        try {
          const room = await RoomStateManager.getRoom(roomId);
          if (!room) {
            Logger.warn(`Room ${roomId} not found for join request`);
            return;
          }

          // Validate host
          const callingUserId = Object.values(room.users || {}).find(
            (u) => u.socketId === socket.id,
          )?.id;
          if (room.hostId !== callingUserId) {
            Logger.warn(
              `Unauthorized handle_join_request or room not found: ${roomId}`,
            );
            return;
          }

          if (!room.pendingUsers || !room.pendingUsers[guestId]) {
            Logger.warn(
              `Guest ${guestId} not found in pendingUsers for room ${roomId}`,
            );
            return;
          }

          const pendingInfo = room.pendingUsers[guestId];

          // Perform atomic move from pending -> users
          const updated = await RoomStateManager.atomicUpdate(roomId, (r) => {
            if (!r) return r;
            delete r.pendingUsers![guestId];
            if (action === "accept") {
              r.users = r.users || {};
              r.users[guestId] = {
                ...pendingInfo.user,
                socketId: pendingInfo.socketId,
                joinedAt: Date.now(),
                color: pendingInfo.user.color || getRandomColor(),
              } as User;
            }
            r.lastActivity = Date.now();
            return r;
          });

          if (action === "accept") {
            const guestSocket = io.sockets.sockets.get(pendingInfo.socketId);
            if (guestSocket) {
              guestSocket.join(roomId);
            }

            io.to(pendingInfo.socketId).emit("room_joined", {
              roomId,
              elements: updated!.elements,
              collaborators: collaboratorsFromRoom(updated!),
              hostId: updated!.hostId,
              settings: updated!.settings,
            });

            io.to(roomId).emit(
              "collaborators_updated",
              collaboratorsFromRoom(updated!),
            );

            Logger.info(
              `Host accepted user ${pendingInfo.user.name} into room ${roomId}`,
            );
          } else {
            io.to(pendingInfo.socketId).emit("join_rejected", { roomId });
            Logger.info(
              `Host rejected user ${pendingInfo.user.name} for room ${roomId}`,
            );
          }
        } catch (error) {
          Logger.error("Error handling join request:", error);
        }
      },
    );

    socket.on("drawing_operation", async (data: any) => {
      try {
        Logger.info("=== BACKEND: Received drawing operation ===");
        Logger.info("Full data received:", JSON.stringify(data, null, 2));

        // Extract the actual operation from the data
        const operation = data.operation;
        const roomId = data.roomId;

        if (!operation || !operation.type) {
          Logger.error("Invalid operation structure received:", data);
          return;
        }

        Logger.info("Operation type:", operation.type);
        Logger.info("Element ID:", operation.elementId);
        Logger.info("Author ID:", operation.authorId);
        Logger.info("Room ID:", roomId);

        await RoomStateManager.atomicUpdate(roomId, (room) => {
          if (!room) {
            Logger.error(`Room ${roomId} not found`);
            return null;
          }

          Logger.info(
            `Room ${roomId} has ${room.elements.length} elements before operation`,
          );

          // Update room state based on operation
          switch (operation.type) {
            case "element_create":
            case "element_start": {
              const startElement = operation.data?.element || operation.element;
              if (startElement) {
                room.elements.push({
                  ...startElement,
                  isTemporary: operation.type === "element_start",
                });
              }
              break;
            }
            case "element_update": {
              const updateIndex = room.elements.findIndex(
                (el) => el.id === operation.elementId,
              );
              if (updateIndex !== -1) {
                room.elements[updateIndex] = {
                  ...room.elements[updateIndex],
                  ...operation.data,
                };
              }
              break;
            }
            case "element_complete": {
              const completeIndex = room.elements.findIndex(
                (el) => el.id === operation.elementId,
              );
              if (completeIndex !== -1) {
                room.elements[completeIndex] = {
                  ...room.elements[completeIndex],
                  ...operation.data.element,
                  isTemporary: false,
                };
              }
              break;
            }
            case "element_delete": {
              room.elements = room.elements.filter(
                (el) => el.id !== operation.elementId,
              );
              break;
            }
          }

          room.lastActivity = Date.now();

          Logger.info(
            `Room ${roomId} now has ${room.elements.length} elements after operation`,
          );

          // Update user's drawing status
          if (room.users && room.users[operation.authorId]) {
            room.users[operation.authorId].isDrawing =
              operation.type === "element_start" ||
              operation.type === "element_create";
            room.users[operation.authorId].currentElementId = room.users[
              operation.authorId
            ].isDrawing
              ? operation.elementId
              : undefined;
          }

          return room;
        });

        // Append to op log for recovery
        await RoomStateManager.appendOp(roomId, operation);

        Logger.info("=== BACKEND: Broadcasting operation to room ===");
        Logger.info("Broadcasting to room:", roomId);

        // Broadcast operation to all users in room including sender
        io.to(roomId).emit("operation_applied", operation);
      } catch (error) {
        Logger.error("Error processing drawing operation:", error);
      }
    });

    socket.on(
      "cursor_update",
      ({
        roomId,
        position,
      }: {
        roomId: string;
        position: { x: number; y: number };
      }) => {
        try {
          // Broadcast cursor update immediately without Redis write (reduced write frequency)
          socket.to(roomId).emit("cursor_moved", {
            userId: undefined, // will be discovered by other clients from room state
            position,
          });
        } catch (error) {
          Logger.error("Error updating cursor:", error);
        }
      },
    );

    // Handle laser tool events
    socket.on(
      "laser_point",
      ({
        roomId,
        point,
        userId,
        timestamp,
      }: {
        roomId: string;
        point: { x: number; y: number };
        userId: string;
        timestamp: number;
      }) => {
        try {
          // Broadcast laser point to all users in room including sender
          io.to(roomId).emit("laser_point", {
            userId,
            point,
            timestamp,
          });
        } catch (error) {
          Logger.error("Error broadcasting laser point:", error);
        }
      },
    );

    socket.on(
      "laser_clear",
      ({ roomId, userId }: { roomId: string; userId: string }) => {
        try {
          // Broadcast laser clear to all users in room including sender
          io.to(roomId).emit("laser_clear", {
            userId,
          });
        } catch (error) {
          Logger.error("Error broadcasting laser clear:", error);
        }
      },
    );

    socket.on(
      "check-if-in-room",
      async ({ roomId, userId }: { roomId: string; userId: string }) => {
        try {
          const room = await RoomStateManager.getRoom(roomId);
          let isInRoom = false;
          let userInfo = null;

          if (room) {
            const user = room.users[userId];
            if (user && user.socketId === socket.id) {
              isInRoom = true;
              userInfo = {
                id: user.id,
                name: user.name,
                color: user.color,
                joinedAt: user.joinedAt,
              };
            }
          }

          socket.emit("room-status-response", {
            roomId,
            userId,
            isInRoom,
            userInfo,
            roomExists: !!room,
            collaboratorsCount: room ? Object.keys(room.users).length : 0,
          });

          Logger.info(
            `Room status check for user ${userId} in room ${roomId}: ${isInRoom}`,
          );
        } catch (error) {
          Logger.error("Error checking room status:", error);
          socket.emit("room-status-response", {
            roomId,
            userId,
            isInRoom: false,
            userInfo: null,
            roomExists: false,
            collaboratorsCount: 0,
            error: "Failed to check room status",
          });
        }
      },
    );

    socket.on("leave_room", async ({ roomId }: { roomId: string }) => {
      try {
        await RoomStateManager.atomicUpdate(roomId, (room) => {
          if (!room) return null;

          for (const uid of Object.keys(room.users || {})) {
            if (room.users[uid].socketId === socket.id) {
              delete room.users[uid];
              Logger.info(`User ${uid} left room ${roomId}`);
              break;
            }
          }

          room.lastActivity = Date.now();

          // Delete room if no users left
          if (!Object.keys(room.users || {}).length) {
            return null;
          }

          return room;
        });

        socket.leave(roomId);

        // Broadcast updated collaborators
        const room = await RoomStateManager.getRoom(roomId);
        const collaborators = room ? collaboratorsFromRoom(room) : [];
        socket.to(roomId).emit("collaborators_updated", collaborators);
        socket.emit("room_left", { roomId, success: true });
      } catch (error) {
        Logger.error("Error leaving room:", error);
        socket.emit("room_left", {
          roomId,
          success: false,
          error: "Failed to leave room",
        });
      }
    });

    socket.on("disconnect", async () => {
      try {
        Logger.info(`Client disconnected: ${socket.id}`);

        // Remove disconnected socket from any room via socket.rooms
        for (const roomId of socket.rooms) {
          if (roomId === socket.id) continue;

          await RoomStateManager.atomicUpdate(roomId, (room) => {
            if (!room) return null;

            for (const uid of Object.keys(room.users || {})) {
              if (room.users[uid].socketId === socket.id) {
                delete room.users[uid];
                Logger.info(
                  `Removed disconnected user ${uid} from room ${roomId}`,
                );
                break;
              }
            }

            room.lastActivity = Date.now();

            // Delete room if no users left
            if (!Object.keys(room.users || {}).length) {
              return null;
            }

            return room;
          });

          const room = await RoomStateManager.getRoom(roomId);
          const collaborators = room ? collaboratorsFromRoom(room) : [];
          socket.to(roomId).emit("collaborators_updated", collaborators);
        }
      } catch (error) {
        Logger.error("Error handling disconnect:", error);
      }
    });
  });
};

function collaboratorsFromRoom(room: Room) {
  return Object.values(room.users || {}).map((u) => ({
    id: u.id,
    name: u.name,
    color: u.color,
    cursor: u.cursor,
    isDrawing: u.isDrawing,
  }));
}

function getRandomColor(): string {
  const colors = [
    "#ff6b6b",
    "#4ecdc4",
    "#45b7d1",
    "#96ceb4",
    "#feca57",
    "#ff9ff3",
    "#a8e6cf",
    "#ffd93d",
    "#6c5ce7",
    "#fd79a8",
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}
