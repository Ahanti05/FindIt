import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, MailCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { authApi, errorMessage } from '../services/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await authApi.forgotPassword(email);
      setResult(data);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Link to="/login" className="flex items-center gap-1.5 text-sm text-[var(--color-ink-500)] hover:text-[var(--color-ink-900)] mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to sign in
        </Link>

        {result ? (
          <div className="card border border-[var(--color-ink-100)] p-6">
            <MailCheck className="w-8 h-8 text-[var(--color-teal-600)] mb-3" />
            <h1 className="font-display font-bold text-xl text-[var(--color-ink-900)]">Check your email</h1>
            <p className="text-sm text-[var(--color-ink-500)] mt-1">{result.message}</p>
            {result.devResetUrl && (
              <div className="mt-4 rounded-lg bg-[var(--color-amber-50)] border border-[var(--color-amber-100)] p-3 text-sm text-[#92400e]">
                Email isn't configured on this server, so here is the link directly (development only):
                <Link to={result.devResetUrl} className="block font-semibold underline mt-1 break-all">Reset your password</Link>
              </div>
            )}
          </div>
        ) : (
          <>
            <h1 className="font-display font-bold text-2xl text-[var(--color-ink-900)]">Reset your password</h1>
            <p className="text-sm text-[var(--color-ink-500)] mt-1 mb-6">We'll email you a link that works for one hour.</p>
            <form onSubmit={submit} className="card border border-[var(--color-ink-100)] p-6 space-y-4">
              <div>
                <label className="label" htmlFor="email">Email</label>
                <input id="email" type="email" className="input" placeholder="you@university.edu" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <button type="submit" className="btn btn-primary w-full" disabled={loading || !email}>{loading ? 'Sending...' : 'Send reset link'}</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
