import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const e = {};
    if (!form.email) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Enter a valid email';
    if (!form.password) e.password = 'Password is required';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setLoading(true);
    try {
      await login(form.email, form.password);
      toast.success('Welcome back!');
      navigate('/dashboard');
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed. Please try again.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex">
      {/* Left visual panel */}
      <div className="hidden lg:flex flex-1 bg-[var(--color-ink-900)] items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-[var(--color-violet-600)] opacity-15 blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-48 h-48 rounded-full bg-[var(--color-teal-500)] opacity-15 blur-3xl" />
        </div>
        <div className="relative text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-violet-600)] flex items-center justify-center mx-auto mb-6">
            <Search className="w-8 h-8 text-white" strokeWidth={2.5} />
          </div>
          <h2 className="font-display font-bold text-3xl text-white mb-3">FindIt</h2>
          <p className="text-[var(--color-ink-300)] leading-relaxed">
            Your campus lost & found platform, powered by AI.
          </p>
          <div className="mt-10 space-y-3 text-left">
            {['YOLOv8 object detection', 'Visual similarity matching', 'Secure recovery workflow', 'Real-time notifications'].map((f) => (
              <div key={f} className="flex items-center gap-3 text-sm text-[var(--color-ink-300)]">
                <span className="w-5 h-5 rounded-full bg-[var(--color-violet-600)] flex items-center justify-center shrink-0">
                  <span className="text-white text-[10px]">✓</span>
                </span>
                {f}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          <div className="mb-8">
            <h1 className="font-display font-bold text-2xl text-[var(--color-ink-900)]">Welcome back</h1>
            <p className="text-sm text-[var(--color-ink-500)] mt-1">Sign in to your FindIt account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div>
              <label className="label">Email address</label>
              <input
                type="email"
                className={`input ${errors.email ? 'input-error' : ''}`}
                placeholder="you@university.edu"
                value={form.email}
                onChange={(e) => { setForm({ ...form, email: e.target.value }); setErrors({ ...errors, email: '' }); }}
                autoComplete="email"
              />
              {errors.email && <p className="text-xs text-[var(--color-red-500)] mt-1">{errors.email}</p>}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="label mb-0">Password</label>
                <Link to="/forgot-password" className="text-xs text-[var(--color-violet-600)] hover:underline">Forgot password?</Link>
              </div>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  className={`input pr-10 ${errors.password ? 'input-error' : ''}`}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => { setForm({ ...form, password: e.target.value }); setErrors({ ...errors, password: '' }); }}
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-300)] hover:text-[var(--color-ink-700)]">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-[var(--color-red-500)] mt-1">{errors.password}</p>}
            </div>

            <button type="submit" className="btn btn-primary w-full btn-lg" disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="20" />
                  </svg>
                  Signing in...
                </span>
              ) : 'Sign in'}
            </button>
          </form>

          <div className="divider my-6">or</div>

          <p className="text-center text-sm text-[var(--color-ink-500)]">
            Don't have an account?{' '}
            <Link to="/register" className="text-[var(--color-violet-600)] font-semibold hover:underline">Create one free</Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
