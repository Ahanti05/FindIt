import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const DEPARTMENTS = [
  'Computer Science', 'Engineering', 'Business', 'Arts & Humanities',
  'Natural Sciences', 'Law', 'Medicine', 'Architecture', 'Education', 'Other'
];

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', studentId: '', department: '', role: 'student' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const set = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setErrors((err) => ({ ...err, [field]: '' }));
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Full name is required';
    if (!form.email) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Enter a valid email';
    if (!form.password) e.password = 'Password is required';
    else if (form.password.length < 8) e.password = 'Minimum 8 characters';
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setLoading(true);
    try {
      await register({ name: form.name, email: form.email, password: form.password, studentId: form.studentId, department: form.department, role: form.role });
      toast.success('Account created! Welcome to FindIt.');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const pwStrength = form.password.length >= 12 ? 'strong' : form.password.length >= 8 ? 'medium' : form.password.length > 0 ? 'weak' : '';
  const strengthColor = { strong: 'bg-green-500', medium: 'bg-amber-400', weak: 'bg-red-400' };
  const strengthWidth = { strong: 'w-full', medium: 'w-2/3', weak: 'w-1/3' };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-lg"
      >
        <div className="mb-8 text-center">
          <h1 className="font-display font-bold text-2xl text-[var(--color-ink-900)]">Create your account</h1>
          <p className="text-sm text-[var(--color-ink-500)] mt-1">Join FindIt — free for all campus members</p>
        </div>

        <div className="card p-8 border border-[var(--color-ink-100)]">
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {/* Name */}
            <div>
              <label className="label">Full name</label>
              <input className={`input ${errors.name ? 'input-error' : ''}`} placeholder="Alex Johnson" value={form.name} onChange={set('name')} />
              {errors.name && <p className="text-xs text-[var(--color-red-500)] mt-1">{errors.name}</p>}
            </div>

            {/* Email */}
            <div>
              <label className="label">University email</label>
              <input type="email" className={`input ${errors.email ? 'input-error' : ''}`} placeholder="alex@university.edu" value={form.email} onChange={set('email')} />
              {errors.email && <p className="text-xs text-[var(--color-red-500)] mt-1">{errors.email}</p>}
            </div>

            {/* Student ID + Role */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Student / Staff ID <span className="text-[var(--color-ink-300)]">(optional)</span></label>
                <input className="input" placeholder="20CS001" value={form.studentId} onChange={set('studentId')} />
              </div>
              <div>
                <label className="label">Role</label>
                <select className="input" value={form.role} onChange={set('role')}>
                  <option value="student">Student</option>
                  <option value="faculty">Faculty</option>
                  <option value="staff">Staff</option>
                </select>
              </div>
            </div>

            {/* Department */}
            <div>
              <label className="label">Department <span className="text-[var(--color-ink-300)]">(optional)</span></label>
              <select className="input" value={form.department} onChange={set('department')}>
                <option value="">Select department</option>
                {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            {/* Password */}
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  className={`input pr-10 ${errors.password ? 'input-error' : ''}`}
                  placeholder="Min. 8 characters"
                  value={form.password}
                  onChange={set('password')}
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-300)]">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {pwStrength && (
                <div className="mt-2">
                  <div className="match-bar-track"><div className={`match-bar-fill ${strengthColor[pwStrength]} ${strengthWidth[pwStrength]}`} /></div>
                  <p className={`text-xs mt-1 capitalize ${pwStrength === 'strong' ? 'text-green-600' : pwStrength === 'medium' ? 'text-amber-600' : 'text-red-500'}`}>{pwStrength} password</p>
                </div>
              )}
              {errors.password && <p className="text-xs text-[var(--color-red-500)] mt-1">{errors.password}</p>}
            </div>

            {/* Confirm password */}
            <div>
              <label className="label">Confirm password</label>
              <input
                type="password"
                className={`input ${errors.confirmPassword ? 'input-error' : ''}`}
                placeholder="Re-enter password"
                value={form.confirmPassword}
                onChange={set('confirmPassword')}
                autoComplete="new-password"
              />
              {errors.confirmPassword && <p className="text-xs text-[var(--color-red-500)] mt-1">{errors.confirmPassword}</p>}
              {form.confirmPassword && form.confirmPassword === form.password && (
                <p className="text-xs text-green-600 mt-1 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Passwords match</p>
              )}
            </div>

            <button type="submit" className="btn btn-primary w-full btn-lg" disabled={loading}>
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-[var(--color-ink-500)] mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-[var(--color-violet-600)] font-semibold hover:underline">Sign in</Link>
        </p>
      </motion.div>
    </div>
  );
}
