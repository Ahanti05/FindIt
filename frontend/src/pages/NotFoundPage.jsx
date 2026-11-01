import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, ArrowLeft } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-md"
      >
        <div className="w-20 h-20 rounded-2xl bg-[var(--color-violet-100)] flex items-center justify-center mx-auto mb-6">
          <Search className="w-9 h-9 text-[var(--color-violet-500)]" />
        </div>
        <p className="text-6xl font-display font-extrabold text-[var(--color-ink-100)] mb-2">404</p>
        <h1 className="font-display font-bold text-2xl text-[var(--color-ink-900)] mb-3">Page not found</h1>
        <p className="text-sm text-[var(--color-ink-500)] leading-relaxed mb-8">
          Looks like this page got lost — just like an item on campus. Let's get you back on track.
        </p>
        <div className="flex gap-3 justify-center">
          <Link to="/" className="btn btn-primary gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to FindIt
          </Link>
          <Link to="/browse" className="btn btn-ghost gap-2">
            Browse items
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
