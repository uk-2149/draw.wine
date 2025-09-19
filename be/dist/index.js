"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.httpServer = void 0;
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const compression_1 = __importDefault(require("compression"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const http_1 = require("http");
const socket_service_1 = require("./services/socket.service");
const rooms_routes_1 = __importDefault(require("./routes/rooms.routes"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const app = (0, express_1.default)();
// Create HTTP server FIRST
exports.httpServer = (0, http_1.createServer)(app);
// Initialize collaborative server - this sets up Socket.IO
const collabServer = socket_service_1.CollabDrawingServer.getInstance(exports.httpServer);
const fe_url = process.env.NODE_ENV === "prod"
    ? process.env.FE_URL_PROD
    : "http://localhost:5173";
// Middleware
app.use((0, helmet_1.default)());
app.use((0, compression_1.default)());
app.use(express_1.default.json());
app.use((0, cors_1.default)({
    origin: fe_url,
    methods: ["GET", "POST"],
    credentials: true,
}));
// Rate limiting
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: { error: "Too many requests from this IP" },
});
app.use(limiter);
// Health check route
app.get("/health", (req, res) => {
    const stats = collabServer.getConnectionStats();
    res.json({
        status: "healthy",
        timestamp: Date.now(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        connections: stats,
    });
});
app.use("/api/rooms", rooms_routes_1.default);
const PORT = 3000;
exports.httpServer.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
// Graceful shutdown
process.on("SIGTERM", () => {
    console.log("SIGTERM received, shutting down gracefully");
    exports.httpServer.close(() => {
        process.exit(0);
    });
});
