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

// ─── Matching on report details (no photo, or AI service offline) ────────────
// Same idea as ai-service/matcher.py but with word overlap instead of photo
// similarity. Only same-category pairs are compared, so it stays specific.
const STOPWORDS = new Set([
  'the', 'and', 'with', 'for', 'near', 'from', 'this', 'that', 'has', 'have', 'was', 'are',
  'its', 'left', 'found', 'lost', 'item', 'inside', 'some', 'small', 'one', 'not', 'my',
]);
const tokens = (doc) => new Set(
  [doc.title, doc.description, ...(doc.colors || [])].join(' ').toLowerCase()
    .split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !STOPWORDS.has(w))
);
const jaccard = (a, b) => {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  a.forEach((w) => { if (b.has(w)) inter += 1; });
  return inter / (a.size + b.size - inter);
};
const locationScore = (a, b) => (!a || !b ? 0.5 : a.trim().toLowerCase() === b.trim().toLowerCase() ? 1 : 0);
const dateScore = (lost, found) => {
  if (!lost || !found) return 0.5;
  const gapDays = (new Date(found) - new Date(lost)) / 86400000;
  if (gapDays < -1) return 0;
  return Math.exp(-0.5 * (Math.max(gapDays, 0) / 5) ** 2);
};

const detailsScore = (lost, found) => {
  // Short reports rarely share many words; sharing 2–3 is already a strong signal.
  const text = Math.min(1, jaccard(tokens(lost), tokens(found)) * 2.5);
  const breakdown = {
    text,
    category: lost.category === found.category ? 1 : 0,
    location: locationScore(lost.lastSeenLocation?.building, found.foundLocation?.building),
    date: dateScore(lost.lostDate, found.foundDate),
  };
  const combined = 0.4 * breakdown.text + 0.3 * breakdown.category + 0.15 * breakdown.location + 0.15 * breakdown.date;
  return { combined, breakdown };
};

// ─── Tell BOTH sides about a match ────────────────────────────────────────────
// Whichever report arrived second, the owner must hear about a likely match
// even if they reported days ago, and the finder learns the owner exists.
const notifyMatch = async (match, lost, found) => {
  const pct = Math.round(match.combinedScore * 100);
  const how = match.method === 'photo' ? 'looks' : 'is described as';
  await Promise.all([
    createNotification({
      recipient: lost.reporter,
      type: 'match_found',
      title: 'Someone may have found your item',
      message: `A found "${found.title}" ${how} ${pct}% like your lost "${lost.title}". Is it yours?`,
      relatedMatch: match._id,
      relatedLostItem: lost._id,
      relatedFoundItem: found._id,
      actionUrl: `/matches/${match._id}`,
    }),
    createNotification({
      recipient: found.reporter,
      type: 'match_found',
      title: 'The owner may have reported the item you found',
      message: `Your found "${found.title}" ${how} ${pct}% like a lost "${lost.title}".`,
      relatedMatch: match._id,
      relatedLostItem: lost._id,
      relatedFoundItem: found._id,
      actionUrl: `/matches/${match._id}`,
    }),
  ]);
};

// ─── Find and store matches for one item ─────────────────────────────────────
const CANDIDATE_FIELDS = '+embedding.vector category title description colors lastSeenLocation foundLocation lostDate foundDate reporter';

const findMatches = async (itemId, type) => {
  const Model = modelFor(type);
  const otherType = type === 'lost' ? 'found' : 'lost';
  const Other = modelFor(otherType);

  const item = await Model.findById(itemId).select(`${CANDIDATE_FIELDS} status`);
  if (!item || item.status !== 'active') return [];

  const candidates = await Other.find({
    status: 'active',
    isPublic: true,
    reporter: { $ne: item.reporter }, // you can't match your own report
  })
    .select(CANDIDATE_FIELDS)
    .sort({ createdAt: -1 })
    .limit(500);
  if (candidates.length === 0) return [];

  const hasVector = (d) => d.embedding?.vector?.length > 0;
  const results = [];

  // 1. Photo against photo, through the AI service.
  const withPhotos = hasVector(item) ? candidates.filter(hasVector) : [];
  let compared = new Set();
  if (withPhotos.length) {
    const toPayload = (doc, docType) => ({
      id: String(doc._id),
      embedding: doc.embedding.vector,
      category: doc.category,
      building: locationOf(doc, docType)?.building || null,
      date: dateOf(doc, docType) || null,
    });
    try {
      const { data } = await axios.post(`${AI_URL}/match`, {
        query_type: type,
        query: toPayload(item, type),
        candidates: withPhotos.map((c) => toPayload(c, otherType)),
        top_k: 10,
      }, { timeout: 30000 });
      const byId = new Map(withPhotos.map((c) => [String(c._id), c]));
      data.matches.forEach((m) => results.push({
        other: byId.get(m.id),
        combined: m.combined_score,
        breakdown: m.score_breakdown,
        similarity: m.similarity_score,
        cosine: m.cosine,
        method: 'photo',
      }));
      compared = new Set(withPhotos.map((c) => String(c._id)));
    } catch (err) {
      console.error(`AI matching unavailable, comparing report details instead: ${err.message}`);
    }
  }

  // 2. Everything the photo comparison didn't cover: compare report details.
  candidates
    .filter((c) => !compared.has(String(c._id)) && c.category === item.category)
    .forEach((other) => {
      const lost = type === 'lost' ? item : other;
      const found = type === 'lost' ? other : item;
      const { combined, breakdown } = detailsScore(lost, found);
      results.push({ other, combined, breakdown, similarity: breakdown.text, method: 'details' });
    });

  results.sort((a, b) => b.combined - a.combined);
  const created = [];

  for (const r of results.slice(0, 10)) {
    if (r.combined < MATCH_STORE_MIN) continue;
    const lost = type === 'lost' ? item : r.other;
    const found = type === 'lost' ? r.other : item;
    if (await Match.exists({ lostItem: lost._id, foundItem: found._id })) continue;

    const match = await Match.create({
      lostItem: lost._id,
      foundItem: found._id,
      lostReporter: lost.reporter,
      foundReporter: found.reporter,
      method: r.method,
      similarityScore: Math.max(0, Math.min(1, r.similarity)),
      cosine: r.cosine,
      combinedScore: Math.max(0, Math.min(1, r.combined)),
      scoreBreakdown: r.breakdown,
    });
    created.push(match);

    // A details-only match needs some shared words before anyone is pinged.
    const notify = match.combinedScore >= MATCH_NOTIFY_MIN && (r.method === 'photo' || r.breakdown.text >= 0.25);
    if (notify) await notifyMatch(match, lost, found);
  }
  return created;
};

// ─── Full pipeline: analyze → store results → match ──────────────────────────
// `buffer` is optional; when omitted the stored image is loaded again.
// Matching always runs: on the photo when analysis worked, on details if not.
const processItem = async (itemId, type, buffer) => {
  const Model = modelFor(type);
  const item = await Model.findById(itemId);
  if (!item) return [];

  if (item.image?.url) {
    try {
      await Model.findByIdAndUpdate(itemId, { 'aiDetection.processingStatus': 'processing', 'aiDetection.error': null });
      const bytes = buffer || await loadImage(item.image);
      if (!bytes) throw new Error('Stored image could not be loaded');

      const result = await analyzeImage(bytes);
      const annotated = result.annotated_image ? await saveDataUrl(result.annotated_image, 'annotated') : null;
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
    } catch (err) {
      const message = err.code === 'ECONNREFUSED' ? 'AI service is offline' : (err.response?.data?.detail || err.message);
      await Model.findByIdAndUpdate(itemId, {
        'aiDetection.processingStatus': 'failed',
        'aiDetection.error': String(message).slice(0, 300),
      });
      console.error(`AI analysis failed for ${type} item ${itemId}: ${message}`);
    }
  } else {
    await Model.findByIdAndUpdate(itemId, { 'aiDetection.processingStatus': 'skipped' });
  }

  try {
    return await findMatches(itemId, type);
  } catch (err) {
    console.error(`Matching failed for ${type} item ${itemId}: ${err.message}`);
    return [];
  }
};

// ─── Retry photos that could not be analysed (e.g. AI service was down) ──────
const retryPendingAnalysis = async () => {
  const health = await aiHealth();
  if (!health || health.status !== 'ok') return 0;
  const filter = {
    'image.url': { $exists: true, $ne: null },
    'aiDetection.processingStatus': { $in: ['pending', 'failed'] },
    updatedAt: { $lt: new Date(Date.now() - 30 * 1000) },
  };
  const [lost, found] = await Promise.all([
    LostItem.find(filter).select('_id').limit(20),
    FoundItem.find(filter).select('_id').limit(20),
  ]);
  for (const i of lost) await processItem(i._id, 'lost');
  for (const i of found) await processItem(i._id, 'found');
  return lost.length + found.length;
};

const startAiRetryJob = () => {
  setInterval(() => retryPendingAnalysis().catch(() => {}), 2 * 60 * 1000).unref();
};

module.exports = {
  analyzeImage, aiHealth, processItem, findMatches, detailsScore, notifyMatch, retryPendingAnalysis, startAiRetryJob,
};
