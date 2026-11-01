import { useState, useRef } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { authApi, errorMessage } from '../services/api';
import { Avatar, FieldError } from '../components/ui';

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const fileRef = useRef(null);
  const [form, setForm] = useState({
    name: user?.name || '',
    studentId: user?.studentId || '',
    department: user?.department || '',
    phone: user?.phone || '',
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [pwError, setPwError] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  const set = (f) => (e) => setForm((s) => ({ ...s, [f]: e.target.value }));
  const setP = (f) => (e) => { setPw((s) => ({ ...s, [f]: e.target.value })); setPwError(''); };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await authApi.updateProfile(form);
      updateUser(data.user);
      toast.success('Profile saved');
    } catch (err) {
      toast.error(errorMessage(err, 'Could not save'));
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error('Image must be under 10 MB'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('avatar', file);
      const { data } = await authApi.updateProfile(fd);
      updateUser(data.user);
      toast.success('Photo updated');
    } catch (err) {
      toast.error(errorMessage(err, 'Upload failed'));
    } finally {
      setUploading(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (pw.newPassword.length < 8) { setPwError('New password must be at least 8 characters'); return; }
    if (pw.newPassword !== pw.confirm) { setPwError('The new passwords do not match'); return; }
    setPwSaving(true);
    try {
      await authApi.changePassword({ currentPassword: pw.currentPassword, newPassword: pw.newPassword });
      toast.success('Password changed');
      setPw({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      setPwError(errorMessage(err, 'Could not change password'));
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-5">
      <h1 className="font-display font-bold text-2xl text-[var(--color-ink-900)]">Profile</h1>

      <div className="card border border-[var(--color-ink-100)] p-5 flex items-center gap-4">
        <div className="relative">
          <Avatar user={user} size="w-16 h-16" text="text-2xl" />
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white border border-[var(--color-ink-100)] shadow flex items-center justify-center" aria-label="Change photo">
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5 text-[var(--color-ink-600)]" />}
          </button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={uploadAvatar} />
        </div>
        <div className="min-w-0">
          <p className="font-display font-bold text-lg text-[var(--color-ink-900)] truncate">{user?.name}</p>
          <p className="text-sm text-[var(--color-ink-500)] truncate">{user?.email}</p>
          <span className="badge badge-neutral capitalize mt-1">{user?.role}</span>
        </div>
      </div>

      <form onSubmit={save} className="card border border-[var(--color-ink-100)] p-5 space-y-4">
        <h2 className="font-bold text-[var(--color-ink-900)]">Your details</h2>
        <div><label className="label" htmlFor="name">Full name</label><input id="name" className="input" value={form.name} onChange={set('name')} required maxLength={80} /></div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div><label className="label" htmlFor="sid">Student / staff ID</label><input id="sid" className="input" value={form.studentId} onChange={set('studentId')} /></div>
          <div><label className="label" htmlFor="dept">Department</label><input id="dept" className="input" value={form.department} onChange={set('department')} /></div>
        </div>
        <div>
          <label className="label" htmlFor="phone">Phone <span className="font-normal text-[var(--color-ink-400)]">(never shown to other users)</span></label>
          <input id="phone" className="input" value={form.phone} onChange={set('phone')} placeholder="+91" />
        </div>
        <button type="submit" disabled={saving} className="btn btn-primary">{saving ? 'Saving...' : 'Save details'}</button>
      </form>

      <form onSubmit={changePassword} className="card border border-[var(--color-ink-100)] p-5 space-y-4">
        <h2 className="font-bold text-[var(--color-ink-900)]">Change password</h2>
        <div><label className="label" htmlFor="cur">Current password</label><input id="cur" type="password" className="input" value={pw.currentPassword} onChange={setP('currentPassword')} autoComplete="current-password" required /></div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div><label className="label" htmlFor="np">New password</label><input id="np" type="password" className="input" value={pw.newPassword} onChange={setP('newPassword')} autoComplete="new-password" required /></div>
          <div><label className="label" htmlFor="cp">Repeat new password</label><input id="cp" type="password" className="input" value={pw.confirm} onChange={setP('confirm')} autoComplete="new-password" required /></div>
        </div>
        <FieldError>{pwError}</FieldError>
        <button type="submit" disabled={pwSaving} className="btn btn-ghost">{pwSaving ? 'Updating...' : 'Update password'}</button>
      </form>
    </div>
  );
}
