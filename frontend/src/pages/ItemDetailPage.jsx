import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  MapPin, Calendar, Tag, Eye, Zap, ArrowLeft, User,
  AlertCircle, CheckCircle2, Share2, Flag, Loader2
} from 'lucide-react';
import { lostApi, foundApi, matchApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatDistanceToNow, format } from 'date-fns';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

export default function ItemDetailPage({ type }) {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [matchLoading, setMatchLoading] = useState(false);

  const api = type === 'lost' ? lostApi : foundApi;

  useEffect(() => {
    api.getById(id)
      .then(({ data }) => setItem(data.item))
      .catch(() => navigate('/404'))
      .finally(() => setLoading(false));
  }, [id, type]);

  // Load AI matches for lost items (owner only)
  useEffect(() => {
    if (!item || type !== 'lost' || !user) return;
    if (item.reporter?._id !== user.id && item.reporter?.id !== user.id) return;
    setMatchLoading(true);
    matchApi.getForLostItem(id)
      .then(({ data }) => setMatches(data.matches || []))
      .catch(() => {})
      .finally(() => setMatchLoading(false));
  }, [item, type, user]);

  const isOwner = user && (item?.reporter?._id === user.id || item?.reporter?.id === user.id);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12 space-y-4">
        <div className="skeleton h-4 w-24 mb-6" />
        <div className="skeleton h-72 w-full rounded-2xl" />
        <div className="skeleton h-6 w-1/2" />
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-4 w-3/4" />
      </div>
    );
  }

  if (!item) return null;

  const location = type === 'lost' ? item.lastSeenLocation : item.foundLocation;
  const date = type === 'lost' ? item.lostDate : item.foundDate;
  const detection = item.aiDetection;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      {/* Back */}
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-[var(--color-ink-500)] hover:text-[var(--color-ink-900)] mb-6 group">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" /> Back
      </button>

      <div className="grid lg:grid-cols-[1fr_340px] gap-6">
        {/* Main column */}
        <div className="space-y-5">
          {/* Image */}
          <div className="card border border-[var(--color-ink-100)] overflow-hidden">
            {detection?.annotatedImageUrl || item.image?.url ? (
              <div className="relative">
                <img
                  src={detection?.annotatedImageUrl || item.image?.url}
                  alt={item.title}
                  className="w-full max-h-80 object-contain bg-[var(--color-canvas-dark)]"
                />
                {detection?.annotatedImageUrl && (
                  <div className="absolute top-3 left-3">
                    <span className="badge badge-violet gap-1.5 text-xs py-1">
                      <Zap className="w-3 h-3" /> AI Annotated
                    </span>
                  </div>
                )}
                <div className="absolute top-3 right-3">
                  <span className={clsx('badge text-xs py-1', type === 'lost' ? 'badge-red' : 'badge-teal')}>
                    {type === 'lost' ? 'Lost' : 'Found'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="h-56 bg-[var(--color-canvas-dark)] flex items-center justify-center">
                <div className="text-center">
                  <span className="text-5xl">📦</span>
                  <p className="text-sm text-[var(--color-ink-300)] mt-2">No photo provided</p>
                </div>
              </div>
            )}
          </div>

          {/* Item info */}
          <div className="card border border-[var(--color-ink-100)] p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h1 className="font-display font-bold text-xl text-[var(--color-ink-900)]">{item.title}</h1>
                <div className="flex items-center gap-2 mt-2">
                  <span className="badge badge-neutral">{item.category}</span>
                  {item.rewardOffered && <span className="badge badge-amber">🎁 Reward offered</span>}
                  <span className="flex items-center gap-1 text-[11px] text-[var(--color-ink-300)]">
                    <Eye className="w-3 h-3" /> {item.views} views
                  </span>
                </div>
              </div>
              <button
                onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success('Link copied!'); }}
                className="btn btn-ghost btn-sm btn-icon shrink-0"
                title="Share"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>

            {item.description && (
              <p className="text-sm text-[var(--color-ink-600)] leading-relaxed mb-5">{item.description}</p>
            )}

            <div className="space-y-3 border-t border-[var(--color-ink-100)] pt-4">
              {location?.building && (
                <InfoRow icon={MapPin} label={type === 'lost' ? 'Last seen at' : 'Found at'}>
                  {location.building}{location.area ? ` · ${location.area}` : ''}
                </InfoRow>
              )}
              {date && (
                <InfoRow icon={Calendar} label={type === 'lost' ? 'Date lost' : 'Date found'}>
                  {format(new Date(date), 'PPP')} ({formatDistanceToNow(new Date(date), { addSuffix: true })})
                </InfoRow>
              )}
              {type === 'lost' && item.lostTimeApprox && (
                <InfoRow icon={Calendar} label="Approximate time">{item.lostTimeApprox}</InfoRow>
              )}
              {item.colors?.length > 0 && (
                <InfoRow icon={Tag} label="Colors">{item.colors.join(', ')}</InfoRow>
              )}
              {item.identifyingCharacteristics && (
                <InfoRow icon={AlertCircle} label="Identifying features">{item.identifyingCharacteristics}</InfoRow>
              )}
              {type === 'lost' && item.rewardDescription && (
                <InfoRow icon={CheckCircle2} label="Reward">{item.rewardDescription}</InfoRow>
              )}
              {type === 'found' && item.handoverPreference && (
                <InfoRow icon={CheckCircle2} label="Handover via">
                  {item.handoverPreference.replace(/-/g, ' ')}
                </InfoRow>
              )}
            </div>
          </div>

          {/* AI Detection results */}
          {detection && detection.processingStatus === 'done' && detection.detectedObjects?.length > 0 && (
            <div className="card border border-[var(--color-violet-100)] bg-[var(--color-violet-50)] p-5">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-4 h-4 text-[var(--color-violet-600)]" />
                <span className="font-bold text-sm text-[var(--color-violet-600)]">AI Detection Results</span>
                <span className="badge badge-violet text-[10px]">YOLOv8</span>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {detection.detectedObjects.map((obj, i) => (
                  <div key={i} className="bg-white rounded-lg p-3 border border-[var(--color-violet-100)]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-[var(--color-ink-900)] capitalize">{obj.label}</span>
                      <span className="badge badge-violet text-[10px]">{Math.round(obj.confidence * 100)}%</span>
                    </div>
                    <div className="match-bar-track">
                      <div className="match-bar-fill" style={{ width: `${obj.confidence * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-[var(--color-ink-400)] mt-3">
                * AI detection identifies visible objects. Results may not be 100% accurate for all item types.
              </p>
            </div>
          )}

          {detection?.processingStatus === 'processing' && (
            <div className="card border border-[var(--color-violet-100)] p-5 flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-[var(--color-violet-600)] animate-spin" />
              <div>
                <p className="text-sm font-semibold text-[var(--color-violet-600)]">AI processing in progress...</p>
                <p className="text-xs text-[var(--color-ink-500)]">Object detection and matching will complete shortly.</p>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Reporter */}
          <div className="card border border-[var(--color-ink-100)] p-5">
            <p className="text-xs font-bold text-[var(--color-ink-500)] uppercase tracking-wider mb-3">
              {type === 'lost' ? 'Reported by' : 'Found by'}
            </p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[var(--color-violet-100)] flex items-center justify-center">
                {item.reporter?.avatar
                  ? <img src={item.reporter.avatar} alt="" className="w-full h-full object-cover rounded-full" />
                  : <span className="text-[var(--color-violet-600)] font-bold">{item.reporter?.name?.charAt(0)}</span>}
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--color-ink-900)]">{item.reporter?.name || 'Anonymous'}</p>
                <p className="text-xs text-[var(--color-ink-500)] capitalize">{item.reporter?.department || item.reporter?.role}</p>
              </div>
            </div>
            <p className="text-xs text-[var(--color-ink-300)] mt-3">
              Reported {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
            </p>
          </div>

          {/* Actions */}
          {!isOwner && user && type === 'lost' && (
            <div className="card border border-[var(--color-teal-100)] bg-[var(--color-teal-50)] p-5">
              <p className="text-sm font-bold text-[var(--color-teal-600)] mb-2">Found this item?</p>
              <p className="text-xs text-[var(--color-ink-500)] mb-4 leading-relaxed">
                If you've found this item, report it as found and our AI will link the reports.
              </p>
              <Link to="/report/found" className="btn btn-teal w-full">
                Report I found it
              </Link>
            </div>
          )}

          {!user && (
            <div className="card border border-[var(--color-ink-100)] p-5 text-center">
              <p className="text-sm text-[var(--color-ink-600)] mb-3">Sign in to contact the reporter or submit a claim.</p>
              <Link to="/login" className="btn btn-primary w-full">Sign in</Link>
            </div>
          )}

          {/* AI Matches (owner only, lost items) */}
          {isOwner && type === 'lost' && (
            <div className="card border border-[var(--color-ink-100)] p-5">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-4 h-4 text-[var(--color-violet-600)]" />
                <p className="text-sm font-bold text-[var(--color-ink-900)]">AI Matches</p>
              </div>
              {matchLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="skeleton w-12 h-12 rounded-lg shrink-0" />
                      <div className="flex-1">
                        <div className="skeleton h-3 w-2/3 mb-1.5" />
                        <div className="skeleton h-2.5 w-full" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : matches.length === 0 ? (
                <div className="text-center py-6">
                  <Zap className="w-8 h-8 text-[var(--color-ink-200)] mx-auto mb-2" />
                  <p className="text-xs text-[var(--color-ink-400)]">No matches found yet. AI searches automatically.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {matches.slice(0, 4).map((match) => (
                    <Link
                      key={match._id}
                      to={`/matches/${match._id}`}
                      className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-[var(--color-canvas-dark)] transition-colors"
                    >
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-[var(--color-canvas-dark)] shrink-0">
                        {match.foundItem?.image?.url
                          ? <img src={match.foundItem.image.url} alt="" className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center text-xl">📦</div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-[var(--color-ink-900)] truncate">{match.foundItem?.title}</p>
                        <div className="match-bar-track mt-1.5">
                          <div className="match-bar-fill" style={{ width: `${(match.combinedScore || match.similarityScore) * 100}%` }} />
                        </div>
                        <p className="text-[10px] text-[var(--color-ink-400)] mt-1">
                          {Math.round((match.combinedScore || match.similarityScore) * 100)}% match
                        </p>
                      </div>
                    </Link>
                  ))}
                  {matches.length > 4 && (
                    <p className="text-xs text-center text-[var(--color-violet-600)] font-semibold">
                      +{matches.length - 4} more matches
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Report */}
          <button className="flex items-center gap-2 text-xs text-[var(--color-ink-300)] hover:text-[var(--color-red-500)] w-full justify-center py-2">
            <Flag className="w-3.5 h-3.5" /> Report this listing
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, children }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="w-4 h-4 text-[var(--color-ink-300)] shrink-0 mt-0.5" />
      <div>
        <span className="text-[11px] font-bold text-[var(--color-ink-500)] uppercase tracking-wide block">{label}</span>
        <span className="text-sm text-[var(--color-ink-800)]">{children}</span>
      </div>
    </div>
  );
}
