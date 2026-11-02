import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Clock, MapPin, Loader2, ShieldCheck, MessageSquare, KeyRound, XCircle, Circle } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';
import { clsx } from 'clsx';
import { recoveryApi, errorMessage } from '../services/api';
import { HANDOVER_LABELS } from '../context/MetaContext';
import { StatusBadge, Thumb, Modal } from '../components/ui';

export default function RecoveryPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const load = useCallback(() => recoveryApi.getById(id)
    .then(({ data: d }) => setData(d))
    .catch((err) => { toast.error(errorMessage(err, 'Claim not found')); navigate('/dashboard?tab=claims'); }),
  [id, navigate]);

  useEffect(() => { load(); }, [load]);

  if (!data) {
    return <div className="max-w-3xl mx-auto px-6 py-10 space-y-4"><div className="skeleton h-24 rounded-xl w-full" /><div className="skeleton h-64 rounded-xl w-full" /></div>;
  }

  const { recovery, role } = data;
  const { status, lostItem, foundItem } = recovery;
  const reviewer = role === 'finder' || role === 'admin';

  const cancel = async () => {
    try {
      await recoveryApi.cancel(id);
      toast.success('Claim withdrawn');
      setConfirmCancel(false);
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-[var(--color-ink-500)] hover:text-[var(--color-ink-900)] mb-5">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <p className="text-sm font-semibold text-[var(--color-violet-600)]">Ownership claim</p>
          <h1 className="font-display font-bold text-2xl text-[var(--color-ink-900)]">{foundItem?.title}</h1>
          <p className="text-sm text-[var(--color-ink-500)] mt-1">
            {role === 'claimant' ? 'Your claim' : `Claimed by ${recovery.claimant?.name}`} · submitted {format(new Date(recovery.createdAt), 'd MMM yyyy, HH:mm')}
          </p>
        </div>
        <StatusBadge status={status} className="text-sm py-1 px-3" />
      </div>

      <Timeline recovery={recovery} />

      {/* Role-specific next step */}
      {role === 'claimant' && status === 'pending' && (
        <Panel tone="violet" icon={Clock} title="Waiting for verification">
          The finder or the Lost &amp; Found office is checking your description against the item. You'll be notified as soon as they decide.
        </Panel>
      )}
      {role === 'claimant' && status === 'approved' && <HandoverPass recovery={recovery} />}
      {reviewer && status === 'pending' && <ReviewForm recovery={recovery} onDone={load} />}
      {reviewer && status === 'approved' && <CompleteForm recovery={recovery} onDone={load} />}
      {status === 'completed' && (
        <Panel tone="green" icon={CheckCircle2} title="Item returned">
          Handed over on {format(new Date(recovery.handoverCompletedAt), 'd MMM yyyy, HH:mm')}{recovery.handoverLocation ? ` at ${recovery.handoverLocation}` : ''}. Both reports are closed.
        </Panel>
      )}
      {status === 'denied' && (
        <Panel tone="red" icon={XCircle} title="Claim not approved">
          {recovery.reviewNote || 'The details did not match the item.'} {role === 'claimant' && 'If you think this is a mistake, contact the Lost & Found office.'}
        </Panel>
      )}
      {status === 'cancelled' && <Panel tone="neutral" icon={XCircle} title="Claim withdrawn">The claimant withdrew this claim and the item is listed as found again.</Panel>}

      {/* Items */}
      <div className="grid sm:grid-cols-2 gap-4 my-5">
        {[['Lost report', lostItem, 'lost'], ['Found report', foundItem, 'found']].map(([label, item, type]) => item && (
          <Link key={label} to={`/items/${type}/${item._id}`} className="card border border-[var(--color-ink-100)] p-4 flex items-center gap-3 hover:border-[var(--color-ink-300)]">
            <Thumb item={item} />
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-[var(--color-ink-500)] uppercase">{label}</p>
              <p className="text-sm font-semibold text-[var(--color-ink-900)] truncate">{item.title}</p>
              <p className="text-xs text-[var(--color-ink-500)]">{item.category}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Evidence */}
      <div className="card border border-[var(--color-ink-100)] p-5">
        <p className="font-bold text-sm text-[var(--color-ink-900)] flex items-center gap-2 mb-3"><ShieldCheck className="w-4 h-4 text-[var(--color-violet-600)]" /> Proof of ownership</p>
        <blockquote className="text-sm text-[var(--color-ink-700)] leading-relaxed border-l-2 border-[var(--color-violet-300)] pl-3 whitespace-pre-line">{recovery.ownershipStatement}</blockquote>
        {recovery.additionalDetails && <p className="text-sm text-[var(--color-ink-600)] mt-3"><span className="font-semibold">Also: </span>{recovery.additionalDetails}</p>}
        {reviewer && lostItem?.identifyingCharacteristics && (
          <p className="text-xs text-[var(--color-ink-500)] mt-3 bg-[var(--color-canvas)] rounded-lg p-2.5">
            Identifying marks in the owner's original report: <span className="font-semibold text-[var(--color-ink-700)]">{lostItem.identifyingCharacteristics}</span>
          </p>
        )}
        {recovery.evidenceImages?.length > 0 && (
          <div className="flex gap-2 mt-4">
            {recovery.evidenceImages.map((img) => (
              <a key={img.url} href={img.url} target="_blank" rel="noreferrer" className="w-20 h-20 rounded-lg overflow-hidden border border-[var(--color-ink-100)]">
                <img src={img.url} alt="Evidence" className="w-full h-full object-cover" />
              </a>
            ))}
          </div>
        )}
        {role === 'admin' && recovery.claimant?.email && (
          <p className="text-xs text-[var(--color-ink-500)] mt-4">Claimant contact (admin only): {recovery.claimant.email}{recovery.claimant.studentId ? ` · ${recovery.claimant.studentId}` : ''}</p>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mt-5">
        <Link to={`/matches/${recovery.match}#chat`} className="btn btn-ghost btn-sm"><MessageSquare className="w-4 h-4" /> Open chat</Link>
        {role === 'claimant' && ['pending', 'approved'].includes(status) && (
          <button onClick={() => setConfirmCancel(true)} className="btn btn-ghost-danger btn-sm">Withdraw claim</button>
        )}
      </div>

      <Modal open={confirmCancel} onClose={() => setConfirmCancel(false)} title="Withdraw this claim?">
        <p className="text-sm text-[var(--color-ink-600)]">The item goes back to being listed as found. You can submit a new claim from the match page later.</p>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={() => setConfirmCancel(false)} className="btn btn-ghost">Keep claim</button>
          <button onClick={cancel} className="btn btn-danger">Withdraw</button>
        </div>
      </Modal>
    </div>
  );
}

function Timeline({ recovery }) {
  const { status } = recovery;
  const reviewed = Boolean(recovery.reviewedAt);
  const steps = [
    { label: 'Claim submitted', at: recovery.createdAt, done: true },
    {
      label: status === 'denied' ? 'Not approved' : 'Ownership verified',
      at: recovery.reviewedAt,
      done: reviewed,
      by: recovery.reviewedBy?.name,
      failed: status === 'denied',
    },
    { label: 'Handed over', at: recovery.handoverCompletedAt, done: status === 'completed' },
  ];
  return (
    <ol className="card border border-[var(--color-ink-100)] p-5 grid sm:grid-cols-3 gap-4 mb-5">
      {steps.map((s) => (
        <li key={s.label} className="flex items-start gap-2.5">
          {s.failed ? <XCircle className="w-5 h-5 text-[#b91c1c] shrink-0" />
            : s.done ? <CheckCircle2 className="w-5 h-5 text-[var(--color-teal-600)] shrink-0" />
              : <Circle className="w-5 h-5 text-[var(--color-ink-200)] shrink-0" />}
          <div>
            <p className={clsx('text-sm font-semibold', s.done ? 'text-[var(--color-ink-900)]' : 'text-[var(--color-ink-400)]')}>{s.label}</p>
            {s.at && <p className="text-xs text-[var(--color-ink-500)]">{format(new Date(s.at), 'd MMM, HH:mm')}{s.by ? ` · ${s.by}` : ''}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

function HandoverPass({ recovery }) {
  const code = recovery.handoverCode;
  return (
    <div className="card border border-[var(--color-teal-100)] p-6 grid sm:grid-cols-[auto_1fr] gap-6 items-center">
      <div className="bg-white p-3 rounded-xl border border-[var(--color-ink-100)] justify-self-center">
        <QRCodeSVG value={`FINDIT:${recovery._id}:${code}`} size={152} level="M" />
      </div>
      <div>
        <p className="font-display font-bold text-lg text-[var(--color-ink-900)]">Your claim is approved</p>
        <p className="text-sm text-[var(--color-ink-600)] mt-1">Show this code when you collect the item. The finder enters it to confirm the handover – don't share it before then.</p>
        <p className="font-mono font-bold text-3xl tracking-[0.3em] text-[var(--color-ink-900)] mt-4">{code}</p>
        <div className="mt-4 space-y-1.5 text-sm text-[var(--color-ink-700)]">
          <p className="flex items-center gap-2"><MapPin className="w-4 h-4 text-[var(--color-teal-600)]" />{recovery.handoverLocation}</p>
          {recovery.handoverScheduled && <p className="flex items-center gap-2"><Clock className="w-4 h-4 text-[var(--color-teal-600)]" />{format(new Date(recovery.handoverScheduled), 'EEE d MMM, HH:mm')}</p>}
        </div>
      </div>
    </div>
  );
}

function ReviewForm({ recovery, onDone }) {
  const pref = recovery.foundItem?.handoverPreference;
  const [form, setForm] = useState({
    handoverLocation: recovery.foundItem?.currentLocation || (pref ? HANDOVER_LABELS[pref] : ''),
    handoverScheduled: '',
    reviewNote: '',
  });
  const [busy, setBusy] = useState(null);
  const set = (f) => (e) => setForm((s) => ({ ...s, [f]: e.target.value }));

  const decide = async (decision) => {
    if (decision === 'approved' && !form.handoverLocation.trim()) { toast.error('Say where the handover will happen'); return; }
    if (decision === 'denied' && !form.reviewNote.trim()) { toast.error('Give the claimant a short reason'); return; }
    setBusy(decision);
    try {
      await recoveryApi.review(recovery._id, { decision, ...form, handoverScheduled: form.handoverScheduled || undefined });
      toast.success(decision === 'approved' ? 'Claim approved – the owner has their handover code' : 'Claim declined');
      onDone();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="card border border-[var(--color-violet-200)] p-5 space-y-4">
      <div>
        <p className="font-display font-bold text-[var(--color-ink-900)]">Review this claim</p>
        <p className="text-sm text-[var(--color-ink-500)] mt-1">Compare the proof below with the item you have. Approve only if the details match something not visible in the public report.</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="hl">Handover place</label>
          <input id="hl" className="input" value={form.handoverLocation} onChange={set('handoverLocation')} maxLength={200} placeholder="e.g. Security desk, main gate" />
        </div>
        <div>
          <label className="label" htmlFor="hs">Time <span className="font-normal text-[var(--color-ink-400)]">(optional)</span></label>
          <input id="hs" type="datetime-local" className="input" value={form.handoverScheduled} onChange={set('handoverScheduled')} />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="rn">Note to the claimant <span className="font-normal text-[var(--color-ink-400)]">(required if declining)</span></label>
        <input id="rn" className="input" value={form.reviewNote} onChange={set('reviewNote')} maxLength={500} />
      </div>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => decide('approved')} disabled={Boolean(busy)} className="btn btn-teal">
          {busy === 'approved' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Approve claim
        </button>
        <button onClick={() => decide('denied')} disabled={Boolean(busy)} className="btn btn-ghost-danger">Decline</button>
      </div>
    </div>
  );
}

function CompleteForm({ recovery, onDone }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await recoveryApi.complete(recovery._id, code);
      toast.success('Handover confirmed. Thank you!');
      onDone();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card border border-[var(--color-teal-100)] p-5">
      <p className="font-display font-bold text-[var(--color-ink-900)] flex items-center gap-2"><KeyRound className="w-4 h-4 text-[var(--color-teal-600)]" /> Confirm the handover</p>
      <p className="text-sm text-[var(--color-ink-500)] mt-1">
        Meet at <span className="font-semibold text-[var(--color-ink-700)]">{recovery.handoverLocation}</span>
        {recovery.handoverScheduled ? ` on ${format(new Date(recovery.handoverScheduled), 'EEE d MMM, HH:mm')}` : ''}.
        Ask the owner for the 6-digit code on their claim page and enter it here as you hand the item over.
      </p>
      <div className="flex gap-2 mt-4">
        <input
          className="input font-mono text-lg tracking-[0.3em] max-w-[11rem]"
          inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000"
          value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} aria-label="Handover code"
        />
        <button type="submit" disabled={busy || code.length !== 6} className="btn btn-teal">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm handover'}
        </button>
      </div>
    </form>
  );
}

function Panel({ tone, icon: Icon, title, children }) {
  const tones = {
    green: 'border-[var(--color-green-100)] bg-[#f0fdf4] text-[#166534]',
    violet: 'border-[var(--color-violet-100)] bg-[var(--color-violet-50)] text-[var(--color-ink-800)]',
    red: 'border-[var(--color-red-100)] bg-[#fef2f2] text-[#991b1b]',
    neutral: 'border-[var(--color-ink-100)] bg-white text-[var(--color-ink-700)]',
  };
  return (
    <div className={clsx('card border p-5', tones[tone])}>
      <p className="font-bold text-sm flex items-center gap-2"><Icon className="w-4 h-4" />{title}</p>
      <p className="text-sm mt-1.5 leading-relaxed">{children}</p>
    </div>
  );
}
