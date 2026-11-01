import { Link } from 'react-router-dom';
import { Search, ExternalLink, Link2, Mail } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-[var(--color-ink-900)] text-[var(--color-ink-300)] mt-auto">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-[var(--color-violet-600)] flex items-center justify-center">
                <Search className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
              </div>
              <span className="font-display font-bold text-white text-base">
                Find<span className="text-[var(--color-violet-400)]">It</span>
              </span>
            </div>
            <p className="text-sm leading-relaxed mb-4">
              AI-powered lost & found for your campus. Helping students, faculty and staff recover what matters.
            </p>
            <div className="flex gap-3">
            {[ExternalLink, Link2, Mail].map((Icon, i) => (
                <a key={i} href="#" className="w-8 h-8 rounded-lg bg-[var(--color-ink-800)] flex items-center justify-center hover:bg-[var(--color-violet-600)] transition-colors">
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Platform */}
          <div>
            <p className="text-xs font-bold text-white uppercase tracking-wider mb-4">Platform</p>
            <ul className="space-y-2.5">
              {[
                ['Browse Items', '/browse'],
                ['Report Lost', '/report/lost'],
                ['Report Found', '/report/found'],
                ['Dashboard', '/dashboard'],
              ].map(([label, to]) => (
                <li key={to}>
                  <Link to={to} className="text-sm hover:text-white transition-colors">{label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* How it works */}
          <div>
            <p className="text-xs font-bold text-white uppercase tracking-wider mb-4">How It Works</p>
            <ul className="space-y-2.5 text-sm">
              {['YOLO Detection', 'Visual Matching', 'Smart Notifications', 'Secure Recovery'].map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div>
            <p className="text-xs font-bold text-white uppercase tracking-wider mb-4">Support</p>
            <ul className="space-y-2.5">
              {[['About', '#'], ['Contact', '#'], ['Privacy Policy', '#'], ['Terms of Use', '#']].map(([label, href]) => (
                <li key={label}>
                  <a href={href} className="text-sm hover:text-white transition-colors">{label}</a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-[var(--color-ink-800)] mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs">© {new Date().getFullYear()} FindIt. Built for campus communities.</p>
          <p className="text-xs flex items-center gap-1.5">
            <span className="dot-live" />
            Powered by YOLOv8 · ResNet50 · Socket.IO
          </p>
        </div>
      </div>
    </footer>
  );
}
