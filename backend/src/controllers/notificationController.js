const Notification = require('../models/Notification');
const User = require('../models/User');
const { emitToUser } = require('../services/socketService');

// ─── Create notification (internal helper) ────────────────────────────────────
const createNotification = async (data) => {
  const notification = await Notification.create(data);
  emitToUser(data.recipient, 'notification', {
    _id: notification._id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    actionUrl: notification.actionUrl,
    isRead: false,
    createdAt: notification.createdAt,
  });
  return notification;
};

const notifyAdmins = async (data) => {
  const admins = await User.find({ role: 'admin', isActive: true }).select('_id');
  await Promise.all(admins.map((a) => createNotification({ ...data, recipient: a._id })));
};

// ─── Get notifications for user ───────────────────────────────────────────────
const getNotifications = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
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

    const query = { recipient: req.user._id, isRead: false };
    if (Array.isArray(ids) && ids.length > 0) query._id = { $in: ids };

    await Notification.updateMany(query, { isRead: true, readAt: new Date() });
    const unreadCount = await Notification.countDocuments({ recipient: req.user._id, isRead: false });
    res.json({ success: true, unreadCount });
  } catch (err) {
    next(err);
  }
};

module.exports = { createNotification, notifyAdmins, getNotifications, markAsRead };
