const mongoose = require('mongoose');

// In-app chat between the owner and the finder of a matched pair.
// Contact details are never exchanged automatically.
const messageSchema = new mongoose.Schema(
  {
    match: { type: mongoose.Schema.Types.ObjectId, ref: 'Match', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    body: {
      type: String,
      required: [true, 'Message cannot be empty'],
      trim: true,
      maxlength: [1000, 'Message too long'],
    },
    readAt: Date,
  },
  { timestamps: true }
);

messageSchema.index({ match: 1, createdAt: 1 });

module.exports = mongoose.model('Message', messageSchema);
