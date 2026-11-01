import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import { Upload, X, CheckCircle2, MapPin, Calendar, Loader2, ChevronDown, AlertCircle } from 'lucide-react';
import { foundApi } from '../services/api';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

const CATEGORIES = [
  'ID Card', 'Wallet', 'Keys', 'Phone', 'Laptop', 'Bag/Backpack',
  'Watch', 'Earphones/AirPods', 'Charger/Cable', 'Water Bottle',
  'Umbrella', 'Glasses', 'Clothing', 'Books/Notes', 'Jewelry', 'Other',
];

const BUILDINGS = [
  'Main Library', 'Science Block', 'Engineering Block', 'Arts Building',
  'Student Center', 'Cafeteria', 'Admin Block', 'Sports Complex',
  'Hostel A', 'Hostel B', 'Lecture Hall Complex', 'Computer Labs', 'Other',
];

const HANDOVER_OPTIONS = [
  { value: 'lost-found-office', label: 'Lost & Found Office' },
  { value: 'security-desk', label: 'Security Desk' },
  { value: 'in-person', label: 'In Person (coordinate via app)' },
  { value: 'other', label: 'Other (describe in notes)' },
];

const STEP_LABELS = ['Item Details', 'Where Found', 'Photo', 'Handover'];

export default function ReportFoundPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    title: '', category: '', description: '',
    building: '', area: '', foundDate: '', foundTime: '',
    currentLocation: '', handoverPreference: 'lost-found-office', colors: '',
  });
  const [errors, setErrors] = useState({});
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  const set = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setErrors((er) => ({ ...er, [field]: '' }));
  };

  const onDrop = useCallback((accepted) => {
    const file = accepted[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
  });

  const validateStep = () => {
    const e = {};
    if (step === 0) {
      if (!form.title.trim()) e.title = 'Item name is required';
      if (!form.category) e.category = 'Please select a category';
    }
    if (step === 1) {
      if (!form.building) e.building = 'Location is required';
      if (!form.foundDate) e.foundDate = 'Date found is required';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => { if (validateStep()) setStep((s) => s + 1); };
  const back = () => setStep((s) => s - 1);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v); });
      if (imageFile) fd.append('image', imageFile);
      const { data } = await foundApi.create(fd);
      toast.success('Found item report submitted! Thank you! 🙏');
      navigate(`/items/found/${data.item._id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
      <div className="mb-8">
        <span className="badge badge-teal mb-3 text-xs">Report Found Item</span>
        <h1 className="font-display font-bold text-2xl text-[var(--color-ink-900)]">Found something?</h1>
        <p className="text-sm text-[var(--color-ink-500)] mt-1">Help reunite it with its owner.</p>
      </div>

      {/* Progress */}
      <div className="mb-8">
        <div className="flex items-center gap-2">
          {STEP_LABELS.map((label, i) => (
            <div key={i} className="flex items-center gap-2 flex-1">
              <div className={clsx(
                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all',
                i < step ? 'bg-[var(--color-teal-500)] text-white' :
                i === step ? 'bg-[var(--color-teal-600)] text-white' :
                'bg-[var(--color-ink-100)] text-[var(--color-ink-500)]'
              )}>
                {i < step ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span className={clsx('text-xs font-semibold hidden sm:block', i === step ? 'text-[var(--color-teal-600)]' : 'text-[var(--color-ink-300)]')}>{label}</span>
              {i < STEP_LABELS.length - 1 && <div className="flex-1 h-px bg-[var(--color-ink-100)]" />}
            </div>
          ))}
        </div>
      </div>

      <div className="card border border-[var(--color-ink-100)] p-6 sm:p-8">
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25 }}>

            {step === 0 && (
              <div className="space-y-5">
                <div>
                  <label className="label">Item name *</label>
                  <input className={`input ${errors.title ? 'input-error' : ''}`} placeholder="e.g. Black leather wallet" value={form.title} onChange={set('title')} />
                  {errors.title && <p className="text-xs text-[var(--color-red-500)] mt-1">{errors.title}</p>}
                </div>
                <div>
                  <label className="label">Category *</label>
                  <div className="relative">
                    <select className={`input appearance-none pr-8 ${errors.category ? 'input-error' : ''}`} value={form.category} onChange={set('category')}>
                      <option value="">Select a category</option>
                      {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-ink-300)] pointer-events-none" />
                  </div>
                  {errors.category && <p className="text-xs text-[var(--color-red-500)] mt-1">{errors.category}</p>}
                </div>
                <div>
                  <label className="label">Description</label>
                  <textarea className="input min-h-[90px] resize-y" placeholder="Brand, color, condition, any visible markings..." value={form.description} onChange={set('description')} rows={3} />
                </div>
                <div>
                  <label className="label">Colors <span className="text-[var(--color-ink-300)]">(optional)</span></label>
                  <input className="input" placeholder="e.g. Brown, Gold" value={form.colors} onChange={set('colors')} />
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-5">
                <div>
                  <label className="label">Found at building *</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-ink-300)]" />
                    <select className={`input pl-9 appearance-none pr-8 ${errors.building ? 'input-error' : ''}`} value={form.building} onChange={set('building')}>
                      <option value="">Select location</option>
                      {BUILDINGS.map((b) => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                  {errors.building && <p className="text-xs text-[var(--color-red-500)] mt-1">{errors.building}</p>}
                </div>
                <div>
                  <label className="label">Specific area <span className="text-[var(--color-ink-300)]">(optional)</span></label>
                  <input className="input" placeholder="e.g. Bench near entrance" value={form.area} onChange={set('area')} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Date found *</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-ink-300)]" />
                      <input type="date" className={`input pl-9 ${errors.foundDate ? 'input-error' : ''}`} value={form.foundDate} onChange={set('foundDate')} max={new Date().toISOString().split('T')[0]} />
                    </div>
                    {errors.foundDate && <p className="text-xs text-[var(--color-red-500)] mt-1">{errors.foundDate}</p>}
                  </div>
                  <div>
                    <label className="label">Time found <span className="text-[var(--color-ink-300)]">(optional)</span></label>
                    <input type="time" className="input" value={form.foundTime} onChange={set('foundTime')} />
                  </div>
                </div>
                <div>
                  <label className="label">Where is the item now? <span className="text-[var(--color-ink-300)]">(optional)</span></label>
                  <input className="input" placeholder="e.g. Handed to security desk, still with me..." value={form.currentLocation} onChange={set('currentLocation')} />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <div>
                  <label className="label mb-3">Photo of the item <span className="text-[var(--color-ink-300)]">(strongly recommended)</span></label>
                  {imagePreview ? (
                    <div className="relative rounded-xl overflow-hidden border border-[var(--color-ink-100)]">
                      <img src={imagePreview} alt="preview" className="w-full max-h-64 object-contain bg-[var(--color-canvas-dark)]" />
                      <button onClick={() => { setImageFile(null); setImagePreview(null); }} className="absolute top-2 right-2 btn btn-sm bg-white shadow border border-[var(--color-ink-100)]">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div {...getRootProps()} className={clsx(
                      'border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all',
                      isDragActive ? 'border-[var(--color-teal-500)] bg-[var(--color-teal-50)]' : 'border-[var(--color-ink-100)] hover:border-[var(--color-teal-400)] hover:bg-[var(--color-canvas-dark)]'
                    )}>
                      <input {...getInputProps()} />
                      <Upload className="w-8 h-8 text-[var(--color-ink-300)] mx-auto mb-3" />
                      <p className="text-sm font-semibold text-[var(--color-ink-700)]">{isDragActive ? 'Drop here...' : 'Drag & drop or click to upload'}</p>
                      <p className="text-xs text-[var(--color-ink-300)] mt-1">JPG, PNG, WEBP · max 10 MB</p>
                    </div>
                  )}
                </div>
                <div className="rounded-xl border border-[var(--color-teal-100)] bg-[var(--color-teal-50)] p-4 text-sm text-[var(--color-teal-600)]">
                  📷 A clear photo greatly improves AI matching accuracy and helps the owner recognize their item.
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <div>
                  <label className="label">Preferred handover method</label>
                  <div className="space-y-2 mt-2">
                    {HANDOVER_OPTIONS.map((opt) => (
                      <label key={opt.value} className={clsx(
                        'flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all',
                        form.handoverPreference === opt.value
                          ? 'border-[var(--color-teal-500)] bg-[var(--color-teal-50)]'
                          : 'border-[var(--color-ink-100)] hover:border-[var(--color-ink-300)]'
                      )}>
                        <input type="radio" name="handover" value={opt.value} checked={form.handoverPreference === opt.value} onChange={set('handoverPreference')} className="accent-[var(--color-teal-600)]" />
                        <span className="text-sm font-semibold text-[var(--color-ink-800)]">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl bg-[var(--color-amber-50)] border border-[var(--color-amber-100)] p-4 flex gap-3">
                  <AlertCircle className="w-4 h-4 text-[#92400e] shrink-0 mt-0.5" />
                  <p className="text-xs text-[#92400e] leading-relaxed">
                    Your personal contact details are never shown publicly. Owners will contact you through FindIt's secure messaging system.
                  </p>
                </div>

                {/* Summary */}
                <div className="space-y-2 text-sm border-t border-[var(--color-ink-100)] pt-5">
                  <p className="font-bold text-[var(--color-ink-700)] mb-3">Report summary</p>
                  {[
                    ['Item', form.title], ['Category', form.category],
                    ['Found at', form.building + (form.area ? ` · ${form.area}` : '')],
                    ['Date', form.foundDate], ['Currently', form.currentLocation || '—'],
                  ].map(([l, v]) => (
                    <div key={l} className="grid grid-cols-[120px_1fr] gap-2">
                      <span className="text-xs font-bold text-[var(--color-ink-500)] uppercase">{l}</span>
                      <span className="text-[var(--color-ink-800)]">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="flex items-center justify-between mt-8 pt-6 border-t border-[var(--color-ink-100)]">
          {step > 0 ? <button className="btn btn-ghost" onClick={back}>← Back</button> : <div />}
          {step < STEP_LABELS.length - 1 ? (
            <button className="btn btn-teal" onClick={next}>Continue →</button>
          ) : (
            <button className="btn btn-teal" onClick={handleSubmit} disabled={submitting}>
              {submitting ? <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Submitting...</span> : 'Submit Report'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
