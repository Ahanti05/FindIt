import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart2, Users, ShieldCheck, Package,
  CheckCircle2, AlertCircle, Zap, TrendingUp,
  ChevronDown, Eye, Ban, Check
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { adminApi } from '../services/api';
import toast from 'react-hot-toast';

const COLORS = ['#6d5bd0', '#14b8a6', '#f59e0b', '#ef4444', '#22c55e', '#8b5cf6'];

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [pending, setPending] = useState({ lostItems: [], foundItems: [] });
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    Promise.all([adminApi.getStats(), adminApi.getPending(), adminApi.getUsers()])
      .then(([s, p, u]) => {
        setStats(s.data.data);
        setPending(p.data.data);
        setUsers(u.data.users);
      })
      .catch(() => toast.error('Failed to load admin data'))
      .finally(() => setLoading(false));
  }, []);

  const moderate = async (itemType, itemId, isApproved) => {
    try {
      await adminApi.moderate(itemType, itemId, { isApproved });
      toast.success(isApproved ? 'Item approved' : 'Item hidden');
      // Remove from pending list
      setPending((prev) => ({
        ...prev,
        [`${itemType}Items`]: prev[`${itemType}Items`].filter((i) => i._id !== itemId),
      }));
    } catch {
      toast.error('Moderation failed');
    }
  };

  const toggleUser = async (userId) => {
    try {
      const { data } = await adminApi.toggleUser(userId);
      setUsers((prev) => prev.map((u) => u._id === userId ? data.user : u));
      toast.success(`User ${data.user.isActive ? 'activated' : 'deactivated'}`);
    } catch {
      toast.error('Failed to update user');
    }
  };

  const overview = stats?.overview;

  // Build daily activity chart data
  const dailyMap = {};
  (stats?.dailyActivity?.lost || []).forEach(({ _id, lost }) => { dailyMap[_id] = { date: _id, lost, found: 0 }; });
  (stats?.dailyActivity?.found || []).forEach(({ _id, found }) => {
    if (dailyMap[_id]) dailyMap[_id].found = found;
    else dailyMap[_id] = { date: _id, lost: 0, found };
  });
  const activityData = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date)).slice(-7);

  const categoryData = (stats?.lostByCategory || []).map((c) => ({
    name: c._id,
    value: c.count,
  }));

  const TABS = [
    { id: 'overview', label: 'Overview', icon: BarChart2 },
    { id: 'moderation', label: `Moderation (${pending.lostItems.length + pending.foundItems.length})`, icon: ShieldCheck },
    { id: 'users', label: `Users (${users.length})`, icon: Users },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="w-5 h-5 text-[var(--color-violet-600)]" />
          <h1 className="font-display font-bold text-2xl text-[var(--color-ink-900)]">Admin Dashboard</h1>
        </div>
        <p className="text-sm text-[var(--color-ink-500)]">Platform-wide management and moderation</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[var(--color-canvas-dark)] p-1 rounded-xl w-fit mb-8">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${tab === t.id ? 'bg-white shadow-sm text-[var(--color-ink-900)]' : 'text-[var(--color-ink-500)]'}`}>
            <t.icon className="w-3.5 h-3.5" />{t.label}
          </button>
        ))}
      </div>

      {/* ── Overview ──────────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <div className="space-y-6">
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { label: 'Total Lost', value: overview?.totalLost, icon: AlertCircle, color: 'red' },
              { label: 'Total Found', value: overview?.totalFound, icon: CheckCircle2, color: 'teal' },
              { label: 'Recovered', value: overview?.totalRecovered, icon: Package, color: 'violet' },
              { label: 'Pending Verif.', value: overview?.pendingVerifications, icon: Zap, color: 'amber' },
              { label: 'Users', value: overview?.totalUsers, icon: Users, color: 'violet' },
            ].map((kpi, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="card border border-[var(--color-ink-100)] p-4">
                <div className={`w-8 h-8 rounded-lg bg-[var(--color-${kpi.color}-100)] flex items-center justify-center mb-2`}>
                  <kpi.icon className={`w-4 h-4 text-[var(--color-${kpi.color}-600)]`} />
                </div>
                <p className="font-display font-extrabold text-2xl text-[var(--color-ink-900)]">
                  {loading ? <span className="skeleton w-8 h-6 inline-block" /> : (kpi.value ?? 0)}
                </p>
                <p className="text-xs text-[var(--color-ink-500)] font-medium mt-0.5">{kpi.label}</p>
              </motion.div>
            ))}
          </div>

          {/* Charts */}
          <div className="grid lg:grid-cols-2 gap-5">
            {/* Activity chart */}
            <div className="card border border-[var(--color-ink-100)] p-5">
              <p className="font-bold text-sm text-[var(--color-ink-900)] mb-4">7-Day Activity</p>
              {loading ? <div className="skeleton h-48 w-full rounded-lg" /> : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={activityData} barGap={4}>
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d) => d.slice(5)} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="lost" fill="#ef4444" radius={[4, 4, 0, 0]} name="Lost" />
                    <Bar dataKey="found" fill="#14b8a6" radius={[4, 4, 0, 0]} name="Found" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Category pie */}
            <div className="card border border-[var(--color-ink-100)] p-5">
              <p className="font-bold text-sm text-[var(--color-ink-900)] mb-4">Lost Items by Category</p>
              {loading ? <div className="skeleton h-48 w-full rounded-lg" /> : categoryData.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-sm text-[var(--color-ink-300)]">No data yet</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={categoryData} cx="50%" cy="50%" outerRadius={80} dataKey="value" nameKey="name">
                      {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: '11px' }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Heatmap data table */}
          {stats?.heatmap?.length > 0 && (
            <div className="card border border-[var(--color-ink-100)] p-5">
              <p className="font-bold text-sm text-[var(--color-ink-900)] mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[var(--color-violet-600)]" /> Campus Hotspots
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-bold text-[var(--color-ink-500)] uppercase">
                      <th className="pb-3">Building</th>
                      <th className="pb-3">Lost Reports</th>
                      <th className="pb-3">Activity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-ink-100)]">
                    {stats.heatmap.sort((a, b) => b.lostCount - a.lostCount).slice(0, 8).map((h) => (
                      <tr key={h._id}>
                        <td className="py-2.5 font-medium text-[var(--color-ink-800)]">{h._id}</td>
                        <td className="py-2.5 text-[var(--color-ink-600)]">{h.lostCount}</td>
                        <td className="py-2.5 w-40">
                          <div className="match-bar-track">
                            <div
                              className="h-full rounded-full bg-[var(--color-violet-500)]"
                              style={{ width: `${Math.min((h.lostCount / (stats.heatmap[0]?.lostCount || 1)) * 100, 100)}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Moderation ────────────────────────────────────────────────── */}
      {tab === 'moderation' && (
        <div className="space-y-5">
          {pending.lostItems.length === 0 && pending.foundItems.length === 0 ? (
            <div className="text-center py-20">
              <CheckCircle2 className="w-10 h-10 text-[var(--color-teal-500)] mx-auto mb-3" />
              <p className="font-bold text-[var(--color-ink-800)]">All clear!</p>
              <p className="text-sm text-[var(--color-ink-500)]">No items pending moderation.</p>
            </div>
          ) : (
            <>
              {[...pending.lostItems.map((i) => ({ ...i, _type: 'lost' })), ...pending.foundItems.map((i) => ({ ...i, _type: 'found' }))].map((item) => (
                <div key={item._id} className="card border border-[var(--color-ink-100)] p-4 flex items-start gap-4">
                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-[var(--color-canvas-dark)] shrink-0">
                    {item.image?.url
                      ? <img src={item.image.url} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-xl">📦</div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`badge text-[10px] ${item._type === 'lost' ? 'badge-red' : 'badge-teal'}`}>{item._type}</span>
                      <span className="badge badge-neutral text-[10px]">{item.category}</span>
                    </div>
                    <p className="font-semibold text-sm text-[var(--color-ink-900)] truncate">{item.title}</p>
                    <p className="text-xs text-[var(--color-ink-500)] mt-0.5">
                      By {item.reporter?.name} ({item.reporter?.email})
                    </p>
                    {item.description && (
                      <p className="text-xs text-[var(--color-ink-400)] mt-1 line-clamp-2">{item.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => moderate(item._type, item._id, true)}
                      className="btn btn-sm gap-1 bg-[var(--color-green-100)] text-[#15803d] hover:bg-green-200"
                    >
                      <Check className="w-3.5 h-3.5" /> Approve
                    </button>
                    <button
                      onClick={() => moderate(item._type, item._id, false)}
                      className="btn btn-sm gap-1 bg-[var(--color-red-100)] text-[var(--color-red-500)] hover:bg-red-200"
                    >
                      <Ban className="w-3.5 h-3.5" /> Hide
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* ── Users ─────────────────────────────────────────────────────── */}
      {tab === 'users' && (
        <div className="card border border-[var(--color-ink-100)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-canvas-dark)] border-b border-[var(--color-ink-100)]">
                <tr className="text-left text-xs font-bold text-[var(--color-ink-500)] uppercase">
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-ink-100)]">
                {loading ? [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(5)].map((_, j) => <td key={j} className="px-4 py-3"><div className="skeleton h-4 w-24 rounded" /></td>)}
                  </tr>
                )) : users.map((u) => (
                  <tr key={u._id} className="hover:bg-[var(--color-canvas-dark)] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[var(--color-violet-100)] flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-[var(--color-violet-600)]">{u.name?.charAt(0)}</span>
                        </div>
                        <div>
                          <p className="font-medium text-[var(--color-ink-900)]">{u.name}</p>
                          <p className="text-xs text-[var(--color-ink-400)]">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 capitalize">
                      <span className="badge badge-neutral">{u.role}</span>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-ink-500)]">{u.department || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${u.isActive ? 'badge-green' : 'badge-red'}`}>
                        {u.isActive ? 'Active' : 'Deactivated'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleUser(u._id)}
                        className={`btn btn-sm ${u.isActive ? 'btn-ghost text-[var(--color-red-500)]' : 'btn-ghost text-[var(--color-teal-600)]'}`}
                      >
                        {u.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
