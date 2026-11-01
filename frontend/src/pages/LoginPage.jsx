import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useMeta } from '../context/MetaContext';
import { errorMessage } from '../services/api';
import { FieldError } from '../components/ui';

// Accounts created by backend/seed/seed.js – only offered when the backend runs with DEMO_MODE=true.
const DEMO_ACCOUNTS = [
  ['Arun (student, lost a wallet)', 'arun@university.edu', 'Test@1234'],
  ['Priya (student, lost an ID card)', 'priya@university.edu', 'Test@1234'],
  ['Campus Security (finder)', 'security@university.edu', 'Test@1234'],
  ['Admin office', 'admin@findit.campus', 'Admin@1234'],
];

export default function LoginPage() {
  const { login } = useAuth();
  const { demoMode } = useMeta();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const signIn = async (email, password) => {
    setLoading(true);
    setError('');
    try {
      const user = await login(email, password);
      toast.success(`Signed in as ${user.name.split(' ')[0]}`);
      navigate(location.state?.from || (user.role === 'admin' ? '/admin' : '/dashboard'), { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'Could not sign in'));
    } finally {
      setLoading(false);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    if (!form.email || !form.password) { setError('Enter your email and password'); return; }
    signIn(form.email, form.password);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <h1 className="font-display font-bold text-2xl text-[var(--color-ink-900)]">Sign in to FindIt</h1>
        <p className="text-sm text-[var(--color-ink-500)] mt-1 mb-6">Use your campus email.</p>

        <form onSubmit={submit} className="card border border-[var(--color-ink-100)] p-6 space-y-4" noValidate>
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" type="email" className="input" placeholder="you@university.edu" autoComplete="email"
              value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="label mb-0" htmlFor="password">Password</label>
              <Link to="/forgot-password" className="text-xs font-semibold text-[var(--color-violet-600)] hover:underline">Forgot password?</Link>
            </div>
            <div className="relative">
              <input id="password" type={showPw ? 'text' : 'password'} className="input pr-10" autoComplete="current-password"
                value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)]" aria-label={showPw ? 'Hide password' : 'Show password'}>
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <FieldError>{error}</FieldError>
          <button type="submit" className="btn btn-primary w-full" disabled={loading}>
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in...</> : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-sm text-[var(--color-ink-500)] mt-5">
          New here? <Link to="/register" className="text-[var(--color-violet-600)] font-semibold hover:underline">Create an account</Link>
        </p>

        {demoMode && (
          <div className="mt-8 border border-dashed border-[var(--color-ink-200)] rounded-xl p-4">
            <p className="text-xs font-bold text-[var(--color-ink-500)] uppercase tracking-wider mb-2">Demo accounts</p>
            <div className="grid gap-1.5">
              {DEMO_ACCOUNTS.map(([label, email, password]) => (
                <button key={email} type="button" disabled={loading} onClick={() => signIn(email, password)}
                  className="text-left text-sm px-3 py-2 rounded-lg hover:bg-[var(--color-canvas-dark)] flex justify-between gap-3">
                  <span className="font-semibold text-[var(--color-ink-800)]">{label}</span>
                  <span className="text-[var(--color-ink-400)] truncate">{email}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
