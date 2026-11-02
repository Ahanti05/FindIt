const User = require('../models/User');
const CoinTransaction = require('../models/CoinTransaction');
const { emitToUser } = require('./socketService');
const { HttpError } = require('../utils/http');

// How many FindIt coins each action is worth.
const COINS = {
  WELCOME: 50,
  FOUND_REPORT: 5,          // reporting a found item with a photo
  FOUND_REPORT_DAILY_CAP: 3, // ...at most this many times a day
  ITEM_RETURNED: 50,        // finder, when the handover is confirmed
  RECOVERY_CLOSED: 10,      // owner, for closing the loop
};
const REWARD_OPTIONS = [0, 10, 25, 50, 100];

// Atomically change a balance and write the ledger row. Negative amounts
// fail (without changing anything) if the user cannot afford them.
const change = async (userId, amount, reason, refs = {}) => {
  if (!amount) return null;
  const filter = { _id: userId };
  if (amount < 0) filter.coins = { $gte: -amount };
  const user = await User.findOneAndUpdate(filter, { $inc: { coins: amount } }, { new: true }).select('coins');
  if (!user) {
    if (amount < 0) throw new HttpError(400, 'Not enough FindIt coins for that reward');
    return null;
  }
  const tx = await CoinTransaction.create({ user: userId, amount, reason, balanceAfter: user.coins, ...refs });
  emitToUser(userId, 'coins', { balance: user.coins, delta: amount, reason, note: refs.note });
  return tx;
};

const award = (userId, amount, reason, refs) => change(userId, Math.abs(amount), reason, refs);

// Reporting a found item with a photo earns a little, capped per day so the
// coins can't be farmed with junk reports.
const awardFoundReport = async (userId, foundItemId) => {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const today = await CoinTransaction.countDocuments({ user: userId, reason: 'found_report', createdAt: { $gte: since } });
  if (today >= COINS.FOUND_REPORT_DAILY_CAP) return null;
  return award(userId, COINS.FOUND_REPORT, 'found_report', { foundItem: foundItemId, note: 'Reported a found item' });
};

// Owner pledges coins when reporting a lost item; they are held until the
// item comes back (paid to the finder) or the report is closed (refunded).
const holdReward = (userId, lostItemId, amount) =>
  change(userId, -amount, 'reward_pledged', { lostItem: lostItemId, note: 'Reward held for your lost item' });

const refundReward = async (lostItem) => {
  if (!lostItem.rewardCoins || lostItem.rewardCoinsSettled) return null;
  lostItem.rewardCoinsSettled = true;
  await lostItem.save();
  return award(lostItem.reporter, lostItem.rewardCoins, 'reward_refunded', { lostItem: lostItem._id, note: `Reward returned for "${lostItem.title}"` });
};

// Handover confirmed: pay the finder (base + pledged reward) and thank the owner.
const settleRecovery = async ({ recovery, lostItem, foundItem }) => {
  const refs = { recovery: recovery._id, lostItem: lostItem._id, foundItem: foundItem._id };
  await award(recovery.finder, COINS.ITEM_RETURNED, 'item_returned', { ...refs, note: `Returned "${foundItem.title}" to its owner` });
  if (lostItem.rewardCoins && !lostItem.rewardCoinsSettled) {
    lostItem.rewardCoinsSettled = true;
    await lostItem.save();
    await award(recovery.finder, lostItem.rewardCoins, 'reward_received', { ...refs, note: `Reward from the owner of "${lostItem.title}"` });
  }
  await award(recovery.claimant, COINS.RECOVERY_CLOSED, 'recovery_closed', { ...refs, note: `Got "${lostItem.title}" back` });
};

module.exports = { COINS, REWARD_OPTIONS, change, award, awardFoundReport, holdReward, refundReward, settleRecovery };
