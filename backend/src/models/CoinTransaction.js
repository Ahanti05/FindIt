const mongoose = require('mongoose');

// Every change to a user's FindIt coin balance is one ledger row, so the
// balance can always be explained (and recomputed) from history.
const coinTransactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true }, // positive = earned, negative = spent / held
    reason: {
      type: String,
      enum: [
        'welcome',          // new account
        'found_report',     // reported a found item with a photo
        'item_returned',    // finder: handover completed
        'reward_received',  // finder: owner's pledged reward
        'reward_pledged',   // owner: coins held while the item is lost
        'reward_refunded',  // owner: pledge returned (archived / deleted / got it back elsewhere)
        'recovery_closed',  // owner: confirmed the handover
      ],
      required: true,
    },
    note: { type: String, maxlength: 200 },
    balanceAfter: { type: Number, required: true },
    lostItem: { type: mongoose.Schema.Types.ObjectId, ref: 'LostItem' },
    foundItem: { type: mongoose.Schema.Types.ObjectId, ref: 'FoundItem' },
    recovery: { type: mongoose.Schema.Types.ObjectId, ref: 'RecoveryRequest' },
  },
  { timestamps: true }
);

coinTransactionSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('CoinTransaction', coinTransactionSchema);
