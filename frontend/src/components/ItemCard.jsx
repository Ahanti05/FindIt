import { Link } from 'react-router-dom';
import { MapPin, Clock, Tag, Eye } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { clsx } from 'clsx';

const CATEGORY_ICONS = {
  'ID Card': '🪪', 'Wallet': '👛', 'Keys': '🔑', 'Phone': '📱',
  'Laptop': '💻', 'Bag/Backpack': '🎒', 'Watch': '⌚',
  'Earphones/AirPods': '🎧', 'Charger/Cable': '🔌',
  'Water Bottle': '🍶', 'Umbrella': '☂️', 'Glasses': '👓',
  'Clothing': '👕', 'Books/Notes': '📚', 'Jewelry': '💍', 'Other': '📦',
};

export default function ItemCard({ item, type }) {
  const to = `/items/${type}/${item._id}`;
  const location = type === 'lost'
    ? item.lastSeenLocation?.building
    : item.foundLocation?.building;
  const date = type === 'lost' ? item.lostDate : item.foundDate;
  const emoji = CATEGORY_ICONS[item.category] || '📦';

  return (
    <Link to={to} className="card card-lift block overflow-hidden border border-[var(--color-ink-100)] group">
      {/* Image */}
      <div className="img-preview-wrapper h-44 bg-[var(--color-canvas-dark)] overflow-hidden">
        {item.image?.url ? (
          <img
            src={item.image.url}
            alt={item.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
            <span className="text-4xl">{emoji}</span>
            <span className="text-xs text-[var(--color-ink-300)]">{item.category}</span>
          </div>
        )}
        {/* Status badge overlay */}
        <div className="absolute top-2 left-2">
          <span className={clsx(
            'badge text-[10px]',
            type === 'lost' ? 'badge-red' : 'badge-teal'
          )}>
            {type === 'lost' ? 'Lost' : 'Found'}
          </span>
        </div>
        {/* AI match badge */}
        {item.aiDetection?.primaryLabel && (
          <div className="absolute top-2 right-2">
            <span className="badge badge-violet text-[10px] gap-1">
              AI: {item.aiDetection.primaryLabel}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-sm text-[var(--color-ink-900)] truncate group-hover:text-[var(--color-violet-600)] transition-colors">
          {item.title}
        </h3>
        <p className="text-xs text-[var(--color-ink-500)] mt-0.5 mb-3 line-clamp-2 leading-relaxed">
          {item.description || 'No description provided.'}
        </p>

        <div className="space-y-1.5">
          {location && (
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-ink-500)]">
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="truncate">{location}</span>
            </div>
          )}
          {date && (
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-ink-500)]">
              <Clock className="w-3 h-3 shrink-0" />
              <span>{formatDistanceToNow(new Date(date), { addSuffix: true })}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--color-ink-100)]">
          <span className="badge badge-neutral text-[10px]">{item.category}</span>
          {item.views > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-[var(--color-ink-300)]">
              <Eye className="w-3 h-3" /> {item.views}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
