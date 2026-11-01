const mongoose = require('mongoose');

const recoveryRequestSchema = new mongoose.Schema(
  {
    claimant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    lostItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LostItem',
      required: true,
    },
    foundItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FoundItem',
      required: true,
    },
    match: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Match',
    },
    // ── Evidence ─────────────────────────────────────────────────────────────
    ownershipStatement: {
      type: String,
      required: [true, 'Ownership statement is required'],
      maxlength: [2000],
    },
    evidenceImages: [
      {
        url: String,
        publicId: String,
        description: String,
      },
    ],
    additionalDetails: String,
    // ── Status ────────────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ['pending', 'under_review', 'approved', 'denied', 'completed'],
      default: 'pending',
      index: true,
    },
    // ── Admin review ─────────────────────────────────────────────────────────
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewNote: String,
    reviewedAt: Date,
    // ── QR Code ───────────────────────────────────────────────────────────────
    qrCode: {
      url: String,
      data: String,
      generatedAt: Date,
    },
    // ── Handover ──────────────────────────────────────────────────────────────
    handoverScheduled: Date,
    handoverLocation: String,
    handoverCompletedAt: Date,
    handoverNote: String,
  },
  { timestamps: true }
);

recoveryRequestSchema.index({ status: 1, createdAt: -1 });
recoveryRequestSchema.index({ claimant: 1, status: 1 });

module.exports = mongoose.model('RecoveryRequest', recoveryRequestSchema);
