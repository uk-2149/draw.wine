import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { CollabDrawingServer } from './services/socket.service';
import roomRouter from './routes/rooms.routes';

const app = express();

// Create HTTP server FIRST
export const httpServer = createServer(app);

// Initialize collaborative server - this sets up Socket.IO
const collabServer = CollabDrawingServer.getInstance(httpServer);

// Middleware
app.use(helmet());
app.use(compression());
app.use(express.json());
app.use(cors({
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: { error: 'Too many requests from this IP' }
});
app.use(limiter);

// Health check route
app.get('/health', (req, res) => {
    const stats = collabServer.getConnectionStats();
    res.json({
        status: 'healthy',
        timestamp: Date.now(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        connections: stats
    });
});

app.use('/api/rooms', roomRouter);

const PORT = 3000;

httpServer.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Socket.IO server initialized and ready for connections`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    httpServer.close(() => {
        process.exit(0);
    });
});