const FoundItem = require('../models/FoundItem');
const { triggerAIProcessing } = require('./lostItemController');

// ─── Create found item report ─────────────────────────────────────────────────
const createFoundItem = async (req, res, next) => {
  try {
    const {
      title, category, description,
      building, area, lat, lng,
      foundDate, foundTime,
      currentLocation, handoverPreference,
      colors,
    } = req.body;

    const itemData = {
      reporter: req.user._id,
      title, category, description,
      foundLocation: {
        building, area,
        coordinates: lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : undefined,
      },
      foundDate: new Date(foundDate),
      foundTime,
      currentLocation,
      handoverPreference,
      colors: colors ? (Array.isArray(colors) ? colors : colors.split(',').map(c => c.trim())) : [],
      contactInfo: {
        preferEmail: true,
        preferPhone: false,
      },
    };

    if (req.file) {
      itemData.image = { url: req.file.path, publicId: req.file.filename };
    }

    const item = await FoundItem.create(itemData);

    if (item.image?.url) {
      triggerAIProcessing(item._id, 'found', req.user._id, item.image.url);
    }

    res.status(201).json({ success: true, item });
  } catch (err) {
    next(err);
  }
};

// ─── Get found items (public) ─────────────────────────────────────────────────
const getFoundItems = async (req, res, next) => {
  try {
    const { page = 1, limit = 12, category, search, building, sortBy = 'createdAt' } = req.query;
    const skip = (page - 1) * limit;
    const query = { isPublic: true, 'moderation.isApproved': true, status: 'active' };

    if (category) query.category = category;
    if (building) query['foundLocation.building'] = new RegExp(building, 'i');
    if (search) {
      query.$or = [
        { title: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') },
      ];
    }

    const [items, total] = await Promise.all([
      FoundItem.find(query)
        .populate('reporter', 'name department avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('-embedding.vector'),
      FoundItem.countDocuments(query),
    ]);

    res.json({ success: true, items, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
};

// ─── Get single found item ────────────────────────────────────────────────────
const getFoundItemById = async (req, res, next) => {
  try {
    const item = await FoundItem.findById(req.params.id)
      .populate('reporter', 'name department avatar');

    if (!item || !item.isPublic) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }
    await FoundItem.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } });
    res.json({ success: true, item });
  } catch (err) {
    next(err);
  }
};

// ─── My found reports ─────────────────────────────────────────────────────────
const getMyFoundItems = async (req, res, next) => {
  try {
    const items = await FoundItem.find({ reporter: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, items });
  } catch (err) {
    next(err);
  }
};

// ─── Update / Delete ──────────────────────────────────────────────────────────
const updateFoundItem = async (req, res, next) => {
  try {
    const item = await FoundItem.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });
    if (item.reporter.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    const allowedUpdates = ['title', 'category', 'description', 'currentLocation', 'handoverPreference', 'status'];
    const updates = {};
    allowedUpdates.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
    const updated = await FoundItem.findByIdAndUpdate(req.params.id, updates, { new: true });
    res.json({ success: true, item: updated });
  } catch (err) {
    next(err);
  }
};

const deleteFoundItem = async (req, res, next) => {
  try {
    const item = await FoundItem.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });
    if (item.reporter.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    await item.deleteOne();
    res.json({ success: true, message: 'Report deleted' });
  } catch (err) {
    next(err);
  }
};

module.exports = { createFoundItem, getFoundItems, getFoundItemById, getMyFoundItems, updateFoundItem, deleteFoundItem };
