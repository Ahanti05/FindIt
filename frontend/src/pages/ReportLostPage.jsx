import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import { Upload, X, Zap, MapPin, Calendar, Tag, AlertCircle, CheckCircle2, Loader2, ChevronDown } from 'lucide-react';
import { lostApi, aiApi } from '../services/api';
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

const STEP_LABELS = ['Item Details', 'Location & Date', 'Photo & AI', 'Review'];

export default function ReportLostPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    title: '', category: '', description: '',
    identifyingCharacteristics: '', building: '', area: '',
    lostDate: '', lostTimeApprox: '', rewardOffered: false,
    rewardDescription: '', colors: '',
  });
  const [errors, setErrors] = useState({});

  // Image state
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  // AI detection state
  const [detecting, setDetecting] = useState(false);
  const [detection, setDetection] = useState(null);

  const set = (field) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [field]: val }));
    setErrors((er) => ({ ...er, [field]: '' }));
  };

  // ── Image drop ──────────────────────────────────────────────────────────────
  const onDrop = useCallback((accepted) => {
    const file = accepted[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setDetection(null);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
  });

  // ── AI detect (triggered after upload, needs image URL) ─────────────────────
  // Since we need to upload first to get a URL, we run detection after form submit
  // For UX, we show a "Analyze image" button that uploads to a temp endpoint
  // or we can use the base64 preview. For simplicity, we run detection post-submit.

  // ── Validation ──────────────────────────────────────────────────────────────
  const validateStep = () => {
    const e = {};
    if (step === 0) {
      if (!form.title.trim()) e.title = 'Item name is required';
      if (!form.category) e.category = 'Please select a category';
    }
    if (step === 1) {
      if (!form.building) e.building = 'Last seen building is required';
      if (!form.lostDate) e.lostDate = 'Date lost is required';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => { if (validateStep()) setStep((s) => s + 1); };
  const back = () => setStep((s) => s - 1);

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (v !== '' && v !== false) fd.append(k, v);
      });
      if (imageFile) fd.append('image', imageFile);

      const { data } = await lostApi.create(fd);
      toast.success('Lost item report submitted!');
      navigate(`/items/lost/${data.item._id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
      {/* Header */}
      <div className="mb-8">
        <span className="badge badge-red mb-3 text-xs">Report Lost Item</span>
        <h1 className="font-display font-bold text-2xl text-[var(--color-ink-900)]">What did you lose?</h1>
        <p className="text-sm text-[var(--color-ink-500)] mt-1">Fill in the details so others can help you find it.</p>
      </div>

      {/* Progress */}
      <div className="mb-8">
        <div className="flex items-center gap-2">
          {STEP_LABELS.map((label, i) => (
            <div key={i} className="flex items-center gap-2 flex-1">
              <div className={clsx(
                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all',
                i < step ? 'bg-[var(--color-teal-500)] text-white' :
                i === step ? 'bg-[var(--color-violet-600)] text-white' :
                'bg-[var(--color-ink-100)] text-[var(--color-ink-500)]'
              )}>
                {i < step ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span className={clsx('text-xs font-semibold hidden sm:block', i === step ? 'text-[var(--color-violet-600)]' : 'text-[var(--color-ink-300)]')}>{label}</span>
              {i < STEP_LABELS.length - 1 && <div className="flex-1 h-px bg-[var(--color-ink-100)]" />}
            </div>
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="card border border-[var(--color-ink-100)] p-6 sm:p-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.25 }}
          >
            {/* ── Step 0: Item Details ──────────────────────────────────── */}
            {step === 0 && (
              <div className="space-y-5">
                <div>
                  <label className="label">Item name *</label>
                  <input className={`input ${errors.title ? 'input-error' : ''}`} placeholder="e.g. Blue ASUS laptop" value={form.title} onChange={set('title')} />
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
                  <textarea
                    className="input min-h-[100px] resize-y"
                    placeholder="Describe the item in as much detail as possible: brand, model, size, color, any unique features..."
                    value={form.description}
                    onChange={set('description')}
                    rows={4}
                  />
                </div>

                <div>
                  <label className="label">Identifying characteristics <span className="text-[var(--color-ink-300)]">(optional)</span></label>
                  <input className="input" placeholder="e.g. Sticker on cover, initials engraved, cracked corner..." value={form.identifyingCharacteristics} onChange={set('identifyingCharacteristics')} />
                </div>

                <div>
                  <label className="label">Colors <span className="text-[var(--color-ink-300)]">(optional)</span></label>
                  <input className="input" placeholder="e.g. Black, Silver" value={form.colors} onChange={set('colors')} />
                </div>

                <div className="flex items-center gap-3">
                  <input type="checkbox" id="reward" className="w-4 h-4 rounded" checked={form.rewardOffered} onChange={set('rewardOffered')} />
                  <label htmlFor="reward" className="text-sm font-semibold text-[var(--color-ink-700)] cursor-pointer">Offering a reward</label>
                </div>
                {form.rewardOffered && (
                  <input className="input" placeholder="Describe your reward offer" value={form.rewardDescription} onChange={set('rewardDescription')} />
                )}
              </div>
            )}

            {/* ── Step 1: Location & Date ───────────────────────────────── */}
            {step === 1 && (
              <div className="space-y-5">
                <div>
                  <label className="label">Last seen building / location *</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-ink-300)]" />
                    <select className={`input pl-9 appearance-none pr-8 ${errors.building ? 'input-error' : ''}`} value={form.building} onChange={set('building')}>
                      <option value="">Select building</option>
                      {BUILDINGS.map((b) => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                  {errors.building && <p className="text-xs text-[var(--color-red-500)] mt-1">{errors.building}</p>}
                </div>

                <div>
                  <label className="label">Specific area / floor <span className="text-[var(--color-ink-300)]">(optional)</span></label>
                  <input className="input" placeholder="e.g. 2nd floor, near the coffee machine" value={form.area} onChange={set('area')} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Date lost *</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-ink-300)]" />
                      <input
                        type="date"
                        className={`input pl-9 ${errors.lostDate ? 'input-error' : ''}`}
                        value={form.lostDate}
                        onChange={set('lostDate')}
                        max={new Date().toISOString().split('T')[0]}
                      />
                    </div>
                    {errors.lostDate && <p className="text-xs text-[var(--color-red-500)] mt-1">{errors.lostDate}</p>}
                  </div>
                  <div>
                    <label className="label">Approximate time <span className="text-[var(--color-ink-300)]">(optional)</span></label>
                    <input className="input" placeholder="e.g. 10:00 – 12:00" value={form.lostTimeApprox} onChange={set('lostTimeApprox')} />
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 2: Photo ─────────────────────────────────────────── */}
            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <label className="label mb-3">Upload a photo <span className="text-[var(--color-ink-300)]">(strongly recommended)</span></label>
                  {imagePreview ? (
                    <div className="relative rounded-xl overflow-hidden border border-[var(--color-ink-100)]">
                      <img src={imagePreview} alt="preview" className="w-full max-h-64 object-contain bg-[var(--color-canvas-dark)]" />
                      <button
                        onClick={() => { setImageFile(null); setImagePreview(null); setDetection(null); }}
                        className="absolute top-2 right-2 btn btn-sm bg-white shadow border border-[var(--color-ink-100)]"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div
                      {...getRootProps()}
                      className={clsx(
                        'border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all',
                        isDragActive
                          ? 'border-[var(--color-violet-500)] bg-[var(--color-violet-50)]'
                          : 'border-[var(--color-ink-100)] hover:border-[var(--color-violet-400)] hover:bg-[var(--color-canvas-dark)]'
                      )}
                    >
                      <input {...getInputProps()} />
                      <Upload className="w-8 h-8 text-[var(--color-ink-300)] mx-auto mb-3" />
                      <p className="text-sm font-semibold text-[var(--color-ink-700)]">
                        {isDragActive ? 'Drop it here...' : 'Drag & drop or click to upload'}
                      </p>
                      <p className="text-xs text-[var(--color-ink-300)] mt-1">JPG, PNG, WEBP · max 10 MB</p>
                    </div>
                  )}
                </div>

                {/* AI Detection info box */}
                <div className="rounded-xl border border-[var(--color-violet-100)] bg-[var(--color-violet-50)] p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[var(--color-violet-100)] flex items-center justify-center shrink-0 mt-0.5">
                      <Zap className="w-4 h-4 text-[var(--color-violet-600)]" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[var(--color-violet-600)]">AI Detection</p>
                      <p className="text-xs text-[var(--color-ink-500)] mt-0.5 leading-relaxed">
                        Once you submit, our YOLOv8 model will automatically detect objects in your image, suggest a category, and generate an embedding to find matches. You can review the AI output on the item page.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 3: Review ────────────────────────────────────────── */}
            {step === 3 && (
              <div className="space-y-5">
                <h3 className="font-display font-bold text-lg text-[var(--color-ink-900)]">Review your report</h3>
                <div className="space-y-3 text-sm">
                  {[
                    ['Item', form.title],
                    ['Category', form.category],
                    ['Description', form.description || '—'],
                    ['Last seen at', form.building + (form.area ? ` · ${form.area}` : '')],
                    ['Date lost', form.lostDate],
                    ['Time (approx)', form.lostTimeApprox || '—'],
                    ['Colors', form.colors || '—'],
                    ['Characteristics', form.identifyingCharacteristics || '—'],
                    ['Reward', form.rewardOffered ? (form.rewardDescription || 'Yes') : 'No'],
                  ].map(([label, value]) => (
                    <div key={label} className="grid grid-cols-[140px_1fr] gap-2 items-start">
                      <span className="text-xs font-bold text-[var(--color-ink-500)] uppercase tracking-wide pt-0.5">{label}</span>
                      <span className="text-[var(--color-ink-800)]">{value}</span>
                    </div>
                  ))}
                  {imagePreview && (
                    <div className="mt-4">
                      <p className="text-xs font-bold text-[var(--color-ink-500)] uppercase tracking-wide mb-2">Photo</p>
                      <img src={imagePreview} alt="item" className="h-28 rounded-lg object-cover border border-[var(--color-ink-100)]" />
                    </div>
                  )}
                </div>

                <div className="rounded-xl bg-[var(--color-amber-50)] border border-[var(--color-amber-100)] p-4 flex gap-3">
                  <AlertCircle className="w-4 h-4 text-[#92400e] shrink-0 mt-0.5" />
                  <p className="text-xs text-[#92400e] leading-relaxed">
                    Your report will be visible to all campus users. Do not include sensitive personal information in the description.
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-[var(--color-ink-100)]">
          {step > 0 ? (
            <button className="btn btn-ghost" onClick={back}>← Back</button>
          ) : <div />}

          {step < STEP_LABELS.length - 1 ? (
            <button className="btn btn-primary" onClick={next}>Continue →</button>
          ) : (
            <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
              {submitting ? (
                <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</span>
              ) : 'Submit Report'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
