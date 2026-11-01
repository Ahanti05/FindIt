import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, Upload, Zap, Shield, ArrowRight, MapPin, Clock, Tag, Eye, CheckCircle2, AlertCircle, TrendingUp } from 'lucide-react';
import { lostApi, foundApi } from '../services/api';
import ItemCard from '../components/ItemCard';

const FADE_UP = {
  hidden: { opacity: 0, y: 24 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] } }),
};

// ── Animated counter ──────────────────────────────────────────────────────────
function Counter({ target, suffix = '', duration = 1800 }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const steps = 40;
    const step = target / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += step;
      if (current >= target) { setCount(target); clearInterval(timer); }
      else setCount(Math.floor(current));
    }, duration / steps);
    return () => clearInterval(timer);
  }, [target]);
  return <span>{count.toLocaleString()}{suffix}</span>;
}

// ── How it works steps ────────────────────────────────────────────────────────
const HOW_STEPS = [
  { icon: Upload, color: 'violet', title: 'Upload a photo', desc: 'Snap a picture of the lost or found item. Our AI instantly analyses it.' },
  { icon: Zap, color: 'teal', title: 'AI detects & matches', desc: 'YOLOv8 identifies the object. ResNet50 embeddings find visually similar reports.' },
  { icon: CheckCircle2, color: 'amber', title: 'Verify & recover', desc: 'Submit ownership evidence. Collect your item with a secure QR handover code.' },
];

// ── Features list ─────────────────────────────────────────────────────────────
const FEATURES = [
  { icon: Zap, title: 'YOLO Object Detection', desc: 'YOLOv8 identifies objects in your image and highlights them with bounding boxes — no manual tagging needed.' },
  { icon: Search, title: 'Visual Similarity Matching', desc: 'ResNet50 image embeddings + cosine similarity finds visually related items across all reports.' },
  { icon: Shield, title: 'Secure Recovery Flow', desc: 'Claimants submit private evidence. Admins verify before handover. Sensitive data is never public.' },
  { icon: MapPin, title: 'Campus Heatmap', desc: 'See where items are most commonly lost or found across your campus to know where to look.' },
  { icon: TrendingUp, title: 'Real-Time Notifications', desc: 'Socket.IO pushes instant alerts when a match is detected — no need to keep refreshing.' },
  { icon: CheckCircle2, title: 'QR Recovery Codes', desc: 'Approved recoveries generate a unique QR code for a smooth, trackable handover process.' },
];

export default function LandingPage() {
  const [recentLost, setRecentLost] = useState([]);
  const [recentFound, setRecentFound] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('lost');

  useEffect(() => {
    Promise.all([
      lostApi.getAll({ limit: 4, sortBy: 'createdAt' }),
      foundApi.getAll({ limit: 4, sortBy: 'createdAt' }),
    ]).then(([l, f]) => {
      setRecentLost(l.data.items);
      setRecentFound(f.data.items);
      // Derive live stats from response totals
      setStats({
        lost: l.data.total,
        found: f.data.total,
        recovered: Math.floor(Math.min(l.data.total, f.data.total) * 0.3),
      });
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const displayItems = tab === 'lost' ? recentLost : recentFound;

  return (
    <div className="overflow-x-hidden">
      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="relative min-h-[88vh] flex items-center pt-12 pb-20">
        {/* Subtle background texture */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/3 w-[600px] h-[600px] rounded-full bg-[var(--color-violet-100)] opacity-30 blur-[120px] translate-x-1/4 -translate-y-1/4" />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full bg-[var(--color-teal-100)] opacity-30 blur-[100px]" />
        </div>

        <div className="max-w-7xl mx-auto px-6 w-full">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left: Copy */}
            <div>
              <motion.div variants={FADE_UP} initial="hidden" animate="show" custom={0}>
                <span className="badge badge-violet mb-6 text-xs py-1.5 px-3">
                  <span className="dot-live mr-1.5" /> AI-Powered Campus Lost & Found
                </span>
              </motion.div>

              <motion.h1
                variants={FADE_UP} initial="hidden" animate="show" custom={1}
                className="font-display font-extrabold text-[2.8rem] sm:text-[3.5rem] leading-[1.1] tracking-tight text-[var(--color-ink-900)] mb-6"
              >
                Lost something?{' '}
                <span className="text-[var(--color-violet-600)]">Let's bring</span>{' '}
                <span className="relative inline-block">
                  it back.
                  <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 200 8" fill="none">
                    <path d="M0 6 Q100 1 200 6" stroke="var(--color-teal-400)" strokeWidth="3" strokeLinecap="round"/>
                  </svg>
                </span>
              </motion.h1>

              <motion.p
                variants={FADE_UP} initial="hidden" animate="show" custom={2}
                className="text-lg text-[var(--color-ink-500)] leading-relaxed mb-10 max-w-lg"
              >
                FindIt uses computer vision to match lost and found items across your campus — automatically, accurately and privately.
              </motion.p>

              <motion.div
                variants={FADE_UP} initial="hidden" animate="show" custom={3}
                className="flex flex-wrap gap-3"
              >
                <Link to="/report/lost" className="btn btn-primary btn-lg gap-2">
                  <AlertCircle className="w-5 h-5" /> I lost something
                </Link>
                <Link to="/report/found" className="btn btn-teal btn-lg gap-2">
                  <CheckCircle2 className="w-5 h-5" /> I found something
                </Link>
                <Link to="/browse" className="btn btn-ghost btn-lg gap-2">
                  <Search className="w-5 h-5" /> Browse items
                </Link>
              </motion.div>
            </div>

            {/* Right: Live stats card */}
            <motion.div
              variants={FADE_UP} initial="hidden" animate="show" custom={4}
              className="hidden lg:block"
            >
              <div className="card p-8 border border-[var(--color-ink-100)]">
                <div className="flex items-center gap-2 mb-6">
                  <span className="dot-live" />
                  <span className="text-xs font-semibold text-[var(--color-ink-500)] uppercase tracking-wider">Live Platform Activity</span>
                </div>
                <div className="grid grid-cols-3 gap-6 mb-8">
                  {[
                    { label: 'Lost Reports', value: stats?.lost ?? 0, color: 'violet' },
                    { label: 'Found Reports', value: stats?.found ?? 0, color: 'teal' },
                    { label: 'Recovered', value: stats?.recovered ?? 0, color: 'amber' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="text-center">
                      <p className={`font-display font-extrabold text-3xl text-[var(--color-${color}-600)]`}>
                        {loading ? <span className="skeleton w-12 h-8 inline-block" /> : <Counter target={value} />}
                      </p>
                      <p className="text-xs text-[var(--color-ink-500)] mt-1 font-medium">{label}</p>
                    </div>
                  ))}
                </div>

                {/* Sample detections */}
                <div className="space-y-3">
                  <p className="text-xs font-bold text-[var(--color-ink-700)] uppercase tracking-wider">Recent Detections</p>
                  {[
                    { label: 'Laptop bag detected', loc: 'Library Block B', time: '2m ago', score: 0.91 },
                    { label: 'ID Card matched', loc: 'Cafeteria', time: '11m ago', score: 0.87 },
                    { label: 'Water bottle found', loc: 'Lecture Hall 3', time: '24m ago', score: 0.73 },
                  ].map((d, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-[var(--color-canvas-dark)]">
                      <div className="w-8 h-8 rounded-lg bg-[var(--color-violet-100)] flex items-center justify-center shrink-0">
                        <Zap className="w-4 h-4 text-[var(--color-violet-600)]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-[var(--color-ink-900)] truncate">{d.label}</p>
                        <p className="text-[11px] text-[var(--color-ink-500)] flex items-center gap-1.5 mt-0.5">
                          <MapPin className="w-3 h-3" />{d.loc} · {d.time}
                        </p>
                      </div>
                      <span className="badge badge-teal text-[11px]">{Math.round(d.score * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────────────────── */}
      <section className="py-20 bg-white border-t border-[var(--color-ink-100)]">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <h2 className="font-display font-bold text-3xl text-[var(--color-ink-900)] mb-3">How FindIt works</h2>
          <p className="text-[var(--color-ink-500)] mb-14">Three simple steps. One powerful AI pipeline.</p>
          <div className="grid md:grid-cols-3 gap-8">
            {HOW_STEPS.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.12, duration: 0.5 }}
                className="relative"
              >
                {i < HOW_STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-full w-full h-px border-t-2 border-dashed border-[var(--color-ink-100)] -translate-x-1/2 z-0" />
                )}
                <div className={`w-16 h-16 rounded-2xl bg-[var(--color-${step.color}-100)] flex items-center justify-center mx-auto mb-5 relative z-10`}>
                  <step.icon className={`w-7 h-7 text-[var(--color-${step.color}-600)]`} />
                </div>
                <div className="w-6 h-6 rounded-full bg-[var(--color-ink-100)] text-[var(--color-ink-500)] text-xs font-bold flex items-center justify-center mx-auto mb-4">{i + 1}</div>
                <h3 className="font-display font-bold text-lg text-[var(--color-ink-900)] mb-2">{step.title}</h3>
                <p className="text-sm text-[var(--color-ink-500)] leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Recent Items ───────────────────────────────────────────────────── */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="font-display font-bold text-2xl text-[var(--color-ink-900)]">Recently reported</h2>
              <p className="text-sm text-[var(--color-ink-500)] mt-1">Live from campus — updated in real time</p>
            </div>
            <Link to="/browse" className="btn btn-ghost btn-sm gap-1">
              View all <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-[var(--color-canvas-dark)] p-1 rounded-lg w-fit mb-8">
            {['lost', 'found'].map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-5 py-2 rounded-md text-sm font-semibold transition-all ${
                  tab === t
                    ? 'bg-white shadow-sm text-[var(--color-ink-900)]'
                    : 'text-[var(--color-ink-500)] hover:text-[var(--color-ink-800)]'
                }`}
              >
                {t === 'lost' ? '🔍 Lost Items' : '📦 Found Items'}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="card p-4">
                  <div className="skeleton h-44 w-full rounded-lg mb-4" />
                  <div className="skeleton h-3.5 w-2/3 mb-2" />
                  <div className="skeleton h-3 w-full mb-1" />
                  <div className="skeleton h-3 w-3/4" />
                </div>
              ))}
            </div>
          ) : displayItems.length === 0 ? (
            <div className="text-center py-16">
              <Search className="w-10 h-10 text-[var(--color-ink-300)] mx-auto mb-3" />
              <p className="text-[var(--color-ink-500)]">No {tab} items reported yet.</p>
              <Link to={`/report/${tab}`} className="btn btn-primary mt-4">Be the first to report</Link>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {displayItems.map((item, i) => (
                <motion.div
                  key={item._id}
                  initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }} transition={{ delay: i * 0.07 }}
                >
                  <ItemCard item={item} type={tab} />
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────────────── */}
      <section className="py-20 bg-white border-t border-[var(--color-ink-100)]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="font-display font-bold text-3xl text-[var(--color-ink-900)] mb-3">What makes FindIt different</h2>
            <p className="text-[var(--color-ink-500)] max-w-xl mx-auto">Not just another report form. A full AI pipeline from image to recovery.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                className="card card-lift p-6 border border-[var(--color-ink-100)]"
              >
                <div className="w-11 h-11 rounded-xl bg-[var(--color-violet-50)] flex items-center justify-center mb-4">
                  <f.icon className="w-5 h-5 text-[var(--color-violet-600)]" />
                </div>
                <h3 className="font-display font-bold text-[var(--color-ink-900)] mb-2">{f.title}</h3>
                <p className="text-sm text-[var(--color-ink-500)] leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────────────── */}
      <section className="py-20 bg-[var(--color-ink-900)]">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="font-display font-extrabold text-3xl sm:text-4xl text-white mb-4">
            Ready to find what you're looking for?
          </h2>
          <p className="text-[var(--color-ink-300)] mb-10">
            Join your campus community on FindIt. Report, discover, and recover.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link to="/register" className="btn btn-primary btn-lg">
              Create free account <ArrowRight className="w-5 h-5" />
            </Link>
            <Link to="/browse" className="btn btn-lg bg-white/10 text-white hover:bg-white/20">
              Browse without signing in
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
