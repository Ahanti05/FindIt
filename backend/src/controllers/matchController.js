const Match = require('../models/Match');
const Message = require('../models/Message');
const LostItem = require('../models/LostItem');
const FoundItem = require('../models/FoundItem');
const RecoveryRequest = require('../models/RecoveryRequest');
const { createNotification } = require('./notificationController');
const { emitToUser } = require('../services/socketService');
const { HttpError, idOf, isOwnerOrAdmin } = require('../utils/http');

const ITEM_SUMMARY = 'title category image status lastSeenLocation foundLocation lostDate foundDate description colors identifyingCharacteristics currentLocation handoverPreference aiDetection.annotatedImageUrl';
const REPORTER = 'name department avatar';

const roleIn = (match, user) => {
  if (idOf(match.lostReporter) === String(user._id)) return 'owner';
  if (idOf(match.foundReporter) === String(user._id)) return 'finder';
  return user.role === 'admin' ? 'admin' : null;
};

const loadMatch = async (req, { populate = false } = {}) => {
  let q = Match.findById(req.params.matchId);
  if (populate) {
    q = q
      .populate('lostItem', ITEM_SUMMARY)
      .populate('foundItem', ITEM_SUMMARY)
      .populate('lostReporter', REPORTER)
      .populate('foundReporter', REPORTER);
  }
  const match = await q;
  if (!match) throw new HttpError(404, 'Match not found');
  const role = roleIn(match, req.user);
  if (!role) throw new HttpError(403, 'Access denied');
  return { match, role };
};

// ─── My matches (as owner or finder) ─────────────────────────────────────────
const getMyMatches = async (req, res, next) => {
  try {
    const me = req.user._id;
    const filter = { $or: [{ lostReporter: me }, { foundReporter: me }] };
    if (req.query.includeRejected !== 'true') filter.status = { $ne: 'rejected' };

    const matches = await Match.find(filter)
      .populate('lostItem', ITEM_SUMMARY)
      .populate('foundItem', ITEM_SUMMARY)
      .sort({ status: 1, combinedScore: -1 })
      .limit(100);

    const withRole = matches
      .filter((m) => m.lostItem && m.foundItem)
      .map((m) => ({ ...m.toJSON(), role: idOf(m.lostReporter) === String(me) ? 'owner' : 'finder' }));
    res.json({ success: true, matches: withRole });
  } catch (err) {
    next(err);
  }
};

// ─── Matches for one of my items ──────────────────────────────────────────────
const getMatchesForItem = async (req, res, next) => {
  try {
    const { type, itemId } = req.params;
    if (!['lost', 'found'].includes(type)) throw new HttpError(400, 'Unknown item type');
    const Model = type === 'lost' ? LostItem : FoundItem;
    const item = await Model.findById(itemId).select('reporter');
    if (!item) throw new HttpError(404, 'Item not found');
    if (!isOwnerOrAdmin(req.user, item.reporter)) throw new HttpError(403, 'Access denied');

    const other = type === 'lost' ? 'foundItem' : 'lostItem';
    const matches = await Match.find({ [type === 'lost' ? 'lostItem' : 'foundItem']: itemId })
      .populate(other, ITEM_SUMMARY)
      .sort({ combinedScore: -1 })
      .limit(20);

    res.json({ success: true, matches: matches.filter((m) => m[other]) });
  } catch (err) {
    next(err);
  }
};

// ─── Match detail ─────────────────────────────────────────────────────────────
const getMatch = async (req, res, next) => {
  try {
    const { match, role } = await loadMatch(req, { populate: true });
    const recovery = await RecoveryRequest.findOne({ match: match._id, status: { $ne: 'cancelled' } })
      .sort({ createdAt: -1 })
      .select('status createdAt');
    res.json({ success: true, match, role, recovery });
  } catch (err) {
    next(err);
  }
};

// ─── Respond to a match ───────────────────────────────────────────────────────
const OWNER_RESPONSES = ['interested', 'not-mine'];
const FINDER_RESPONSES = ['confirmed', 'denied'];

const respondToMatch = async (req, res, next) => {
  try {
    const { match, role } = await loadMatch(req);
    const { response } = req.body;
    if (match.status === 'verified') throw new HttpError(400, 'This match is already closed');

    let otherParty;
    let note;
    if (role === 'owner') {
      if (!OWNER_RESPONSES.includes(response)) throw new HttpError(400, 'Invalid response');
      if (response === 'interested' && match.foundReporterResponse === 'denied') {
        throw new HttpError(400, 'The finder has said this item does not fit your report');
      }
      match.lostReporterResponse = response;
      match.status = response === 'interested' ? 'accepted' : 'rejected';
      otherParty = match.foundReporter;
      note = response === 'interested'
        ? { title: 'The owner thinks this is theirs', message: 'Chat is now open so you can arrange the handover.' }
        : { title: 'Match dismissed', message: 'The owner said this is not their item.' };
    } else if (role === 'finder') {
      if (!FINDER_RESPONSES.includes(response)) throw new HttpError(400, 'Invalid response');
      match.foundReporterResponse = response;
      if (response === 'denied') match.status = 'rejected';
      otherParty = match.lostReporter;
      note = response === 'confirmed'
        ? { title: 'The finder confirmed the match', message: 'The person holding the item agrees it fits your report.' }
        : { title: 'Finder says this is not a match', message: 'The finder says this item does not fit your report.' };
    } else {
      throw new HttpError(403, 'Only the owner or finder can respond');
    }

    await match.save();
    await createNotification({
      recipient: otherParty,
      type: match.status === 'rejected' ? 'match_rejected' : 'match_accepted',
      ...note,
      relatedMatch: match._id,
      actionUrl: `/matches/${match._id}`,
    });

    res.json({ success: true, match, role });
  } catch (err) {
    next(err);
  }
};

// ─── Chat ─────────────────────────────────────────────────────────────────────
// Chat opens once the owner says the item looks like theirs, or straight away
// when the finder reached out to the owner themselves.
const chatOpen = (match) => ['accepted', 'verified'].includes(match.status)
  || (match.method === 'finder' && match.status !== 'rejected');

// Marks the other person's messages as read and tells them ("Seen").
const markRead = async (match, userId) => {
  const result = await Message.updateMany(
    { match: match._id, sender: { $ne: userId }, readAt: null },
    { readAt: new Date() }
  );
  if (result.modifiedCount) {
    const other = idOf(match.lostReporter) === String(userId) ? match.foundReporter : match.lostReporter;
    emitToUser(other, 'chat:read', { matchId: String(match._id), readAt: new Date() });
  }
};

const getMessages = async (req, res, next) => {
  try {
    const { match, role } = await loadMatch(req);
    const messages = await Message.find({ match: match._id })
      .populate('sender', 'name avatar')
      .sort({ createdAt: 1 })
      .limit(500);
    if (role !== 'admin') await markRead(match, req.user._id);
    res.json({ success: true, messages, open: chatOpen(match) });
  } catch (err) {
    next(err);
  }
};

const readMessages = async (req, res, next) => {
  try {
    const { match, role } = await loadMatch(req);
    if (role !== 'admin') await markRead(match, req.user._id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

const sendMessage = async (req, res, next) => {
  try {
    const { match, role } = await loadMatch(req);
    if (role === 'admin') throw new HttpError(403, 'Admins can read but not post in this chat');
    if (!chatOpen(match)) throw new HttpError(400, 'Chat opens once the owner confirms the item looks like theirs');

    const body = String(req.body.body || '').trim();
    if (!body) throw new HttpError(400, 'Message cannot be empty');

    const message = await Message.create({ match: match._id, sender: req.user._id, body });
    await message.populate('sender', 'name avatar');

    const recipient = role === 'owner' ? match.foundReporter : match.lostReporter;
    emitToUser(recipient, 'chat:message', { matchId: String(match._id), message });

    // One notification per burst of messages, not one per message.
    const previous = await Message.findOne({ match: match._id, sender: req.user._id, _id: { $ne: message._id } })
      .sort({ createdAt: -1 });
    if (!previous || Date.now() - previous.createdAt.getTime() > 10 * 60 * 1000) {
      await createNotification({
        recipient,
        type: 'new_message',
        title: `New message from ${req.user.name.split(' ')[0]}`,
        message: body.length > 120 ? `${body.slice(0, 117)}...` : body,
        relatedMatch: match._id,
        actionUrl: `/messages/${match._id}`,
      });
    }

    res.status(201).json({ success: true, message });
  } catch (err) {
    next(err);
  }
};

// ─── Inbox: every conversation I'm part of ────────────────────────────────────
const getConversations = async (req, res, next) => {
  try {
    const me = req.user._id;
    const matches = await Match.find({ $or: [{ lostReporter: me }, { foundReporter: me }] })
      .populate('lostItem', 'title category image status')
      .populate('foundItem', 'title category image status')
      .populate('lostReporter', REPORTER)
      .populate('foundReporter', REPORTER)
      .limit(200);

    const ids = matches.map((m) => m._id);
    const [lastMessages, unread] = await Promise.all([
      Message.aggregate([
        { $match: { match: { $in: ids } } },
        { $sort: { createdAt: -1 } },
        { $group: { _id: '$match', body: { $first: '$body' }, sender: { $first: '$sender' }, createdAt: { $first: '$createdAt' }, readAt: { $first: '$readAt' } } },
      ]),
      Message.aggregate([
        { $match: { match: { $in: ids }, sender: { $ne: me }, readAt: null } },
        { $group: { _id: '$match', count: { $sum: 1 } } },
      ]),
    ]);
    const lastBy = new Map(lastMessages.map((m) => [String(m._id), m]));
    const unreadBy = new Map(unread.map((u) => [String(u._id), u.count]));

    const conversations = matches
      .filter((m) => m.lostItem && m.foundItem && (chatOpen(m) || lastBy.has(String(m._id))))
      .map((m) => {
        const role = idOf(m.lostReporter) === String(me) ? 'owner' : 'finder';
        const last = lastBy.get(String(m._id));
        return {
          matchId: m._id,
          role,
          status: m.status,
          open: chatOpen(m),
          other: role === 'owner' ? m.foundReporter : m.lostReporter,
          item: role === 'owner' ? m.foundItem : m.lostItem,
          myItem: role === 'owner' ? m.lostItem : m.foundItem,
          lastMessage: last ? { body: last.body, mine: String(last.sender) === String(me), createdAt: last.createdAt, readAt: last.readAt } : null,
          unread: unreadBy.get(String(m._id)) || 0,
          updatedAt: last?.createdAt || m.updatedAt,
        };
      })
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    res.json({ success: true, conversations, unread: conversations.reduce((n, c) => n + c.unread, 0) });
  } catch (err) {
    next(err);
  }
};

const getUnreadCount = async (req, res, next) => {
  try {
    const me = req.user._id;
    const ids = (await Match.find({ $or: [{ lostReporter: me }, { foundReporter: me }] }).select('_id')).map((m) => m._id);
    const unread = await Message.countDocuments({ match: { $in: ids }, sender: { $ne: me }, readAt: null });
    res.json({ success: true, unread });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getMyMatches, getMatchesForItem, getMatch, respondToMatch, getMessages, sendMessage, readMessages,
  getConversations, getUnreadCount, chatOpen,
};
