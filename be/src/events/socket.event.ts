import { Server as SocketServer } from "socket.io";

export const ExecSocketEvents = (io: SocketServer) => {
  io.on("connection", (socket) => {
    console.log(`New client connected: ${socket.id}`);

    socket.on("disconnect", () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });
};
