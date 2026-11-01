const mongoose = require('mongoose');
const { CATEGORIES } = require('../config/constants');

// Schema pieces shared by LostItem and FoundItem.

const locationSchema = {
  building: { type: String, trim: true },
  area: { type: String, trim: true, maxlength: 200 },
  coordinates: { lat: Number, lng: Number },
};

const imageSchema = {
  url: String,
  publicId: String,
};

const aiDetectionSchema = {
  detectedObjects: [
    {
      _id: false,
      label: String,
      confidence: Number,
      bbox: [Number], // [x1, y1, x2, y2]
    },
  ],
  annotatedImageUrl: String,
  primaryLabel: String,
  suggestedCategory: String,
  categoryGuesses: [{ _id: false, category: String, confidence: Number }],
  processingStatus: {
    type: String,
    enum: ['pending', 'processing', 'done', 'failed', 'skipped'],
    default: 'pending',
  },
  error: String,
  processedAt: Date,
};

const embeddingSchema = {
  // Never sent to clients; matching code selects it explicitly.
  vector: { type: [Number], select: false },
  model: String,
  generatedAt: Date,
};

const moderationSchema = {
  isReviewed: { type: Boolean, default: false },
  isApproved: { type: Boolean, default: true },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewNote: String,
  flags: [
    {
      _id: false,
      by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      reason: { type: String, maxlength: 300 },
      at: { type: Date, default: Date.now },
    },
  ],
};

const commonFields = {
  reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: {
    type: String,
    required: [true, 'Item name is required'],
    trim: true,
    maxlength: [100, 'Title too long'],
  },
  category: {
    type: String,
    enum: { values: CATEGORIES, message: 'Unknown category' },
    required: [true, 'Category is required'],
  },
  description: { type: String, trim: true, maxlength: [1000, 'Description too long'] },
  colors: [String],
  image: imageSchema,
  aiDetection: aiDetectionSchema,
  embedding: embeddingSchema,
  isPublic: { type: Boolean, default: true },
  moderation: moderationSchema,
  views: { type: Number, default: 0 },
  // After this date an active report is marked "expired" (it is never deleted,
  // so matches and recovery history keep working).
  expiresAt: { type: Date, default: () => new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) },
};

const parseColors = (colors) => {
  if (!colors) return [];
  const list = Array.isArray(colors) ? colors : String(colors).split(',');
  return list.map((c) => c.trim()).filter(Boolean).slice(0, 6);
};

module.exports = { locationSchema, commonFields, parseColors };
