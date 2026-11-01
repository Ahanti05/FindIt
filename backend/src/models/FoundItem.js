const mongoose = require('mongoose');

const foundItemSchema = new mongoose.Schema(
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
      enum: [
        'ID Card', 'Wallet', 'Keys', 'Phone', 'Laptop', 'Bag/Backpack',
        'Watch', 'Earphones/AirPods', 'Charger/Cable', 'Water Bottle',
        'Umbrella', 'Glasses', 'Clothing', 'Books/Notes', 'Jewelry', 'Other',
      ],
      required: [true, 'Category is required'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Description too long'],
    },
    // ── Location ─────────────────────────────────────────────────────────────
    foundLocation: {
      building: { type: String, trim: true },
      area: { type: String, trim: true },
      coordinates: {
        lat: Number,
        lng: Number,
      },
    },
    foundDate: {
      type: Date,
      required: [true, 'Date found is required'],
    },
    foundTime: String,
    // ── Handover ──────────────────────────────────────────────────────────────
    currentLocation: {
      type: String,
      trim: true,
      maxlength: [200],
    },
    handoverPreference: {
      type: String,
      enum: ['in-person', 'security-desk', 'lost-found-office', 'other'],
      default: 'lost-found-office',
    },
    // ── Contact (private, never public) ──────────────────────────────────────
    contactInfo: {
      preferEmail: { type: Boolean, default: true },
      preferPhone: { type: Boolean, default: false },
    },
    // ── Image ─────────────────────────────────────────────────────────────────
    image: {
      url: String,
      publicId: String,
    },
    // ── AI Detection ──────────────────────────────────────────────────────────
    aiDetection: {
      detectedObjects: [
        {
          label: String,
          confidence: Number,
          bbox: [Number],
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
      enum: ['active', 'claimed', 'returned', 'expired', 'archived'],
      default: 'active',
      index: true,
    },
    isPublic: { type: Boolean, default: true },
    moderation: {
      isReviewed: { type: Boolean, default: false },
      isApproved: { type: Boolean, default: true },
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      reviewNote: String,
    },
    colors: [String],
    views: { type: Number, default: 0 },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

foundItemSchema.index({ status: 1, createdAt: -1 });
foundItemSchema.index({ category: 1, status: 1 });
foundItemSchema.index({ 'foundLocation.building': 1 });
foundItemSchema.index({ foundDate: -1 });

module.exports = mongoose.model('FoundItem', foundItemSchema);
