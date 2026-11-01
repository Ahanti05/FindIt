import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Check, EyeOff, Cpu, RefreshCw, Flag, ShieldCheck, Users as UsersIcon, LayoutGrid } from 'lucide-react';
import { format, subDays, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import { adminApi, errorMessage } from '../services/api';
import { StatusBadge, Thumb, EmptyState } from '../components/ui';

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'claims', label: 'Claims', icon: ShieldCheck },
  { id: 'moderation', label: 'Moderation', icon: Flag },
  { id: 'users', label: 'Users', icon: UsersIcon },
];

export default function AdminDashboard() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'overview';
  const [stats, setStats] = useState(null);
  const [pending, setPending] = useState({ lostItems: [], foundItems: [] });
  const [claims, setClaims] = useState([]);
  const [claimFilter, setClaimFilter] = useState('pending');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [s, p, u] = await Promise.all([adminApi.getStats(), adminApi.getPending(), adminApi.getUsers()]);
      setStats(s.data.data);
      setPending(p.data.data);
      setUsers(u.data.users);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not load admin data'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    adminApi.getRecoveries(claimFilter).then(({ data }) => setClaims(data.recoveries)).catch(() => {});
  }, [claimFilter]);

  const moderate = async (type, id, isApproved) => {
    try {
      await adminApi.moderate(type, id, { isApproved });
      toast.success(isApproved ? 'Listing approved' : 'Listing hidden from the public');
      setPending((p) => ({ ...p, [`${type}Items`]: p[`${type}Items`].filter((i) => i._id !== id) }));
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const toggleUser = async (id) => {
    try {
      const { data } = await adminApi.toggleUser(id);
      setUsers((us) => us.map((u) => (u._id === id ? data.user : u)));
      toast.success(data.user.isActive ? 'Account reactivated' : 'Account deactivated');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const backfill = async () => {
    try {
      const { data } = await adminApi.backfillAI();
      toast.success(data.queued ? `Analyzing ${data.queued} report(s) in the background` : 'Every report with a photo is already analyzed');
      setTimeout(load, 4000);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const o = stats?.overview;
  const queue = [
    ...pending.lostItems.map((i) => ({ ...i, _type: 'lost' })),
    ...pending.foundItems.map((i) => ({ ...i, _type: 'found' })),
  ].sort((a, b) => (b.moderation?.flags?.length || 0) - (a.moderation?.flags?.length || 0));

  // Last 7 days, including days with no reports.
  const days = [...Array(7)].map((_, i) => format(subDays(new Date(), 6 - i), 'yyyy-MM-dd'));
  const byDay = (rows) => Object.fromEntries((rows || []).map((r) => [r._id, r.count]));
  const lostDays = byDay(stats?.dailyActivity?.lost);
  const foundDays = byDay(stats?.dailyActivity?.found);
  const activity = days.map((d) => ({ day: format(parseISO(d), 'EEE'), Lost: lostDays[d] || 0, Found: foundDays[d] || 0 }));
  const processing = stats?.ai?.processing || {};

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display font-bold text-2xl text-[var(--color-ink-900)]">Lost &amp; Found Office</h1>
          <p className="text-sm text-[var(--color-ink-500)]">Campus-wide reports, claims and moderation</p>
        </div>
        <button onClick={() => { setLoading(true); load(); }} className="btn btn-ghost btn-sm"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
      </div>

      <div className="flex gap-1 border-b border-[var(--color-ink-100)] mb-6 overflow-x-auto" role="tablist">
        {TABS.map((t) => {
          const count = t.id === 'claims' ? o?.pendingVerifications : t.id === 'moderation' ? queue.length : 0;
          return (
            <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setParams({ tab: t.id }, { replace: true })}
              className={clsx('px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px flex items-center gap-2',
                tab === t.id ? 'border-[var(--color-ink-900)] text-[var(--color-ink-900)]' : 'border-transparent text-[var(--color-ink-500)] hover:text-[var(--color-ink-800)]')}>
              <t.icon className="w-4 h-4" /> {t.label}
              {count > 0 && <span className="min-w-5 h-5 px-1.5 rounded-full bg-[var(--color-amber-500)] text-white text-[11px] flex items-center justify-center">{count}</span>}
            </button>
          );
        })}
      </div>

      {tab === 'overview' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              ['Open lost', o?.activeLost], ['Open found', o?.activeFound], ['AI matches', o?.totalMatches],
              ['Owner-confirmed', o?.acceptedMatches], ['Returned', o?.totalRecovered], ['Users', o?.totalUsers],
            ].map(([label, value]) => (
              <div key={label} className="card border border-[var(--color-ink-100)] p-4">
                <p className="font-display font-extrabold text-2xl text-[var(--color-ink-900)]">{loading ? <span className="skeleton w-8 h-7" /> : value ?? 0}</p>
                <p className="text-xs text-[var(--color-ink-500)] mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-[1fr_320px] gap-5">
            <div className="card border border-[var(--color-ink-100)] p-5">
              <p className="font-bold text-sm text-[var(--color-ink-900)] mb-4">New reports, last 7 days</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={activity} barGap={2}>
                  <CartesianGrid vertical={false} stroke="#e9eef3" />
                  <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#6d8197' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#6d8197' }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip cursor={{ fill: '#f2f0ec' }} />
                  <Bar dataKey="Lost" fill="#6d5bd0" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Found" fill="#0d9488" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card border border-[var(--color-ink-100)] p-5">
              <p className="font-bold text-sm text-[var(--color-ink-900)] flex items-center gap-2"><Cpu className="w-4 h-4" /> AI service</p>
              <p className={clsx('text-sm font-semibold mt-3 flex items-center gap-2', stats?.ai?.online ? 'text-[var(--color-teal-600)]' : 'text-[#b91c1c]')}>
                <span className={clsx('w-2 h-2 rounded-full', stats?.ai?.online ? 'bg-[var(--color-teal-500)]' : 'bg-[var(--color-red-500)]')} />
                {stats ? (stats.ai.online ? 'Online' : 'Offline') : '...'}
              </p>
              {stats?.ai?.health?.models && (
                <p className="text-xs text-[var(--color-ink-500)] mt-1">
                  {stats.ai.health.models.detector} + {stats.ai.health.models.embedder?.split('/').pop()} on {stats.ai.health.models.device}
                </p>
              )}
              <dl className="grid grid-cols-2 gap-2 mt-4 text-sm">
                {[['Analyzed', processing.done], ['Failed', processing.failed], ['Waiting', (processing.pending || 0) + (processing.processing || 0)], ['No photo', processing.skipped]].map(([k, v]) => (
                  <div key={k} className="bg-[var(--color-canvas)] rounded-lg p-2.5">
                    <dt className="text-[11px] text-[var(--color-ink-500)]">{k}</dt>
                    <dd className="font-bold text-[var(--color-ink-900)]">{v || 0}</dd>
                  </div>
                ))}
              </dl>
              <button onClick={backfill} disabled={!stats?.ai?.online} className="btn btn-ghost btn-sm w-full mt-4">Run AI on pending items</button>
            </div>
          </div>

          <div className="card border border-[var(--color-ink-100)] p-5">
            <p className="font-bold text-sm text-[var(--color-ink-900)] mb-4">Where things get lost</p>
            {stats?.hotspots?.length ? (
              <ul className="space-y-2.5">
                {stats.hotspots.map((h) => (
                  <li key={h._id} className="grid grid-cols-[180px_1fr_32px] items-center gap-3 text-sm">
                    <span className="text-[var(--color-ink-800)] truncate">{h._id}</span>
                    <div className="h-2 rounded-full bg-[var(--color-canvas-dark)] overflow-hidden">
                      <div className="h-full bg-[var(--color-violet-500)] rounded-full" style={{ width: `${(h.lostCount / stats.hotspots[0].lostCount) * 100}%` }} />
                    </div>
                    <span className="text-right font-semibold text-[var(--color-ink-700)]">{h.lostCount}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-[var(--color-ink-400)]">No lost reports yet.</p>}
          </div>
        </div>
      )}

      {tab === 'claims' && (
        <div>
          <div className="flex gap-1.5 mb-4">
            {['pending', 'approved', 'completed', 'denied', 'all'].map((s) => (
              <button key={s} onClick={() => setClaimFilter(s)} className={clsx('badge py-1 px-3 capitalize', claimFilter === s ? 'bg-[var(--color-ink-900)] text-white' : 'badge-neutral')}>{s}</button>
            ))}
          </div>
          {claims.length === 0 ? (
            <EmptyState icon={ShieldCheck} title="No claims here" desc="Claims appear when an owner submits proof of ownership for a match." />
          ) : (
            <ul className="card border border-[var(--color-ink-100)] divide-y divide-[var(--color-ink-100)]">
              {claims.map((r) => (
                <li key={r._id}>
                  <Link to={`/recovery/${r._id}`} className="p-4 flex items-center gap-4 hover:bg-[var(--color-canvas)]">
                    <Thumb item={r.foundItem} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[var(--color-ink-900)] truncate">{r.foundItem?.title}</p>
                      <p className="text-xs text-[var(--color-ink-500)] truncate">Claimed by {r.claimant?.name} ({r.claimant?.email}) · found by {r.finder?.name}</p>
                      <p className="text-xs text-[var(--color-ink-400)]">{format(new Date(r.createdAt), 'd MMM yyyy, HH:mm')}</p>
                    </div>
                    <StatusBadge status={r.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'moderation' && (queue.length === 0 ? (
        <EmptyState icon={Check} title="Nothing to review" desc="New and reported listings show up here." />
      ) : (
        <ul className="space-y-3">
          {queue.map((item) => (
            <li key={item._id} className={clsx('card border p-4 flex flex-wrap sm:flex-nowrap items-start gap-4', item.moderation?.flags?.length ? 'border-[var(--color-red-100)]' : 'border-[var(--color-ink-100)]')}>
              <Thumb item={item} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={clsx('badge text-[10px]', item._type === 'lost' ? 'badge-red' : 'badge-teal')}>{item._type}</span>
                  <Link to={`/items/${item._type}/${item._id}`} className="text-sm font-semibold text-[var(--color-ink-900)] hover:underline truncate">{item.title}</Link>
                </div>
                <p className="text-xs text-[var(--color-ink-500)]">{item.category} · by {item.reporter?.name} ({item.reporter?.email})</p>
                {item.moderation?.flags?.map((f, i) => (
                  <p key={i} className="text-xs text-[#b91c1c] mt-1 flex items-start gap-1.5"><Flag className="w-3 h-3 mt-0.5 shrink-0" />{f.reason}</p>
                ))}
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => moderate(item._type, item._id, true)} className="btn btn-ghost btn-sm"><Check className="w-3.5 h-3.5" /> Looks fine</button>
                <button onClick={() => moderate(item._type, item._id, false)} className="btn btn-ghost-danger btn-sm"><EyeOff className="w-3.5 h-3.5" /> Hide</button>
              </div>
            </li>
          ))}
        </ul>
      ))}

      {tab === 'users' && (
        <div className="card border border-[var(--color-ink-100)] overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-canvas)] text-left text-xs font-bold text-[var(--color-ink-500)] uppercase">
              <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Department</th><th className="px-4 py-3">Joined</th><th className="px-4 py-3">Status</th><th className="px-4 py-3" /></tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-ink-100)]">
              {users.map((u) => (
                <tr key={u._id}>
                  <td className="px-4 py-3"><p className="font-medium text-[var(--color-ink-900)]">{u.name}</p><p className="text-xs text-[var(--color-ink-500)]">{u.email}</p></td>
                  <td className="px-4 py-3 capitalize text-[var(--color-ink-700)]">{u.role}</td>
                  <td className="px-4 py-3 text-[var(--color-ink-600)]">{u.department || '–'}</td>
                  <td className="px-4 py-3 text-[var(--color-ink-600)]">{format(new Date(u.createdAt), 'd MMM yyyy')}</td>
                  <td className="px-4 py-3"><span className={clsx('badge', u.isActive ? 'badge-green' : 'badge-red')}>{u.isActive ? 'Active' : 'Deactivated'}</span></td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => toggleUser(u._id)} className={clsx('btn btn-sm', u.isActive ? 'btn-ghost-danger' : 'btn-ghost')}>{u.isActive ? 'Deactivate' : 'Reactivate'}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
