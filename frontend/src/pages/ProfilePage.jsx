import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../services/api';
import { User, Mail, BookOpen, Phone, Bell, Lock, CheckCircle2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState({
    name: user?.name || '',
    studentId: user?.studentId || '',
    department: user?.department || '',
    phone: user?.phone || '',
    notificationPreferences: user?.notificationPreferences || { email: true, inApp: true },
  });
  const [saving, setSaving] = useState(false);
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const setPw = (field) => (e) => setPwForm((f) => ({ ...f, [field]: e.target.value }));

  const saveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await authApi.updateProfile(form);
      updateUser(data.user);
      toast.success('Profile updated!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="font-display font-bold text-2xl text-[var(--color-ink-900)] mb-8">Your Profile</h1>

      {/* Avatar */}
      <div className="card border border-[var(--color-ink-100)] p-6 flex items-center gap-5 mb-5">
        <div className="w-16 h-16 rounded-2xl bg-[var(--color-violet-100)] flex items-center justify-center text-2xl font-bold text-[var(--color-violet-600)]">
          {user?.name?.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="font-display font-bold text-lg text-[var(--color-ink-900)]">{user?.name}</p>
          <p className="text-sm text-[var(--color-ink-500)]">{user?.email}</p>
          <span className="badge badge-violet capitalize mt-1">{user?.role}</span>
        </div>
      </div>

      {/* Profile form */}
      <form onSubmit={saveProfile} className="card border border-[var(--color-ink-100)] p-6 space-y-5 mb-5">
        <h2 className="font-bold text-base text-[var(--color-ink-900)]">Personal Information</h2>

        <div>
          <label className="label">Full name</label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-ink-300)]" />
            <input className="input pl-9" value={form.name} onChange={set('name')} />
          </div>
        </div>

        <div>
          <label className="label">Student / Staff ID</label>
          <div className="relative">
            <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-ink-300)]" />
            <input className="input pl-9" placeholder="e.g. 20CS001" value={form.studentId} onChange={set('studentId')} />
          </div>
        </div>

        <div>
          <label className="label">Department</label>
          <input className="input" value={form.department} onChange={set('department')} />
        </div>

        <div>
          <label className="label">Phone <span className="text-[var(--color-ink-300)]">(private)</span></label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-ink-300)]" />
            <input className="input pl-9" placeholder="+91 9000000000" value={form.phone} onChange={set('phone')} />
          </div>
        </div>

        <div>
          <label className="label">Notification preferences</label>
          <div className="space-y-2">
            {[
              { key: 'inApp', label: 'In-app notifications' },
              { key: 'email', label: 'Email notifications' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-[var(--color-violet-600)]"
                  checked={form.notificationPreferences[key]}
                  onChange={(e) => setForm((f) => ({
                    ...f,
                    notificationPreferences: { ...f.notificationPreferences, [key]: e.target.checked }
                  }))}
                />
                <span className="text-sm font-medium text-[var(--color-ink-700)]">{label}</span>
              </label>
            ))}
          </div>
        </div>

        <button type="submit" className="btn btn-primary gap-2" disabled={saving}>
          {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><CheckCircle2 className="w-4 h-4" /> Save changes</>}
        </button>
      </form>

      {/* Password section – UI only, backend email-flow required */}
      <div className="card border border-[var(--color-ink-100)] p-6">
        <h2 className="font-bold text-base text-[var(--color-ink-900)] mb-4 flex items-center gap-2">
          <Lock className="w-4 h-4" /> Change Password
        </h2>
        <p className="text-sm text-[var(--color-ink-500)] mb-4">
          To change your password, use the "Forgot password" flow. An email reset link will be sent to your registered address.
        </p>
        <a href="/forgot-password" className="btn btn-ghost btn-sm">Send reset link →</a>
      </div>
    </div>
  );
}
