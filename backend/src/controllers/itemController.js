const LostItem = require('../models/LostItem');
const FoundItem = require('../models/FoundItem');
const Match = require('../models/Match');
const RecoveryRequest = require('../models/RecoveryRequest');
const { parseColors } = require('../models/itemShared');
const { saveImage, deleteImage } = require('../services/storage');
const { processItem, findMatches } = require('../services/aiPipeline');
const { notifyAdmins } = require('./notificationController');
const { HttpError, escapeRegex, isOwnerOrAdmin } = require('../utils/http');

// Lost and found reports behave the same apart from a few field names, so one
// controller is built per type from this config.
const CONFIG = {
  lost: {
    Model: LostItem,
    locationField: 'lastSeenLocation',
    dateField: 'lostDate',
    createFields: ['title', 'category', 'description', 'identifyingCharacteristics',
      'lostTimeApprox', 'rewardDescription'],
    updateFields: ['title', 'category', 'description', 'identifyingCharacteristics',
      'lostTimeApprox', 'rewardOffered', 'rewardDescription'],
    ownerStatuses: ['active', 'archived', 'recovered'],
  },
  found: {
    Model: FoundItem,
    locationField: 'foundLocation',
    dateField: 'foundDate',
    createFields: ['title', 'category', 'description', 'foundTime', 'currentLocation',
      'handoverPreference'],
    updateFields: ['title', 'category', 'description', 'foundTime', 'currentLocation',
      'handoverPreference'],
    ownerStatuses: ['active', 'archived', 'returned'],
  },
};

const PUBLIC_REPORTER = 'name department avatar role';

const parseDate = (value, label) => {
  const d = new Date(value);
  if (!value || Number.isNaN(d.getTime())) throw new HttpError(400, `${label} is required`);
  if (d.getTime() > Date.now() + 24 * 60 * 60 * 1000) throw new HttpError(400, `${label} cannot be in the future`);
  return d;
};

const makeItemController = (type) => {
  const { Model, locationField, dateField, createFields, updateFields, ownerStatuses } = CONFIG[type];
  const dateLabel = type === 'lost' ? 'Date lost' : 'Date found';

  const loadOwned = async (req) => {
    const item = await Model.findById(req.params.id);
    if (!item) throw new HttpError(404, 'Item not found');
    if (!isOwnerOrAdmin(req.user, item.reporter)) throw new HttpError(403, 'Not authorized');
    return item;
  };

  // ── Create ───────────────────────────────────────────────────────────────
  const create = async (req, res, next) => {
    try {
      const data = { reporter: req.user._id };
      createFields.forEach((f) => { if (req.body[f] !== undefined && req.body[f] !== '') data[f] = req.body[f]; });
      if (!req.body.building) throw new HttpError(400, 'Location is required');
      data[locationField] = { building: req.body.building, area: req.body.area };
      data[dateField] = parseDate(req.body[dateField], dateLabel);
      data.colors = parseColors(req.body.colors);
      if (type === 'lost') data.rewardOffered = req.body.rewardOffered === 'true' || req.body.rewardOffered === true;

      if (req.file) {
        data.image = await saveImage(req.file.buffer, { folder: 'items', mimetype: req.file.mimetype });
      } else {
        data.aiDetection = { processingStatus: 'skipped' };
      }

      const item = await Model.create(data);

      // Detection, embedding and matching run in the background; the item page
      // polls the status and shows results when they land.
      if (req.file) processItem(item._id, type, req.file.buffer);

      res.status(201).json({ success: true, item });
    } catch (err) {
      next(err);
    }
  };

  // ── Public list ──────────────────────────────────────────────────────────
  const list = async (req, res, next) => {
    try {
      const page = Math.max(parseInt(req.query.page) || 1, 1);
      const limit = Math.min(Math.max(parseInt(req.query.limit) || 12, 1), 50);
      const { category, building, search, sortBy = 'createdAt' } = req.query;
      const status = req.query.status || 'active';

      const query = { isPublic: true, 'moderation.isApproved': true };
      if (status !== 'all') query.status = status;
      if (category) query.category = category;
      if (building) query[`${locationField}.building`] = building;
      if (search) {
        const rx = new RegExp(escapeRegex(String(search).slice(0, 80)), 'i');
        query.$or = [{ title: rx }, { description: rx }, { colors: rx }];
      }

      const sort = {
        createdAt: { createdAt: -1 },
        date: { [dateField]: -1 },
        views: { views: -1 },
      }[sortBy] || { createdAt: -1 };

      const [items, total] = await Promise.all([
        Model.find(query)
          .populate('reporter', PUBLIC_REPORTER)
          .sort(sort)
          .skip((page - 1) * limit)
          .limit(limit)
          .select('-aiDetection.detectedObjects -aiDetection.categoryGuesses -moderation'),
        Model.countDocuments(query),
      ]);

      res.json({ success: true, items, total, page, pages: Math.ceil(total / limit) });
    } catch (err) {
      next(err);
    }
  };

  // ── Detail ───────────────────────────────────────────────────────────────
  const getById = async (req, res, next) => {
    try {
      const item = await Model.findById(req.params.id).populate('reporter', PUBLIC_REPORTER);
      if (!item) throw new HttpError(404, 'Item not found');

      const isOwner = req.user && String(item.reporter?._id) === String(req.user._id);
      const isAdmin = req.user?.role === 'admin';
      const visible = item.isPublic && item.moderation?.isApproved !== false;
      if (!visible && !isOwner && !isAdmin) throw new HttpError(404, 'Item not found');

      if (!isOwner) await Model.updateOne({ _id: item._id }, { $inc: { views: 1 } });

      const json = item.toJSON();
      if (!isAdmin) delete json.moderation;
      res.json({ success: true, item: json, isOwner });
    } catch (err) {
      next(err);
    }
  };

  // ── Mine ─────────────────────────────────────────────────────────────────
  const mine = async (req, res, next) => {
    try {
      const items = await Model.find({ reporter: req.user._id }).sort({ createdAt: -1 });
      res.json({ success: true, items });
    } catch (err) {
      next(err);
    }
  };

  // ── Update ───────────────────────────────────────────────────────────────
  const update = async (req, res, next) => {
    try {
      const item = await loadOwned(req);
      const before = { category: item.category, building: item[locationField]?.building, date: String(item[dateField]) };

      updateFields.forEach((f) => { if (req.body[f] !== undefined) item[f] = req.body[f]; });
      if (req.body.colors !== undefined) item.colors = parseColors(req.body.colors);
      if (req.body.building !== undefined) item[locationField].building = req.body.building;
      if (req.body.area !== undefined) item[locationField].area = req.body.area;
      if (req.body[dateField] !== undefined) item[dateField] = parseDate(req.body[dateField], dateLabel);

      if (req.body.status !== undefined) {
        if (!ownerStatuses.includes(req.body.status) && req.user.role !== 'admin') {
          throw new HttpError(400, 'That status can only be set by the recovery process');
        }
        item.status = req.body.status;
      }

      await item.save();

      const metadataChanged = before.category !== item.category
        || before.building !== item[locationField]?.building
        || before.date !== String(item[dateField]);
      if (metadataChanged && item.status === 'active') findMatches(item._id, type).catch(() => {});

      res.json({ success: true, item });
    } catch (err) {
      next(err);
    }
  };

  // ── Delete ───────────────────────────────────────────────────────────────
  const remove = async (req, res, next) => {
    try {
      const item = await loadOwned(req);
      const openClaim = await RecoveryRequest.exists({
        [type === 'lost' ? 'lostItem' : 'foundItem']: item._id,
        status: { $in: ['pending', 'approved'] },
      });
      if (openClaim) throw new HttpError(409, 'This report has an open claim. Archive it instead of deleting.');

      await Match.deleteMany({ [type === 'lost' ? 'lostItem' : 'foundItem']: item._id, status: { $ne: 'verified' } });
      await deleteImage(item.image);
      const annotated = item.aiDetection?.annotatedImageUrl;
      if (annotated?.startsWith('/uploads/')) {
        await deleteImage({ publicId: `local:${annotated.slice('/uploads/'.length)}` });
      }
      await item.deleteOne();
      res.json({ success: true, message: 'Report deleted' });
    } catch (err) {
      next(err);
    }
  };

  // ── Re-run AI ────────────────────────────────────────────────────────────
  const reprocess = async (req, res, next) => {
    try {
      const item = await loadOwned(req);
      if (!item.image?.url) throw new HttpError(400, 'This report has no photo to analyze');
      await Model.updateOne({ _id: item._id }, { 'aiDetection.processingStatus': 'processing' });
      processItem(item._id, type);
      res.status(202).json({ success: true, message: 'AI analysis restarted' });
    } catch (err) {
      next(err);
    }
  };

  // ── Flag for moderation ──────────────────────────────────────────────────
  const flag = async (req, res, next) => {
    try {
      const item = await Model.findById(req.params.id);
      if (!item) throw new HttpError(404, 'Item not found');
      const reason = String(req.body.reason || '').trim().slice(0, 300);
      if (!reason) throw new HttpError(400, 'Please give a reason');
      if (item.moderation.flags.some((f) => String(f.by) === String(req.user._id))) {
        return res.json({ success: true, message: 'You have already reported this listing' });
      }

      item.moderation.flags.push({ by: req.user._id, reason });
      item.moderation.isReviewed = false;
      await item.save();

      await notifyAdmins({
        type: 'item_flagged',
        title: 'Listing reported',
        message: `"${item.title}" was reported: ${reason}`,
        [type === 'lost' ? 'relatedLostItem' : 'relatedFoundItem']: item._id,
        actionUrl: '/admin?tab=moderation',
      });
      res.json({ success: true, message: 'Thanks – an admin will review this listing' });
    } catch (err) {
      next(err);
    }
  };

  return { create, list, getById, mine, update, remove, reprocess, flag };
};

module.exports = { makeItemController };
