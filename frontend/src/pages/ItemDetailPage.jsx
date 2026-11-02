import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  MapPin, Calendar, Eye, ArrowLeft, Sparkles, Loader2, Share2, Flag, Pencil, Archive,
  RotateCcw, Trash2, CheckCircle2, AlertTriangle, Package, Gift, Clock, Hand,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import { itemsApi, matchApi, foundApi, lostApi, errorMessage } from '../services/api';
import Owl, { Coin } from '../components/Owl';
import { useAuth } from '../context/AuthContext';
import { useMeta, HANDOVER_LABELS } from '../context/MetaContext';
import { Avatar, CategoryIcon, Modal, ScoreBar, StatusBadge, Thumb, pct } from '../components/ui';

const PROCESSING = ['pending', 'processing'];

export default function ItemDetailPage({ type }) {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const api = itemsApi(type);
  const [item, setItem] = useState(null);
  const [isOwner, setIsOwner] = useState(false);
  const [namedOnItem, setNamedOnItem] = useState(false);
  const [matches, setMatches] = useState(null);
  const [showAnnotated, setShowAnnotated] = useState(false);
  const [modal, setModal] = useState(null); // 'edit' | 'delete' | 'flag'
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api.getById(id)
    .then(({ data }) => { setItem(data.item); setIsOwner(data.isOwner); setNamedOnItem(Boolean(data.namedOnItem)); return data.item; })
    .catch((err) => {
      if (err.response?.status === 404) navigate('/404', { replace: true });
      else toast.error(errorMessage(err, 'Could not load this report'));
    }), [api, id, navigate]);

  useEffect(() => { setItem(null); setMatches(null); load(); }, [load]);

  const aiStatus = item?.aiDetection?.processingStatus;
  const aiRunning = Boolean(item?.image?.url) && PROCESSING.includes(aiStatus);

  // Poll while the AI is still working on this report.
  useEffect(() => {
    if (!aiRunning) return undefined;
    const t = setInterval(load, 2500);
    return () => clearInterval(t);
  }, [aiRunning, load]);

  useEffect(() => {
    if (!isOwner || aiRunning) return;
    matchApi.forItem(type, id).then(({ data }) => setMatches(data.matches)).catch(() => setMatches([]));
  }, [isOwner, aiRunning, type, id]);

  const updateStatus = async (status, message) => {
    setBusy(true);
    try {
      const { data } = await api.update(id, { status });
      setItem((i) => ({ ...i, status: data.item.status }));
      toast.success(message);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const reprocess = async () => {
    try {
      await api.reprocess(id);
      setItem((i) => ({ ...i, aiDetection: { ...i.aiDetection, processingStatus: 'processing', error: null } }));
      toast.success('Running the AI again');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(id);
      toast.success('Report deleted');
      navigate('/dashboard');
    } catch (err) {
      toast.error(errorMessage(err));
      setBusy(false);
      setModal(null);
    }
  };

  if (!item) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-10 grid lg:grid-cols-[1fr_340px] gap-6">
        <div className="space-y-4"><div className="skeleton h-80 w-full rounded-xl" /><div className="skeleton h-6 w-1/2" /><div className="skeleton h-4 w-full" /></div>
        <div className="skeleton h-64 rounded-xl" />
      </div>
    );
  }

  const location = type === 'lost' ? item.lastSeenLocation : item.foundLocation;
  const date = type === 'lost' ? item.lostDate : item.foundDate;
  const ai = item.aiDetection || {};
  const imageSrc = showAnnotated && ai.annotatedImageUrl ? ai.annotatedImageUrl : item.image?.url;
  const doneStatus = type === 'lost' ? 'recovered' : 'returned';

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-[var(--color-ink-500)] hover:text-[var(--color-ink-900)] mb-5">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
        {/* ── Main ─────────────────────────────────────────────────────── */}
        <div className="space-y-5 min-w-0">
          <div className="card border border-[var(--color-ink-100)] overflow-hidden">
            {item.image?.url ? (
              <div className="relative bg-[var(--color-canvas-dark)]">
                <img src={imageSrc} alt={item.title} className="w-full max-h-[420px] object-contain" />
                {ai.annotatedImageUrl && (
                  <div className="absolute bottom-3 left-3 flex bg-white/95 rounded-lg p-0.5 shadow-sm text-xs font-semibold">
                    {[['Photo', false], ['AI detections', true]].map(([label, val]) => (
                      <button key={label} onClick={() => setShowAnnotated(val)}
                        className={clsx('px-3 py-1.5 rounded-md', showAnnotated === val ? 'bg-[var(--color-ink-900)] text-white' : 'text-[var(--color-ink-600)]')}>
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="h-56 bg-[var(--color-canvas-dark)] flex flex-col items-center justify-center text-[var(--color-ink-300)]">
                <CategoryIcon category={item.category} className="w-12 h-12" />
                <p className="text-sm mt-2">No photo was added</p>
              </div>
            )}
          </div>

          <div className="card border border-[var(--color-ink-100)] p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className={clsx('badge', type === 'lost' ? 'badge-red' : 'badge-teal')}>{type === 'lost' ? 'Lost' : 'Found'}</span>
                  <StatusBadge status={item.status} />
                  {item.rewardCoins > 0 && <span className="badge badge-amber"><Coin size={13} /> {item.rewardCoins} coin reward</span>}
                  {item.rewardOffered && !item.rewardCoins && <span className="badge badge-amber"><Gift className="w-3 h-3" /> Reward</span>}
                </div>
                <h1 className="font-display font-bold text-2xl text-[var(--color-ink-900)] break-words">{item.title}</h1>
                <p className="text-sm text-[var(--color-ink-500)] flex items-center gap-1.5 mt-1">
                  <CategoryIcon category={item.category} className="w-4 h-4" /> {item.category}
                  <span className="text-[var(--color-ink-300)]">·</span>
                  <Eye className="w-3.5 h-3.5" /> {item.views} views
                </p>
              </div>
              <button
                onClick={() => { navigator.clipboard?.writeText(window.location.href); toast.success('Link copied'); }}
                className="btn btn-ghost btn-sm shrink-0" title="Copy link"
              >
                <Share2 className="w-4 h-4" /> Share
              </button>
            </div>

            {item.description && <p className="text-sm text-[var(--color-ink-700)] leading-relaxed mt-4 whitespace-pre-line">{item.description}</p>}

            <dl className="mt-5 pt-5 border-t border-[var(--color-ink-100)] grid sm:grid-cols-2 gap-4">
              {location?.building && (
                <Info icon={MapPin} label={type === 'lost' ? 'Last seen' : 'Found at'}>
                  {location.building}{location.area ? ` – ${location.area}` : ''}
                </Info>
              )}
              {date && (
                <Info icon={Calendar} label={type === 'lost' ? 'Date lost' : 'Date found'}>
                  {format(new Date(date), 'd MMM yyyy')}{(item.lostTimeApprox || item.foundTime) ? `, ${item.lostTimeApprox || item.foundTime}` : ''}
                </Info>
              )}
              {item.colors?.length > 0 && <Info icon={Package} label="Colours">{item.colors.join(', ')}</Info>}
              {type === 'lost' && item.identifyingCharacteristics && <Info icon={AlertTriangle} label="Identifying marks">{item.identifyingCharacteristics}</Info>}
              {type === 'lost' && item.rewardOffered && (
                <Info icon={Gift} label="Reward">
                  {[item.rewardCoins ? `${item.rewardCoins} FindIt coins` : '', item.rewardDescription].filter(Boolean).join(' + ') || 'Offered'}
                </Info>
              )}
              {type === 'found' && item.currentLocation && <Info icon={Package} label="Item is now">{item.currentLocation}</Info>}
              {type === 'found' && <Info icon={Hand} label="Collection">{HANDOVER_LABELS[item.handoverPreference]}</Info>}
            </dl>
          </div>

          {/* AI panel */}
          {item.image?.url && (
            <div className="card border border-[var(--color-ink-100)] p-5">
              <div className="flex items-center justify-between gap-3 mb-3">
                <p className="font-bold text-sm text-[var(--color-ink-900)] flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[var(--color-violet-600)]" /> AI analysis
                </p>
                {isOwner && ['done', 'failed'].includes(aiStatus) && (
                  <button onClick={reprocess} className="btn btn-ghost btn-sm"><RotateCcw className="w-3.5 h-3.5" /> Run again</button>
                )}
              </div>

              {aiRunning && (
                <p className="text-sm text-[var(--color-ink-500)] flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-[var(--color-violet-600)]" />
                  Detecting the object, computing its visual fingerprint and searching for matches...
                </p>
              )}
              {aiStatus === 'failed' && (
                <p className="text-sm text-[#92400e] bg-[var(--color-amber-50)] rounded-lg p-3">
                  Analysis did not finish{ai.error ? `: ${ai.error}` : ''}. {isOwner ? 'Try "Run again" in a moment.' : ''}
                </p>
              )}
              {aiStatus === 'done' && (
                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <p className="text-xs font-bold text-[var(--color-ink-500)] uppercase tracking-wide mb-2">Recognised as</p>
                    <div className="space-y-2">
                      {(ai.categoryGuesses || []).map((g) => (
                        <div key={g.category}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className={clsx('font-semibold', g.category === item.category ? 'text-[var(--color-ink-900)]' : 'text-[var(--color-ink-500)]')}>{g.category}</span>
                            <span className="text-[var(--color-ink-500)]">{pct(g.confidence)}</span>
                          </div>
                          <ScoreBar value={g.confidence} />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[var(--color-ink-500)] uppercase tracking-wide mb-2">Objects detected (YOLOv8)</p>
                    {ai.detectedObjects?.length ? (
                      <ul className="flex flex-wrap gap-1.5">
                        {ai.detectedObjects.slice(0, 6).map((o, i) => (
                          <li key={i} className="badge badge-neutral">{o.label} {pct(o.confidence)}</li>
                        ))}
                      </ul>
                    ) : <p className="text-sm text-[var(--color-ink-400)]">None of the 80 COCO classes were detected – recognition relies on CLIP.</p>}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Sidebar ──────────────────────────────────────────────────── */}
        <aside className="space-y-4">
          <div className="card border border-[var(--color-ink-100)] p-5">
            <p className="text-xs font-bold text-[var(--color-ink-500)] uppercase tracking-wider mb-3">{type === 'lost' ? 'Reported by' : 'Found by'}</p>
            <div className="flex items-center gap-3">
              <Avatar user={item.reporter} />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--color-ink-900)] truncate">{isOwner ? 'You' : item.reporter?.name}</p>
                <p className="text-xs text-[var(--color-ink-500)] truncate">{item.reporter?.department || item.reporter?.role}</p>
              </div>
            </div>
            <p className="text-xs text-[var(--color-ink-400)] mt-3 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Reported {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
            </p>
          </div>

          {isOwner && (
            <div className="card border border-[var(--color-ink-100)] p-5">
              <p className="text-xs font-bold text-[var(--color-ink-500)] uppercase tracking-wider mb-3">Manage report</p>
              <div className="grid gap-2">
                <button onClick={() => setModal('edit')} className="btn btn-ghost justify-start"><Pencil className="w-4 h-4" /> Edit details</button>
                {item.status === 'active' && (
                  <>
                    <button disabled={busy} onClick={() => updateStatus(doneStatus, type === 'lost' ? 'Glad you got it back!' : 'Marked as returned')} className="btn btn-ghost justify-start">
                      <CheckCircle2 className="w-4 h-4" /> {type === 'lost' ? 'I got it back' : 'Returned to owner'}
                    </button>
                    <button disabled={busy} onClick={() => updateStatus('archived', 'Report archived')} className="btn btn-ghost justify-start"><Archive className="w-4 h-4" /> Archive</button>
                  </>
                )}
                {['archived', 'expired'].includes(item.status) && (
                  <button disabled={busy} onClick={() => updateStatus('active', 'Report reopened')} className="btn btn-ghost justify-start"><RotateCcw className="w-4 h-4" /> Reopen</button>
                )}
                <button onClick={() => setModal('delete')} className="btn btn-ghost-danger justify-start"><Trash2 className="w-4 h-4" /> Delete</button>
              </div>
            </div>
          )}

          {isOwner && (
            <div className="card border border-[var(--color-ink-100)] p-5">
              <p className="font-bold text-sm text-[var(--color-ink-900)] flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-[var(--color-violet-600)]" /> Possible matches
              </p>
              {matches === null || aiRunning ? (
                <div className="space-y-3">{[0, 1].map((i) => <div key={i} className="flex gap-3"><div className="skeleton w-12 h-12 rounded-lg" /><div className="flex-1"><div className="skeleton h-3 w-2/3 mb-2" /><div className="skeleton h-2 w-full" /></div></div>)}</div>
              ) : matches.length === 0 ? (
                <p className="text-sm text-[var(--color-ink-500)]">
                  {item.image?.url
                    ? `Nothing similar yet. You'll be notified as soon as a matching ${type === 'lost' ? 'found' : 'lost'} report comes in.`
                    : <>Reports without a photo are not matched automatically. <Link className="font-semibold text-[var(--color-violet-600)] hover:underline" to={`/browse?type=${type === 'lost' ? 'found' : 'lost'}`}>Browse {type === 'lost' ? 'found' : 'lost'} items</Link> instead.</>}
                </p>
              ) : (
                <ul className="space-y-1">
                  {matches.map((m) => {
                    const other = type === 'lost' ? m.foundItem : m.lostItem;
                    return (
                      <li key={m._id}>
                        <Link to={`/matches/${m._id}`} className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-[var(--color-canvas)]">
                          <Thumb item={other} className="w-12 h-12" />
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm font-semibold text-[var(--color-ink-900)] truncate">{other.title}</span>
                            <ScoreBar value={m.combinedScore} className="mt-1.5" />
                            <span className="flex justify-between text-[11px] text-[var(--color-ink-500)] mt-1">
                              <span>{pct(m.combinedScore)} match</span>
                              {m.status !== 'pending' && <StatusBadge status={m.status} className="text-[10px] py-0" />}
                            </span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {!isOwner && user && item.status === 'active' && (
            <div className={clsx('card border p-5', type === 'lost' ? 'border-[var(--color-teal-100)] bg-[var(--color-teal-50)]' : 'border-[var(--color-violet-100)] bg-[var(--color-violet-50)]')}>
              {type === 'lost' ? (
                <>
                  <p className="font-bold text-sm text-[var(--color-ink-900)] mb-1">Have you found this?</p>
                  <p className="text-xs text-[var(--color-ink-600)] mb-4 leading-relaxed">Message the owner right now – a private chat opens. They prove it's theirs before you hand it over.</p>
                  <button onClick={() => setModal('found-it')} className="btn btn-teal w-full">I found this – message the owner</button>
                  <Link to="/report/found" className="block text-center text-xs font-semibold text-[var(--color-teal-600)] mt-3 hover:underline">Or report it with a photo</Link>
                </>
              ) : (
                <>
                  {namedOnItem && (
                    <div className="flex items-center gap-3 mb-4">
                      <Owl mood="search" size={56} />
                      <p className="text-sm font-semibold text-[var(--color-ink-900)]">The finder says your name is on this item.</p>
                    </div>
                  )}
                  <p className="font-bold text-sm text-[var(--color-ink-900)] mb-1">Is this yours?</p>
                  <p className="text-xs text-[var(--color-ink-600)] mb-4 leading-relaxed">
                    Tell the finder. A private chat opens and you can submit proof of ownership – they hand it over once it's verified.
                  </p>
                  <button onClick={() => setModal('mine')} className="btn btn-primary w-full">This is mine</button>
                  <Link to="/dashboard?tab=matches" className="block text-center text-xs font-semibold text-[var(--color-violet-600)] mt-3 hover:underline">Already reported it lost? See your matches</Link>
                </>
              )}
            </div>
          )}

          {!user && (
            <div className="card border border-[var(--color-ink-100)] p-5 text-center">
              <p className="text-sm text-[var(--color-ink-600)] mb-3">Sign in to report a match or contact the {type === 'lost' ? 'owner' : 'finder'}.</p>
              <Link to="/login" state={{ from: `/items/${type}/${id}` }} className="btn btn-primary w-full">Sign in</Link>
            </div>
          )}

          {user && !isOwner && (
            <button onClick={() => setModal('flag')} className="flex items-center gap-1.5 text-xs text-[var(--color-ink-400)] hover:text-[#b91c1c] w-full justify-center py-2">
              <Flag className="w-3.5 h-3.5" /> Report this listing
            </button>
          )}
        </aside>
      </div>

      <EditModal open={modal === 'edit'} onClose={() => setModal(null)} item={item} type={type}
        onSaved={(updated) => { setItem((i) => ({ ...i, ...updated })); setModal(null); }} />

      <Modal open={modal === 'delete'} onClose={() => setModal(null)} title="Delete this report?">
        <p className="text-sm text-[var(--color-ink-600)]">This removes the report, its photo and any suggested matches. If you just got the item back, mark it as resolved instead so the stats stay accurate.</p>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={() => setModal(null)} className="btn btn-ghost">Cancel</button>
          <button onClick={remove} disabled={busy} className="btn btn-danger">{busy ? 'Deleting...' : 'Delete report'}</button>
        </div>
      </Modal>

      <FlagModal open={modal === 'flag'} onClose={() => setModal(null)} api={api} id={id} />
      <MineModal open={modal === 'mine'} onClose={() => setModal(null)} item={item} onDone={(matchId) => navigate(`/matches/${matchId}`)} />
      <FoundItModal open={modal === 'found-it'} onClose={() => setModal(null)} item={item} onDone={(matchId) => navigate(`/messages/${matchId}`)} />
    </div>
  );
}

function Info({ icon: Icon, label, children }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="w-4 h-4 text-[var(--color-ink-400)] shrink-0 mt-0.5" />
      <div className="min-w-0">
        <dt className="text-[11px] font-bold text-[var(--color-ink-500)] uppercase tracking-wide">{label}</dt>
        <dd className="text-sm text-[var(--color-ink-800)] break-words">{children}</dd>
      </div>
    </div>
  );
}

function EditModal({ open, onClose, item, type, onSaved }) {
  const { categories, buildings } = useMeta();
  const location = type === 'lost' ? item.lastSeenLocation : item.foundLocation;
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({
      title: item.title || '',
      category: item.category || '',
      description: item.description || '',
      colors: (item.colors || []).join(', '),
      building: location?.building || '',
      area: location?.area || '',
      ...(type === 'lost'
        ? { identifyingCharacteristics: item.identifyingCharacteristics || '' }
        : { currentLocation: item.currentLocation || '' }),
    });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (f) => (e) => setForm((s) => ({ ...s, [f]: e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await itemsApi(type).update(item._id, form);
      toast.success('Report updated');
      onSaved(data.item);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Edit report" width="max-w-lg">
      <form onSubmit={save} className="space-y-4">
        <div><label className="label">Item name</label><input className="input" value={form.title || ''} onChange={set('title')} required maxLength={100} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Category</label>
            <select className="input" value={form.category || ''} onChange={set('category')}>{categories.map((c) => <option key={c}>{c}</option>)}</select></div>
          <div><label className="label">Building</label>
            <select className="input" value={form.building || ''} onChange={set('building')}>{buildings.map((b) => <option key={b}>{b}</option>)}</select></div>
        </div>
        <div><label className="label">Exact spot</label><input className="input" value={form.area || ''} onChange={set('area')} maxLength={200} /></div>
        <div><label className="label">Description</label><textarea className="input min-h-[80px]" value={form.description || ''} onChange={set('description')} maxLength={1000} /></div>
        <div><label className="label">Colours</label><input className="input" value={form.colors || ''} onChange={set('colors')} /></div>
        {type === 'lost'
          ? <div><label className="label">Identifying marks</label><input className="input" value={form.identifyingCharacteristics || ''} onChange={set('identifyingCharacteristics')} maxLength={500} /></div>
          : <div><label className="label">Item is now</label><input className="input" value={form.currentLocation || ''} onChange={set('currentLocation')} maxLength={200} /></div>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button type="submit" disabled={saving} className="btn btn-primary">{saving ? 'Saving...' : 'Save changes'}</button>
        </div>
      </form>
    </Modal>
  );
}

function FlagModal({ open, onClose, api, id }) {
  const [reason, setReason] = useState('');
  const [sending, setSending] = useState(false);
  const send = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      const { data } = await api.flag(id, reason);
      toast.success(data.message);
      setReason('');
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSending(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title="Report this listing">
      <form onSubmit={send} className="space-y-4">
        <p className="text-sm text-[var(--color-ink-600)]">Tell the admins what's wrong – spam, personal information in the description, an offensive photo, or a fake report.</p>
        <textarea className="input min-h-[90px]" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} required placeholder="What's the problem?" />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button type="submit" disabled={sending || !reason.trim()} className="btn btn-danger">{sending ? 'Sending...' : 'Send report'}</button>
        </div>
      </form>
    </Modal>
  );
}

function MineModal({ open, onClose, item, onDone }) {
  const [description, setDescription] = useState('');
  const [sending, setSending] = useState(false);
  const send = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      const { data } = await foundApi.claimMine(item._id, description);
      toast.success('The finder has been told. Chat is open.');
      onDone(data.matchId);
    } catch (err) {
      toast.error(errorMessage(err));
      setSending(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title={`Is "${item?.title}" yours?`}>
      <form onSubmit={send} className="space-y-4">
        <p className="text-sm text-[var(--color-ink-600)]">
          We'll open a private chat with the finder and create a lost report for you. You'll prove ownership in the next step – don't post private details here.
        </p>
        <div>
          <label className="label" htmlFor="mine-desc">When and where did you lose it? <span className="font-normal text-[var(--color-ink-400)]">(optional)</span></label>
          <textarea id="mine-desc" className="input min-h-[80px]" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button type="submit" disabled={sending} className="btn btn-primary">{sending ? 'Opening chat...' : 'Yes, it is mine'}</button>
        </div>
      </form>
    </Modal>
  );
}

function FoundItModal({ open, onClose, item, onDone }) {
  const [message, setMessage] = useState('');
  const [where, setWhere] = useState('');
  const [sending, setSending] = useState(false);
  useEffect(() => {
    if (open) setMessage(`Hi! I think I found your ${item?.title?.toLowerCase() || 'item'}.`);
  }, [open, item?.title]);
  const send = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      const { data } = await lostApi.foundIt(item._id, { message, currentLocation: where });
      toast.success('Message sent to the owner');
      onDone(data.matchId);
    } catch (err) {
      toast.error(errorMessage(err));
      setSending(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title="Message the owner">
      <form onSubmit={send} className="space-y-4">
        <p className="text-sm text-[var(--color-ink-600)]">
          This opens a private chat with the owner. Don't describe hidden details (what's inside, serial numbers) – the owner uses those to prove it's theirs.
        </p>
        <div>
          <label className="label" htmlFor="fi-msg">Your message</label>
          <textarea id="fi-msg" className="input min-h-[90px]" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1000} required />
        </div>
        <div>
          <label className="label" htmlFor="fi-where">Where is it now? <span className="font-normal text-[var(--color-ink-400)]">(optional)</span></label>
          <input id="fi-where" className="input" value={where} onChange={(e) => setWhere(e.target.value)} maxLength={200} placeholder="e.g. With me, or handed to the library desk" />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button type="submit" disabled={sending || !message.trim()} className="btn btn-teal">{sending ? 'Sending...' : 'Send message'}</button>
        </div>
      </form>
    </Modal>
  );
}
