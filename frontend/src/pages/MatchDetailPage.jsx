import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft, Sparkles, MapPin, Calendar, CheckCircle2, XCircle, Loader2, Send, Lock,
  MessageSquare, ImagePlus, X, ShieldCheck, ArrowRight,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import { matchApi, recoveryApi, errorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocketEvent } from '../context/SocketContext';
import { Avatar, ScoreBar, StatusBadge, pct } from '../components/ui';

const SIGNALS = {
  photo: [
    ['visual', 'Looks alike', 'CLIP similarity of the two photos'],
    ['category', 'Same category', 'Both reports use the same category'],
    ['location', 'Same place', 'Lost and found in the same building'],
    ['date', 'Close in time', 'Found soon after it was lost'],
  ],
  details: [
    ['text', 'Described alike', 'Words shared by the two reports'],
    ['category', 'Same category', 'Both reports use the same category'],
    ['location', 'Same place', 'Lost and found in the same building'],
    ['date', 'Close in time', 'Found soon after it was lost'],
  ],
};

const SOURCE = {
  photo: 'Suggested by FindIt AI from the photos',
  details: 'Suggested by FindIt from the report details',
  owner: 'The owner recognised this item',
};

export default function MatchDetailPage() {
  const { matchId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [data, setData] = useState(null);
  const [responding, setResponding] = useState(false);

  const load = useCallback(() => matchApi.getById(matchId)
    .then(({ data: d }) => setData(d))
    .catch((err) => { toast.error(errorMessage(err, 'Match not found')); navigate('/dashboard?tab=matches'); }),
  [matchId, navigate]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (data && location.hash === '#chat') document.getElementById('chat')?.scrollIntoView({ behavior: 'smooth' });
  }, [data, location.hash]);

  const respond = async (response) => {
    setResponding(true);
    try {
      await matchApi.respond(matchId, response);
      await load();
      toast.success({
        interested: 'Marked as yours – chat is open',
        'not-mine': 'Match dismissed',
        confirmed: 'Thanks – the owner has been told',
        denied: 'Match dismissed',
      }[response]);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setResponding(false);
    }
  };

  if (!data) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-10 space-y-4">
        <div className="skeleton h-28 w-full rounded-xl" />
        <div className="grid md:grid-cols-2 gap-4"><div className="skeleton h-72 rounded-xl" /><div className="skeleton h-72 rounded-xl" /></div>
      </div>
    );
  }

  const { match, role, recovery } = data;
  const { lostItem, foundItem, scoreBreakdown = {} } = match;
  const openRecovery = recovery && !['cancelled', 'denied'].includes(recovery.status) ? recovery : null;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-[var(--color-ink-500)] hover:text-[var(--color-ink-900)] mb-5">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {/* Score */}
      <div className="card border border-[var(--color-ink-100)] p-5 sm:p-6 mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[var(--color-violet-600)] flex items-center gap-1.5"><Sparkles className="w-4 h-4" /> {SOURCE[match.method || 'photo']}</p>
            <h1 className="font-display font-bold text-xl text-[var(--color-ink-900)] mt-1">
              {role === 'finder' ? 'Someone may have lost the item you found' : role === 'owner' ? 'This found item may be yours' : 'Match between two reports'}
            </h1>
            <p className="text-xs text-[var(--color-ink-500)] mt-1">Suggested {formatDistanceToNow(new Date(match.createdAt), { addSuffix: true })}</p>
          </div>
          <div className="text-right">
            {match.method !== 'owner' && <p className="font-display font-extrabold text-3xl text-[var(--color-ink-900)]">{pct(match.combinedScore)}</p>}
            <StatusBadge status={match.status} />
          </div>
        </div>
        {match.method !== 'owner' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-5 border-t border-[var(--color-ink-100)]">
          {SIGNALS[match.method === 'details' ? 'details' : 'photo'].map(([key, label, hint]) => (
            <div key={key} title={hint}>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="font-semibold text-[var(--color-ink-700)]">{label}</span>
                <span className="text-[var(--color-ink-500)]">{pct(scoreBreakdown[key])}</span>
              </div>
              <ScoreBar value={scoreBreakdown[key]} />
            </div>
          ))}
        </div>
        )}
        <p className="text-xs text-[var(--color-ink-400)] mt-4">
          {match.method === 'owner'
            ? 'The owner opened this from the found report. They still prove ownership before anything is handed over.'
            : 'A high score means the reports look alike – not that they are the same item. Ownership is always checked before handover.'}
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-5 mb-5">
        <ItemPanel item={lostItem} type="lost" reporter={match.lostReporter} you={role === 'owner'} />
        <ItemPanel item={foundItem} type="found" reporter={match.foundReporter} you={role === 'finder'} />
      </div>

      <div className="grid lg:grid-cols-[1fr_1fr] gap-5 items-start">
        <div className="space-y-5">
          {/* Next step */}
          <ActionPanel
            role={role} match={match} recovery={openRecovery} responding={responding} respond={respond}
            onClaimed={(id) => navigate(`/recovery/${id}`)}
          />
        </div>
        <ChatPanel match={match} role={role} me={user} />
      </div>
    </div>
  );
}

function ItemPanel({ item, type, reporter, you }) {
  const loc = type === 'lost' ? item.lastSeenLocation : item.foundLocation;
  const date = type === 'lost' ? item.lostDate : item.foundDate;
  return (
    <div className="card border border-[var(--color-ink-100)] overflow-hidden">
      <div className="h-56 bg-[var(--color-canvas-dark)] relative">
        {item.image?.url && <img src={item.image.url} alt={item.title} className="w-full h-full object-contain" />}
        <span className={clsx('badge absolute top-3 left-3', type === 'lost' ? 'badge-red' : 'badge-teal')}>{type === 'lost' ? 'Lost report' : 'Found report'}</span>
      </div>
      <div className="p-5">
        <h2 className="font-semibold text-[var(--color-ink-900)]">{item.title}</h2>
        {item.description && <p className="text-sm text-[var(--color-ink-600)] mt-1.5 line-clamp-3">{item.description}</p>}
        <div className="mt-3 space-y-1.5 text-xs text-[var(--color-ink-500)]">
          {loc?.building && <p className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{loc.building}{loc.area ? ` – ${loc.area}` : ''}</p>}
          {date && <p className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />{format(new Date(date), 'd MMM yyyy')}</p>}
        </div>
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-[var(--color-ink-100)]">
          <span className="flex items-center gap-2 text-xs text-[var(--color-ink-600)]">
            <Avatar user={reporter} size="w-6 h-6" text="text-[10px]" /> {you ? 'You' : reporter?.name}
          </span>
          <Link to={`/items/${type}/${item._id}`} className="text-xs font-semibold text-[var(--color-violet-600)] hover:underline">Full report</Link>
        </div>
      </div>
    </div>
  );
}

function ActionPanel({ role, match, recovery, responding, respond, onClaimed }) {
  if (match.status === 'verified') {
    return (
      <Notice tone="green" icon={CheckCircle2} title="Returned to its owner">
        This item was handed over and confirmed with a handover code.
        {recovery && <Link className="block font-semibold mt-2 hover:underline" to={`/recovery/${recovery._id}`}>View recovery record</Link>}
      </Notice>
    );
  }
  if (match.status === 'rejected') {
    return <Notice tone="neutral" icon={XCircle} title="Dismissed">One of you said these reports are not the same item. Other suggestions will still appear on your dashboard.</Notice>;
  }
  if (recovery) {
    return (
      <Notice tone="violet" icon={ShieldCheck} title={`Claim ${recovery.status === 'pending' ? 'waiting for review' : recovery.status}`}>
        {role === 'finder' && recovery.status === 'pending' ? 'The owner submitted proof of ownership. Please review it.' : 'Track the verification and handover on the claim page.'}
        <Link className="btn btn-primary btn-sm mt-3" to={`/recovery/${recovery._id}`}>Open claim <ArrowRight className="w-3.5 h-3.5" /></Link>
      </Notice>
    );
  }

  if (role === 'owner') {
    if (match.status === 'pending') {
      return (
        <div className="card border border-[var(--color-ink-100)] p-5">
          <h3 className="font-display font-bold text-[var(--color-ink-900)]">Is this your item?</h3>
          <p className="text-sm text-[var(--color-ink-500)] mt-1 mb-4">Saying yes opens a chat with the finder and lets you submit proof of ownership.</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => respond('interested')} disabled={responding} className="btn btn-primary">
              {responding ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Yes, it looks like mine
            </button>
            <button onClick={() => respond('not-mine')} disabled={responding} className="btn btn-ghost">Not mine</button>
          </div>
        </div>
      );
    }
    return <ClaimForm match={match} onClaimed={onClaimed} />;
  }

  if (role === 'finder') {
    if (match.status === 'pending' && match.foundReporterResponse === 'none') {
      return (
        <div className="card border border-[var(--color-ink-100)] p-5">
          <h3 className="font-display font-bold text-[var(--color-ink-900)]">Does the lost report fit what you found?</h3>
          <p className="text-sm text-[var(--color-ink-500)] mt-1 mb-4">Your answer is shared with the owner. They still have to prove ownership before you hand anything over.</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => respond('confirmed')} disabled={responding} className="btn btn-teal"><CheckCircle2 className="w-4 h-4" /> Looks right</button>
            <button onClick={() => respond('denied')} disabled={responding} className="btn btn-ghost">Not a match</button>
          </div>
        </div>
      );
    }
    return (
      <Notice tone="violet" icon={ShieldCheck} title={match.status === 'accepted' ? 'The owner says this is theirs' : 'Waiting for the owner'}>
        {match.status === 'accepted'
          ? 'They can now submit a claim with proof of ownership. You will be notified to review it. Use the chat to agree on a handover place.'
          : 'The owner has been notified. Nothing to do until they respond.'}
      </Notice>
    );
  }

  return <Notice tone="neutral" icon={ShieldCheck} title="Admin view">You can read this match and its chat. Claims are reviewed from the admin dashboard.</Notice>;
}

function ClaimForm({ match, onClaimed }) {
  const [statement, setStatement] = useState('');
  const [details, setDetails] = useState('');
  const [files, setFiles] = useState([]);
  const [sending, setSending] = useState(false);

  const addFiles = (e) => {
    const picked = Array.from(e.target.files || []).filter((f) => ['image/jpeg', 'image/png', 'image/webp'].includes(f.type));
    setFiles((fs) => [...fs, ...picked].slice(0, 3));
    e.target.value = '';
  };

  const submit = async (e) => {
    e.preventDefault();
    if (statement.trim().length < 20) { toast.error('Describe the item in at least 20 characters'); return; }
    setSending(true);
    try {
      const fd = new FormData();
      fd.append('matchId', match._id);
      fd.append('ownershipStatement', statement.trim());
      if (details.trim()) fd.append('additionalDetails', details.trim());
      files.forEach((f) => fd.append('evidenceImages', f));
      const { data } = await recoveryApi.create(fd);
      toast.success('Claim submitted');
      onClaimed(data.recovery._id);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not submit the claim'));
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={submit} className="card border border-[var(--color-ink-100)] p-5 space-y-4">
      <div>
        <h3 className="font-display font-bold text-[var(--color-ink-900)]">Prove it's yours</h3>
        <p className="text-sm text-[var(--color-ink-500)] mt-1">Only the finder and campus admins see this. Mention things that are not in the public report.</p>
      </div>
      <div>
        <label className="label" htmlFor="statement">What would only the owner know?</label>
        <textarea id="statement" className="input min-h-[110px]" value={statement} onChange={(e) => setStatement(e.target.value)} maxLength={2000}
          placeholder="e.g. What's inside, a serial number, the lock screen photo, a scratch on the back..." />
        <p className="text-[11px] text-[var(--color-ink-400)] mt-1">{statement.trim().length}/20 characters minimum</p>
      </div>
      <div>
        <label className="label" htmlFor="details">Anything else <span className="font-normal text-[var(--color-ink-400)]">(optional)</span></label>
        <input id="details" className="input" value={details} onChange={(e) => setDetails(e.target.value)} maxLength={1000} placeholder="When you can collect it, etc." />
      </div>
      <div>
        <p className="label">Supporting photos <span className="font-normal text-[var(--color-ink-400)]">(up to 3 – receipts, older photos of the item)</span></p>
        <div className="flex flex-wrap gap-2">
          {files.map((f, i) => (
            <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-[var(--color-ink-100)]">
              <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
              <button type="button" onClick={() => setFiles((fs) => fs.filter((_, j) => j !== i))} className="absolute top-0.5 right-0.5 bg-white rounded-full p-0.5 shadow" aria-label="Remove photo"><X className="w-3 h-3" /></button>
            </div>
          ))}
          {files.length < 3 && (
            <label className="w-16 h-16 rounded-lg border-2 border-dashed border-[var(--color-ink-200)] flex items-center justify-center cursor-pointer hover:border-[var(--color-violet-400)]">
              <ImagePlus className="w-5 h-5 text-[var(--color-ink-400)]" />
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={addFiles} />
            </label>
          )}
        </div>
      </div>
      <button type="submit" disabled={sending} className="btn btn-primary w-full">
        {sending ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</> : 'Submit claim'}
      </button>
    </form>
  );
}

function ChatPanel({ match, role, me }) {
  const [messages, setMessages] = useState([]);
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);
  const matchId = match._id;

  useEffect(() => {
    matchApi.messages(matchId).then(({ data }) => { setMessages(data.messages); setOpen(data.open); }).catch(() => {});
  }, [matchId, match.status]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  const onIncoming = useCallback(({ matchId: id, message }) => {
    if (id === matchId) setMessages((ms) => (ms.some((m) => m._id === message._id) ? ms : [...ms, message]));
  }, [matchId]);
  useSocketEvent('chat:message', onIncoming);

  const send = async (e) => {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    setSending(true);
    try {
      const { data } = await matchApi.send(matchId, text);
      setMessages((ms) => [...ms, data.message]);
      setBody('');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const otherName = role === 'owner' ? match.foundReporter?.name : match.lostReporter?.name;

  return (
    <section id="chat" className="card border border-[var(--color-ink-100)] flex flex-col h-[460px] scroll-mt-20">
      <header className="px-5 py-3.5 border-b border-[var(--color-ink-100)] flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-[var(--color-violet-600)]" />
        <p className="font-bold text-sm text-[var(--color-ink-900)] truncate">Chat{role !== 'admin' && otherName ? ` with ${otherName}` : ''}</p>
        <span className="text-[11px] text-[var(--color-ink-400)] ml-auto">Contact details stay private</span>
      </header>

      <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {!open && messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-6">
            <Lock className="w-6 h-6 text-[var(--color-ink-300)] mb-2" />
            <p className="text-sm text-[var(--color-ink-500)]">Chat opens once the owner confirms the item looks like theirs.</p>
          </div>
        ) : messages.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-400)] text-center mt-10">No messages yet. Say hello and agree where to meet.</p>
        ) : messages.map((m) => {
          const mine = String(m.sender?._id || m.sender) === String(me?.id);
          return (
            <div key={m._id} className={clsx('flex gap-2', mine && 'flex-row-reverse')}>
              {!mine && <Avatar user={m.sender} size="w-7 h-7" text="text-[11px]" />}
              <div className={clsx('max-w-[78%] rounded-2xl px-3.5 py-2', mine ? 'bg-[var(--color-ink-900)] text-white rounded-br-md' : 'bg-[var(--color-canvas-dark)] text-[var(--color-ink-900)] rounded-bl-md')}>
                <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>
                <p className={clsx('text-[10px] mt-1', mine ? 'text-white/60' : 'text-[var(--color-ink-400)]')}>{format(new Date(m.createdAt), 'd MMM, HH:mm')}</p>
              </div>
            </div>
          );
        })}
      </div>

      {open && role !== 'admin' && (
        <form onSubmit={send} className="p-3 border-t border-[var(--color-ink-100)] flex gap-2">
          <input className="input" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a message" maxLength={1000} aria-label="Message" />
          <button type="submit" disabled={sending || !body.trim()} className="btn btn-primary px-3" aria-label="Send"><Send className="w-4 h-4" /></button>
        </form>
      )}
    </section>
  );
}

function Notice({ tone, icon: Icon, title, children }) {
  const tones = {
    green: 'border-[var(--color-green-100)] bg-[#f0fdf4] text-[#166534]',
    violet: 'border-[var(--color-violet-100)] bg-[var(--color-violet-50)] text-[var(--color-ink-800)]',
    neutral: 'border-[var(--color-ink-100)] bg-white text-[var(--color-ink-700)]',
  };
  return (
    <div className={clsx('card border p-5', tones[tone])}>
      <p className="font-bold text-sm flex items-center gap-2"><Icon className="w-4 h-4" />{title}</p>
      <div className="text-sm mt-1.5 leading-relaxed">{children}</div>
    </div>
  );
}
