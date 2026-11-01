const Notification = require('../models/Notification');
const { getIO } = require('../services/socketService');

// ─── Create notification (internal helper) ────────────────────────────────────
const createNotification = async (data) => {
  const notification = await Notification.create(data);

  // Push real-time via Socket.IO
  try {
    const io = getIO();
    io.to(`user:${data.recipient}`).emit('notification', {
      id: notification._id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      actionUrl: notification.actionUrl,
      createdAt: notification.createdAt,
    });
  } catch (_) {
    // Non-fatal
  }

  return notification;
};

// ─── Get notifications for user ───────────────────────────────────────────────
const getNotifications = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [notifications, unreadCount] = await Promise.all([
      Notification.find({ recipient: req.user._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Notification.countDocuments({ recipient: req.user._id, isRead: false }),
    ]);

    res.json({ success: true, notifications, unreadCount, page });
  } catch (err) {
    next(err);
  }
};

// ─── Mark as read ─────────────────────────────────────────────────────────────
const markAsRead = async (req, res, next) => {
  try {
    const { ids } = req.body; // array of notification IDs, or empty for all

    const query = { recipient: req.user._id };
    if (ids && ids.length > 0) query._id = { $in: ids };

    await Notification.updateMany(query, { isRead: true, readAt: new Date() });
    res.json({ success: true, message: 'Marked as read' });
  } catch (err) {
    next(err);
  }
};

module.exports = { createNotification, getNotifications, markAsRead };
