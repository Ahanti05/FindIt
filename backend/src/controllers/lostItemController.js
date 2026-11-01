const LostItem = require('../models/LostItem');
const { triggerMatching } = require('./aiController');
const { upload } = require('../config/cloudinary');
const axios = require('axios');

// ─── Create lost item report ──────────────────────────────────────────────────
const createLostItem = async (req, res, next) => {
  try {
    const {
      title, category, description, identifyingCharacteristics,
      building, area, lat, lng, lostDate, lostTimeApprox,
      rewardOffered, rewardDescription, colors,
    } = req.body;

    const itemData = {
      reporter: req.user._id,
      title, category, description, identifyingCharacteristics,
      lastSeenLocation: {
        building, area,
        coordinates: lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : undefined,
      },
      lostDate: new Date(lostDate),
      lostTimeApprox,
      rewardOffered: rewardOffered === 'true' || rewardOffered === true,
      rewardDescription,
      colors: colors ? (Array.isArray(colors) ? colors : colors.split(',').map(c => c.trim())) : [],
    };

    if (req.file) {
      itemData.image = {
        url: req.file.path,
        publicId: req.file.filename,
      };
    }

    const item = await LostItem.create(itemData);

    // Trigger AI in background (non-blocking)
    if (item.image?.url) {
      triggerAIProcessing(item._id, 'lost', req.user._id, item.image.url);
    }

    res.status(201).json({ success: true, item });
  } catch (err) {
    next(err);
  }
};

// ─── Background AI: detect + embed + match ────────────────────────────────────
const triggerAIProcessing = async (itemId, itemType, userId, imageUrl) => {
  const Model = itemType === 'lost' ? LostItem : require('../models/FoundItem');
  const AI_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

  try {
    await Model.findByIdAndUpdate(itemId, { 'aiDetection.processingStatus': 'processing' });

    const detRes = await axios.post(`${AI_URL}/detect`, { image_url: imageUrl }, { timeout: 30000 });
    const { detected_objects, annotated_image_url, primary_label } = detRes.data;

    await Model.findByIdAndUpdate(itemId, {
      'aiDetection.detectedObjects': detected_objects || [],
      'aiDetection.annotatedImageUrl': annotated_image_url,
      'aiDetection.primaryLabel': primary_label,
      'aiDetection.processingStatus': 'done',
    });

    // Get embedding
    const embRes = await axios.post(`${AI_URL}/embed`, { image_url: imageUrl }, { timeout: 30000 });
    await Model.findByIdAndUpdate(itemId, {
      'embedding.vector': embRes.data.embedding,
      'embedding.model': embRes.data.model,
      'embedding.generatedAt': new Date(),
    });

    // Trigger matching
    await triggerMatching(itemId, itemType, userId);
  } catch (err) {
    await Model.findByIdAndUpdate(itemId, { 'aiDetection.processingStatus': 'failed' });
    console.error(`AI processing failed for ${itemType} item ${itemId}:`, err.message);
  }
};

// ─── Get lost items (public feed) ─────────────────────────────────────────────
const getLostItems = async (req, res, next) => {
  try {
    const {
      page = 1, limit = 12, category, status = 'active',
      search, building, sortBy = 'createdAt',
    } = req.query;

    const skip = (page - 1) * limit;
    const query = { isPublic: true, 'moderation.isApproved': true };

    if (status) query.status = status;
    if (category) query.category = category;
    if (building) query['lastSeenLocation.building'] = new RegExp(building, 'i');
    if (search) {
      query.$or = [
        { title: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') },
      ];
    }

    const sortOptions = {
      createdAt: { createdAt: -1 },
      lostDate: { lostDate: -1 },
      views: { views: -1 },
    };

    const [items, total] = await Promise.all([
      LostItem.find(query)
        .populate('reporter', 'name department avatar')
        .sort(sortOptions[sortBy] || { createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('-embedding.vector -aiDetection.detectedObjects'),
      LostItem.countDocuments(query),
    ]);

    res.json({ success: true, items, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
};

// ─── Get single lost item ─────────────────────────────────────────────────────
const getLostItemById = async (req, res, next) => {
  try {
    const item = await LostItem.findById(req.params.id)
      .populate('reporter', 'name department avatar studentId');

    if (!item || !item.isPublic) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    // Increment view count
    await LostItem.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } });

    res.json({ success: true, item });
  } catch (err) {
    next(err);
  }
};

// ─── Update lost item ─────────────────────────────────────────────────────────
const updateLostItem = async (req, res, next) => {
  try {
    const item = await LostItem.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });

    if (item.reporter.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const allowedUpdates = [
      'title', 'category', 'description', 'identifyingCharacteristics',
      'lostTimeApprox', 'rewardOffered', 'rewardDescription', 'colors', 'status',
    ];
    const updates = {};
    allowedUpdates.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    const updated = await LostItem.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    res.json({ success: true, item: updated });
  } catch (err) {
    next(err);
  }
};

// ─── Delete lost item ─────────────────────────────────────────────────────────
const deleteLostItem = async (req, res, next) => {
  try {
    const item = await LostItem.findById(req.params.id);
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

// ─── Get my lost reports ──────────────────────────────────────────────────────
const getMyLostItems = async (req, res, next) => {
  try {
    const items = await LostItem.find({ reporter: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, items });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createLostItem,
  getLostItems,
  getLostItemById,
  updateLostItem,
  deleteLostItem,
  getMyLostItems,
  triggerAIProcessing,
};
