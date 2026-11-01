const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        'match_found',
        'match_accepted',
        'match_rejected',
        'recovery_requested',
        'recovery_approved',
        'recovery_denied',
        'item_expired',
        'admin_message',
        'system',
      ],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    // ── Related entities ──────────────────────────────────────────────────────
    relatedMatch: { type: mongoose.Schema.Types.ObjectId, ref: 'Match' },
    relatedLostItem: { type: mongoose.Schema.Types.ObjectId, ref: 'LostItem' },
    relatedFoundItem: { type: mongoose.Schema.Types.ObjectId, ref: 'FoundItem' },
    relatedRecovery: { type: mongoose.Schema.Types.ObjectId, ref: 'RecoveryRequest' },
    // ── State ─────────────────────────────────────────────────────────────────
    isRead: { type: Boolean, default: false, index: true },
    readAt: Date,
    // ── Deep link ─────────────────────────────────────────────────────────────
    actionUrl: String,
    // ── Delivery ─────────────────────────────────────────────────────────────
    channels: {
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: false },
      emailSentAt: Date,
    },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
