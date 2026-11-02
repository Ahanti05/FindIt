import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { ImagePlus, Loader2, Sparkles, RotateCcw, AlertTriangle, Check, ChevronLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import { itemsApi, aiApi, errorMessage } from '../services/api';
import { useMeta, HANDOVER_LABELS } from '../context/MetaContext';
import { CategoryIcon, FieldError, pct } from '../components/ui';

const STEPS = ['Photo', 'Details', 'Where & when', 'Review'];

const COPY = {
  lost: {
    eyebrow: 'Report a lost item',
    heading: 'What did you lose?',
    photoHint: 'A photo of the item (even an old one) lets the AI compare it with everything that has been found.',
    whereLabel: 'Where did you last have it?',
    dateLabel: 'Date lost',
    submit: 'Submit lost report',
    accent: 'btn-primary',
  },
  found: {
    eyebrow: 'Report a found item',
    heading: 'What did you find?',
    photoHint: 'Take a clear photo of the item on a plain surface. The AI uses it to find the owner’s report.',
    whereLabel: 'Where did you find it?',
    dateLabel: 'Date found',
    submit: 'Submit found report',
    accent: 'btn-teal',
  },
};

// Local calendar date (toISOString alone would give the UTC date).
const today = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

export default function ReportPage({ type }) {
  const navigate = useNavigate();
  const { categories, buildings } = useMeta();
  const copy = COPY[type];
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const [form, setForm] = useState({
    title: '', category: '', description: '', colors: '',
    identifyingCharacteristics: '', rewardOffered: false, rewardDescription: '',
    building: '', area: '', date: today(), time: '',
    currentLocation: '', handoverPreference: 'lost-found-office',
  });

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [analysis, setAnalysis] = useState(null); // { status: 'running'|'done'|'error', data, message }

  // Reset wizard when switching between /report/lost and /report/found.
  useEffect(() => {
    setStep(0); setFile(null); setPreview(null); setAnalysis(null); setErrors({});
  }, [type]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const set = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((er) => ({ ...er, [field]: '' }));
  };

  const analyze = useCallback(async (picked) => {
    setAnalysis({ status: 'running' });
    try {
      const { data } = await aiApi.analyze(picked);
      setAnalysis({ status: 'done', data: data.data });
      const suggested = data.data.suggestedCategory;
      setForm((f) => ({ ...f, category: f.category || (suggested !== 'Other' ? suggested : '') }));
    } catch (err) {
      setAnalysis({ status: 'error', message: errorMessage(err, 'Could not analyze the photo.') });
    }
  }, []);

  const onDrop = useCallback((accepted, rejected) => {
    if (rejected.length) {
      toast.error(rejected[0].errors[0]?.code === 'file-too-large' ? 'Image must be under 10 MB' : 'Use a JPG, PNG or WEBP image');
      return;
    }
    const picked = accepted[0];
    if (!picked) return;
    setFile(picked);
    setPreview(URL.createObjectURL(picked));
    analyze(picked);
  }, [analyze]);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: { 'image/jpeg': [], 'image/png': [], 'image/webp': [] },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
    noClick: Boolean(preview),
  });

  const clearPhoto = () => { setFile(null); setPreview(null); setAnalysis(null); };

  const validate = () => {
    const e = {};
    if (step === 1) {
      if (!form.title.trim()) e.title = 'Give the item a short name';
      if (!form.category) e.category = 'Choose a category';
    }
    if (step === 2) {
      if (!form.building) e.building = 'Choose a location';
      if (!form.date) e.date = 'Pick a date';
      else if (form.date > today()) e.date = 'Date cannot be in the future';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => { if (validate()) setStep((s) => s + 1); };

  const submit = async () => {
    setSubmitting(true);
    try {
      const fd = new FormData();
      const fields = {
        title: form.title.trim(), category: form.category, description: form.description,
        colors: form.colors, building: form.building, area: form.area,
      };
      if (type === 'lost') {
        Object.assign(fields, {
          lostDate: form.date, lostTimeApprox: form.time, identifyingCharacteristics: form.identifyingCharacteristics,
          rewardOffered: form.rewardOffered, rewardDescription: form.rewardOffered ? form.rewardDescription : '',
        });
      } else {
        Object.assign(fields, {
          foundDate: form.date, foundTime: form.time,
          currentLocation: form.currentLocation, handoverPreference: form.handoverPreference,
        });
      }
      Object.entries(fields).forEach(([k, v]) => { if (v !== '' && v !== undefined) fd.append(k, v); });
      if (file) fd.append('image', file);

      const { data } = await itemsApi(type).create(fd);
      toast.success(file ? 'Report submitted. Matching has started.' : 'Report submitted.');
      navigate(`/items/${type}/${data.item._id}`);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not submit the report'));
    } finally {
      setSubmitting(false);
    }
  };

  const guesses = analysis?.data?.categoryGuesses || [];

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <p className={clsx('text-sm font-semibold mb-1', type === 'lost' ? 'text-[var(--color-violet-600)]' : 'text-[var(--color-teal-600)]')}>{copy.eyebrow}</p>
      <h1 className="font-display font-bold text-2xl text-[var(--color-ink-900)]">{copy.heading}</h1>

      {/* Progress */}
      <ol className="flex items-center gap-2 my-7" aria-label="Progress">
        {STEPS.map((label, i) => (
          <li key={label} className="flex items-center gap-2 flex-1 last:flex-none">
            <span className={clsx(
              'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
              i < step ? 'bg-[var(--color-teal-500)] text-white'
                : i === step ? 'bg-[var(--color-ink-900)] text-white'
                  : 'bg-[var(--color-ink-100)] text-[var(--color-ink-500)]'
            )} aria-current={i === step ? 'step' : undefined}>
              {i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
            </span>
            <span className={clsx('text-xs font-semibold hidden sm:block whitespace-nowrap', i === step ? 'text-[var(--color-ink-900)]' : 'text-[var(--color-ink-400)]')}>{label}</span>
            {i < STEPS.length - 1 && <span className="flex-1 h-px bg-[var(--color-ink-100)]" />}
          </li>
        ))}
      </ol>

      <div className="card border border-[var(--color-ink-100)] p-6 sm:p-7">
        {/* ── Step 0: Photo ─────────────────────────────────────────────── */}
        {step === 0 && (
          <div className="space-y-5">
            <p className="text-sm text-[var(--color-ink-500)]">{copy.photoHint}</p>

            {!preview ? (
              <div
                {...getRootProps()}
                className={clsx(
                  'border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors',
                  isDragActive ? 'border-[var(--color-violet-500)] bg-[var(--color-violet-50)]' : 'border-[var(--color-ink-200)] hover:border-[var(--color-violet-400)] hover:bg-[var(--color-canvas)]'
                )}
              >
                <input {...getInputProps()} />
                <ImagePlus className="w-8 h-8 text-[var(--color-ink-300)] mx-auto mb-3" />
                <p className="text-sm font-semibold text-[var(--color-ink-700)]">{isDragActive ? 'Drop the photo here' : 'Drag a photo here or click to choose'}</p>
                <p className="text-xs text-[var(--color-ink-400)] mt-1">JPG, PNG or WEBP, up to 10 MB</p>
              </div>
            ) : (
              <div {...getRootProps()}>
                <input {...getInputProps()} />
                <div className="grid sm:grid-cols-2 gap-4">
                <div className="relative rounded-xl overflow-hidden border border-[var(--color-ink-100)] bg-[var(--color-canvas-dark)]">
                  <img
                    src={analysis?.data?.annotatedImage || preview}
                    alt="Selected item"
                    className="w-full h-60 object-contain"
                  />
                  {analysis?.data?.annotatedImage && (
                    <span className="badge badge-violet absolute top-2 left-2 text-[10px]">Detected objects</span>
                  )}
                </div>

                <div className="flex flex-col">
                  <p className="text-xs font-bold text-[var(--color-ink-500)] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[var(--color-violet-600)]" /> AI analysis
                  </p>
                  {analysis?.status === 'running' && (
                    <div className="flex items-center gap-2 text-sm text-[var(--color-ink-500)]">
                      <Loader2 className="w-4 h-4 animate-spin" /> Looking at your photo...
                    </div>
                  )}
                  {analysis?.status === 'error' && (
                    <div className="rounded-lg bg-[var(--color-amber-50)] border border-[var(--color-amber-100)] p-3 text-xs text-[#92400e] flex gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{analysis.message} The photo will still be attached and analyzed later.</span>
                    </div>
                  )}
                  {analysis?.status === 'done' && (
                    <>
                      <p className="text-sm text-[var(--color-ink-700)] mb-3">This looks like:</p>
                      <div className="space-y-2">
                        {guesses.map((g) => (
                          <button
                            key={g.category}
                            type="button"
                            onClick={() => setForm((f) => ({ ...f, category: g.category }))}
                            className={clsx(
                              'w-full flex items-center gap-3 p-2.5 rounded-lg border text-left transition-colors',
                              form.category === g.category ? 'border-[var(--color-violet-500)] bg-[var(--color-violet-50)]' : 'border-[var(--color-ink-100)] hover:border-[var(--color-ink-300)]'
                            )}
                          >
                            <CategoryIcon category={g.category} className="w-4 h-4 text-[var(--color-ink-500)]" />
                            <span className="flex-1 text-sm font-semibold text-[var(--color-ink-800)]">{g.category}</span>
                            <span className="text-xs font-bold text-[var(--color-ink-500)]">{pct(g.confidence)}</span>
                          </button>
                        ))}
                      </div>
                      <p className="text-[11px] text-[var(--color-ink-400)] mt-2">Tap the right one. You can change it on the next step.</p>
                    </>
                  )}
                  <div className="mt-auto pt-4 flex gap-2">
                    <button type="button" onClick={open} className="btn btn-ghost btn-sm"><RotateCcw className="w-3.5 h-3.5" /> Change photo</button>
                    <button type="button" onClick={clearPhoto} className="btn btn-ghost btn-sm">Remove</button>
                  </div>
                </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Step 1: Details ──────────────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <label className="label" htmlFor="title">Item name</label>
              <input id="title" className={clsx('input', errors.title && 'input-error')} placeholder={type === 'lost' ? 'e.g. Black HP laptop charger' : 'e.g. Brown leather wallet'} value={form.title} onChange={set('title')} maxLength={100} />
              <FieldError>{errors.title}</FieldError>
            </div>
            <div>
              <label className="label" htmlFor="category">Category</label>
              <select id="category" className={clsx('input', errors.category && 'input-error')} value={form.category} onChange={set('category')}>
                <option value="">Choose a category</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <FieldError>{errors.category}</FieldError>
            </div>
            <div>
              <label className="label" htmlFor="description">Description</label>
              <textarea id="description" className="input min-h-[96px] resize-y" maxLength={1000}
                placeholder={type === 'lost' ? 'Brand, model, size, what was inside...' : 'Brand, condition, anything written on it...'}
                value={form.description} onChange={set('description')} />
              {type === 'found' && <p className="text-[11px] text-[var(--color-ink-400)] mt-1">Leave out details only the owner would know (like what is inside). They will use them to prove ownership.</p>}
            </div>
            <div>
              <label className="label" htmlFor="colors">Colours <span className="font-normal text-[var(--color-ink-400)]">(comma separated)</span></label>
              <input id="colors" className="input" placeholder="e.g. Black, Silver" value={form.colors} onChange={set('colors')} />
            </div>
            {type === 'lost' && (
              <>
                <div>
                  <label className="label" htmlFor="ident">Identifying marks <span className="font-normal text-[var(--color-ink-400)]">(optional)</span></label>
                  <input id="ident" className="input" placeholder="Stickers, scratches, engraving..." value={form.identifyingCharacteristics} onChange={set('identifyingCharacteristics')} maxLength={500} />
                </div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 accent-[var(--color-violet-600)]" checked={form.rewardOffered} onChange={set('rewardOffered')} />
                  <span className="text-sm font-semibold text-[var(--color-ink-700)]">I'm offering a reward</span>
                </label>
                {form.rewardOffered && (
                  <input className="input" placeholder="What are you offering?" value={form.rewardDescription} onChange={set('rewardDescription')} maxLength={200} />
                )}
              </>
            )}
          </div>
        )}

        {/* ── Step 2: Where & when ─────────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <label className="label" htmlFor="building">{copy.whereLabel}</label>
              <select id="building" className={clsx('input', errors.building && 'input-error')} value={form.building} onChange={set('building')}>
                <option value="">Choose a building</option>
                {buildings.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
              <FieldError>{errors.building}</FieldError>
            </div>
            <div>
              <label className="label" htmlFor="area">Exact spot <span className="font-normal text-[var(--color-ink-400)]">(optional)</span></label>
              <input id="area" className="input" placeholder="e.g. 2nd floor, near the water cooler" value={form.area} onChange={set('area')} maxLength={200} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label" htmlFor="date">{copy.dateLabel}</label>
                <input id="date" type="date" className={clsx('input', errors.date && 'input-error')} value={form.date} onChange={set('date')} max={today()} />
                <FieldError>{errors.date}</FieldError>
              </div>
              <div>
                <label className="label" htmlFor="time">Time <span className="font-normal text-[var(--color-ink-400)]">(optional)</span></label>
                <input id="time" className="input" placeholder={type === 'lost' ? 'e.g. 10:00 – 12:00' : 'e.g. 15:30'} value={form.time} onChange={set('time')} maxLength={type === 'lost' ? 40 : 20} />
              </div>
            </div>
            {type === 'found' && (
              <>
                <div>
                  <label className="label" htmlFor="currentLocation">Where is the item now?</label>
                  <input id="currentLocation" className="input" placeholder="e.g. Handed to the library front desk" value={form.currentLocation} onChange={set('currentLocation')} maxLength={200} />
                </div>
                <fieldset>
                  <legend className="label">How should the owner collect it?</legend>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {Object.entries(HANDOVER_LABELS).map(([value, label]) => (
                      <label key={value} className={clsx(
                        'flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer text-sm font-semibold',
                        form.handoverPreference === value ? 'border-[var(--color-teal-500)] bg-[var(--color-teal-50)] text-[var(--color-ink-900)]' : 'border-[var(--color-ink-100)] text-[var(--color-ink-700)]'
                      )}>
                        <input type="radio" name="handover" value={value} checked={form.handoverPreference === value} onChange={set('handoverPreference')} className="accent-[var(--color-teal-600)]" />
                        {label}
                      </label>
                    ))}
                  </div>
                </fieldset>
              </>
            )}
          </div>
        )}

        {/* ── Step 3: Review ───────────────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-5">
            <div className="flex gap-4">
              {preview && <img src={preview} alt="" className="w-24 h-24 rounded-lg object-cover border border-[var(--color-ink-100)] shrink-0" />}
              <div className="min-w-0">
                <p className="font-display font-bold text-lg text-[var(--color-ink-900)]">{form.title}</p>
                <p className="text-sm text-[var(--color-ink-500)] flex items-center gap-1.5 mt-0.5"><CategoryIcon category={form.category} className="w-3.5 h-3.5" />{form.category}</p>
                {!preview && <p className="text-xs text-[#92400e] mt-2">No photo – AI matching will not run for this report.</p>}
              </div>
            </div>
            <dl className="grid grid-cols-[130px_1fr] gap-y-2.5 gap-x-3 text-sm border-t border-[var(--color-ink-100)] pt-4">
              {[
                ['Description', form.description],
                ['Colours', form.colors],
                [type === 'lost' ? 'Last seen' : 'Found at', [form.building, form.area].filter(Boolean).join(' – ')],
                [copy.dateLabel, [form.date, form.time].filter(Boolean).join(', ')],
                ...(type === 'lost'
                  ? [['Identifying marks', form.identifyingCharacteristics], ['Reward', form.rewardOffered ? form.rewardDescription || 'Yes' : '']]
                  : [['Item is now', form.currentLocation], ['Collection', HANDOVER_LABELS[form.handoverPreference]]]),
              ].filter(([, v]) => v).map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-xs font-bold text-[var(--color-ink-500)] uppercase tracking-wide pt-0.5">{k}</dt>
                  <dd className="text-[var(--color-ink-800)] break-words">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="text-xs text-[var(--color-ink-500)] bg-[var(--color-canvas)] rounded-lg p-3">
              Your report is visible to everyone on campus. Your email and phone number are never shown – people contact you through FindIt chat.
            </p>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-7 pt-5 border-t border-[var(--color-ink-100)]">
          {step > 0
            ? <button className="btn btn-ghost" onClick={() => setStep((s) => s - 1)}><ChevronLeft className="w-4 h-4" /> Back</button>
            : <span />}
          {step === 0 && (
            <button className={clsx('btn', copy.accent)} onClick={() => setStep(1)} disabled={analysis?.status === 'running'}>
              {preview ? 'Continue' : 'Continue without a photo'}
            </button>
          )}
          {step > 0 && step < STEPS.length - 1 && <button className={clsx('btn', copy.accent)} onClick={next}>Continue</button>}
          {step === STEPS.length - 1 && (
            <button className={clsx('btn', copy.accent)} onClick={submit} disabled={submitting}>
              {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</> : copy.submit}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
