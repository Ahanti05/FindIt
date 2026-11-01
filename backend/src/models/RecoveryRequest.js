const mongoose = require('mongoose');

const recoveryRequestSchema = new mongoose.Schema(
  {
    claimant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    finder: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    lostItem: { type: mongoose.Schema.Types.ObjectId, ref: 'LostItem', required: true },
    foundItem: { type: mongoose.Schema.Types.ObjectId, ref: 'FoundItem', required: true },
    match: { type: mongoose.Schema.Types.ObjectId, ref: 'Match', required: true },
    // ── Evidence (visible to claimant, finder and admins only) ───────────────
    ownershipStatement: {
      type: String,
      required: [true, 'Ownership statement is required'],
      trim: true,
      minlength: [20, 'Please describe the item in at least 20 characters'],
      maxlength: [2000],
    },
    evidenceImages: [{ _id: false, url: String, publicId: String }],
    additionalDetails: { type: String, maxlength: 1000 },
    // ── Status ────────────────────────────────────────────────────────────────
    // pending → approved → completed, or pending → denied
    status: {
      type: String,
      enum: ['pending', 'approved', 'denied', 'completed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewNote: { type: String, maxlength: 500 },
    reviewedAt: Date,
    // ── Handover ──────────────────────────────────────────────────────────────
    // The claimant shows this code (or its QR) at handover; the finder or an
    // admin enters it to confirm the item changed hands.
    handoverCode: { type: String, select: false },
    handoverAttempts: { type: Number, default: 0, select: false },
    handoverLocation: { type: String, maxlength: 200 },
    handoverScheduled: Date,
    handoverCompletedAt: Date,
    handoverConfirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

recoveryRequestSchema.index({ status: 1, createdAt: -1 });
recoveryRequestSchema.index({ claimant: 1, status: 1 });

module.exports = mongoose.model('RecoveryRequest', recoveryRequestSchema);
