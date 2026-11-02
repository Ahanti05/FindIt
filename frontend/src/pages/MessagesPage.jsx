import { useState, useEffect, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Search } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import { clsx } from 'clsx';
import { matchApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocketEvent } from '../context/SocketContext';
import ChatPanel from '../components/ChatPanel';
import Owl from '../components/Owl';
import { Avatar, Thumb, StatusBadge } from '../components/ui';

export default function MessagesPage() {
  const { matchId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState(null);
  const [filter, setFilter] = useState('');

  const load = useCallback(() => {
    matchApi.conversations().then(({ data }) => setConversations(data.conversations)).catch(() => setConversations([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  // A message in any conversation moves it to the top and updates its preview.
  const onIncoming = useCallback(({ matchId: id, message }) => {
    setConversations((cs) => {
      if (!cs) return cs;
      const existing = cs.find((c) => String(c.matchId) === String(id));
      if (!existing) { load(); return cs; }
      const updated = {
        ...existing,
        lastMessage: { body: message.body, mine: false, createdAt: message.createdAt },
        unread: String(id) === String(matchId) ? 0 : existing.unread + 1,
        updatedAt: message.createdAt,
        open: true,
      };
      return [updated, ...cs.filter((c) => c !== existing)];
    });
  }, [matchId, load]);
  useSocketEvent('chat:message', onIncoming);

  // Opening a conversation clears its unread badge.
  useEffect(() => {
    if (!matchId) return;
    setConversations((cs) => cs?.map((c) => (String(c.matchId) === String(matchId) ? { ...c, unread: 0 } : c)));
  }, [matchId]);

  const onSent = (message) => {
    setConversations((cs) => {
      const existing = cs?.find((c) => String(c.matchId) === String(matchId));
      if (!existing) return cs;
      return [{ ...existing, lastMessage: { body: message.body, mine: true, createdAt: message.createdAt }, updatedAt: message.createdAt }, ...cs.filter((c) => c !== existing)];
    });
  };

  const active = conversations?.find((c) => String(c.matchId) === String(matchId));
  const shown = (conversations || []).filter((c) => {
    const q = filter.trim().toLowerCase();
    return !q || c.other?.name?.toLowerCase().includes(q) || c.item?.title?.toLowerCase().includes(q);
  });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-end justify-between mb-4">
        <div>
          <h1 className="font-display font-bold text-2xl text-[var(--color-ink-900)]">Messages</h1>
          <p className="text-sm text-[var(--color-ink-500)] mt-0.5">Talk to the person who found your item – or to the owner of something you found.</p>
        </div>
      </div>

      <div className="grid md:grid-cols-[320px_1fr] gap-4 items-start">
        {/* Conversation list */}
        <aside className={clsx('card border border-[var(--color-ink-100)] overflow-hidden', matchId && 'hidden md:block')}>
          <div className="p-3 border-b border-[var(--color-ink-100)] relative">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-ink-400)]" />
            <input className="input pl-9" placeholder="Search people or items" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Search conversations" />
          </div>
          {conversations === null ? (
            <div className="p-3 space-y-2">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-16 w-full rounded-lg" />)}</div>
          ) : shown.length === 0 ? (
            <div className="text-center p-6">
              <Owl mood="sleepy" size={90} className="mx-auto" />
              <p className="text-sm font-semibold text-[var(--color-ink-800)] mt-2">No conversations yet</p>
              <p className="text-xs text-[var(--color-ink-500)] mt-1">
                A chat starts when you confirm a match, tap "This is mine" on a found item, or "I found this" on a lost one.
              </p>
              <Link to="/browse" className="btn btn-ghost btn-sm mt-4">Browse reports</Link>
            </div>
          ) : (
            <ul className="max-h-[calc(100vh-15rem)] overflow-y-auto divide-y divide-[var(--color-ink-100)]">
              {shown.map((c) => {
                const selected = String(c.matchId) === String(matchId);
                return (
                  <li key={c.matchId}>
                    <button
                      onClick={() => navigate(`/messages/${c.matchId}`)}
                      className={clsx('w-full text-left p-3 flex gap-3 items-center transition-colors', selected ? 'bg-[var(--color-violet-50)]' : 'hover:bg-[var(--color-canvas)]')}
                      aria-current={selected ? 'true' : undefined}
                    >
                      <div className="relative shrink-0">
                        <Avatar user={c.other} size="w-11 h-11" />
                        <Thumb item={c.item} className="w-6 h-6 absolute -bottom-1 -right-1 ring-2 ring-white rounded-md" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className={clsx('text-sm truncate', c.unread ? 'font-bold text-[var(--color-ink-900)]' : 'font-semibold text-[var(--color-ink-800)]')}>{c.other?.name}</p>
                          {c.lastMessage && (
                            <span className="text-[10px] text-[var(--color-ink-400)] shrink-0">
                              {Date.now() - new Date(c.lastMessage.createdAt) < 60000 ? 'now' : formatDistanceToNowStrict(new Date(c.lastMessage.createdAt))}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[var(--color-ink-500)] truncate">
                          {c.role === 'owner' ? 'Found' : 'Lost'}: {c.item?.title}
                        </p>
                        <div className="flex items-center justify-between gap-2 mt-0.5">
                          <p className={clsx('text-xs truncate', c.unread ? 'text-[var(--color-ink-900)] font-semibold' : 'text-[var(--color-ink-500)]')}>
                            {c.lastMessage ? `${c.lastMessage.mine ? 'You: ' : ''}${c.lastMessage.body}` : c.open ? 'Say hello' : 'Waiting for the owner to confirm'}
                          </p>
                          {c.unread > 0 && (
                            <span className="min-w-5 h-5 px-1.5 rounded-full bg-[var(--color-violet-600)] text-white text-[11px] font-bold flex items-center justify-center shrink-0">{c.unread}</span>
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        {/* Conversation */}
        <div className={clsx(!matchId && 'hidden md:block')}>
          {matchId && active ? (
            <>
              <button onClick={() => navigate('/messages')} className="md:hidden flex items-center gap-1.5 text-sm text-[var(--color-ink-500)] mb-3">
                <ArrowLeft className="w-4 h-4" /> All conversations
              </button>
              <div className="card border border-[var(--color-ink-100)] p-3 mb-3 flex items-center gap-3">
                <Thumb item={active.myItem} className="w-10 h-10" />
                <p className="text-xs text-[var(--color-ink-500)] flex-1 min-w-0">
                  {active.role === 'owner' ? 'About your lost' : 'About the item you found:'}{' '}
                  <span className="font-semibold text-[var(--color-ink-800)]">“{active.myItem?.title}”</span>
                </p>
                <StatusBadge status={active.status} className="text-[10px]" />
              </div>
              <ChatPanel
                key={active.matchId}
                matchId={active.matchId} role={active.role} other={active.other} me={user}
                height="h-[calc(100vh-17rem)] min-h-[380px]" showMatchLink onSent={onSent}
              />
            </>
          ) : matchId && conversations && !active ? (
            <div className="card border border-[var(--color-ink-100)] p-10 text-center">
              <p className="text-sm text-[var(--color-ink-500)]">This conversation isn't available.</p>
            </div>
          ) : (
            <div className="card border border-[var(--color-ink-100)] h-[calc(100vh-15rem)] min-h-[380px] flex flex-col items-center justify-center text-center p-8">
              <Owl mood="happy" size={120} bob />
              <p className="font-display font-bold text-[var(--color-ink-900)] mt-3">Pick a conversation</p>
              <p className="text-sm text-[var(--color-ink-500)] mt-1 max-w-xs">Agree where to meet, ask a question about the item – your email and phone stay private.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
