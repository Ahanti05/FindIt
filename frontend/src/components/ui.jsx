import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  IdCard, Wallet, KeyRound, Smartphone, Laptop, Backpack, Watch, Headphones,
  Cable, GlassWater, Umbrella, Glasses, Shirt, BookOpen, Gem, Package, X, ArrowRight,
} from 'lucide-react';
import { clsx } from 'clsx';
import Owl from './Owl';

// ─── Category icon ────────────────────────────────────────────────────────────
const CATEGORY_ICONS = {
  'ID Card': IdCard, Wallet, Keys: KeyRound, Phone: Smartphone, Laptop,
  'Bag/Backpack': Backpack, Watch, 'Earphones/AirPods': Headphones,
  'Charger/Cable': Cable, 'Water Bottle': GlassWater, Umbrella, Glasses,
  Clothing: Shirt, 'Books/Notes': BookOpen, Jewelry: Gem, Other: Package,
};

export function CategoryIcon({ category, className = 'w-4 h-4' }) {
  const Icon = CATEGORY_ICONS[category] || Package;
  return <Icon className={className} />;
}

// ─── Status badge (items, matches, claims) ────────────────────────────────────
const STATUS = {
  active: ['Open', 'badge-violet'],
  matched: ['Claim in progress', 'badge-amber'],
  claimed: ['Claim in progress', 'badge-amber'],
  recovered: ['Recovered', 'badge-green'],
  returned: ['Returned', 'badge-green'],
  expired: ['Expired', 'badge-neutral'],
  archived: ['Archived', 'badge-neutral'],
  pending: ['Pending', 'badge-amber'],
  accepted: ['Owner confirmed', 'badge-teal'],
  rejected: ['Dismissed', 'badge-neutral'],
  verified: ['Returned', 'badge-green'],
  approved: ['Approved', 'badge-teal'],
  denied: ['Denied', 'badge-red'],
  completed: ['Completed', 'badge-green'],
  cancelled: ['Withdrawn', 'badge-neutral'],
};

export function StatusBadge({ status, className }) {
  const [label, tone] = STATUS[status] || [status, 'badge-neutral'];
  return <span className={clsx('badge', tone, className)}>{label}</span>;
}

// ─── Score bar ────────────────────────────────────────────────────────────────
export function ScoreBar({ value = 0, className }) {
  return (
    <div className={clsx('match-bar-track', className)}>
      <div className="match-bar-fill" style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%` }} />
    </div>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
export function Avatar({ user, size = 'w-9 h-9', text = 'text-sm' }) {
  return (
    <div className={clsx(size, 'rounded-full bg-[var(--color-violet-100)] flex items-center justify-center overflow-hidden shrink-0')}>
      {user?.avatar
        ? <img src={user.avatar} alt="" className="w-full h-full object-cover" />
        : <span className={clsx(text, 'font-bold text-[var(--color-violet-600)]')}>{user?.name?.charAt(0)?.toUpperCase() || '?'}</span>}
    </div>
  );
}

// ─── Item thumbnail ───────────────────────────────────────────────────────────
export function Thumb({ item, className = 'w-14 h-14' }) {
  return (
    <div className={clsx(className, 'rounded-lg overflow-hidden bg-[var(--color-canvas-dark)] shrink-0 flex items-center justify-center')}>
      {item?.image?.url
        ? <img src={item.image.url} alt="" className="w-full h-full object-cover" />
        : <CategoryIcon category={item?.category} className="w-5 h-5 text-[var(--color-ink-300)]" />}
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
// `icon` is kept for callers; Hoot the owl stands in for it.
export function EmptyState({ title, desc, action, mood = 'search' }) {
  return (
    <div className="text-center py-12 px-4">
      <Owl mood={mood} size={110} className="mx-auto mb-3" />
      <h3 className="font-display font-bold text-base text-[var(--color-ink-800)] mb-1.5">{title}</h3>
      <p className="text-sm text-[var(--color-ink-500)] max-w-sm mx-auto mb-5">{desc}</p>
      {action && (
        <Link to={action.to} className="btn btn-primary btn-sm">
          {action.label} <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      )}
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, width = 'max-w-md' }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[rgba(13,27,42,0.45)]"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            role="dialog" aria-modal="true" aria-label={title}
            className={clsx('w-full bg-white rounded-xl shadow-[var(--shadow-modal)]', width)}
            initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 12, opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-ink-100)]">
              <h2 className="font-display font-bold text-base text-[var(--color-ink-900)]">{title}</h2>
              <button onClick={onClose} className="btn-icon text-[var(--color-ink-500)] hover:bg-[var(--color-canvas-dark)]" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Field error ──────────────────────────────────────────────────────────────
export function FieldError({ children }) {
  if (!children) return null;
  return <p className="text-xs text-[var(--color-red-500)] mt-1">{children}</p>;
}

export const pct = (v) => `${Math.round((v || 0) * 100)}%`;
