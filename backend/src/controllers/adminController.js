const LostItem = require('../models/LostItem');
const FoundItem = require('../models/FoundItem');
const Match = require('../models/Match');
const RecoveryRequest = require('../models/RecoveryRequest');
const User = require('../models/User');

// ─── Overview stats ───────────────────────────────────────────────────────────
const getStats = async (req, res, next) => {
  try {
    const [
      totalLost,
      totalFound,
      totalRecovered,
      pendingVerifications,
      totalUsers,
      recentMatches,
    ] = await Promise.all([
      LostItem.countDocuments(),
      FoundItem.countDocuments(),
      LostItem.countDocuments({ status: 'recovered' }),
      RecoveryRequest.countDocuments({ status: 'pending' }),
      User.countDocuments({ role: { $ne: 'admin' } }),
      Match.find().sort({ createdAt: -1 }).limit(5)
        .populate('lostItem', 'title category')
        .populate('foundItem', 'title category'),
    ]);

    // Category breakdown
    const lostByCategory = await LostItem.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // Activity over last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const dailyActivity = await LostItem.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          lost: { $sum: 1 },
        },
      },
    ]);

    const dailyFound = await FoundItem.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          found: { $sum: 1 },
        },
      },
    ]);

    // Heatmap data (aggregate by building)
    const heatmap = await LostItem.aggregate([
      { $match: { 'lastSeenLocation.building': { $exists: true, $ne: '' } } },
      {
        $group: {
          _id: '$lastSeenLocation.building',
          lostCount: { $sum: 1 },
          lat: { $first: '$lastSeenLocation.coordinates.lat' },
          lng: { $first: '$lastSeenLocation.coordinates.lng' },
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        overview: { totalLost, totalFound, totalRecovered, pendingVerifications, totalUsers },
        lostByCategory,
        dailyActivity: { lost: dailyActivity, found: dailyFound },
        recentMatches,
        heatmap,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── Moderation: list items awaiting review ───────────────────────────────────
const getPendingItems = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [lostItems, foundItems] = await Promise.all([
      LostItem.find({ 'moderation.isReviewed': false })
        .populate('reporter', 'name email studentId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      FoundItem.find({ 'moderation.isReviewed': false })
        .populate('reporter', 'name email studentId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
    ]);

    res.json({ success: true, data: { lostItems, foundItems } });
  } catch (err) {
    next(err);
  }
};

// ─── Moderate an item ─────────────────────────────────────────────────────────
const moderateItem = async (req, res, next) => {
  try {
    const { itemId, itemType } = req.params;
    const { isApproved, reviewNote } = req.body;

    const Model = itemType === 'lost' ? LostItem : FoundItem;
    const item = await Model.findByIdAndUpdate(
      itemId,
      {
        'moderation.isReviewed': true,
        'moderation.isApproved': isApproved,
        'moderation.reviewedBy': req.user._id,
        'moderation.reviewNote': reviewNote,
        ...(isApproved === false && { isPublic: false }),
      },
      { new: true }
    );

    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });
    res.json({ success: true, item });
  } catch (err) {
    next(err);
  }
};

// ─── List all users (admin) ───────────────────────────────────────────────────
const getUsers = async (req, res, next) => {
  try {
    const users = await User.find({ role: { $ne: 'admin' } })
      .select('-password')
      .sort({ createdAt: -1 });
    res.json({ success: true, users });
  } catch (err) {
    next(err);
  }
};

// ─── Toggle user active status ────────────────────────────────────────────────
const toggleUserStatus = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.isActive = !user.isActive;
    await user.save({ validateBeforeSave: false });
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
};

module.exports = { getStats, getPendingItems, moderateItem, getUsers, toggleUserStatus };
