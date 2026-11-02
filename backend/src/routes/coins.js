const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const CoinTransaction = require('../models/CoinTransaction');
const User = require('../models/User');
const { COINS, REWARD_OPTIONS } = require('../services/coinService');

const FINDER_REASONS = ['found_report', 'item_returned', 'reward_received'];

// Balance, recent history and how coins are earned.
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const [user, history] = await Promise.all([
      User.findById(req.user._id).select('coins'),
      CoinTransaction.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(50),
    ]);
    res.json({ success: true, balance: user.coins, history, rules: COINS, rewardOptions: REWARD_OPTIONS });
  } catch (err) {
    next(err);
  }
});

// Top finders by coins earned from returning items (not by balance, so
// spending coins on rewards doesn't push anyone down).
router.get('/leaderboard', async (req, res, next) => {
  try {
    const rows = await CoinTransaction.aggregate([
      { $match: { reason: { $in: FINDER_REASONS } } },
      {
        $group: {
          _id: '$user',
          earned: { $sum: '$amount' },
          returned: { $sum: { $cond: [{ $eq: ['$reason', 'item_returned'] }, 1, 0] } },
        },
      },
      { $sort: { earned: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      { $match: { 'user.isActive': true } },
      { $project: { _id: 0, earned: 1, returned: 1, name: '$user.name', department: '$user.department', avatar: '$user.avatar' } },
    ]);
    res.json({ success: true, leaderboard: rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
