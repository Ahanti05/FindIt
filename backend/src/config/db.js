const mongoose = require('mongoose');
const LostItem = require('../models/LostItem');
const FoundItem = require('../models/FoundItem');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    console.log(`MongoDB connected: ${conn.connection.host}:${conn.connection.port}/${conn.connection.name}`);
    await dropLegacyTtlIndex();
  } catch (err) {
    console.error(`MongoDB connection error: ${err.message}`);
    console.error('Start MongoDB (or run "npm run db" in backend/) and check MONGODB_URI.');
    process.exit(1);
  }
};

// Earlier versions used a TTL index that silently DELETED lost reports after
// 30 days, orphaning their matches and claims. Remove it if it still exists.
const dropLegacyTtlIndex = async () => {
  try {
    const indexes = await LostItem.collection.indexes();
    const ttl = indexes.find((i) => i.key?.expiresAt && i.expireAfterSeconds !== undefined);
    if (ttl) {
      await LostItem.collection.dropIndex(ttl.name);
      console.log('Dropped legacy TTL index on lostitems.expiresAt');
    }
  } catch (_) {
    // Collection may not exist yet.
  }
};

// Marks reports past their expiry date as "expired" instead of deleting them.
const expireOldReports = async () => {
  const now = new Date();
  const [lost, found] = await Promise.all([
    LostItem.updateMany({ status: 'active', expiresAt: { $lt: now } }, { status: 'expired' }),
    FoundItem.updateMany({ status: 'active', expiresAt: { $lt: now } }, { status: 'expired' }),
  ]);
  const total = lost.modifiedCount + found.modifiedCount;
  if (total) console.log(`Marked ${total} report(s) as expired`);
};

const startExpiryJob = () => {
  expireOldReports().catch(() => {});
  setInterval(() => expireOldReports().catch(() => {}), 60 * 60 * 1000).unref();
};

module.exports = { connectDB, startExpiryJob, expireOldReports };
