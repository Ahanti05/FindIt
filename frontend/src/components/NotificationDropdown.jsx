import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Bell, CheckCheck } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { notifApi } from '../services/api';

export default function NotificationDropdown({ onClose, onCountChange }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const ref = useRef(null);
  const navigate = useNavigate();
  // Parent callbacks change identity on every render; read them through a ref
  // so the fetch below runs once per opening.
  const callbacks = useRef({ onClose, onCountChange });
  callbacks.current = { onClose, onCountChange };

  useEffect(() => {
    notifApi.getAll({ limit: 10 })
      .then(({ data }) => {
        setNotifications(data.notifications);
        callbacks.current.onCountChange(data.unreadCount);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    const handler = (e) => {
      // The bell button toggles the dropdown itself.
      if (ref.current && !ref.current.contains(e.target) && !e.target.closest('[aria-label^="Notifications"]')) {
        callbacks.current.onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markAllRead = async () => {
    const { data } = await notifApi.markRead([]);
    setNotifications((ns) => ns.map((n) => ({ ...n, isRead: true })));
    onCountChange(data.unreadCount);
  };

  const open = async (n) => {
    if (!n.isRead) {
      const { data } = await notifApi.markRead([n._id]).catch(() => ({ data: {} }));
      if (data.unreadCount !== undefined) onCountChange(data.unreadCount);
    }
    onClose();
    if (n.actionUrl) navigate(n.actionUrl);
  };

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.12 }}
      className="absolute right-0 top-full mt-2 w-[22rem] max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-[var(--shadow-modal)] border border-[var(--color-ink-100)] z-50 overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-ink-100)]">
        <span className="text-sm font-bold text-[var(--color-ink-900)]">Notifications</span>
        <button onClick={markAllRead} className="text-xs text-[var(--color-violet-600)] font-semibold hover:underline flex items-center gap-1">
          <CheckCheck className="w-3.5 h-3.5" /> Mark all read
        </button>
      </div>
      <div className="max-h-96 overflow-y-auto divide-y divide-[var(--color-ink-100)]">
        {loading ? (
          [...Array(3)].map((_, i) => (
            <div key={i} className="p-4"><div className="skeleton h-3 w-3/4 mb-2" /><div className="skeleton h-2.5 w-full" /></div>
          ))
        ) : notifications.length === 0 ? (
          <div className="py-10 text-center">
            <Bell className="w-7 h-7 text-[var(--color-ink-300)] mx-auto mb-2" />
            <p className="text-sm text-[var(--color-ink-500)]">Nothing yet. Match alerts and messages will show up here.</p>
          </div>
        ) : (
          notifications.map((n) => (
            <button
              key={n._id}
              onClick={() => open(n)}
              className={`w-full text-left p-4 flex gap-3 transition-colors ${n.isRead ? 'hover:bg-[var(--color-canvas-dark)]' : 'bg-[var(--color-violet-50)] hover:bg-[var(--color-violet-100)]'}`}
            >
              <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${n.isRead ? 'bg-transparent' : 'bg-[var(--color-violet-600)]'}`} />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-[var(--color-ink-900)]">{n.title}</span>
                <span className="block text-xs text-[var(--color-ink-500)] mt-0.5 leading-relaxed">{n.message}</span>
                <span className="block text-[11px] text-[var(--color-ink-400)] mt-1.5">
                  {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                </span>
              </span>
            </button>
          ))
        )}
      </div>
      <div className="border-t border-[var(--color-ink-100)] p-2.5 text-center">
        <Link to="/dashboard?tab=notifications" onClick={onClose} className="text-xs text-[var(--color-violet-600)] font-semibold hover:underline">
          See all notifications
        </Link>
      </div>
    </motion.div>
  );
}
