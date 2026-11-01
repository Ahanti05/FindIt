const axios = require('axios');
const LostItem = require('../models/LostItem');
const FoundItem = require('../models/FoundItem');
const Match = require('../models/Match');
const { createNotification } = require('./notificationController');

const AI_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

// ─── Detect objects in image ──────────────────────────────────────────────────
const detectObjects = async (req, res, next) => {
  try {
    const { imageUrl } = req.body;
    if (!imageUrl) {
      return res.status(400).json({ success: false, message: 'imageUrl is required' });
    }

    const response = await axios.post(`${AI_URL}/detect`, { image_url: imageUrl }, { timeout: 30000 });
    res.json({ success: true, data: response.data });
  } catch (err) {
    if (err.code === 'ECONNREFUSED') {
      return res.status(503).json({
        success: false,
        message: 'AI service is not available. Object detection skipped.',
        fallback: true,
      });
    }
    next(err);
  }
};

// ─── Get matches for a lost item ──────────────────────────────────────────────
const getMatchesForLostItem = async (req, res, next) => {
  try {
    const { itemId } = req.params;
    const lostItem = await LostItem.findById(itemId);
    if (!lostItem) return res.status(404).json({ success: false, message: 'Lost item not found' });

    // Authorization: only reporter or admin
    if (lostItem.reporter.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const matches = await Match.find({ lostItem: itemId })
      .populate('foundItem', 'title category image foundLocation foundDate status description')
      .sort({ combinedScore: -1 })
      .limit(20);

    res.json({ success: true, matches });
  } catch (err) {
    next(err);
  }
};

// ─── Trigger matching for an item (called after upload) ──────────────────────
const triggerMatching = async (itemId, itemType, userId) => {
  try {
    const response = await axios.post(
      `${AI_URL}/match`,
      { item_id: itemId, item_type: itemType },
      { timeout: 60000 }
    );

    const { matches } = response.data;
    if (!matches || matches.length === 0) return;

    for (const m of matches) {
      // Prevent duplicate matches
      const existing = await Match.findOne({
        lostItem: itemType === 'lost' ? itemId : m.item_id,
        foundItem: itemType === 'found' ? itemId : m.item_id,
      });
      if (existing) continue;

      const matchDoc = await Match.create({
        lostItem: itemType === 'lost' ? itemId : m.item_id,
        foundItem: itemType === 'found' ? itemId : m.item_id,
        similarityScore: m.similarity_score,
        combinedScore: m.combined_score,
        scoreBreakdown: m.score_breakdown,
        status: 'pending',
      });

      // Notify the user
      if (matchDoc.combinedScore >= 0.5) {
        await createNotification({
          recipient: userId,
          type: 'match_found',
          title: 'Potential Match Found!',
          message: `We found a potential match for your ${itemType} item with ${Math.round(matchDoc.combinedScore * 100)}% similarity.`,
          relatedMatch: matchDoc._id,
          [`related${itemType === 'lost' ? 'LostItem' : 'FoundItem'}`]: itemId,
          actionUrl: `/dashboard/matches/${matchDoc._id}`,
        });
      }
    }
  } catch (err) {
    // Non-fatal: matching failure should not block the user
    console.error('Matching service error:', err.message);
  }
};

// ─── Respond to a match (interested / not-mine) ───────────────────────────────
const respondToMatch = async (req, res, next) => {
  try {
    const { matchId } = req.params;
    const { response: userResponse } = req.body; // 'interested' | 'not-mine'

    const match = await Match.findById(matchId)
      .populate('lostItem', 'reporter')
      .populate('foundItem', 'reporter');

    if (!match) return res.status(404).json({ success: false, message: 'Match not found' });

    const isLostReporter = match.lostItem.reporter.toString() === req.user._id.toString();
    const isFoundReporter = match.foundItem.reporter.toString() === req.user._id.toString();

    if (!isLostReporter && !isFoundReporter && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (isLostReporter) match.lostReporterResponse = userResponse;
    if (isFoundReporter) match.foundReporterResponse = userResponse;

    if (match.lostReporterResponse === 'interested' && match.foundReporterResponse === 'confirmed') {
      match.status = 'accepted';
    } else if (match.lostReporterResponse === 'not-mine' || match.foundReporterResponse === 'denied') {
      match.status = 'rejected';
    }

    await match.save();
    res.json({ success: true, match });
  } catch (err) {
    next(err);
  }
};

module.exports = { detectObjects, getMatchesForLostItem, triggerMatching, respondToMatch };
