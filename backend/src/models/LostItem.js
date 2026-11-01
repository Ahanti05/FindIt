const mongoose = require('mongoose');

const CATEGORIES = [
  'ID Card', 'Wallet', 'Keys', 'Phone', 'Laptop', 'Bag/Backpack',
  'Watch', 'Earphones/AirPods', 'Charger/Cable', 'Water Bottle',
  'Umbrella', 'Glasses', 'Clothing', 'Books/Notes', 'Jewelry', 'Other',
];

const lostItemSchema = new mongoose.Schema(
  {
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Item name is required'],
      trim: true,
      maxlength: [100, 'Title too long'],
    },
    category: {
      type: String,
      enum: CATEGORIES,
      required: [true, 'Category is required'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Description too long'],
    },
    identifyingCharacteristics: {
      type: String,
      trim: true,
      maxlength: [500, 'Characteristics too long'],
    },
    // ── Location ─────────────────────────────────────────────────────────────
    lastSeenLocation: {
      building: { type: String, trim: true },
      area: { type: String, trim: true },
      coordinates: {
        lat: Number,
        lng: Number,
      },
    },
    lostDate: {
      type: Date,
      required: [true, 'Date lost is required'],
    },
    lostTimeApprox: {
      type: String, // e.g. "09:00-11:00"
    },
    // ── Image ─────────────────────────────────────────────────────────────────
    image: {
      url: String,
      publicId: String,
      thumbnailUrl: String,
    },
    // ── AI Detection ──────────────────────────────────────────────────────────
    aiDetection: {
      detectedObjects: [
        {
          label: String,
          confidence: Number,
          bbox: [Number], // [x1, y1, x2, y2]
        },
      ],
      annotatedImageUrl: String,
      primaryLabel: String,
      processingStatus: {
        type: String,
        enum: ['pending', 'processing', 'done', 'failed', 'skipped'],
        default: 'pending',
      },
    },
    // ── Embedding ─────────────────────────────────────────────────────────────
    embedding: {
      vector: [Number],
      model: String,
      generatedAt: Date,
    },
    // ── Status ────────────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ['active', 'matched', 'recovered', 'expired', 'archived'],
      default: 'active',
      index: true,
    },
    isPublic: {
      type: Boolean,
      default: true,
    },
    // ── Moderation ────────────────────────────────────────────────────────────
    moderation: {
      isReviewed: { type: Boolean, default: false },
      isApproved: { type: Boolean, default: true },
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      reviewNote: String,
    },
    // ── Color hints ───────────────────────────────────────────────────────────
    colors: [String],
    // ── Reward ────────────────────────────────────────────────────────────────
    rewardOffered: {
      type: Boolean,
      default: false,
    },
    rewardDescription: String,
    views: {
      type: Number,
      default: 0,
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ───────────────────────────────────────────────────────────────────
lostItemSchema.index({ status: 1, createdAt: -1 });
lostItemSchema.index({ category: 1, status: 1 });
lostItemSchema.index({ 'lastSeenLocation.building': 1 });
lostItemSchema.index({ lostDate: -1 });
lostItemSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('LostItem', lostItemSchema);
module.exports.CATEGORIES = CATEGORIES;
