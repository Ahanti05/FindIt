// Shared lists – the frontend reads these from GET /api/meta, and
// ai-service/categories.py must use the same category names.

const CATEGORIES = [
  'ID Card', 'Wallet', 'Keys', 'Phone', 'Laptop', 'Bag/Backpack',
  'Watch', 'Earphones/AirPods', 'Charger/Cable', 'Water Bottle',
  'Umbrella', 'Glasses', 'Clothing', 'Books/Notes', 'Jewelry', 'Other',
];

const BUILDINGS = [
  'Main Library', 'Central Cafeteria', 'Academic Block A', 'Academic Block B',
  'Computer Labs', 'Lecture Hall Complex', 'Workshop Building', 'Admin Block',
  'Student Activity Centre', 'Sports Complex', 'Boys Hostel', 'Girls Hostel',
  'Parking Area', 'Other',
];

const HANDOVER_OPTIONS = ['in-person', 'security-desk', 'lost-found-office', 'other'];

// Match thresholds on the combined score (0–1). See ai-service/matcher.py.
// With the calibrated visual score, a different-category pair tops out at
// ~0.44 even when place and date agree, so it is never stored. 0.60 alerts
// both sides when two genuinely different photos of the same object agree
// on category plus place or date; people still verify before any handover.
const MATCH_STORE_MIN = parseFloat(process.env.MATCH_STORE_MIN) || 0.45;
const MATCH_NOTIFY_MIN = parseFloat(process.env.MATCH_NOTIFY_MIN) || 0.6;

module.exports = {
  CATEGORIES,
  BUILDINGS,
  HANDOVER_OPTIONS,
  MATCH_STORE_MIN,
  MATCH_NOTIFY_MIN,
};
