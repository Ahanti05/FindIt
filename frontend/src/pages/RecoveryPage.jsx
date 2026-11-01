import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle2, Clock, MapPin, QrCode, Loader2, Shield } from 'lucide-react';
import { recoveryApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { QRCodeCanvas } from 'qrcode.react';

const STATUS_CONFIG = {
  pending: { label: 'Pending Review', color: 'badge-amber', desc: 'Your claim is awaiting admin review.' },
  under_review: { label: 'Under Review', color: 'badge-violet', desc: 'An administrator is reviewing your claim.' },
  approved: { label: 'Approved', color: 'badge-green', desc: 'Your claim has been approved! Proceed to collect your item.' },
  denied: { label: 'Denied', color: 'badge-red', desc: 'Your claim was denied. Contact the Lost & Found Office for more info.' },
  completed: { label: 'Completed', color: 'badge-teal', desc: 'Item successfully recovered and returned.' },
};

export default function RecoveryPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [recovery, setRecovery] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    recoveryApi.getById(id)
      .then(({ data }) => setRecovery(data.recovery))
      .catch(() => { toast.error('Recovery request not found'); navigate('/dashboard'); })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-12 space-y-4">
        <div className="skeleton h-4 w-24 mb-6" />
        <div className="skeleton h-64 rounded-2xl" />
      </div>
    );
  }

  if (!recovery) return null;

  const { status, lostItem, foundItem, ownershipStatement, qrCode, handoverLocation, handoverScheduled, reviewNote } = recovery;
  const statusInfo = STATUS_CONFIG[status] || STATUS_CONFIG.pending;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-[var(--color-ink-500)] hover:text-[var(--color-ink-900)] mb-6 group">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" /> Back
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-2xl text-[var(--color-ink-900)]">Recovery Request</h1>
          <p className="text-sm text-[var(--color-ink-500)] mt-1">Track your item recovery status</p>
        </div>
        <span className={`badge text-sm py-1.5 px-3 ${statusInfo.color}`}>{statusInfo.label}</span>
      </div>

      {/* Status card */}
      <div className={`card border p-5 mb-5 ${
        status === 'approved' || status === 'completed'
          ? 'border-[var(--color-green-100)] bg-[var(--color-green-100)]'
          : status === 'denied'
          ? 'border-[var(--color-red-100)] bg-[var(--color-red-100)]'
          : 'border-[var(--color-violet-100)] bg-[var(--color-violet-50)]'
      }`}>
        <div className="flex items-center gap-3">
          {status === 'approved' || status === 'completed' ? (
            <div className="animate-check-pop">
              <CheckCircle2 className="w-6 h-6 text-[#15803d]" />
            </div>
          ) : (
            <Clock className="w-6 h-6 text-[var(--color-violet-600)]" />
          )}
          <div>
            <p className="font-bold text-sm text-[var(--color-ink-900)]">{statusInfo.label}</p>
            <p className="text-xs text-[var(--color-ink-600)] mt-0.5">{statusInfo.desc}</p>
          </div>
        </div>
        {reviewNote && (
          <div className="mt-3 pt-3 border-t border-black/10">
            <p className="text-xs font-semibold text-[var(--color-ink-600)]">Admin note:</p>
            <p className="text-sm text-[var(--color-ink-800)] mt-0.5">{reviewNote}</p>
          </div>
        )}
      </div>

      {/* Items */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        {[{ label: 'Lost Item', item: lostItem }, { label: 'Found Item', item: foundItem }].map(({ label, item }) => (
          <div key={label} className="card border border-[var(--color-ink-100)] p-4">
            <p className="text-xs font-bold text-[var(--color-ink-500)] uppercase mb-2">{label}</p>
            {item?.image?.url && (
              <img src={item.image.url} alt="" className="h-24 w-full object-cover rounded-lg mb-2" />
            )}
            <p className="text-sm font-semibold text-[var(--color-ink-900)] truncate">{item?.title}</p>
            <span className="badge badge-neutral text-[10px] mt-1">{item?.category}</span>
          </div>
        ))}
      </div>

      {/* Ownership statement */}
      <div className="card border border-[var(--color-ink-100)] p-5 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-[var(--color-violet-600)]" />
          <p className="text-sm font-bold text-[var(--color-ink-900)]">Ownership Statement</p>
        </div>
        <p className="text-sm text-[var(--color-ink-600)] leading-relaxed italic">"{ownershipStatement}"</p>
      </div>

      {/* Handover info */}
      {(handoverLocation || handoverScheduled) && (
        <div className="card border border-[var(--color-teal-100)] bg-[var(--color-teal-50)] p-5 mb-5">
          <p className="text-sm font-bold text-[var(--color-teal-600)] mb-3">Handover Details</p>
          {handoverLocation && (
            <div className="flex items-center gap-2 text-sm text-[var(--color-ink-700)] mb-1.5">
              <MapPin className="w-4 h-4 text-[var(--color-teal-600)]" />
              {handoverLocation}
            </div>
          )}
          {handoverScheduled && (
            <div className="flex items-center gap-2 text-sm text-[var(--color-ink-700)]">
              <Clock className="w-4 h-4 text-[var(--color-teal-600)]" />
              {format(new Date(handoverScheduled), 'PPpp')}
            </div>
          )}
        </div>
      )}

      {/* QR Code */}
      {status === 'approved' && qrCode?.data && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          className="card border border-[var(--color-green-100)] p-6 text-center mb-5"
        >
          <div className="w-10 h-10 rounded-full bg-[var(--color-green-100)] flex items-center justify-center mx-auto mb-3 animate-check-pop">
            <QrCode className="w-5 h-5 text-[#15803d]" />
          </div>
          <p className="font-display font-bold text-[var(--color-ink-900)] mb-1">Your Recovery QR Code</p>
          <p className="text-xs text-[var(--color-ink-500)] mb-5">Show this at the handover location. It contains your verified recovery information.</p>
          <div className="flex justify-center">
            <div className="p-4 bg-white rounded-xl shadow-sm border border-[var(--color-ink-100)] inline-block">
              <QRCodeCanvas value={qrCode.data} size={160} level="H" />
            </div>
          </div>
          <p className="text-[11px] text-[var(--color-ink-300)] mt-4">
            Recovery ID: {recovery._id}
          </p>
        </motion.div>
      )}

      {/* Timeline */}
      <div className="card border border-[var(--color-ink-100)] p-5">
        <p className="text-sm font-bold text-[var(--color-ink-900)] mb-4">Recovery Timeline</p>
        <div className="space-y-3">
          {[
            { label: 'Claim submitted', date: recovery.createdAt, done: true },
            { label: 'Under review', date: recovery.reviewedAt, done: !!recovery.reviewedAt },
            { label: 'Decision made', date: recovery.reviewedAt, done: ['approved', 'denied'].includes(status) },
            { label: 'Item collected', date: recovery.handoverCompletedAt, done: status === 'completed' },
          ].map((step, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                step.done ? 'bg-[var(--color-teal-500)]' : 'bg-[var(--color-ink-100)]'
              }`}>
                {step.done
                  ? <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                  : <div className="w-2 h-2 rounded-full bg-[var(--color-ink-300)]" />}
              </div>
              <div>
                <p className={`text-sm font-semibold ${step.done ? 'text-[var(--color-ink-900)]' : 'text-[var(--color-ink-400)]'}`}>{step.label}</p>
                {step.date && <p className="text-xs text-[var(--color-ink-400)]">{format(new Date(step.date), 'PP')}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
