import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Owl from '../components/Owl';

export default function NotFoundPage() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <Owl mood="search" size={150} bob className="mx-auto mb-4" />
        <p className="font-display font-extrabold text-5xl text-[var(--color-ink-200)]">404</p>
        <h1 className="font-display font-bold text-2xl text-[var(--color-ink-900)] mt-2">Hoot looked everywhere</h1>
        <p className="text-sm text-[var(--color-ink-500)] leading-relaxed mt-2 mb-7">
          This page isn't here – maybe it got lost on campus too.
        </p>
        <div className="flex gap-3 justify-center">
          <Link to="/" className="btn btn-primary"><ArrowLeft className="w-4 h-4" /> Back to FindIt</Link>
          <Link to="/browse" className="btn btn-ghost">Browse reports</Link>
        </div>
      </div>
    </div>
  );
}
