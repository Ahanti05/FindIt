import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { authApi } from '../services/api';
import toast from 'react-hot-toast';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      await authApi.forgotPassword(email);
      setSent(true);
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Link to="/login" className="flex items-center gap-2 text-sm text-[var(--color-ink-500)] hover:text-[var(--color-ink-900)] mb-8">
          <ArrowLeft className="w-4 h-4" /> Back to login
        </Link>

        {sent ? (
          <div className="card p-8 text-center border border-[var(--color-ink-100)]">
            <div className="w-14 h-14 rounded-full bg-[var(--color-teal-100)] flex items-center justify-center mx-auto mb-4 animate-check-pop">
              <CheckCircle2 className="w-7 h-7 text-[var(--color-teal-600)]" />
            </div>
            <h2 className="font-display font-bold text-xl text-[var(--color-ink-900)] mb-2">Check your inbox</h2>
            <p className="text-sm text-[var(--color-ink-500)]">
              If <strong>{email}</strong> is registered, you'll receive a reset link shortly.
            </p>
            <Link to="/login" className="btn btn-primary mt-6 w-full">Back to login</Link>
          </div>
        ) : (
          <>
            <h1 className="font-display font-bold text-2xl text-[var(--color-ink-900)] mb-2">Forgot your password?</h1>
            <p className="text-sm text-[var(--color-ink-500)] mb-8">Enter your email and we'll send a reset link.</p>

            <form onSubmit={handleSubmit} className="card p-8 border border-[var(--color-ink-100)] space-y-5">
              <div>
                <label className="label">Email address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-ink-300)]" />
                  <input
                    type="email"
                    className="input pl-9"
                    placeholder="you@university.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
              <button type="submit" className="btn btn-primary w-full" disabled={loading || !email}>
                {loading ? 'Sending...' : 'Send reset link'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
