import 'dotenv/config';               // ← load .env FIRST (ESM safe)
import './config/firebase-admin.js'; // ← init Firebase Admin second
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import authRoutes         from './routes/auth.js';
import historyRoutes      from './routes/history.js';
import conversationRoutes from './routes/conversation.routes.js';
import messageRoutes      from './routes/message.routes.js';
import userRoutes         from './routes/user.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import { setupSocketHandlers } from './socket/handlers.js';

const app        = express();
const httpServer = createServer(app);

const io = new SocketIOServer(httpServer, {
  cors: {
    origin:      true,
    credentials: true,
    methods:     ['GET', 'POST'],
  },
  transports:   ['polling', 'websocket'],
  pingTimeout:  60000,
  pingInterval: 25000,
});

app.locals.io = io;

app.use(cors({ origin: true, credentials: true, methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'] }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ── Health check
app.get('/health', (_req, res) => {
  res.json({
    success:  true,
    message:  'Taskly API is running',
    timestamp: new Date().toISOString(),
    database: 'firestore',
    socketio: 'enabled',
  });
});

// ── Routes
app.use('/api/auth',          authRoutes);
app.use('/api/history',       historyRoutes);
app.use('/api/conversations',  conversationRoutes);
app.use('/api/messages',      messageRoutes);
app.use('/api/users',         userRoutes);
app.use('/api/notifications', notificationRoutes);

setupSocketHandlers(io);

io.on('connection', (socket) => {
  console.log(`🔌 Socket connected: ${socket.id}`);
  socket.on('disconnect', (reason) => {
    console.log(`❌ Socket disconnected: ${socket.id} - ${reason}`);
  });
  socket.on('error', (error) => {
    console.error(`⚠️  Socket error:`, error);
  });
});

// ── 404
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ── Global error handler
app.use((err, _req, res, _next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Local:   http://localhost:${PORT}`);
  console.log(`🔥 Database: Firebase Firestore`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔌 Socket.io ready`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM: closing HTTP server');
  io.close();
  httpServer.close(() => process.exit(0));
});

export default app;