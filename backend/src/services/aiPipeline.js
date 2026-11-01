const axios = require('axios');
const FormData = require('form-data');
const LostItem = require('../models/LostItem');
const FoundItem = require('../models/FoundItem');
const Match = require('../models/Match');
const { saveDataUrl, loadImage } = require('./storage');
const { createNotification } = require('../controllers/notificationController');
const { MATCH_STORE_MIN, MATCH_NOTIFY_MIN } = require('../config/constants');

const AI_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

const modelFor = (type) => (type === 'lost' ? LostItem : FoundItem);
const locationOf = (item, type) => (type === 'lost' ? item.lastSeenLocation : item.foundLocation);
const dateOf = (item, type) => (type === 'lost' ? item.lostDate : item.foundDate);

// ─── Call the AI service with raw image bytes ─────────────────────────────────
const analyzeImage = async (buffer, filename = 'image.jpg', contentType = 'image/jpeg') => {
  const form = new FormData();
  form.append('file', buffer, { filename, contentType });
  const res = await axios.post(`${AI_URL}/analyze`, form, {
    headers: form.getHeaders(),
    timeout: 60000,
    maxBodyLength: 20 * 1024 * 1024,
  });
  return res.data;
};

const aiHealth = async () => {
  try {
    const res = await axios.get(`${AI_URL}/health`, { timeout: 3000 });
    return res.data;
  } catch (_) {
    return null;
  }
};

// ─── Find and store matches for one item ─────────────────────────────────────
const findMatches = async (itemId, type) => {
  const Model = modelFor(type);
  const otherType = type === 'lost' ? 'found' : 'lost';
  const Other = modelFor(otherType);

  const item = await Model.findById(itemId).select('+embedding.vector');
  if (!item?.embedding?.vector?.length || item.status !== 'active') return [];

  const candidates = await Other.find({
    status: 'active',
    isPublic: true,
    reporter: { $ne: item.reporter }, // you can't match your own report
    'embedding.vector.0': { $exists: true },
  })
    .select('+embedding.vector category lastSeenLocation foundLocation lostDate foundDate reporter title')
    .sort({ createdAt: -1 })
    .limit(500);

  if (candidates.length === 0) return [];

  const toPayload = (doc, docType) => ({
    id: String(doc._id),
    embedding: doc.embedding.vector,
    category: doc.category,
    building: locationOf(doc, docType)?.building || null,
    date: dateOf(doc, docType) || null,
  });

  const { data } = await axios.post(`${AI_URL}/match`, {
    query_type: type,
    query: toPayload(item, type),
    candidates: candidates.map((c) => toPayload(c, otherType)),
    top_k: 10,
  }, { timeout: 30000 });

  const byId = new Map(candidates.map((c) => [String(c._id), c]));
  const created = [];

  for (const m of data.matches) {
    if (m.combined_score < MATCH_STORE_MIN) continue;
    const other = byId.get(m.id);
    const lost = type === 'lost' ? item : other;
    const found = type === 'lost' ? other : item;

    const existing = await Match.findOne({ lostItem: lost._id, foundItem: found._id });
    if (existing) continue;

    const match = await Match.create({
      lostItem: lost._id,
      foundItem: found._id,
      lostReporter: lost.reporter,
      foundReporter: found.reporter,
      similarityScore: m.similarity_score,
      cosine: m.cosine,
      combinedScore: m.combined_score,
      scoreBreakdown: m.score_breakdown,
    });
    created.push(match);

    // Tell BOTH sides – whichever report arrived second, the owner must hear
    // about a likely match even if they reported days ago.
    if (match.combinedScore >= MATCH_NOTIFY_MIN) {
      const pct = Math.round(match.combinedScore * 100);
      await Promise.all([
        createNotification({
          recipient: lost.reporter,
          type: 'match_found',
          title: 'Possible match for your lost item',
          message: `A found "${found.title}" looks ${pct}% similar to your "${lost.title}". Take a look.`,
          relatedMatch: match._id,
          relatedLostItem: lost._id,
          relatedFoundItem: found._id,
          actionUrl: `/matches/${match._id}`,
        }),
        createNotification({
          recipient: found.reporter,
          type: 'match_found',
          title: 'An owner may have reported the item you found',
          message: `Your found "${found.title}" looks ${pct}% similar to a lost "${lost.title}".`,
          relatedMatch: match._id,
          relatedLostItem: lost._id,
          relatedFoundItem: found._id,
          actionUrl: `/matches/${match._id}`,
        }),
      ]);
    }
  }
  return created;
};

// ─── Full pipeline: analyze → store results → match ──────────────────────────
// `buffer` is optional; when omitted the stored image is loaded again.
const processItem = async (itemId, type, buffer) => {
  const Model = modelFor(type);
  try {
    const item = await Model.findById(itemId);
    if (!item) return;
    if (!item.image?.url) {
      await Model.findByIdAndUpdate(itemId, { 'aiDetection.processingStatus': 'skipped' });
      return;
    }

    await Model.findByIdAndUpdate(itemId, {
      'aiDetection.processingStatus': 'processing',
      'aiDetection.error': null,
    });

    const bytes = buffer || await loadImage(item.image);
    if (!bytes) throw new Error('Stored image could not be loaded');

    const result = await analyzeImage(bytes);
    const annotated = result.annotated_image
      ? await saveDataUrl(result.annotated_image, 'annotated')
      : null;

    await Model.findByIdAndUpdate(itemId, {
      'aiDetection.detectedObjects': result.detected_objects.map(({ label, confidence, bbox }) => ({ label, confidence, bbox })),
      'aiDetection.annotatedImageUrl': annotated?.url || null,
      'aiDetection.primaryLabel': result.primary_label,
      'aiDetection.suggestedCategory': result.suggested_category,
      'aiDetection.categoryGuesses': result.category_guesses,
      'aiDetection.processingStatus': 'done',
      'aiDetection.processedAt': new Date(),
      'embedding.vector': result.embedding,
      'embedding.model': result.model,
      'embedding.generatedAt': new Date(),
    });

    return await findMatches(itemId, type);
  } catch (err) {
    const message = err.code === 'ECONNREFUSED'
      ? 'AI service is offline'
      : (err.response?.data?.detail || err.message);
    await Model.findByIdAndUpdate(itemId, {
      'aiDetection.processingStatus': 'failed',
      'aiDetection.error': String(message).slice(0, 300),
    });
    console.error(`AI processing failed for ${type} item ${itemId}: ${message}`);
    return [];
  }
};

module.exports = { analyzeImage, aiHealth, processItem, findMatches };
