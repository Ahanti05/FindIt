const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const RecoveryRequest = require('../models/RecoveryRequest');
const LostItem = require('../models/LostItem');
const FoundItem = require('../models/FoundItem');
const { createNotification } = require('../controllers/notificationController');
const QRCode = require('qrcode');
const { upload } = require('../config/cloudinary');

// ─── Submit recovery request ──────────────────────────────────────────────────
router.post('/', authenticate, upload.array('evidenceImages', 5), async (req, res, next) => {
  try {
    const { lostItemId, foundItemId, matchId, ownershipStatement, additionalDetails } = req.body;

    const [lostItem, foundItem] = await Promise.all([
      LostItem.findById(lostItemId),
      FoundItem.findById(foundItemId),
    ]);

    if (!lostItem || !foundItem) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    // Only the lost item reporter can submit a claim
    if (lostItem.reporter.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the owner of the lost report can claim' });
    }

    const evidenceImages = (req.files || []).map(f => ({
      url: f.path,
      publicId: f.filename,
    }));

    const recovery = await RecoveryRequest.create({
      claimant: req.user._id,
      lostItem: lostItemId,
      foundItem: foundItemId,
      match: matchId,
      ownershipStatement,
      additionalDetails,
      evidenceImages,
    });

    // Notify found item reporter and admins
    await createNotification({
      recipient: foundItem.reporter,
      type: 'recovery_requested',
      title: 'Someone claims your found item!',
      message: `A user has submitted a recovery request for your found item: "${foundItem.title}".`,
      relatedRecovery: recovery._id,
      relatedFoundItem: foundItemId,
      actionUrl: `/recovery/${recovery._id}`,
    });

    res.status(201).json({ success: true, recovery });
  } catch (err) {
    next(err);
  }
});

// ─── Get recovery request ─────────────────────────────────────────────────────
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const recovery = await RecoveryRequest.findById(req.params.id)
      .populate('claimant', 'name email department studentId')
      .populate('lostItem', 'title category image')
      .populate('foundItem', 'title category image handoverPreference');

    if (!recovery) return res.status(404).json({ success: false, message: 'Recovery request not found' });
    res.json({ success: true, recovery });
  } catch (err) {
    next(err);
  }
});

// ─── Admin: approve or deny ───────────────────────────────────────────────────
router.patch('/:id/review', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { status, reviewNote, handoverLocation, handoverScheduled } = req.body;
    const recovery = await RecoveryRequest.findById(req.params.id)
      .populate('claimant', '_id')
      .populate('lostItem', '_id reporter')
      .populate('foundItem', '_id reporter');

    if (!recovery) return res.status(404).json({ success: false, message: 'Not found' });

    recovery.status = status;
    recovery.reviewNote = reviewNote;
    recovery.reviewedBy = req.user._id;
    recovery.reviewedAt = new Date();
    if (handoverLocation) recovery.handoverLocation = handoverLocation;
    if (handoverScheduled) recovery.handoverScheduled = new Date(handoverScheduled);

    // Generate QR code for approved recoveries
    if (status === 'approved') {
      const qrData = JSON.stringify({
        recoveryId: recovery._id,
        claimant: recovery.claimant._id,
        lostItem: recovery.lostItem._id,
        foundItem: recovery.foundItem._id,
        approvedAt: new Date().toISOString(),
      });
      const qrUrl = await QRCode.toDataURL(qrData);
      recovery.qrCode = { url: qrUrl, data: qrData, generatedAt: new Date() };

      await LostItem.findByIdAndUpdate(recovery.lostItem._id, { status: 'recovered' });
      await FoundItem.findByIdAndUpdate(recovery.foundItem._id, { status: 'returned' });
    }

    await recovery.save();

    // Notify claimant
    await createNotification({
      recipient: recovery.claimant._id,
      type: status === 'approved' ? 'recovery_approved' : 'recovery_denied',
      title: status === 'approved' ? 'Recovery Request Approved! 🎉' : 'Recovery Request Denied',
      message: status === 'approved'
        ? `Your claim has been approved. Please collect your item at: ${handoverLocation || 'Lost & Found Office'}`
        : `Your claim was denied. Reason: ${reviewNote || 'Please contact the office for details.'}`,
      relatedRecovery: recovery._id,
      actionUrl: `/recovery/${recovery._id}`,
    });

    res.json({ success: true, recovery });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
