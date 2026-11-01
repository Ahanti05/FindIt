const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getMatchesForLostItem, respondToMatch } = require('../controllers/aiController');
const Match = require('../models/Match');

// Get matches for a lost item
router.get('/lost/:itemId', authenticate, getMatchesForLostItem);

// Get single match detail
router.get('/:matchId', authenticate, async (req, res, next) => {
  try {
    const match = await Match.findById(req.params.matchId)
      .populate('lostItem', 'title category image description lastSeenLocation lostDate reporter identifyingCharacteristics colors')
      .populate('foundItem', 'title category image description foundLocation foundDate reporter handoverPreference colors')
      .populate('lostItem.reporter', 'name department')
      .populate('foundItem.reporter', 'name department');

    if (!match) return res.status(404).json({ success: false, message: 'Match not found' });
    res.json({ success: true, match });
  } catch (err) {
    next(err);
  }
});

// Respond to a match
router.patch('/:matchId/respond', authenticate, respondToMatch);

module.exports = router;
