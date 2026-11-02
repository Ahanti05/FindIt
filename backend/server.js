require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const mongoose = require('mongoose');
const { connectDB, startExpiryJob } = require('./src/config/db');
const { startAiRetryJob } = require('./src/services/aiPipeline');
const { initSocket } = require('./src/services/socketService');
const { UPLOAD_ROOT } = require('./src/services/storage');

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is not set. Copy .env.example to backend/.env first.');
  process.exit(1);
}

const app = express();
const server = http.createServer(app);
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// ─── Socket.IO ───────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: CLIENT_URL, methods: ['GET', 'POST'], credentials: true },
});
initSocket(io);

// ─── Global middleware ────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      connectSrc: ["'self'", 'ws:', 'wss:'],
      scriptSrc: ["'self'"],
    },
  },
  crossOriginResourcePolicy: { policy: 'same-site' },
}));
app.use(cors({ origin: CLIENT_URL, credentials: true }));
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.use('/api/', rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
}));

// Locally stored images (used when Cloudinary is not configured).
app.use('/uploads', express.static(UPLOAD_ROOT, { maxAge: '7d', fallthrough: false }));

// ─── API routes ───────────────────────────────────────────────────────────────
const itemRouter = require('./src/routes/items');
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/lost-items', itemRouter('lost'));
app.use('/api/found-items', itemRouter('found'));
app.use('/api/matches', require('./src/routes/matches'));
app.use('/api/notifications', require('./src/routes/notifications'));
app.use('/api/recovery', require('./src/routes/recovery'));
app.use('/api/admin', require('./src/routes/admin'));
app.use('/api/ai', require('./src/routes/ai'));
app.use('/api/coins', require('./src/routes/coins'));
app.use('/api', require('./src/routes/public'));

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api', (req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ─── Serve the built frontend (npm run build in frontend/) ───────────────────
const DIST = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(path.join(DIST, 'index.html'))) {
  app.use(express.static(DIST, { index: false, maxAge: '1h' }));
  app.get('*', (req, res) => res.sendFile(path.join(DIST, 'index.html')));
}

// ─── Error handler ────────────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  let status = err.statusCode || err.status || 500;
  let message = err.message || 'Internal Server Error';

  if (err instanceof mongoose.Error.ValidationError) {
    status = 400;
    message = Object.values(err.errors).map((e) => e.message).join('. ');
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400;
    message = `Invalid ${err.path}`;
  } else if (err instanceof multer.MulterError) {
    status = 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'Image must be under 10 MB' : err.message;
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Malformed JSON';
  }

  if (status >= 500) console.error(err);
  res.status(status).json({
    success: false,
    message: status >= 500 && process.env.NODE_ENV === 'production' ? 'Internal Server Error' : message,
  });
});

const PORT = process.env.PORT || 5000;

const start = async () => {
  await connectDB();
  startExpiryJob();
  startAiRetryJob();
  server.listen(PORT, () => console.log(`FindIt API running on http://localhost:${PORT}`));
};

if (require.main === module) start();

module.exports = { app, server };
