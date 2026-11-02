/**
 * Seeds FindIt with demo users and reports. Every photo goes through the real
 * AI pipeline (detection → embedding → matching), so the matches you see are
 * produced by the model, not written by hand. Start the AI service first.
 *
 *   npm run seed            # add demo data (skips what already exists)
 *   npm run seed -- --reset # wipe all FindIt data first
 *
 * Photo sources are listed in seed/images/CREDITS.md.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');

const User = require('../src/models/User');
const LostItem = require('../src/models/LostItem');
const FoundItem = require('../src/models/FoundItem');
const Match = require('../src/models/Match');
const Message = require('../src/models/Message');
const Notification = require('../src/models/Notification');
const RecoveryRequest = require('../src/models/RecoveryRequest');
const { saveImage, UPLOAD_ROOT } = require('../src/services/storage');
const { processItem, aiHealth } = require('../src/services/aiPipeline');

const IMAGES = path.join(__dirname, 'images');
const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

const USERS = {
  admin: { name: 'Admin Office', email: 'admin@findit.campus', password: 'Admin@1234', role: 'admin', department: 'Lost & Found Office' },
  arun: { name: 'Arun Sharma', email: 'arun@university.edu', password: 'Test@1234', role: 'student', department: 'Computer Science', studentId: '22CS014' },
  priya: { name: 'Priya Patel', email: 'priya@university.edu', password: 'Test@1234', role: 'student', department: 'Electrical Engineering', studentId: '21EE045' },
  rahul: { name: 'Rahul Verma', email: 'rahul@university.edu', password: 'Test@1234', role: 'student', department: 'Mechanical Engineering', studentId: '22ME032' },
  meera: { name: 'Dr. Meera Nair', email: 'meera@university.edu', password: 'Test@1234', role: 'faculty', department: 'Mathematics' },
  security: { name: 'Campus Security', email: 'security@university.edu', password: 'Test@1234', role: 'staff', department: 'Security' },
};

const LOST = [
  {
    key: 'wallet', by: 'arun', photo: 'wallet.jpg', title: 'Brown leather wallet', category: 'Wallet',
    building: 'Central Cafeteria', area: 'Seating near the juice counter', date: daysAgo(2), lostTimeApprox: '13:00 – 14:00',
    description: 'Bifold brown leather wallet, quite worn at the edges. Has my college ID and a metro card inside.',
    identifyingCharacteristics: 'Long scratch across the front flap', colors: 'Brown', rewardOffered: true, rewardDescription: 'Treat at the canteen',
  },
  {
    key: 'keys', by: 'rahul', photo: 'keys_c.jpg', title: 'Bunch of keys with red Swiss Army knife', category: 'Keys',
    building: 'Sports Complex', area: 'Basketball court benches', date: daysAgo(3), lostTimeApprox: 'Evening',
    description: 'About ten keys on two rings, with a red Victorinox pocket knife and a black car key.',
    identifyingCharacteristics: 'One key has a round head with holes', colors: 'Silver, Red',
  },
  {
    key: 'idcard', by: 'priya', photo: 'idcard.jpg', title: 'Student ID card (Priya Patel)', category: 'ID Card',
    building: 'Main Library', area: 'Ground floor issue counter', date: daysAgo(1),
    description: 'Blue and white institute ID card, roll number 21EE045.', colors: 'Blue, White',
  },
  {
    key: 'headphones', by: 'priya', photo: 'headphones.jpg', title: 'Black over-ear headphones', category: 'Earphones/AirPods',
    building: 'Computer Labs', area: 'Lab 2', date: daysAgo(4),
    description: 'Black wireless over-ear headphones, left in Lab 2 after the evening session.', colors: 'Black',
  },
  {
    key: 'backpack', by: 'rahul', photo: 'backpack.jpg', title: 'Navy blue backpack', category: 'Bag/Backpack',
    building: 'Academic Block B', area: 'Room B-204', date: daysAgo(6),
    description: 'Navy laptop backpack with a small yellow logo patch on the front pocket.', colors: 'Navy',
  },
  {
    key: 'magsafe', by: 'meera', photo: 'charger_b.jpg', title: 'MagSafe charger with USB-C cable', category: 'Charger/Cable',
    building: 'Computer Labs', area: 'Faculty desk, Lab 1', date: daysAgo(2),
    description: 'Round white magnetic iPhone charger attached to a USB-C cable.', colors: 'White',
  },
  {
    key: 'bottle', by: 'arun', photo: 'bottle.jpg', title: 'Green insulated water bottle', category: 'Water Bottle',
    building: 'Lecture Hall Complex', area: 'LH-3, row 5', date: daysAgo(5),
    description: 'Matte green steel bottle, 500 ml.', colors: 'Green',
  },
  {
    key: 'laptop', by: 'meera', photo: 'laptop.jpg', title: 'Silver MacBook Pro', category: 'Laptop',
    building: 'Academic Block A', area: 'Staff room', date: daysAgo(1),
    description: '13-inch silver MacBook Pro in no case.', colors: 'Silver',
  },
];

const FOUND = [
  // Same objects as lost reports above, photographed again by the finder
  { key: 'wallet', by: 'security', photo: 'wallet_reshot.jpg', title: 'Brown wallet', category: 'Wallet', building: 'Central Cafeteria', area: 'Under a table', date: daysAgo(1), currentLocation: 'Security desk, main gate', handoverPreference: 'security-desk', description: 'Brown leather wallet handed in by cafeteria staff.' },
  { key: 'keys', by: 'meera', photo: 'keys_c_reshot.jpg', title: 'Key bunch with pocket knife', category: 'Keys', building: 'Sports Complex', area: 'Near the water cooler', date: daysAgo(2), currentLocation: 'With me – Maths department office', handoverPreference: 'in-person', description: 'Large bunch of keys with a red pocket knife attached.' },
  { key: 'idcard', by: 'security', photo: 'idcard_reshot.jpg', title: 'Institute ID card', category: 'ID Card', building: 'Main Library', area: 'Photocopier', date: daysAgo(0), currentLocation: 'Library front desk', handoverPreference: 'lost-found-office', description: 'Student ID card left in the photocopier tray.' },
  { key: 'headphones', by: 'arun', photo: 'headphones_reshot.jpg', title: 'Black headphones', category: 'Earphones/AirPods', building: 'Computer Labs', area: 'Lab 2, last row', date: daysAgo(3), currentLocation: 'With me', handoverPreference: 'in-person', description: 'Over-ear headphones left on a lab desk.' },
  { key: 'backpack', by: 'priya', photo: 'backpack_reshot.jpg', title: 'Dark blue backpack', category: 'Bag/Backpack', building: 'Academic Block B', area: 'Corridor outside B-204', date: daysAgo(5), currentLocation: 'Lost & Found Office', handoverPreference: 'lost-found-office', description: 'Backpack with a laptop sleeve, found after the lecture.' },
  // Look-alikes and unrelated items, so matching has something to reject
  { key: 'wallet_black', by: 'security', photo: 'wallet_b.jpg', title: 'Black leather wallet', category: 'Wallet', building: 'Main Library', area: 'Reading hall', date: daysAgo(3), currentLocation: 'Security desk, main gate', handoverPreference: 'security-desk', description: 'Black bifold wallet with some cards inside.' },
  { key: 'keys_blue', by: 'rahul', photo: 'keys_a.jpg', title: 'Keys with blue tag and carabiner', category: 'Keys', building: 'Academic Block A', area: 'Stairs', date: daysAgo(2), currentLocation: 'With me', handoverPreference: 'in-person', description: 'Brass keys on a ring with a blue plastic tag.' },
  { key: 'usbc', by: 'security', photo: 'charger_a.jpg', title: 'White USB-C cable', category: 'Charger/Cable', building: 'Computer Labs', area: 'Lab 1 power strip', date: daysAgo(1), currentLocation: 'Computer Labs office', handoverPreference: 'lost-found-office', description: 'Coiled white USB-C cable.' },
  { key: 'umbrella', by: 'security', photo: 'umbrella_b.jpg', title: 'Small patterned umbrella', category: 'Umbrella', building: 'Girls Hostel', area: 'Reception', date: daysAgo(4), currentLocation: 'Hostel reception', handoverPreference: 'other', description: 'Compact folding umbrella with raindrop print.' },
  { key: 'watch', by: 'priya', photo: 'watch.jpg', title: 'Silver analog watch', category: 'Watch', building: 'Student Activity Centre', area: 'Music room', date: daysAgo(3), currentLocation: 'Lost & Found Office', handoverPreference: 'lost-found-office', description: 'Automatic watch with a brown leather strap.' },
  { key: 'earbuds', by: 'arun', photo: 'earbuds_a.jpg', title: 'White wireless earbuds in case', category: 'Earphones/AirPods', building: 'Central Cafeteria', area: 'Counter', date: daysAgo(2), currentLocation: 'With me', handoverPreference: 'in-person', description: 'White earbuds with a charging case.' },
];

const reset = async () => {
  await Promise.all([User, LostItem, FoundItem, Match, Message, Notification, RecoveryRequest]
    .map((M) => M.deleteMany({})));
  await fs.rm(UPLOAD_ROOT, { recursive: true, force: true });
  console.log('Cleared existing data and uploads.');
};

const createItem = async (Model, type, spec, reporterId) => {
  const exists = await Model.findOne({ title: spec.title, reporter: reporterId });
  if (exists) return { item: exists, created: false };

  const buffer = await fs.readFile(path.join(IMAGES, spec.photo));
  const image = await saveImage(buffer, { folder: 'items', mimetype: 'image/jpeg' });
  const base = {
    reporter: reporterId, title: spec.title, category: spec.category, description: spec.description,
    colors: (spec.colors || '').split(',').map((c) => c.trim()).filter(Boolean), image,
    moderation: { isReviewed: true, isApproved: true }, // demo listings start out reviewed
  };
  const doc = type === 'lost'
    ? { ...base, lastSeenLocation: { building: spec.building, area: spec.area }, lostDate: spec.date,
      lostTimeApprox: spec.lostTimeApprox, identifyingCharacteristics: spec.identifyingCharacteristics,
      rewardOffered: Boolean(spec.rewardOffered), rewardDescription: spec.rewardDescription }
    : { ...base, foundLocation: { building: spec.building, area: spec.area }, foundDate: spec.date,
      currentLocation: spec.currentLocation, handoverPreference: spec.handoverPreference };

  const item = await Model.create(doc);
  await processItem(item._id, type, buffer);
  return { item: await Model.findById(item._id), created: true };
};

// Walks two matches through the later steps so every screen has data.
const playScenarios = async (users, lost, found) => {
  const pair = (key) => Match.findOne({ lostItem: lost[key]._id, foundItem: found[key]._id });

  // Backpack: claimed, approved and handed over.
  const backpack = await pair('backpack');
  if (backpack && backpack.status === 'pending') {
    backpack.status = 'accepted';
    backpack.lostReporterResponse = 'interested';
    backpack.foundReporterResponse = 'confirmed';
    await backpack.save();
    await Message.create([
      { match: backpack._id, sender: users.rahul._id, body: 'Hi! That looks like my bag – does it have a yellow patch on the front pocket?', createdAt: daysAgo(4.9) },
      { match: backpack._id, sender: users.priya._id, body: 'Yes it does. I gave it to the Lost & Found Office.', createdAt: daysAgo(4.8) },
    ]);
    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    await RecoveryRequest.create({
      claimant: users.rahul._id, finder: users.priya._id, lostItem: lost.backpack._id, foundItem: found.backpack._id,
      match: backpack._id, status: 'completed',
      ownershipStatement: 'There is a Mechanical Engineering lab manual inside with my name on the first page, and a blue water bottle in the side pocket.',
      reviewedBy: users.admin._id, reviewedAt: daysAgo(4.5), reviewNote: 'Lab manual name matches the claimant.',
      handoverCode: code, handoverLocation: 'Lost & Found Office, Admin Block', handoverCompletedAt: daysAgo(4),
      handoverConfirmedBy: users.admin._id,
    });
    await Promise.all([
      LostItem.updateOne({ _id: lost.backpack._id }, { status: 'recovered' }),
      FoundItem.updateOne({ _id: found.backpack._id }, { status: 'returned' }),
      Match.updateOne({ _id: backpack._id }, { status: 'verified' }),
    ]);
    console.log('  Scenario: backpack claimed and returned');
  }

  // Wallet: owner confirmed, chatting, claim waiting for the finder's review.
  const wallet = await pair('wallet');
  if (wallet && wallet.status === 'pending') {
    wallet.status = 'accepted';
    wallet.lostReporterResponse = 'interested';
    await wallet.save();
    await Message.create([
      { match: wallet._id, sender: users.arun._id, body: 'This is my wallet! Lost it at lunch on Tuesday.' },
      { match: wallet._id, sender: users.security._id, body: 'Please submit a claim describing what is inside, and we will verify it at the main gate desk.' },
    ]);
    await RecoveryRequest.create({
      claimant: users.arun._id, finder: users.security._id, lostItem: lost.wallet._id, foundItem: found.wallet._id,
      match: wallet._id, status: 'pending',
      ownershipStatement: 'It has my college ID (Arun Sharma, 22CS014), a metro card and about 300 rupees. There is a long scratch on the front flap.',
    });
    await Promise.all([
      LostItem.updateOne({ _id: lost.wallet._id }, { status: 'matched' }),
      FoundItem.updateOne({ _id: found.wallet._id }, { status: 'claimed' }),
    ]);
    console.log('  Scenario: wallet claim waiting for review');
  }
};

async function seed() {
  if (process.argv.includes('--reset')) {
    await mongoose.connect(process.env.MONGODB_URI);
    await reset();
  } else {
    await mongoose.connect(process.env.MONGODB_URI);
  }

  const health = await aiHealth();
  if (!health || health.status !== 'ok') {
    console.warn('\nThe AI service is not running – photos will be saved but not analyzed.');
    console.warn('Start it, then use "Run AI on pending items" in the admin dashboard.\n');
  }

  const users = {};
  for (const [key, u] of Object.entries(USERS)) {
    users[key] = await User.findOne({ email: u.email }) || await User.create(u);
  }
  console.log(`Users ready: ${Object.keys(users).length}`);

  // Lost first, then found, so each found item is matched against the owners.
  const lost = {};
  for (const spec of LOST) {
    const { item, created } = await createItem(LostItem, 'lost', spec, users[spec.by]._id);
    lost[spec.key] = item;
    console.log(`  lost  ${created ? '+' : '='} ${spec.title}  [AI: ${item.aiDetection?.processingStatus}]`);
  }
  const found = {};
  for (const spec of FOUND) {
    const { item, created } = await createItem(FoundItem, 'found', spec, users[spec.by]._id);
    found[spec.key] = item;
    console.log(`  found ${created ? '+' : '='} ${spec.title}  [AI: ${item.aiDetection?.processingStatus}]`);
  }

  await playScenarios(users, lost, found);

  const matches = await Match.find().populate('lostItem', 'title').populate('foundItem', 'title').sort({ combinedScore: -1 });
  console.log(`\nMatches generated by the AI: ${matches.length}`);
  matches.forEach((m) => console.log(
    `  ${m.combinedScore.toFixed(2)}  (visual ${m.scoreBreakdown.visual.toFixed(2)})  ${m.lostItem.title}  <->  ${m.foundItem.title}  [${m.status}]`
  ));

  console.log('\nDemo logins');
  Object.values(USERS).forEach((u) => console.log(`  ${u.role.padEnd(8)} ${u.email.padEnd(26)} ${u.password}`));

  await mongoose.disconnect();
}

seed().catch(async (err) => {
  console.error('Seed failed:', err);
  await mongoose.disconnect();
  process.exit(1);
});
