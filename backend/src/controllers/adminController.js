const LostItem = require('../models/LostItem');
const FoundItem = require('../models/FoundItem');
const Match = require('../models/Match');
const RecoveryRequest = require('../models/RecoveryRequest');
const User = require('../models/User');
const { processItem, aiHealth } = require('../services/aiPipeline');
const { HttpError } = require('../utils/http');

// ─── Overview stats ───────────────────────────────────────────────────────────
const getStats = async (req, res, next) => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    // Group by calendar day in the viewer's timezone, not UTC.
    let timezone = 'UTC';
    try {
      if (req.query.tz) timezone = new Intl.DateTimeFormat('en', { timeZone: String(req.query.tz) }).resolvedOptions().timeZone;
    } catch (_) { /* unknown zone – keep UTC */ }
    const daily = (Model) => Model.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone } }, count: { $sum: 1 } } },
    ]);

    const [
      totalLost, totalFound, activeLost, activeFound, totalMatches, acceptedMatches,
      completedRecoveries, pendingClaims, totalUsers, lostByCategory, dailyLost, dailyFound,
      hotspots, aiLost, aiFound, health,
    ] = await Promise.all([
      LostItem.countDocuments(),
      FoundItem.countDocuments(),
      LostItem.countDocuments({ status: 'active' }),
      FoundItem.countDocuments({ status: 'active' }),
      Match.countDocuments(),
      Match.countDocuments({ status: { $in: ['accepted', 'verified'] } }),
      RecoveryRequest.countDocuments({ status: 'completed' }),
      RecoveryRequest.countDocuments({ status: 'pending' }),
      User.countDocuments({ role: { $ne: 'admin' } }),
      LostItem.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      daily(LostItem),
      daily(FoundItem),
      LostItem.aggregate([
        { $match: { 'lastSeenLocation.building': { $nin: [null, ''] } } },
        { $group: { _id: '$lastSeenLocation.building', lostCount: { $sum: 1 } } },
        { $sort: { lostCount: -1 } },
        { $limit: 8 },
      ]),
      LostItem.aggregate([{ $group: { _id: '$aiDetection.processingStatus', count: { $sum: 1 } } }]),
      FoundItem.aggregate([{ $group: { _id: '$aiDetection.processingStatus', count: { $sum: 1 } } }]),
      aiHealth(),
    ]);

    const aiStatus = {};
    [...aiLost, ...aiFound].forEach(({ _id, count }) => { aiStatus[_id || 'pending'] = (aiStatus[_id || 'pending'] || 0) + count; });

    res.json({
      success: true,
      data: {
        overview: {
          totalLost, totalFound, activeLost, activeFound, totalMatches, acceptedMatches,
          totalRecovered: completedRecoveries, pendingVerifications: pendingClaims, totalUsers,
        },
        lostByCategory,
        dailyActivity: { lost: dailyLost, found: dailyFound },
        hotspots,
        ai: { online: Boolean(health && health.status === 'ok'), health, processing: aiStatus },
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── Moderation queue: new or reported listings ───────────────────────────────
const getPendingItems = async (req, res, next) => {
  try {
    const filter = { 'moderation.isReviewed': false };
    const select = 'title category description image reporter moderation createdAt status';
    const [lostItems, foundItems] = await Promise.all([
      LostItem.find(filter).select(select).populate('reporter', 'name email').sort({ 'moderation.flags.0.at': -1, createdAt: -1 }).limit(50),
      FoundItem.find(filter).select(select).populate('reporter', 'name email').sort({ 'moderation.flags.0.at': -1, createdAt: -1 }).limit(50),
    ]);
    res.json({ success: true, data: { lostItems, foundItems } });
  } catch (err) {
    next(err);
  }
};

const moderateItem = async (req, res, next) => {
  try {
    const { itemId, itemType } = req.params;
    if (!['lost', 'found'].includes(itemType)) throw new HttpError(400, 'Unknown item type');
    const isApproved = req.body.isApproved === true || req.body.isApproved === 'true';
    const Model = itemType === 'lost' ? LostItem : FoundItem;
    const item = await Model.findByIdAndUpdate(
      itemId,
      {
        'moderation.isReviewed': true,
        'moderation.isApproved': isApproved,
        'moderation.reviewedBy': req.user._id,
        'moderation.reviewNote': req.body.reviewNote,
        isPublic: isApproved,
      },
      { new: true }
    );
    if (!item) throw new HttpError(404, 'Item not found');
    res.json({ success: true, item });
  } catch (err) {
    next(err);
  }
};

// ─── Claims queue ─────────────────────────────────────────────────────────────
const getRecoveries = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status && req.query.status !== 'all') filter.status = req.query.status;
    const recoveries = await RecoveryRequest.find(filter)
      .populate('claimant', 'name email department')
      .populate('finder', 'name')
      .populate('lostItem', 'title category image')
      .populate('foundItem', 'title category image')
      .sort({ createdAt: -1 })
      .limit(100);
    res.json({ success: true, recoveries });
  } catch (err) {
    next(err);
  }
};

// ─── Users ────────────────────────────────────────────────────────────────────
const getUsers = async (req, res, next) => {
  try {
    const users = await User.find({ role: { $ne: 'admin' } }).sort({ createdAt: -1 });
    res.json({ success: true, users });
  } catch (err) {
    next(err);
  }
};

const toggleUserStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) throw new HttpError(404, 'User not found');
    if (user.role === 'admin') throw new HttpError(400, 'Admin accounts cannot be deactivated here');
    user.isActive = !user.isActive;
    await user.save({ validateBeforeSave: false });
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
};

// ─── Re-run AI on reports that were never processed or failed ────────────────
const backfillAI = async (req, res, next) => {
  try {
    const health = await aiHealth();
    if (!health || health.status !== 'ok') throw new HttpError(503, 'The AI service is offline');

    const filter = {
      'image.url': { $exists: true, $ne: null },
      'aiDetection.processingStatus': { $in: ['pending', 'failed'] },
    };
    const [lost, found] = await Promise.all([
      LostItem.find(filter).select('_id'),
      FoundItem.find(filter).select('_id'),
    ]);
    const queue = [...lost.map((i) => [i._id, 'lost']), ...found.map((i) => [i._id, 'found'])];

    // Sequential so the AI service isn't flooded.
    (async () => {
      for (const [id, type] of queue) await processItem(id, type);
    })();

    res.status(202).json({ success: true, queued: queue.length });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getStats, getPendingItems, moderateItem, getRecoveries, getUsers, toggleUserStatus, backfillAI,
};
