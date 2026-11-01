const express = require('express');
const router = express.Router();
const LostItem = require('../models/LostItem');
const FoundItem = require('../models/FoundItem');
const Match = require('../models/Match');
const RecoveryRequest = require('../models/RecoveryRequest');
const { CATEGORIES, BUILDINGS, HANDOVER_OPTIONS } = require('../config/constants');

// Lists the frontend needs for its forms.
router.get('/meta', (req, res) => {
  res.json({
    success: true,
    categories: CATEGORIES,
    buildings: BUILDINGS,
    handoverOptions: HANDOVER_OPTIONS,
    // Lets the login page offer the seeded demo accounts during a presentation.
    demoMode: process.env.DEMO_MODE === 'true',
  });
});

// Real numbers for the landing page – no personal data.
router.get('/stats/public', async (req, res, next) => {
  try {
    const visible = { isPublic: true, 'moderation.isApproved': true };
    const [activeLost, activeFound, matches, recovered, recentMatches] = await Promise.all([
      LostItem.countDocuments({ ...visible, status: 'active' }),
      FoundItem.countDocuments({ ...visible, status: 'active' }),
      Match.countDocuments(),
      RecoveryRequest.countDocuments({ status: 'completed' }),
      Match.find()
        .sort({ createdAt: -1 })
        .limit(4)
        .populate('foundItem', 'category foundLocation.building')
        .select('combinedScore createdAt status foundItem'),
    ]);

    res.json({
      success: true,
      stats: { activeLost, activeFound, matches, recovered },
      recentMatches: recentMatches
        .filter((m) => m.foundItem)
        .map((m) => ({
          category: m.foundItem.category,
          building: m.foundItem.foundLocation?.building,
          score: m.combinedScore,
          status: m.status,
          createdAt: m.createdAt,
        })),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
