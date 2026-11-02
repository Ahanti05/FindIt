const mongoose = require('mongoose');
const { HANDOVER_OPTIONS } = require('../config/constants');
const { locationSchema, commonFields } = require('./itemShared');

const foundItemSchema = new mongoose.Schema(
  {
    ...commonFields,
    foundLocation: locationSchema,
    foundDate: { type: Date, required: [true, 'Date found is required'] },
    foundTime: { type: String, maxlength: 20 },
    // Where the item is being kept right now (shown publicly).
    currentLocation: { type: String, trim: true, maxlength: 200 },
    // Name / roll number / email written on the item, if any. Private: only
    // used to alert a registered owner who hasn't reported the loss yet.
    ownerHint: { type: String, trim: true, maxlength: 120, select: false },
    ownerNotified: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    handoverPreference: {
      type: String,
      enum: HANDOVER_OPTIONS,
      default: 'lost-found-office',
    },
    status: {
      type: String,
      enum: ['active', 'claimed', 'returned', 'expired', 'archived'],
      default: 'active',
      index: true,
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
