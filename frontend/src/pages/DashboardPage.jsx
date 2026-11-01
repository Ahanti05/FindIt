import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertCircle, CheckCircle2, Zap, Bell, Package,
  TrendingUp, Plus, ArrowRight, Clock, MapPin, RefreshCw
} from 'lucide-react';
import { lostApi, foundApi, matchApi, notifApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { formatDistanceToNow } from 'date-fns';
import ItemCard from '../components/ItemCard';
import toast from 'react-hot-toast';

const TABS = [
  { id: 'lost', label: 'My Lost Items', icon: AlertCircle, color: 'red' },
  { id: 'found', label: 'My Found Items', icon: CheckCircle2, color: 'teal' },
  { id: 'matches', label: 'Potential Matches', icon: Zap, color: 'violet' },
  { id: 'notifications', label: 'Notifications', icon: Bell, color: 'amber' },
];

const STATUS_BADGE = {
  active: 'badge-violet',
  matched: 'badge-amber',
  recovered: 'badge-green',
  expired: 'badge-neutral',
  archived: 'badge-neutral',
  claimed: 'badge-amber',
  returned: 'badge-green',
};

export default function DashboardPage() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [tab, setTab] = useState('lost');
  const [lostItems, setLostItems] = useState([]);
  const [foundItems, setFoundItems] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [l, f, n] = await Promise.all([
        lostApi.getMine(),
        foundApi.getMine(),
        notifApi.getAll({ limit: 15 }),
      ]);
      setLostItems(l.data.items);
      setFoundItems(f.data.items);
      setNotifications(n.data.notifications);
    } catch {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // Real-time: refresh when a new notification arrives
  useEffect(() => {
    if (!socket) return;
    const handler = (notif) => {
      setNotifications((prev) => [{ ...notif, _id: notif.id, isRead: false }, ...prev]);
      toast(notif.title, { icon: '🔔' });
    };
    socket.on('notification', handler);
    return () => socket.off('notification', handler);
  }, [socket]);

  const stats = [
    { label: 'Lost Reports', value: lostItems.length, icon: AlertCircle, color: 'red', tab: 'lost' },
    { label: 'Found Reports', value: foundItems.length, icon: CheckCircle2, color: 'teal', tab: 'found' },
    { label: 'Matches', value: lostItems.filter((i) => i.status === 'matched').length, icon: Zap, color: 'violet', tab: 'matches' },
    { label: 'Recovered', value: lostItems.filter((i) => i.status === 'recovered').length, icon: Package, color: 'amber', tab: 'lost' },
  ];

  const markRead = async (ids) => {
    await notifApi.markRead(ids);
    setNotifications((ns) => ns.map((n) => ids.length === 0 || ids.includes(n._id) ? { ...n, isRead: true } : n));
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-display font-bold text-2xl text-[var(--color-ink-900)]">
            Welcome back, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-sm text-[var(--color-ink-500)] mt-1 capitalize">
            {user?.role} · {user?.department || 'Campus member'}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchData} className="btn btn-ghost btn-sm gap-1.5" title="Refresh">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <Link to="/report/lost" className="btn btn-primary btn-sm gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Report Lost
          </Link>
          <Link to="/report/found" className="btn btn-teal btn-sm gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Report Found
          </Link>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((s, i) => (
          <motion.button
            key={s.label}
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            onClick={() => setTab(s.tab)}
            className="card border border-[var(--color-ink-100)] p-5 text-left hover:border-[var(--color-violet-300)] transition-colors"
          >
            <div className={`w-9 h-9 rounded-xl bg-[var(--color-${s.color}-100)] flex items-center justify-center mb-3`}>
              <s.icon className={`w-4.5 h-4.5 text-[var(--color-${s.color}-600)]`} />
            </div>
            <p className="font-display font-extrabold text-2xl text-[var(--color-ink-900)]">
              {loading ? <span className="skeleton w-8 h-6 inline-block" /> : s.value}
            </p>
            <p className="text-xs text-[var(--color-ink-500)] font-medium mt-0.5">{s.label}</p>
          </motion.button>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[var(--color-canvas-dark)] p-1 rounded-xl w-full mb-6 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-all flex-1 justify-center ${
              tab === t.id
                ? 'bg-white shadow-sm text-[var(--color-ink-900)]'
                : 'text-[var(--color-ink-500)] hover:text-[var(--color-ink-800)]'
            }`}
          >
            <t.icon className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:block">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card p-4">
              <div className="skeleton h-40 w-full rounded-lg mb-4" />
              <div className="skeleton h-3 w-2/3 mb-2" />
              <div className="skeleton h-2.5 w-full mb-1" />
              <div className="skeleton h-2.5 w-3/4" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* ── Lost Items ─────────────────────────────────────────── */}
          {tab === 'lost' && (
            <div>
              {lostItems.length === 0 ? (
                <EmptyState
                  icon={AlertCircle}
                  title="No lost item reports"
                  desc="Report a lost item and our AI will search for matches automatically."
                  action={{ label: 'Report lost item', to: '/report/lost' }}
                />
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {lostItems.map((item) => (
                    <div key={item._id} className="relative">
                      <ItemCard item={item} type="lost" />
                      <div className="absolute top-3 right-3">
                        <span className={`badge ${STATUS_BADGE[item.status] || 'badge-neutral'} text-[10px]`}>
                          {item.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Found Items ───────────────────────────────────────── */}
          {tab === 'found' && (
            <div>
              {foundItems.length === 0 ? (
                <EmptyState
                  icon={CheckCircle2}
                  title="No found item reports"
                  desc="If you find something on campus, report it here to help the owner get it back."
                  action={{ label: 'Report found item', to: '/report/found' }}
                />
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {foundItems.map((item) => (
                    <div key={item._id} className="relative">
                      <ItemCard item={item} type="found" />
                      <div className="absolute top-3 right-3">
                        <span className={`badge ${STATUS_BADGE[item.status] || 'badge-neutral'} text-[10px]`}>
                          {item.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Matches ───────────────────────────────────────────── */}
          {tab === 'matches' && (
            <div>
              {lostItems.filter((i) => i.status !== 'active').length === 0 ? (
                <EmptyState
                  icon={Zap}
                  title="No matches yet"
                  desc="Once you report a lost item with a photo, our AI will scan for potential matches."
                  action={{ label: 'Browse found items', to: '/browse' }}
                />
              ) : (
                <div className="space-y-3">
                  {lostItems.filter((i) => ['matched', 'recovered'].includes(i.status)).map((item) => (
                    <MatchSummaryRow key={item._id} lostItem={item} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Notifications ─────────────────────────────────────── */}
          {tab === 'notifications' && (
            <div>
              {notifications.length === 0 ? (
                <EmptyState icon={Bell} title="All caught up!" desc="Notifications about matches, recoveries and updates will appear here." />
              ) : (
                <>
                  <div className="flex justify-end mb-4">
                    <button onClick={() => markRead([])} className="btn btn-ghost btn-sm gap-1.5">
                      Mark all read
                    </button>
                  </div>
                  <div className="space-y-2">
                    {notifications.map((n) => (
                      <NotifRow key={n._id} notif={n} onRead={() => markRead([n._id])} />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function EmptyState({ icon: Icon, title, desc, action }) {
  return (
    <div className="text-center py-20">
      <div className="w-14 h-14 rounded-2xl bg-[var(--color-canvas-dark)] flex items-center justify-center mx-auto mb-4">
        <Icon className="w-6 h-6 text-[var(--color-ink-300)]" />
      </div>
      <h3 className="font-display font-bold text-lg text-[var(--color-ink-800)] mb-2">{title}</h3>
      <p className="text-sm text-[var(--color-ink-500)] max-w-xs mx-auto mb-6">{desc}</p>
      {action && (
        <Link to={action.to} className="btn btn-primary btn-sm gap-1">
          {action.label} <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      )}
    </div>
  );
}

function MatchSummaryRow({ lostItem }) {
  return (
    <div className="card border border-[var(--color-ink-100)] p-4 flex items-center gap-4">
      <div className="w-14 h-14 rounded-xl overflow-hidden bg-[var(--color-canvas-dark)] shrink-0">
        {lostItem.image?.url
          ? <img src={lostItem.image.url} alt="" className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-2xl">📦</div>}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-[var(--color-ink-900)] truncate">{lostItem.title}</p>
        <p className="text-xs text-[var(--color-ink-500)] mt-0.5 flex items-center gap-1.5">
          <Clock className="w-3 h-3" />
          {formatDistanceToNow(new Date(lostItem.createdAt), { addSuffix: true })}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={`badge ${STATUS_BADGE[lostItem.status]}`}>{lostItem.status}</span>
        <Link to={`/items/lost/${lostItem._id}`} className="btn btn-ghost btn-sm gap-1">
          View <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}

function NotifRow({ notif, onRead }) {
  return (
    <div
      className={`card border p-4 flex items-start gap-4 cursor-pointer transition-colors ${
        !notif.isRead
          ? 'border-[var(--color-violet-200)] bg-[var(--color-violet-50)]'
          : 'border-[var(--color-ink-100)]'
      }`}
      onClick={onRead}
    >
      <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${notif.isRead ? 'bg-transparent' : 'bg-[var(--color-violet-600)]'}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--color-ink-900)]">{notif.title}</p>
        <p className="text-xs text-[var(--color-ink-500)] mt-0.5 leading-relaxed">{notif.message}</p>
        <p className="text-[11px] text-[var(--color-ink-300)] mt-1.5">
          {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
        </p>
      </div>
      {notif.actionUrl && (
        <Link to={notif.actionUrl} className="btn btn-ghost btn-sm shrink-0" onClick={(e) => e.stopPropagation()}>
          View <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      )}
    </div>
  );
}
