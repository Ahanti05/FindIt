let io;

const initSocket = (socketIO) => {
  io = socketIO;

  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // Join user-specific room
    socket.on('join', (userId) => {
      socket.join(`user:${userId}`);
      console.log(`User ${userId} joined their room`);
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Socket disconnected: ${socket.id}`);
    });
  });
};

const getIO = () => {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
};

module.exports = { initSocket, getIO };
