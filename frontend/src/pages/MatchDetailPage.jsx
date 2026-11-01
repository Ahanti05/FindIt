import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Zap, MapPin, Calendar, CheckCircle2, AlertCircle, Loader2, ChevronRight } from 'lucide-react';
import { matchApi, recoveryApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { format, formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

export default function MatchDetailPage() {
  const { matchId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [showClaimForm, setShowClaimForm] = useState(false);
  const [claimText, setClaimText] = useState('');

  useEffect(() => {
    matchApi.getById(matchId)
      .then(({ data }) => setMatch(data.match))
      .catch(() => navigate('/dashboard'))
      .finally(() => setLoading(false));
  }, [matchId]);

  const respond = async (response) => {
    setResponding(true);
    try {
      const { data } = await matchApi.respond(matchId, response);
      setMatch(data.match);
      toast.success(response === 'interested' ? 'Marked as interested!' : 'Dismissed.');
    } catch {
      toast.error('Failed to respond');
    } finally {
      setResponding(false);
    }
  };

  const submitClaim = async () => {
    if (!claimText.trim()) { toast.error('Please describe why this is yours'); return; }
    setClaiming(true);
    try {
      const fd = new FormData();
      fd.append('lostItemId', match.lostItem._id);
      fd.append('foundItemId', match.foundItem._id);
      fd.append('matchId', match._id);
      fd.append('ownershipStatement', claimText);
      const { data } = await recoveryApi.create(fd);
      toast.success('Recovery request submitted!');
      navigate(`/recovery/${data.recovery._id}`);
    } catch {
      toast.error('Failed to submit claim');
    } finally {
      setClaiming(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="skeleton h-4 w-24 mb-8" />
        <div className="grid lg:grid-cols-2 gap-5">
          <div className="skeleton h-64 rounded-2xl" />
          <div className="skeleton h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!match) return null;

  const { lostItem, foundItem, combinedScore, similarityScore, scoreBreakdown, status } = match;
  const overallScore = combinedScore ?? similarityScore ?? 0;
  const isLostOwner = user?.id === (lostItem?.reporter?._id || lostItem?.reporter);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-[var(--color-ink-500)] hover:text-[var(--color-ink-900)] mb-6 group">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" /> Back
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-5 h-5 text-[var(--color-violet-600)]" />
            <h1 className="font-display font-bold text-xl text-[var(--color-ink-900)]">Potential Match</h1>
          </div>
          <p className="text-sm text-[var(--color-ink-500)]">
            Our AI found a visual similarity between these two reports.
          </p>
        </div>
        <div className={`badge text-sm py-1.5 px-3 ${
          status === 'accepted' ? 'badge-green' :
          status === 'rejected' ? 'badge-red' : 'badge-violet'
        }`}>{status}</div>
      </div>

      {/* Overall score */}
      <div className="card border border-[var(--color-ink-100)] p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold text-[var(--color-ink-700)]">Overall Match Confidence</p>
          <p className="font-display font-extrabold text-2xl text-[var(--color-violet-600)]">
            {Math.round(overallScore * 100)}%
          </p>
        </div>
        <div className="match-bar-track mb-4">
          <motion.div
            className="match-bar-fill"
            initial={{ width: 0 }}
            animate={{ width: `${overallScore * 100}%` }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
        <p className="text-xs text-[var(--color-ink-400)]">
          ⚠️ This score indicates visual similarity — it does not guarantee these are the same item. Please verify carefully before claiming.
        </p>

        {/* Score breakdown */}
        {scoreBreakdown && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-[var(--color-ink-100)]">
            {[
              { label: 'Visual', val: scoreBreakdown.visual, desc: 'Image similarity' },
              { label: 'Category', val: scoreBreakdown.category, desc: 'Same type?' },
              { label: 'Location', val: scoreBreakdown.location, desc: 'Nearby?' },
              { label: 'Date', val: scoreBreakdown.date_proximity, desc: 'Time proximity' },
            ].map((s) => (
              <div key={s.label} className="text-center p-2 rounded-lg bg-[var(--color-canvas-dark)]">
                <p className="font-bold text-sm text-[var(--color-ink-900)]">{Math.round((s.val || 0) * 100)}%</p>
                <p className="text-[10px] font-bold text-[var(--color-ink-500)] uppercase">{s.label}</p>
                <p className="text-[10px] text-[var(--color-ink-300)]">{s.desc}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Side-by-side comparison */}
      <div className="grid lg:grid-cols-2 gap-5 mb-6">
        {/* Lost Item */}
        <ItemMatchCard item={lostItem} type="lost" label="Lost Item" />
        {/* Found Item */}
        <ItemMatchCard item={foundItem} type="found" label="Found Item" />
      </div>

      {/* Actions */}
      {isLostOwner && status === 'pending' && (
        <div className="card border border-[var(--color-ink-100)] p-6 space-y-4">
          <h3 className="font-display font-bold text-[var(--color-ink-900)]">Is this your item?</h3>
          <p className="text-sm text-[var(--color-ink-500)]">
            Review the comparison above. If you believe this is your lost item, you can express interest or start a recovery claim.
          </p>
          <div className="flex flex-wrap gap-3">
            {!showClaimForm ? (
              <>
                <button
                  onClick={() => setShowClaimForm(true)}
                  className="btn btn-primary gap-2"
                  disabled={responding}
                >
                  <CheckCircle2 className="w-4 h-4" /> Yes, submit claim
                </button>
                <button
                  onClick={() => respond('not-mine')}
                  className="btn btn-ghost gap-2"
                  disabled={responding}
                >
                  {responding ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertCircle className="w-4 h-4" />}
                  Not my item
                </button>
              </>
            ) : (
              <div className="w-full space-y-3">
                <label className="label">Describe why this item is yours *</label>
                <textarea
                  className="input min-h-[120px] resize-y"
                  placeholder="Provide specific details only you would know: serial number, purchase date, unique markings, what's inside the wallet, etc."
                  value={claimText}
                  onChange={(e) => setClaimText(e.target.value)}
                  rows={5}
                />
                <div className="flex gap-3">
                  <button onClick={submitClaim} disabled={claiming} className="btn btn-primary gap-2">
                    {claiming ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</> : 'Submit Recovery Claim'}
                  </button>
                  <button onClick={() => setShowClaimForm(false)} className="btn btn-ghost">Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {status === 'accepted' && (
        <div className="card border border-[var(--color-green-100)] bg-[var(--color-green-100)] p-5 flex items-center gap-3">
          <CheckCircle2 className="w-6 h-6 text-[#15803d]" />
          <div>
            <p className="font-bold text-[#15803d]">Match accepted!</p>
            <p className="text-sm text-[#166534]">Both parties have confirmed interest. A recovery request may now be submitted.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function ItemMatchCard({ item, type, label }) {
  if (!item) return <div className="card border border-[var(--color-ink-100)] p-8 flex items-center justify-center text-[var(--color-ink-300)]">Item not available</div>;

  const location = type === 'lost' ? item.lastSeenLocation : item.foundLocation;
  const date = type === 'lost' ? item.lostDate : item.foundDate;

  return (
    <div className={`card border p-5 ${type === 'lost' ? 'border-[var(--color-red-100)]' : 'border-[var(--color-teal-100)]'}`}>
      <div className="flex items-center gap-2 mb-4">
        <span className={`badge text-xs ${type === 'lost' ? 'badge-red' : 'badge-teal'}`}>{label}</span>
      </div>
      {item.image?.url && (
        <div className="h-48 rounded-xl overflow-hidden mb-4 bg-[var(--color-canvas-dark)] img-preview-wrapper">
          <img src={item.image.url} alt={item.title} className="w-full h-full object-cover" />
        </div>
      )}
      <h3 className="font-semibold text-[var(--color-ink-900)] mb-2">{item.title}</h3>
      <p className="text-xs text-[var(--color-ink-500)] mb-3 line-clamp-2">{item.description}</p>
      <div className="space-y-1.5 text-xs text-[var(--color-ink-500)]">
        {location?.building && (
          <div className="flex items-center gap-1.5"><MapPin className="w-3 h-3" />{location.building}</div>
        )}
        {date && (
          <div className="flex items-center gap-1.5"><Calendar className="w-3 h-3" />{format(new Date(date), 'PP')}</div>
        )}
      </div>
      <Link
        to={`/items/${type}/${item._id}`}
        className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-violet-600)] mt-4 hover:underline"
      >
        View full report <ChevronRight className="w-3 h-3" />
      </Link>
    </div>
  );
}
