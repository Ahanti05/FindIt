const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema(
  {
    lostItem: { type: mongoose.Schema.Types.ObjectId, ref: 'LostItem', required: true, index: true },
    foundItem: { type: mongoose.Schema.Types.ObjectId, ref: 'FoundItem', required: true, index: true },
    // Denormalised so "my matches" is a single indexed query.
    lostReporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    foundReporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // ── Scores ────────────────────────────────────────────────────────────────
    similarityScore: { type: Number, required: true, min: 0, max: 1 }, // calibrated visual score
    cosine: Number, // raw CLIP cosine, kept for analysis
    combinedScore: { type: Number, min: 0, max: 1, index: true },
    // photo   – compared by the AI service
    // details – no photo (or AI offline): compared on category, words, place, date
    // owner   – the owner said "this is mine" directly on a found report
    // finder  – the finder contacted the owner directly from a lost report
    method: { type: String, enum: ['photo', 'details', 'owner', 'finder'], default: 'photo' },
    scoreBreakdown: {
      visual: Number,
      text: Number,
      category: Number,
      location: Number,
      date: Number,
    },
    // ── Lifecycle ─────────────────────────────────────────────────────────────
    // pending  – suggested by the AI, nobody has acted yet
    // accepted – the owner says "this is mine"; chat and claims are unlocked
    // rejected – owner said "not mine" or finder said it doesn't fit
    // verified – a recovery for this pair was completed
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'verified'],
      default: 'pending',
      index: true,
    },
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
    generatedBy: { type: String, enum: ['auto', 'manual'], default: 'auto' },
  },
  { timestamps: true }
);

matchSchema.index({ lostItem: 1, foundItem: 1 }, { unique: true });
matchSchema.index({ status: 1, createdAt: -1 });

matchSchema.methods.isParticipant = function (userId) {
  const id = String(userId);
  return String(this.lostReporter?._id || this.lostReporter) === id
    || String(this.foundReporter?._id || this.foundReporter) === id;
};

module.exports = mongoose.model('Match', matchSchema);
