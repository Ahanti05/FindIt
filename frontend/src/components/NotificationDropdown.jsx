import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Bell, CheckCheck, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { notifApi } from '../services/api';
import { formatDistanceToNow } from 'date-fns';

const TYPE_COLORS = {
  match_found: 'badge-violet',
  match_accepted: 'badge-teal',
  recovery_requested: 'badge-amber',
  recovery_approved: 'badge-green',
  recovery_denied: 'badge-red',
  default: 'badge-neutral',
};

export default function NotificationDropdown({ onClose, onCountChange }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const ref = useRef(null);

  useEffect(() => {
    notifApi.getAll({ limit: 10 }).then(({ data }) => {
      setNotifications(data.notifications);
      onCountChange(data.unreadCount);
    }).finally(() => setLoading(false));

    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markAllRead = async () => {
    await notifApi.markRead([]);
    setNotifications((ns) => ns.map((n) => ({ ...n, isRead: true })));
    onCountChange(0);
  };

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ duration: 0.15 }}
      className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-[var(--shadow-modal)] border border-[var(--color-ink-100)] z-50 overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-ink-100)]">
        <span className="text-sm font-bold text-[var(--color-ink-900)]">Notifications</span>
        <button onClick={markAllRead} className="text-xs text-[var(--color-violet-600)] font-semibold hover:underline flex items-center gap-1">
          <CheckCheck className="w-3.5 h-3.5" /> Mark all read
        </button>
      </div>
      <div className="max-h-80 overflow-y-auto divide-y divide-[var(--color-ink-100)]">
        {loading ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className="p-4">
              <div className="skeleton h-3 w-3/4 mb-2" />
              <div className="skeleton h-2.5 w-full" />
            </div>
          ))
        ) : notifications.length === 0 ? (
          <div className="py-10 text-center">
            <Bell className="w-8 h-8 text-[var(--color-ink-300)] mx-auto mb-2" />
            <p className="text-sm text-[var(--color-ink-500)]">No notifications yet</p>
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n._id}
              className={`p-4 transition-colors ${!n.isRead ? 'bg-[var(--color-violet-50)]' : 'hover:bg-[var(--color-canvas-dark)]'}`}
            >
              <div className="flex items-start gap-3">
                <div className={`badge ${TYPE_COLORS[n.type] || TYPE_COLORS.default} shrink-0 mt-0.5`}>
                  {n.type.replace(/_/g, ' ')}
                </div>
                {!n.isRead && <span className="w-2 h-2 bg-[var(--color-violet-600)] rounded-full shrink-0 mt-1 ml-auto" />}
              </div>
              <p className="text-sm font-semibold text-[var(--color-ink-900)] mt-1.5">{n.title}</p>
              <p className="text-xs text-[var(--color-ink-500)] mt-0.5 leading-relaxed">{n.message}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-[11px] text-[var(--color-ink-300)]">
                  {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                </span>
                {n.actionUrl && (
                  <Link
                    to={n.actionUrl}
                    className="text-xs text-[var(--color-violet-600)] font-semibold flex items-center gap-1 hover:underline"
                    onClick={onClose}
                  >
                    View <ExternalLink className="w-3 h-3" />
                  </Link>
                )}
              </div>
            </div>
          ))
        )}
      </div>
      {notifications.length > 0 && (
        <div className="border-t border-[var(--color-ink-100)] p-3 text-center">
          <Link to="/dashboard" onClick={onClose} className="text-xs text-[var(--color-violet-600)] font-semibold hover:underline">
            View all in Dashboard →
          </Link>
        </div>
      )}
    </motion.div>
  );
}
