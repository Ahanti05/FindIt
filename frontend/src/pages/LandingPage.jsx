import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, Camera, ScanLine, MessageSquare, QrCode, Search, MapPin } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { lostApi, foundApi, publicApi } from '../services/api';
import ItemCard from '../components/ItemCard';
import { CategoryIcon, pct } from '../components/ui';
import Owl from '../components/Owl';
import GetTheApp from '../components/GetTheApp';

const STEPS = [
  {
    icon: Camera,
    title: 'Report with a photo',
    desc: 'Owners describe what they lost and where. Finders snap the item they picked up. Both take under a minute.',
    to: '/report/found', cta: 'Report an item',
  },
  {
    icon: ScanLine,
    title: 'AI compares the photos',
    desc: 'YOLOv8 finds the object, CLIP turns it into a visual fingerprint and recognises the category, then reports are ranked by look, category, place and date. No photo? The descriptions are compared instead.',
    to: '/browse', cta: 'See reports',
  },
  {
    icon: MessageSquare,
    title: 'Both sides are alerted',
    desc: 'The owner and the finder both get a live notification and can chat inside FindIt. If the finder types the name on the item, its owner is told even before they notice it is gone.',
    to: '/dashboard?tab=matches', cta: 'Your matches',
  },
  {
    icon: QrCode,
    title: 'Verified handover',
    desc: 'The owner proves it is theirs, the finder or office approves, and a one-time code confirms the handover. The finder earns FindIt coins.',
    to: '/coins', cta: 'FindIt coins',
  },
];

export default function LandingPage() {
  const location = useLocation();
  const [items, setItems] = useState({ lost: [], found: [] });
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('found');

  useEffect(() => {
    Promise.all([
      lostApi.getAll({ limit: 4 }),
      foundApi.getAll({ limit: 4 }),
      publicApi.stats(),
    ]).then(([l, f, s]) => {
      setItems({ lost: l.data.items, found: f.data.items });
      setStats(s.data.stats);
      setActivity(s.data.recentMatches);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (location.hash) document.querySelector(location.hash)?.scrollIntoView({ behavior: 'smooth' });
  }, [location.hash]);

  const shown = items[tab];

  return (
    <div>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="border-b border-[var(--color-ink-100)] bg-white">
        <div className="max-w-7xl mx-auto px-6 py-16 lg:py-20 grid lg:grid-cols-[1.15fr_1fr] gap-12 items-center">
          <div>
            <p className="text-sm font-semibold text-[var(--color-violet-600)] mb-4">Campus lost &amp; found</p>
            <h1 className="font-display font-extrabold text-[2.5rem] sm:text-[3.25rem] leading-[1.08] tracking-tight text-[var(--color-ink-900)]">
              Lost something?<br />Find it faster.
            </h1>
            <p className="text-lg text-[var(--color-ink-500)] leading-relaxed mt-5 max-w-xl">
              One place for every lost and found report on campus. Upload a photo and FindIt compares it with
              everything already reported, then tells the owner and the finder when there is a likely match.
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <Link to="/report/lost" className="btn btn-primary btn-lg">I lost something</Link>
              <Link to="/report/found" className="btn btn-teal btn-lg">I found something</Link>
              <Link to="/browse" className="btn btn-ghost btn-lg"><Search className="w-4 h-4" /> Browse reports</Link>
            </div>
            <a href="#get-the-app" className="inline-block mt-5 text-sm font-semibold text-[var(--color-ink-500)] hover:text-[var(--color-ink-900)]">Get FindIt on your phone →</a>
          </div>

          <div className="relative pt-16 lg:pt-0">
          <Owl mood="search" size={128} bob className="absolute -top-2 right-4 lg:-top-24 lg:right-6 z-10" title="Hoot, the FindIt owl, searching with a magnifying glass" />
          <div className="card border border-[var(--color-ink-100)] p-6">
            <div className="grid grid-cols-2 gap-px bg-[var(--color-ink-100)] rounded-lg overflow-hidden">
              {[
                ['Open lost reports', stats?.activeLost],
                ['Items waiting to be claimed', stats?.activeFound],
                ['Matches suggested by AI', stats?.matches],
                ['Items returned', stats?.recovered],
              ].map(([label, value]) => (
                <div key={label} className="bg-white p-4">
                  <p className="font-display font-extrabold text-3xl text-[var(--color-ink-900)]">
                    {loading ? <span className="skeleton w-10 h-8" /> : (value ?? 0)}
                  </p>
                  <p className="text-xs text-[var(--color-ink-500)] mt-1">{label}</p>
                </div>
              ))}
            </div>

            <p className="text-xs font-bold text-[var(--color-ink-500)] uppercase tracking-wider mt-6 mb-3">Latest matches</p>
            {activity.length === 0 && !loading && (
              <p className="text-sm text-[var(--color-ink-400)]">No matches yet. They appear here as soon as the AI pairs two reports.</p>
            )}
            <ul className="space-y-2">
              {activity.map((a, i) => (
                <li key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-[var(--color-canvas)]">
                  <span className="w-8 h-8 rounded-lg bg-white border border-[var(--color-ink-100)] flex items-center justify-center shrink-0">
                    <CategoryIcon category={a.category} className="w-4 h-4 text-[var(--color-violet-600)]" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-[var(--color-ink-900)]">{a.category}</span>
                    <span className="flex items-center gap-1 text-xs text-[var(--color-ink-500)]">
                      <MapPin className="w-3 h-3" />{a.building || 'Campus'} · {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                    </span>
                  </span>
                  <span className="text-sm font-bold text-[var(--color-teal-600)]">{pct(a.score)}</span>
                </li>
              ))}
            </ul>
          </div>
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-16 scroll-mt-16">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-display font-bold text-2xl text-[var(--color-ink-900)]">How a lost item gets back</h2>
          <p className="text-[var(--color-ink-500)] mt-1 mb-8">The same four steps whether you lost it or found it.</p>
          <ol className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="card border border-[var(--color-ink-100)] p-5 flex flex-col">
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-9 h-9 rounded-lg bg-[var(--color-violet-50)] text-[var(--color-violet-600)] flex items-center justify-center">
                    <s.icon className="w-[18px] h-[18px]" />
                  </span>
                  <span className="text-xs font-bold text-[var(--color-ink-400)]">Step {i + 1}</span>
                </div>
                <h3 className="font-display font-bold text-[var(--color-ink-900)] mb-1.5">{s.title}</h3>
                <p className="text-sm text-[var(--color-ink-500)] leading-relaxed">{s.desc}</p>
                <Link to={s.to} className="mt-auto pt-4 text-sm font-semibold text-[var(--color-violet-600)] hover:underline inline-flex items-center gap-1">
                  {s.cta} <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Recent reports ───────────────────────────────────────────────── */}
      <section className="pb-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
            <div>
              <h2 className="font-display font-bold text-2xl text-[var(--color-ink-900)]">Recently reported</h2>
              <p className="text-sm text-[var(--color-ink-500)] mt-1">Is one of these yours?</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex bg-[var(--color-canvas-dark)] p-1 rounded-lg" role="tablist">
                {[['found', 'Found items'], ['lost', 'Lost items']].map(([t, label]) => (
                  <button
                    key={t}
                    role="tab"
                    aria-selected={tab === t}
                    onClick={() => setTab(t)}
                    className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${tab === t ? 'bg-white shadow-sm text-[var(--color-ink-900)]' : 'text-[var(--color-ink-500)]'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <Link to={`/browse?type=${tab}`} className="btn btn-ghost btn-sm">View all <ArrowRight className="w-3.5 h-3.5" /></Link>
            </div>
          </div>

          {loading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => <div key={i} className="card p-4"><div className="skeleton h-40 w-full rounded-lg mb-3" /><div className="skeleton h-3 w-2/3" /></div>)}
            </div>
          ) : shown.length === 0 ? (
            <div className="card border border-dashed border-[var(--color-ink-200)] p-10 text-center">
              <p className="text-[var(--color-ink-500)]">No {tab} items reported yet.</p>
              <Link to={`/report/${tab}`} className="btn btn-primary btn-sm mt-4">Report one</Link>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {shown.map((item) => <ItemCard key={item._id} item={item} type={tab} />)}
            </div>
          )}
        </div>
      </section>

      <GetTheApp />
    </div>
  );
}
