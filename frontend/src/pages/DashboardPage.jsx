import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Sparkles, ShieldCheck, Bell, Plus, ArrowRight, RefreshCw, Search, PackageOpen, CheckCheck } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import { lostApi, foundApi, matchApi, notifApi, recoveryApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocketEvent } from '../context/SocketContext';
import ItemCard from '../components/ItemCard';
import { EmptyState, StatusBadge, Thumb, pct } from '../components/ui';

const TABS = [
  { id: 'matches', label: 'Matches' },
  { id: 'claims', label: 'Claims' },
  { id: 'lost', label: 'My lost reports' },
  { id: 'found', label: 'My found reports' },
  { id: 'notifications', label: 'Notifications' },
];

// Does this match/claim need something from me right now?
const matchNeedsMe = (m) => m.status === 'pending' && (m.role === 'owner' || m.foundReporterResponse === 'none');
const claimNeedsMe = (r) => (r.role === 'finder' && ['pending', 'approved'].includes(r.status)) || (r.role === 'claimant' && r.status === 'approved');

export default function DashboardPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'matches';
  const setTab = (id) => setParams({ tab: id }, { replace: true });

  const [data, setData] = useState({ lost: [], found: [], matches: [], claims: [], notifications: [] });
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      const [l, f, m, r, n] = await Promise.all([
        lostApi.getMine(), foundApi.getMine(), matchApi.mine(), recoveryApi.mine(), notifApi.getAll({ limit: 30 }),
      ]);
      setData({ lost: l.data.items, found: f.data.items, matches: m.data.matches, claims: r.data.recoveries, notifications: n.data.notifications });
    } catch {
      toast.error('Could not load your dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Refresh when something happens to one of my reports.
  const onNotification = useCallback(() => { fetchAll(); }, [fetchAll]);
  useSocketEvent('notification', onNotification);

  const markRead = async (ids) => {
    await notifApi.markRead(ids);
    setData((d) => ({ ...d, notifications: d.notifications.map((n) => (ids.length === 0 || ids.includes(n._id) ? { ...n, isRead: true } : n)) }));
  };

  const todo = data.matches.filter(matchNeedsMe).length + data.claims.filter(claimNeedsMe).length;
  const unread = data.notifications.filter((n) => !n.isRead).length;
  const counts = {
    matches: data.matches.filter(matchNeedsMe).length,
    claims: data.claims.filter(claimNeedsMe).length,
    lost: data.lost.length,
    found: data.found.length,
    notifications: unread,
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display font-bold text-2xl text-[var(--color-ink-900)]">Hi, {user?.name?.split(' ')[0]}</h1>
          <p className="text-sm text-[var(--color-ink-500)] mt-1">
            {loading ? 'Loading your reports...' : todo > 0 ? `${todo} thing${todo > 1 ? 's' : ''} need${todo > 1 ? '' : 's'} your attention.` : 'Nothing needs your attention right now.'}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setLoading(true); fetchAll(); }} className="btn btn-ghost btn-sm" aria-label="Refresh"><RefreshCw className="w-3.5 h-3.5" /></button>
          <Link to="/report/lost" className="btn btn-primary btn-sm"><Plus className="w-3.5 h-3.5" /> Lost something</Link>
          <Link to="/report/found" className="btn btn-teal btn-sm"><Plus className="w-3.5 h-3.5" /> Found something</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          ['Open lost reports', data.lost.filter((i) => i.status === 'active').length, 'lost'],
          ['Found items you hold', data.found.filter((i) => ['active', 'claimed'].includes(i.status)).length, 'found'],
          ['Suggested matches', data.matches.length, 'matches'],
          ['Items reunited', data.lost.filter((i) => i.status === 'recovered').length + data.found.filter((i) => i.status === 'returned').length, 'claims'],
        ].map(([label, value, t]) => (
          <button key={label} onClick={() => setTab(t)} className="card border border-[var(--color-ink-100)] p-4 text-left hover:border-[var(--color-ink-300)]">
            <p className="font-display font-extrabold text-2xl text-[var(--color-ink-900)]">{loading ? <span className="skeleton w-8 h-7" /> : value}</p>
            <p className="text-xs text-[var(--color-ink-500)] mt-0.5">{label}</p>
          </button>
        ))}
      </div>

      <div className="flex gap-1 border-b border-[var(--color-ink-100)] mb-6 overflow-x-auto" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={clsx(
              'px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors flex items-center gap-2',
              tab === t.id ? 'border-[var(--color-ink-900)] text-[var(--color-ink-900)]' : 'border-transparent text-[var(--color-ink-500)] hover:text-[var(--color-ink-800)]'
            )}
          >
            {t.label}
            {counts[t.id] > 0 && ['matches', 'claims', 'notifications'].includes(t.id) && (
              <span className="min-w-5 h-5 px-1.5 rounded-full bg-[var(--color-amber-500)] text-white text-[11px] flex items-center justify-center">{counts[t.id]}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-20 w-full rounded-xl" />)}</div>
      ) : (
        <>
          {tab === 'matches' && (data.matches.length === 0 ? (
            <EmptyState icon={Sparkles} title="No matches yet" desc="When the AI finds a report that looks like one of yours, it appears here and you get a notification." action={{ label: 'Browse found items', to: '/browse?type=found' }} />
          ) : (
            <ul className="space-y-3">
              {[...data.matches].sort((a, b) => matchNeedsMe(b) - matchNeedsMe(a)).map((m) => <MatchRow key={m._id} m={m} />)}
            </ul>
          ))}

          {tab === 'claims' && (data.claims.length === 0 ? (
            <EmptyState icon={ShieldCheck} title="No claims" desc="Claims you submit for your lost items, and claims made on items you found, show up here." />
          ) : (
            <ul className="space-y-3">
              {data.claims.map((r) => (
                <li key={r._id}>
                  <Link to={`/recovery/${r._id}`} className={clsx('card border p-4 flex items-center gap-4 hover:border-[var(--color-ink-300)]', claimNeedsMe(r) ? 'border-[var(--color-amber-400)]' : 'border-[var(--color-ink-100)]')}>
                    <Thumb item={r.foundItem} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[var(--color-ink-900)] truncate">{r.foundItem?.title}</p>
                      <p className="text-xs text-[var(--color-ink-500)] mt-0.5">
                        {r.role === 'claimant' ? 'Your claim' : `${r.claimant?.name} claims the item you found`} · {formatDistanceToNow(new Date(r.updatedAt), { addSuffix: true })}
                      </p>
                      {claimNeedsMe(r) && (
                        <p className="text-xs font-semibold text-[#92400e] mt-1">
                          {r.role === 'finder' ? (r.status === 'pending' ? 'Review the proof of ownership' : 'Confirm the handover with their code') : 'Approved – collect your item'}
                        </p>
                      )}
                    </div>
                    <StatusBadge status={r.status} />
                  </Link>
                </li>
              ))}
            </ul>
          ))}

          {tab === 'lost' && (data.lost.length === 0 ? (
            <EmptyState icon={Search} title="You haven't reported anything lost" desc="Report it with a photo and FindIt keeps checking every new found item for you." action={{ label: 'Report a lost item', to: '/report/lost' }} />
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{data.lost.map((i) => <ItemCard key={i._id} item={i} type="lost" showStatus />)}</div>
          ))}

          {tab === 'found' && (data.found.length === 0 ? (
            <EmptyState icon={PackageOpen} title="No found reports" desc="Picked something up on campus? Report it and the owner gets notified if they've reported it lost." action={{ label: 'Report a found item', to: '/report/found' }} />
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{data.found.map((i) => <ItemCard key={i._id} item={i} type="found" showStatus />)}</div>
          ))}

          {tab === 'notifications' && (data.notifications.length === 0 ? (
            <EmptyState icon={Bell} title="No notifications" desc="Match alerts, messages and claim updates will appear here." />
          ) : (
            <>
              {unread > 0 && (
                <div className="flex justify-end mb-3">
                  <button onClick={() => markRead([])} className="btn btn-ghost btn-sm"><CheckCheck className="w-3.5 h-3.5" /> Mark all read</button>
                </div>
              )}
              <ul className="card border border-[var(--color-ink-100)] divide-y divide-[var(--color-ink-100)] overflow-hidden">
                {data.notifications.map((n) => (
                  <li key={n._id} className={clsx('p-4 flex items-start gap-3', !n.isRead && 'bg-[var(--color-violet-50)]')}>
                    <span className={clsx('w-2 h-2 rounded-full mt-1.5 shrink-0', n.isRead ? 'bg-transparent' : 'bg-[var(--color-violet-600)]')} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[var(--color-ink-900)]">{n.title}</p>
                      <p className="text-sm text-[var(--color-ink-600)] mt-0.5">{n.message}</p>
                      <p className="text-[11px] text-[var(--color-ink-400)] mt-1">{formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}</p>
                    </div>
                    {n.actionUrl && (
                      <Link to={n.actionUrl} onClick={() => !n.isRead && markRead([n._id])} className="btn btn-ghost btn-sm shrink-0">Open <ArrowRight className="w-3.5 h-3.5" /></Link>
                    )}
                  </li>
                ))}
              </ul>
            </>
          ))}
        </>
      )}
    </div>
  );
}

function MatchRow({ m }) {
  const mine = m.role === 'owner' ? m.lostItem : m.foundItem;
  const other = m.role === 'owner' ? m.foundItem : m.lostItem;
  const needs = matchNeedsMe(m);
  return (
    <li>
      <Link to={`/matches/${m._id}`} className={clsx('card border p-4 flex items-center gap-4 hover:border-[var(--color-ink-300)]', needs ? 'border-[var(--color-amber-400)]' : 'border-[var(--color-ink-100)]')}>
        <div className="flex -space-x-3 shrink-0">
          <Thumb item={mine} className="w-14 h-14 ring-2 ring-white" />
          <Thumb item={other} className="w-14 h-14 ring-2 ring-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--color-ink-900)] truncate">
            {m.role === 'owner' ? `Found: ${other.title}` : `Lost: ${other.title}`}
          </p>
          <p className="text-xs text-[var(--color-ink-500)] mt-0.5 truncate">
            Matches your {m.role === 'owner' ? 'lost' : 'found'} “{mine.title}” · {formatDistanceToNow(new Date(m.createdAt), { addSuffix: true })}
          </p>
          {needs && <p className="text-xs font-semibold text-[#92400e] mt-1">{m.role === 'owner' ? 'Is this yours? Let the finder know' : 'Does this fit what you found?'}</p>}
        </div>
        <div className="text-right shrink-0">
          <p className="font-display font-bold text-lg text-[var(--color-ink-900)]">{pct(m.combinedScore)}</p>
          {m.status !== 'pending' && <StatusBadge status={m.status} className="text-[10px]" />}
        </div>
      </Link>
    </li>
  );
}
