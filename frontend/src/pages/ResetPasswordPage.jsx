import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authApi, errorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { FieldError } from '../components/ui';

export default function ResetPasswordPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (password.length < 8) { setError('Use at least 8 characters'); return; }
    if (password !== confirm) { setError('The passwords do not match'); return; }
    setLoading(true);
    try {
      const { data } = await authApi.resetPassword(token, password);
      setSession(data.token, data.user);
      toast.success('Password updated – you are signed in');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'Could not reset the password'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <h1 className="font-display font-bold text-2xl text-[var(--color-ink-900)]">Choose a new password</h1>
        <p className="text-sm text-[var(--color-ink-500)] mt-1 mb-6">At least 8 characters.</p>
        <form onSubmit={submit} className="card border border-[var(--color-ink-100)] p-6 space-y-4">
          <div><label className="label" htmlFor="p1">New password</label><input id="p1" type="password" className="input" value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }} autoComplete="new-password" /></div>
          <div><label className="label" htmlFor="p2">Repeat it</label><input id="p2" type="password" className="input" value={confirm} onChange={(e) => { setConfirm(e.target.value); setError(''); }} autoComplete="new-password" /></div>
          <FieldError>{error}</FieldError>
          <button type="submit" className="btn btn-primary w-full" disabled={loading}>{loading ? 'Saving...' : 'Save password'}</button>
        </form>
        <p className="text-center text-sm text-[var(--color-ink-500)] mt-5"><Link to="/forgot-password" className="text-[var(--color-violet-600)] font-semibold hover:underline">Request a new link</Link></p>
      </div>
    </div>
  );
}
