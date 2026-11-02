import { Link } from 'react-router-dom';
import { Logo } from './Navbar';

export default function Footer() {
  return (
    <footer className="bg-[var(--color-ink-900)] text-[var(--color-ink-300)] mt-auto">
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="grid gap-8 sm:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Logo dark />
            <p className="text-sm leading-relaxed mt-4 max-w-xs">
              Campus lost &amp; found with photo matching. Built by Ahanti K Kadam, Maruf F Nadaf and Arman R Shaikh,
              Department of Computer Science Engineering.
            </p>
          </div>
          <div>
            <p className="text-xs font-bold text-white uppercase tracking-wider mb-3">Use FindIt</p>
            <ul className="space-y-2 text-sm">
              {[['Browse reports', '/browse'], ['Report a lost item', '/report/lost'], ['Report a found item', '/report/found'], ['Your dashboard', '/dashboard']].map(([label, to]) => (
                <li key={to}><Link to={to} className="hover:text-white transition-colors">{label}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-bold text-white uppercase tracking-wider mb-3">Project</p>
            <ul className="space-y-2 text-sm">
              <li><Link to="/#how-it-works" className="hover:text-white transition-colors">How matching works</Link></li>
              <li><Link to="/#get-the-app" className="hover:text-white transition-colors">Get the app</Link></li>
              <li><Link to="/coins" className="hover:text-white transition-colors">FindIt coins</Link></li>
              <li><a href="https://github.com/Ahanti05/FindIt" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">Source code</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-[var(--color-ink-800)] mt-8 pt-5 text-xs flex flex-col sm:flex-row gap-2 justify-between">
          <p>© {new Date().getFullYear()} FindIt project team</p>
          <p>YOLOv8 · CLIP ViT-B/32 · React · Node.js · MongoDB</p>
        </div>
      </div>
    </footer>
  );
}
