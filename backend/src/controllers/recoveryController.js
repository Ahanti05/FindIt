const crypto = require('crypto');
const RecoveryRequest = require('../models/RecoveryRequest');
const Match = require('../models/Match');
const LostItem = require('../models/LostItem');
const FoundItem = require('../models/FoundItem');
const { saveImage } = require('../services/storage');
const coins = require('../services/coinService');
const { createNotification, notifyAdmins } = require('./notificationController');
const { HttpError, idOf } = require('../utils/http');

const MAX_CODE_ATTEMPTS = 5;

const roleIn = (recovery, user) => {
  if (idOf(recovery.claimant) === String(user._id)) return 'claimant';
  if (idOf(recovery.finder) === String(user._id)) return 'finder';
  return user.role === 'admin' ? 'admin' : null;
};

const resetItems = (recovery) => Promise.all([
  LostItem.updateOne({ _id: idOf(recovery.lostItem), status: 'matched' }, { status: 'active' }),
  FoundItem.updateOne({ _id: idOf(recovery.foundItem), status: 'claimed' }, { status: 'active' }),
]);

// ─── Submit a claim ───────────────────────────────────────────────────────────
const createRecovery = async (req, res, next) => {
  try {
    const { matchId, ownershipStatement, additionalDetails } = req.body;
    const match = await Match.findById(matchId)
      .populate('lostItem', 'title status reporter')
      .populate('foundItem', 'title status reporter');
    if (!match || !match.lostItem || !match.foundItem) throw new HttpError(404, 'Match not found');
    if (idOf(match.lostReporter) !== String(req.user._id)) {
      throw new HttpError(403, 'Only the person who reported the item lost can claim it');
    }
    if (match.status === 'rejected') throw new HttpError(400, 'This match was dismissed');
    if (match.status === 'verified') throw new HttpError(400, 'This item has already been returned');
    if (match.foundItem.status !== 'active') {
      throw new HttpError(409, 'Someone already has a claim in progress for this found item');
    }

    const existing = await RecoveryRequest.findOne({ match: match._id, status: { $in: ['pending', 'approved'] } });
    if (existing) throw new HttpError(409, 'You already have an open claim for this match');

    const evidenceImages = await Promise.all((req.files || []).map((f) =>
      saveImage(f.buffer, { folder: 'evidence', mimetype: f.mimetype })));

    const recovery = await RecoveryRequest.create({
      claimant: req.user._id,
      finder: match.foundReporter,
      lostItem: match.lostItem._id,
      foundItem: match.foundItem._id,
      match: match._id,
      ownershipStatement,
      additionalDetails,
      evidenceImages,
    });

    // Claiming implies the owner recognised the item.
    if (match.status === 'pending') {
      match.status = 'accepted';
      match.lostReporterResponse = 'interested';
      await match.save();
    }
    await Promise.all([
      LostItem.updateOne({ _id: match.lostItem._id }, { status: 'matched' }),
      FoundItem.updateOne({ _id: match.foundItem._id }, { status: 'claimed' }),
    ]);

    const notice = {
      type: 'recovery_requested',
      title: 'Ownership claim submitted',
      message: `${req.user.name} has claimed the found "${match.foundItem.title}". Review their proof of ownership.`,
      relatedRecovery: recovery._id,
      relatedFoundItem: match.foundItem._id,
      actionUrl: `/recovery/${recovery._id}`,
    };
    await Promise.all([createNotification({ ...notice, recipient: match.foundReporter }), notifyAdmins(notice)]);

    res.status(201).json({ success: true, recovery });
  } catch (err) {
    next(err);
  }
};

// ─── My claims (as claimant or finder) ────────────────────────────────────────
const getMyRecoveries = async (req, res, next) => {
  try {
    const me = req.user._id;
    const recoveries = await RecoveryRequest.find({ $or: [{ claimant: me }, { finder: me }] })
      .populate('lostItem', 'title category image')
      .populate('foundItem', 'title category image')
      .populate('claimant', 'name department')
      .sort({ updatedAt: -1 })
      .limit(50);
    res.json({
      success: true,
      recoveries: recoveries.map((r) => ({ ...r.toJSON(), role: idOf(r.claimant) === String(me) ? 'claimant' : 'finder' })),
    });
  } catch (err) {
    next(err);
  }
};

// ─── Detail ───────────────────────────────────────────────────────────────────
const getRecovery = async (req, res, next) => {
  try {
    const recovery = await RecoveryRequest.findById(req.params.id)
      .select('+handoverCode')
      .populate('claimant', 'name email department studentId')
      .populate('finder', 'name department')
      .populate('reviewedBy', 'name role')
      .populate('lostItem', 'title category image identifyingCharacteristics colors rewardCoins')
      .populate('foundItem', 'title category image handoverPreference currentLocation');
    if (!recovery) throw new HttpError(404, 'Recovery request not found');

    const role = roleIn(recovery, req.user);
    if (!role) throw new HttpError(403, 'Access denied');

    const json = recovery.toJSON();
    // Only the claimant ever sees the handover code – they show it to the finder.
    if (role !== 'claimant' || json.status !== 'approved') delete json.handoverCode;
    // The finder sees who is claiming, but not their contact details.
    if (role === 'finder' && json.claimant) {
      delete json.claimant.email;
      delete json.claimant.studentId;
    }
    res.json({ success: true, recovery: json, role });
  } catch (err) {
    next(err);
  }
};

// ─── Review (finder or admin) ─────────────────────────────────────────────────
const reviewRecovery = async (req, res, next) => {
  try {
    const { decision, reviewNote, handoverLocation, handoverScheduled } = req.body;
    if (!['approved', 'denied'].includes(decision)) throw new HttpError(400, 'Decision must be approved or denied');

    const recovery = await RecoveryRequest.findById(req.params.id).populate('foundItem', 'title');
    if (!recovery) throw new HttpError(404, 'Not found');
    const role = roleIn(recovery, req.user);
    if (role !== 'finder' && role !== 'admin') throw new HttpError(403, 'Only the finder or an admin can review a claim');
    if (recovery.status !== 'pending') throw new HttpError(400, `This claim is already ${recovery.status}`);

    recovery.status = decision;
    recovery.reviewNote = reviewNote;
    recovery.reviewedBy = req.user._id;
    recovery.reviewedAt = new Date();

    if (decision === 'approved') {
      if (!handoverLocation) throw new HttpError(400, 'Please say where the handover will happen');
      recovery.handoverLocation = handoverLocation;
      if (handoverScheduled) recovery.handoverScheduled = new Date(handoverScheduled);
      recovery.handoverCode = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    } else {
      await resetItems(recovery);
      await Match.updateOne({ _id: recovery.match }, { status: 'rejected' });
    }
    await recovery.save();

    await createNotification({
      recipient: recovery.claimant,
      type: decision === 'approved' ? 'recovery_approved' : 'recovery_denied',
      title: decision === 'approved' ? 'Your claim was approved' : 'Your claim was not approved',
      message: decision === 'approved'
        ? `Collect "${recovery.foundItem.title}" at ${handoverLocation}. Show your handover code there.`
        : `Reason: ${reviewNote || 'the details did not match the item.'}`,
      relatedRecovery: recovery._id,
      actionUrl: `/recovery/${recovery._id}`,
    });

    res.json({ success: true, recovery });
  } catch (err) {
    next(err);
  }
};

// ─── Confirm handover with the claimant's code ────────────────────────────────
const completeRecovery = async (req, res, next) => {
  try {
    const recovery = await RecoveryRequest.findById(req.params.id).select('+handoverCode +handoverAttempts');
    if (!recovery) throw new HttpError(404, 'Not found');
    const role = roleIn(recovery, req.user);
    if (role !== 'finder' && role !== 'admin') throw new HttpError(403, 'Only the finder or an admin can confirm the handover');
    if (recovery.status !== 'approved') throw new HttpError(400, 'Only approved claims can be completed');
    if (recovery.handoverAttempts >= MAX_CODE_ATTEMPTS) {
      throw new HttpError(429, 'Too many wrong codes. Ask an admin to review this claim.');
    }

    // Accept either the 6-digit code or the full QR payload.
    const raw = String(req.body.code || '').trim();
    const code = raw.startsWith('FINDIT:') ? raw.split(':')[2] || '' : raw;
    const expected = Buffer.from(recovery.handoverCode || '');
    const given = Buffer.from(code.padEnd(expected.length, ' ').slice(0, expected.length));
    const ok = code.length === expected.length && expected.length > 0 && crypto.timingSafeEqual(expected, given);

    if (!ok) {
      recovery.handoverAttempts += 1;
      await recovery.save();
      throw new HttpError(400, `That code does not match (${MAX_CODE_ATTEMPTS - recovery.handoverAttempts} attempts left)`);
    }

    recovery.status = 'completed';
    recovery.handoverCompletedAt = new Date();
    recovery.handoverConfirmedBy = req.user._id;
    await recovery.save();

    const [lostItem, foundItem] = await Promise.all([
      LostItem.findByIdAndUpdate(recovery.lostItem, { status: 'recovered' }, { new: true }),
      FoundItem.findByIdAndUpdate(recovery.foundItem, { status: 'returned' }, { new: true }),
      Match.updateOne({ _id: recovery.match }, { status: 'verified' }),
    ]);
    await coins.settleRecovery({ recovery, lostItem, foundItem });
    const earned = coins.COINS.ITEM_RETURNED + (lostItem.rewardCoins || 0);

    const notice = {
      type: 'recovery_completed',
      title: 'Handover complete',
      message: `The item is back with its owner. The finder earned ${earned} FindIt coins – thank you!`,
      relatedRecovery: recovery._id,
      actionUrl: `/recovery/${recovery._id}`,
    };
    await Promise.all([
      createNotification({ ...notice, recipient: recovery.claimant }),
      createNotification({ ...notice, recipient: recovery.finder }),
    ]);

    res.json({ success: true, recovery });
  } catch (err) {
    next(err);
  }
};

// ─── Claimant withdraws ───────────────────────────────────────────────────────
const cancelRecovery = async (req, res, next) => {
  try {
    const recovery = await RecoveryRequest.findById(req.params.id);
    if (!recovery) throw new HttpError(404, 'Not found');
    if (roleIn(recovery, req.user) !== 'claimant') throw new HttpError(403, 'Only the claimant can withdraw a claim');
    if (!['pending', 'approved'].includes(recovery.status)) throw new HttpError(400, 'This claim can no longer be withdrawn');

    recovery.status = 'cancelled';
    await recovery.save();
    await resetItems(recovery);
    await createNotification({
      recipient: recovery.finder,
      type: 'system',
      title: 'Claim withdrawn',
      message: 'The claimant withdrew their claim. The item is listed as found again.',
      relatedRecovery: recovery._id,
      actionUrl: `/recovery/${recovery._id}`,
    });
    res.json({ success: true, recovery });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createRecovery, getMyRecoveries, getRecovery, reviewRecovery, completeRecovery, cancelRecovery,
};
