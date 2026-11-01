const jwt = require('jsonwebtoken');
const User = require('../models/User');

let io;

const initSocket = (socketIO) => {
  io = socketIO;

  // Every socket must present a valid JWT. The user's room is derived from the
  // token, so a client can only ever receive its own notifications.
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication required'));
      const { id } = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(id).select('_id role isActive');
      if (!user || !user.isActive) return next(new Error('User not found'));
      socket.userId = String(user._id);
      socket.role = user.role;
      next();
    } catch (_) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.userId}`);
    if (socket.role === 'admin') socket.join('admins');
  });
};

const getIO = () => {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
};

const emitToUser = (userId, event, payload) => {
  if (io) io.to(`user:${userId}`).emit(event, payload);
};

module.exports = { initSocket, getIO, emitToUser };
