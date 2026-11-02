import { useState, useEffect, useRef, useCallback, Fragment } from 'react';
import { Link } from 'react-router-dom';
import { Send, Lock, MessageSquare, CheckCheck, Check, ArrowRight } from 'lucide-react';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import { matchApi, errorMessage } from '../services/api';
import { useSocketEvent } from '../context/SocketContext';
import { Avatar } from './ui';

const dayLabel = (d) => (isToday(d) ? 'Today' : isYesterday(d) ? 'Yesterday' : format(d, 'EEE d MMM'));

/**
 * Private chat between the owner and the finder of one match.
 * Used on the match page and in the Messages section.
 */
export default function ChatPanel({ matchId, role, other, me, className, height = 'h-[460px]', showMatchLink = false, onSent }) {
  const [messages, setMessages] = useState([]);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [seenAt, setSeenAt] = useState(null);
  const listRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    setLoaded(false);
    setMessages([]);
    matchApi.messages(matchId)
      .then(({ data }) => {
        setMessages(data.messages);
        setOpen(data.open);
        const lastMineRead = [...data.messages].reverse().find((m) => String(m.sender?._id || m.sender) === String(me?.id) && m.readAt);
        setSeenAt(lastMineRead?.readAt || null);
        // Loading the chat marked its messages read – let the navbar badge refresh.
        window.dispatchEvent(new Event('findit:messages-read'));
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [matchId, me?.id]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  // Live: new message from the other person – show it and mark it read.
  const onIncoming = useCallback(({ matchId: id, message }) => {
    if (String(id) !== String(matchId)) return;
    setMessages((ms) => (ms.some((m) => m._id === message._id) ? ms : [...ms, message]));
    setOpen(true);
    matchApi.markRead(matchId).then(() => window.dispatchEvent(new Event('findit:messages-read'))).catch(() => {});
  }, [matchId]);
  useSocketEvent('chat:message', onIncoming);

  // Live: the other person read my messages.
  const onRead = useCallback(({ matchId: id, readAt }) => {
    if (String(id) === String(matchId)) setSeenAt(readAt);
  }, [matchId]);
  useSocketEvent('chat:read', onRead);

  const send = async (e) => {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    setSending(true);
    try {
      const { data } = await matchApi.send(matchId, text);
      setMessages((ms) => [...ms, data.message]);
      setSeenAt(null);
      setBody('');
      onSent?.(data.message);
      inputRef.current?.focus();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const mineId = String(me?.id);
  const lastMine = [...messages].reverse().find((m) => String(m.sender?._id || m.sender) === mineId);

  return (
    <section id="chat" className={clsx('card border border-[var(--color-ink-100)] flex flex-col scroll-mt-20', height, className)}>
      <header className="px-5 py-3.5 border-b border-[var(--color-ink-100)] flex items-center gap-3">
        {other ? <Avatar user={other} size="w-8 h-8" text="text-xs" /> : <MessageSquare className="w-4 h-4 text-[var(--color-violet-600)]" />}
        <div className="min-w-0 flex-1">
          <p className="font-bold text-sm text-[var(--color-ink-900)] truncate">{role === 'admin' ? 'Chat (read only)' : other?.name || 'Chat'}</p>
          <p className="text-[11px] text-[var(--color-ink-400)]">
            {role === 'owner' ? 'Found your item' : role === 'finder' ? 'Owner of the item' : ''}{role !== 'admin' ? ' · contact details stay private' : ''}
          </p>
        </div>
        {showMatchLink && (
          <Link to={`/matches/${matchId}`} className="btn btn-ghost btn-sm shrink-0">
            {role === 'owner' ? 'Claim item' : 'Match details'} <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </header>

      <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-2.5 bg-[var(--color-canvas)]">
        {!loaded ? (
          <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className={clsx('skeleton h-10 rounded-2xl', i % 2 ? 'w-1/2 ml-auto' : 'w-2/3')} />)}</div>
        ) : !open && messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-6">
            <Lock className="w-6 h-6 text-[var(--color-ink-300)] mb-2" />
            <p className="text-sm text-[var(--color-ink-500)]">
              {role === 'finder' ? 'Chat opens as soon as the owner says the item looks like theirs.' : 'Say "Yes, it looks like mine" on the match to open the chat.'}
            </p>
          </div>
        ) : messages.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-400)] text-center mt-10">No messages yet. Say hello and agree where to meet.</p>
        ) : messages.map((m, i) => {
          const mine = String(m.sender?._id || m.sender) === mineId;
          const at = new Date(m.createdAt);
          const newDay = i === 0 || !isSameDay(at, new Date(messages[i - 1].createdAt));
          const isLastMine = lastMine && m._id === lastMine._id;
          const seen = isLastMine && (seenAt || m.readAt);
          return (
            <Fragment key={m._id}>
              {newDay && (
                <p className="text-center text-[11px] font-semibold text-[var(--color-ink-400)] py-1">{dayLabel(at)}</p>
              )}
              <div className={clsx('flex gap-2', mine && 'flex-row-reverse')}>
                {!mine && <Avatar user={m.sender} size="w-7 h-7" text="text-[11px]" />}
                <div className={clsx('max-w-[78%] rounded-2xl px-3.5 py-2', mine ? 'bg-[var(--color-ink-900)] text-white rounded-br-md' : 'bg-white border border-[var(--color-ink-100)] text-[var(--color-ink-900)] rounded-bl-md')}>
                  <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>
                  <p className={clsx('text-[10px] mt-1 flex items-center gap-1 justify-end', mine ? 'text-white/60' : 'text-[var(--color-ink-400)]')}>
                    {format(at, 'HH:mm')}
                    {mine && (seen ? <CheckCheck className="w-3 h-3 text-[var(--color-teal-400)]" aria-label="Seen" /> : <Check className="w-3 h-3" aria-label="Sent" />)}
                  </p>
                </div>
              </div>
              {isLastMine && seen && <p className="text-right text-[10px] text-[var(--color-ink-400)] -mt-1">Seen</p>}
            </Fragment>
          );
        })}
      </div>

      {open && role !== 'admin' && (
        <form onSubmit={send} className="p-3 border-t border-[var(--color-ink-100)] flex gap-2 bg-white rounded-b-[var(--radius-card)]">
          <input ref={inputRef} className="input" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a message" maxLength={1000} aria-label="Message" />
          <button type="submit" disabled={sending || !body.trim()} className="btn btn-primary px-3" aria-label="Send"><Send className="w-4 h-4" /></button>
        </form>
      )}
    </section>
  );
}
