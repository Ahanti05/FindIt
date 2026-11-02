import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Download, Smartphone, Bell, Camera, CheckCircle2 } from 'lucide-react';
import { useMeta } from '../context/MetaContext';
import Owl, { Coin } from './Owl';

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone;

// URL a phone should open. On a dev machine "localhost" means nothing to the
// phone, so use this computer's Wi-Fi address instead.
function usePhoneUrl() {
  const { lanAddresses } = useMeta();
  const { protocol, hostname, port, origin } = window.location;
  const local = ['localhost', '127.0.0.1'].includes(hostname);
  if (local && lanAddresses?.length) return `${protocol}//${lanAddresses[0]}${port ? `:${port}` : ''}`;
  return origin;
}

export default function GetTheApp() {
  const phoneUrl = usePhoneUrl();
  const [canInstall, setCanInstall] = useState(Boolean(window.__finditInstallPrompt));
  const [installed, setInstalled] = useState(isStandalone());

  useEffect(() => {
    const ready = () => setCanInstall(true);
    const done = () => { setInstalled(true); setCanInstall(false); };
    window.addEventListener('findit:installable', ready);
    window.addEventListener('appinstalled', done);
    return () => {
      window.removeEventListener('findit:installable', ready);
      window.removeEventListener('appinstalled', done);
    };
  }, []);

  const install = async () => {
    const prompt = window.__finditInstallPrompt;
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    window.__finditInstallPrompt = null;
    setCanInstall(false);
    if (outcome === 'accepted') setInstalled(true);
  };

  return (
    <section id="get-the-app" className="py-16 bg-[var(--color-ink-900)] text-white scroll-mt-16">
      <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-[1.1fr_1fr] gap-12 items-center">
        <div>
          <p className="text-sm font-semibold text-[var(--color-violet-300)] flex items-center gap-2"><Smartphone className="w-4 h-4" /> FindIt on your phone</p>
          <h2 className="font-display font-extrabold text-3xl sm:text-4xl mt-3 leading-tight">Snap it, report it,<br />get alerted anywhere on campus.</h2>
          <ul className="mt-6 space-y-3 text-[var(--color-ink-200)]">
            {[
              [Camera, 'Take the photo straight from your camera'],
              [Bell, 'Live alerts when someone finds your item'],
              [Coin, 'Collect FindIt coins for every item you return'],
            ].map(([Icon, text]) => (
              <li key={text} className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center"><Icon className="w-4 h-4" size={18} /></span>
                {text}
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-wrap items-center gap-6">
            <div className="bg-white p-3 rounded-xl">
              <QRCodeSVG value={phoneUrl} size={124} level="M" />
            </div>
            <div className="space-y-3">
              <p className="text-sm text-[var(--color-ink-200)] max-w-[16rem]">
                Scan with your phone camera to open FindIt, then add it to your home screen – it works like an app.
              </p>
              {installed ? (
                <p className="text-sm font-semibold text-[var(--color-teal-400)] flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Installed on this device</p>
              ) : canInstall ? (
                <button onClick={install} className="btn btn-primary"><Download className="w-4 h-4" /> Install FindIt</button>
              ) : (
                <p className="text-xs text-[var(--color-ink-300)] max-w-[16rem]">
                  {isIOS() ? 'On iPhone: tap Share, then "Add to Home Screen".' : 'On Android: open the browser menu and tap "Install app" or "Add to Home screen".'}
                </p>
              )}
              <p className="text-xs text-[var(--color-ink-400)]">App Store and Google Play versions are planned.</p>
            </div>
          </div>
        </div>

        {/* Phone preview */}
        <div className="justify-self-center relative">
          <div className="w-[260px] h-[520px] rounded-[40px] bg-[#1b2b3c] p-3 shadow-2xl border border-white/10">
            <div className="w-full h-full rounded-[30px] bg-[var(--color-canvas)] overflow-hidden flex flex-col text-[var(--color-ink-900)]">
              <div className="h-7 flex justify-center items-end"><span className="w-20 h-4 rounded-full bg-[#1b2b3c]" /></div>
              <div className="px-4 py-3 flex items-center justify-between bg-white border-b border-[var(--color-ink-100)]">
                <span className="flex items-center gap-1.5 font-display font-extrabold text-sm"><span className="w-6 h-6 rounded-md bg-[var(--color-violet-600)] text-white text-xs flex items-center justify-center">F</span>FindIt</span>
                <span className="flex items-center gap-1 text-xs font-bold text-[#92400e] bg-[var(--color-amber-50)] rounded-full px-2 py-0.5"><Coin size={13} />110</span>
              </div>
              <div className="p-4 space-y-3 flex-1">
                <div className="rounded-xl bg-white border border-[var(--color-amber-400)] p-3">
                  <p className="text-[11px] font-bold text-[var(--color-violet-600)]">Someone may have found your item</p>
                  <p className="text-xs mt-1">A found "Institute ID card" looks 88% like your lost ID card.</p>
                  <span className="mt-2 inline-block text-[11px] font-semibold text-white bg-[var(--color-violet-600)] rounded-md px-2 py-1">Is it yours?</span>
                </div>
                <div className="rounded-xl bg-white border border-[var(--color-ink-100)] p-3 flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-[var(--color-teal-50)] flex items-center justify-center"><CheckCircle2 className="w-4 h-4 text-[var(--color-teal-600)]" /></span>
                  <div>
                    <p className="text-xs font-semibold">Backpack returned</p>
                    <p className="text-[11px] text-[#92400e] font-semibold">+50 FindIt coins</p>
                  </div>
                </div>
              </div>
              <div className="flex justify-center pb-4"><Owl mood="happy" size={110} /></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
