const mongoose = require('mongoose');
const { CATEGORIES } = require('../config/constants');
const { locationSchema, commonFields } = require('./itemShared');

const lostItemSchema = new mongoose.Schema(
  {
    ...commonFields,
    identifyingCharacteristics: {
      type: String,
      trim: true,
      maxlength: [500, 'Characteristics too long'],
    },
    lastSeenLocation: locationSchema,
    lostDate: { type: Date, required: [true, 'Date lost is required'] },
    lostTimeApprox: { type: String, maxlength: 40 },
    status: {
      type: String,
      enum: ['active', 'matched', 'recovered', 'expired', 'archived'],
      default: 'active',
      index: true,
    },
    rewardOffered: { type: Boolean, default: false },
    rewardDescription: { type: String, maxlength: 200 },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

lostItemSchema.index({ status: 1, createdAt: -1 });
lostItemSchema.index({ category: 1, status: 1 });
lostItemSchema.index({ 'lastSeenLocation.building': 1 });
lostItemSchema.index({ lostDate: -1 });

module.exports = mongoose.model('LostItem', lostItemSchema);
module.exports.CATEGORIES = CATEGORIES;
