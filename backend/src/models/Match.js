const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema(
  {
    lostItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LostItem',
      required: true,
      index: true,
    },
    foundItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FoundItem',
      required: true,
      index: true,
    },
    // ── Scores ────────────────────────────────────────────────────────────────
    similarityScore: {
      type: Number, // cosine similarity 0-1
      required: true,
      min: 0,
      max: 1,
    },
    combinedScore: {
      type: Number, // weighted: visual + category + location + date
      min: 0,
      max: 1,
    },
    scoreBreakdown: {
      visual: Number,
      category: Number,
      location: Number,
      dateProximity: Number,
    },
    // ── Status ────────────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ['pending', 'notified', 'accepted', 'rejected', 'verified'],
      default: 'pending',
      index: true,
    },
    // ── Notification tracking ─────────────────────────────────────────────────
    lostReporterNotified: { type: Boolean, default: false },
    foundReporterNotified: { type: Boolean, default: false },
    // ── User feedback ─────────────────────────────────────────────────────────
    lostReporterResponse: {
      type: String,
      enum: ['none', 'interested', 'not-mine'],
      default: 'none',
    },
    foundReporterResponse: {
      type: String,
      enum: ['none', 'confirmed', 'denied'],
      default: 'none',
    },
    generatedBy: {
      type: String,
      enum: ['auto', 'manual'],
      default: 'auto',
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  },
  { timestamps: true }
);

matchSchema.index({ lostItem: 1, foundItem: 1 }, { unique: true });
matchSchema.index({ combinedScore: -1 });
matchSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Match', matchSchema);
