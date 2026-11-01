/**
 * seed.js – Populates the FindIt database with sample users and lost/found items.
 *
 * Usage:
 *   node seed.js          # seeds data
 *   node seed.js --reset  # drops existing data first, then seeds
 */

require('dotenv').config();
const mongoose = require('mongoose');

// ─── Models ──────────────────────────────────────────────────────────────────
const User = require('./src/models/User');
const LostItem = require('./src/models/LostItem');
const FoundItem = require('./src/models/FoundItem');

// ─── Sample image URLs (royalty-free Unsplash, small size) ───────────────────
const IMG = {
  wallet: 'https://images.unsplash.com/photo-1627123424574-724758594e93?w=400&q=80',
  keys: 'https://images.unsplash.com/photo-1582139329536-e7284fece509?w=400&q=80',
  laptop: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400&q=80',
  waterbottle: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=400&q=80',
  backpack: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&q=80',
  idcard: 'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=400&q=80',
  umbrella: 'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?w=400&q=80',
  headphones: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&q=80',
  watch: 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=400&q=80',
  charger: 'https://images.unsplash.com/photo-1583863788434-e62bd6462048?w=400&q=80',
};

// ─── Sample users ────────────────────────────────────────────────────────────
const users = [
  {
    name: 'Admin User',
    email: 'admin@findit.campus',
    password: 'Admin@1234',
    role: 'admin',
    department: 'IT Services',
    studentId: 'ADM001',
    isActive: true,
  },
  {
    name: 'Arun Sharma',
    email: 'arun@university.edu',
    password: 'Test@1234',
    role: 'student',
    department: 'Computer Science',
    studentId: '20CS001',
    isActive: true,
  },
  {
    name: 'Priya Patel',
    email: 'priya@university.edu',
    password: 'Test@1234',
    role: 'student',
    department: 'Electrical Engineering',
    studentId: '21EE045',
    isActive: true,
  },
  {
    name: 'Dr. Meera Nair',
    email: 'meera@university.edu',
    password: 'Test@1234',
    role: 'faculty',
    department: 'Mathematics',
    isActive: true,
  },
  {
    name: 'Rahul Verma',
    email: 'rahul@university.edu',
    password: 'Test@1234',
    role: 'student',
    department: 'Mechanical Engineering',
    studentId: '22ME032',
    isActive: true,
  },
];

async function seed() {
  const reset = process.argv.includes('--reset');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB');

  if (reset) {
    console.log('🗑️  Resetting collections...');
    await User.deleteMany({});
    await LostItem.deleteMany({});
    await FoundItem.deleteMany({});
    console.log('   Done.');
  }

  // ── Create users ────────────────────────────────────────────────────────────
  console.log('👤 Creating users...');
  const createdUsers = [];

  for (const u of users) {
    const existing = await User.findOne({ email: u.email });
    if (existing) {
      console.log(`   ↳ ${u.email} already exists, skipping.`);
      createdUsers.push(existing);
      continue;
    }
    const user = await User.create(u);
    console.log(`   ↳ Created ${u.email} (${u.role})`);
    createdUsers.push(user);
  }

  const [admin, arun, priya, meera, rahul] = createdUsers;

  // ── Create lost items ───────────────────────────────────────────────────────
  // Schema uses: category (enum: 'Wallet', 'Keys', etc.), lastSeenLocation, lostDate
  console.log('📦 Creating lost items...');

  const lostItems = [
    {
      title: 'Brown Leather Wallet',
      description: 'Lost my brown leather wallet near the main cafeteria. Contains my student ID and debit card. It has a small scratch on the front.',
      category: 'Wallet',
      lastSeenLocation: { building: 'Main Cafeteria', area: 'Seating Area' },
      lostDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      image: { url: IMG.wallet, publicId: 'seed/wallet' },
      reporter: arun._id,
      status: 'active',
      rewardOffered: true,
      rewardDescription: 'Coffee treat 🙂',
    },
    {
      title: 'MacBook Pro 14-inch (Space Gray)',
      description: 'Left my laptop on the desk in Library Block B, 2nd floor reading section. Silver/gray MacBook Pro with a "Hello World" sticker on the lid.',
      category: 'Laptop',
      lastSeenLocation: { building: 'Library Block B', area: '2nd Floor Reading Section' },
      lostDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      image: { url: IMG.laptop, publicId: 'seed/laptop' },
      reporter: priya._id,
      status: 'active',
    },
    {
      title: 'Car Keys with Red Keychain',
      description: 'Lost a set of car keys with a red bottle-opener keychain near the Sports Complex parking lot.',
      category: 'Keys',
      lastSeenLocation: { building: 'Sports Complex', area: 'Parking Lot' },
      lostDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      image: { url: IMG.keys, publicId: 'seed/keys' },
      reporter: rahul._id,
      status: 'active',
    },
    {
      title: 'Blue Hydro Flask Water Bottle',
      description: 'Left my blue Hydro Flask in Lecture Hall 3 after the morning calculus class. Has a mountain sticker on it.',
      category: 'Water Bottle',
      lastSeenLocation: { building: 'Lecture Hall 3', area: 'Row 5' },
      lostDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      image: { url: IMG.waterbottle, publicId: 'seed/waterbottle' },
      reporter: arun._id,
      status: 'active',
    },
    {
      title: 'Sony WH-1000XM5 Headphones',
      description: 'Forgot my noise-canceling headphones in the Computer Lab. Black Sony WH-1000XM5 in a carrying case.',
      category: 'Earphones/AirPods',
      lastSeenLocation: { building: 'Computer Lab', area: 'Lab 2, 1st Floor' },
      lostDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      image: { url: IMG.headphones, publicId: 'seed/headphones' },
      reporter: priya._id,
      status: 'active',
    },
  ];

  for (const item of lostItems) {
    const exists = await LostItem.findOne({ title: item.title, reporter: item.reporter });
    if (exists) {
      console.log(`   ↳ "${item.title}" already exists, skipping.`);
      continue;
    }
    await LostItem.create(item);
    console.log(`   ↳ Created lost: "${item.title}"`);
  }

  // ── Create found items ──────────────────────────────────────────────────────
  // Schema uses: category (same enum), foundLocation, foundDate
  console.log('🔍 Creating found items...');

  const foundItems = [
    {
      title: 'Black Backpack with Books',
      description: 'Found a black backpack near the Science Building entrance. Contains textbooks and a pencil case. No ID inside.',
      category: 'Bag/Backpack',
      foundLocation: { building: 'Science Building', area: 'Entrance Lobby' },
      foundDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      image: { url: IMG.backpack, publicId: 'seed/backpack' },
      reporter: meera._id,
      status: 'active',
      currentLocation: 'Science Building security desk',
    },
    {
      title: 'University ID Card – Sneha K.',
      description: 'Found a student ID card near the Library Block A photocopier. Name reads "Sneha K." from EE department.',
      category: 'ID Card',
      foundLocation: { building: 'Library Block A', area: 'Photocopier Area, 1st Floor' },
      foundDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      image: { url: IMG.idcard, publicId: 'seed/idcard' },
      reporter: rahul._id,
      status: 'active',
      currentLocation: 'With me — contact via FindIt',
    },
    {
      title: 'Silver Analog Watch',
      description: 'Found a silver analog wristwatch on a bench in the Student Center. Classic design with a leather strap.',
      category: 'Watch',
      foundLocation: { building: 'Student Center', area: 'Main Lounge' },
      foundDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      image: { url: IMG.watch, publicId: 'seed/watch' },
      reporter: arun._id,
      status: 'active',
      currentLocation: 'Student Center lost & found box',
    },
    {
      title: 'Compact Umbrella (Navy Blue)',
      description: 'Found a navy blue compact umbrella left in the Engineering Wing lobby after the rainstorm yesterday.',
      category: 'Umbrella',
      foundLocation: { building: 'Engineering Wing', area: 'Main Lobby' },
      foundDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      image: { url: IMG.umbrella, publicId: 'seed/umbrella' },
      reporter: priya._id,
      status: 'active',
    },
    {
      title: 'USB-C Laptop Charger (65W)',
      description: 'Found a 65W USB-C laptop charger plugged into an outlet in Hostel Block C common room. Brand looks like Anker.',
      category: 'Charger/Cable',
      foundLocation: { building: 'Hostel Block C', area: 'Common Room, 1st Floor' },
      foundDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      image: { url: IMG.charger, publicId: 'seed/charger' },
      reporter: meera._id,
      status: 'active',
      currentLocation: 'Hostel C warden office',
    },
  ];

  for (const item of foundItems) {
    const exists = await FoundItem.findOne({ title: item.title, reporter: item.reporter });
    if (exists) {
      console.log(`   ↳ "${item.title}" already exists, skipping.`);
      continue;
    }
    await FoundItem.create(item);
    console.log(`   ↳ Created found: "${item.title}"`);
  }

  console.log('\n✅ Seed complete!');
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║              SAMPLE LOGIN CREDENTIALS               ║');
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log('║  Admin:    admin@findit.campus    / Admin@1234      ║');
  console.log('║  Student:  arun@university.edu    / Test@1234       ║');
  console.log('║  Student:  priya@university.edu   / Test@1234       ║');
  console.log('║  Faculty:  meera@university.edu   / Test@1234       ║');
  console.log('║  Student:  rahul@university.edu   / Test@1234       ║');
  console.log('╚══════════════════════════════════════════════════════╝');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed error:', err);
  process.exit(1);
});
