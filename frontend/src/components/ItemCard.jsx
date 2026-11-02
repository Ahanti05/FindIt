import { Link } from 'react-router-dom';
import { MapPin, Clock, Gift } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { clsx } from 'clsx';
import { CategoryIcon, StatusBadge } from './ui';
import { Coin } from './Owl';

export default function ItemCard({ item, type, showStatus = false }) {
  const location = type === 'lost' ? item.lastSeenLocation : item.foundLocation;
  const date = type === 'lost' ? item.lostDate : item.foundDate;

  return (
    <Link
      to={`/items/${type}/${item._id}`}
      className="card card-lift block overflow-hidden border border-[var(--color-ink-100)] group h-full"
    >
      <div className="img-preview-wrapper h-44 bg-[var(--color-canvas-dark)]">
        {item.image?.url ? (
          <img src={item.image.url} alt={item.title} loading="lazy" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-[var(--color-ink-300)]">
            <CategoryIcon category={item.category} className="w-9 h-9" />
            <span className="text-xs">No photo</span>
          </div>
        )}
        <span className={clsx('badge absolute top-2 left-2 text-[10px] shadow-sm', type === 'lost' ? 'badge-red' : 'badge-teal')}>
          {type === 'lost' ? 'Lost' : 'Found'}
        </span>
        {showStatus && <StatusBadge status={item.status} className="absolute top-2 right-2 text-[10px] shadow-sm" />}
      </div>

      <div className="p-4">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--color-ink-500)] uppercase tracking-wide mb-1">
          <CategoryIcon category={item.category} className="w-3.5 h-3.5" />
          {item.category}
        </div>
        <h3 className="font-semibold text-sm text-[var(--color-ink-900)] truncate group-hover:text-[var(--color-violet-600)] transition-colors">
          {item.title}
        </h3>
        <div className="mt-3 space-y-1.5 text-[12px] text-[var(--color-ink-500)]">
          {location?.building && (
            <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 shrink-0" /><span className="truncate">{location.building}</span></div>
          )}
          {date && (
            <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 shrink-0" />{formatDistanceToNow(new Date(date), { addSuffix: true })}</div>
          )}
          {item.rewardCoins > 0 ? (
            <div className="flex items-center gap-1.5 font-semibold text-[#92400e]"><Coin size={14} />{item.rewardCoins} coin reward</div>
          ) : item.rewardOffered && (
            <div className="flex items-center gap-1.5 text-[#92400e]"><Gift className="w-3.5 h-3.5 shrink-0" />Reward offered</div>
          )}
        </div>
      </div>
    </Link>
  );
}
