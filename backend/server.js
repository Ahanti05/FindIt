require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const connectDB = require('./src/config/db');
const { initSocket } = require('./src/services/socketService');

// ─── Routes ──────────────────────────────────────────────────────────────────
const authRoutes = require('./src/routes/auth');
const userRoutes = require('./src/routes/users');
const lostItemRoutes = require('./src/routes/lostItems');
const foundItemRoutes = require('./src/routes/foundItems');
const matchRoutes = require('./src/routes/matches');
const notificationRoutes = require('./src/routes/notifications');
const recoveryRoutes = require('./src/routes/recovery');
const adminRoutes = require('./src/routes/admin');
const aiRoutes = require('./src/routes/ai');

const app = express();
const server = http.createServer(app);

// ─── Socket.IO ───────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});
initSocket(io);

// ─── Connect DB ──────────────────────────────────────────────────────────────
connectDB();

// ─── Global Middleware ────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Rate Limiting ────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/lost-items', lostItemRoutes);
app.use('/api/found-items', foundItemRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/recovery', recoveryRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ai', aiRoutes);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'FindIt API is running', timestamp: new Date().toISOString() });
});

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 FindIt API running on http://localhost:${PORT}`);
});

module.exports = { app, server };
