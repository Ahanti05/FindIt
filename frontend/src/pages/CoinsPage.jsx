import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, Handshake, Gift, PartyPopper, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { clsx } from 'clsx';
import { coinApi } from '../services/api';
import { useCoins } from '../context/CoinContext';
import { useAuth } from '../context/AuthContext';
import Owl, { Coin } from '../components/Owl';
import { Avatar } from '../components/ui';

const REASON_LABELS = {
  welcome: 'Welcome bonus',
  found_report: 'Reported a found item',
  item_returned: 'Returned an item to its owner',
  reward_received: 'Reward from an owner',
  reward_pledged: 'Reward held for your lost item',
  reward_refunded: 'Reward returned to you',
  recovery_closed: 'Got your item back',
};

export default function CoinsPage() {
  const { user } = useAuth();
  const { balance, shown } = useCoins();
  const [data, setData] = useState(null);
  const [leaders, setLeaders] = useState([]);
  // On first visit the balance counts up from 0, one coin at a time.
  const [intro, setIntro] = useState(0);

  useEffect(() => {
    coinApi.me().then(({ data: d }) => setData(d)).catch(() => {});
    coinApi.leaderboard().then(({ data: d }) => setLeaders(d.leaderboard)).catch(() => {});
  }, [balance]);

  useEffect(() => {
    if (!data) return undefined;
    const target = data.balance;
    const step = target > 120 ? Math.ceil(target / 120) : 1;
    const timer = setInterval(() => {
      setIntro((v) => {
        if (v + step >= target) { clearInterval(timer); return target; }
        return v + step;
      });
    }, 22);
    return () => clearInterval(timer);
  }, [data?.balance]); // eslint-disable-line react-hooks/exhaustive-deps

  const display = data && intro < data.balance ? intro : shown;
  const rules = data?.rules;

  const ways = rules ? [
    { icon: Handshake, coins: rules.ITEM_RETURNED, title: 'Return an item', desc: 'When the owner confirms the handover with their code.' },
    { icon: Gift, coins: '+ reward', title: "Owner's reward", desc: 'Owners can promise coins; they are paid to you on handover.' },
    { icon: Camera, coins: rules.FOUND_REPORT, title: 'Report a found item', desc: `With a photo. Up to ${rules.FOUND_REPORT_DAILY_CAP} times a day.` },
    { icon: PartyPopper, coins: rules.RECOVERY_CLOSED, title: 'Get your item back', desc: 'For confirming the handover of your own item.' },
  ] : [];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <section className="card border border-[var(--color-ink-100)] p-6 sm:p-8 grid sm:grid-cols-[1fr_auto] gap-6 items-center overflow-hidden">
        <div>
          <p className="text-sm font-semibold text-[#b45309]">FindIt coins</p>
          <div className="flex items-center gap-3 mt-2">
            <Coin size={44} key={display} className="coin-bump" />
            <span className="font-display font-extrabold text-6xl text-[var(--color-ink-900)] tabular-nums" aria-live="polite">{display}</span>
          </div>
          <p className="text-sm text-[var(--color-ink-500)] mt-3 max-w-md">
            {user?.name?.split(' ')[0]}, coins thank you for helping things get back to their owners. Use them to offer a reward when you lose something.
          </p>
          <div className="flex flex-wrap gap-2 mt-5">
            <Link to="/report/found" className="btn btn-teal btn-sm">Report a found item</Link>
            <Link to="/report/lost" className="btn btn-ghost btn-sm">Offer a reward on a lost item</Link>
          </div>
        </div>
        <Owl mood="cheer" size={170} bob className="justify-self-center" />
      </section>

      <section>
        <h2 className="font-display font-bold text-lg text-[var(--color-ink-900)] mb-3">How to earn</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {ways.map((w) => (
            <div key={w.title} className="card border border-[var(--color-ink-100)] p-4">
              <div className="flex items-center justify-between">
                <span className="w-9 h-9 rounded-lg bg-[var(--color-amber-50)] text-[#b45309] flex items-center justify-center"><w.icon className="w-[18px] h-[18px]" /></span>
                <span className="flex items-center gap-1 font-bold text-[#92400e]"><Coin size={16} />{typeof w.coins === 'number' ? `+${w.coins}` : w.coins}</span>
              </div>
              <p className="font-semibold text-sm text-[var(--color-ink-900)] mt-3">{w.title}</p>
              <p className="text-xs text-[var(--color-ink-500)] mt-1 leading-relaxed">{w.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid lg:grid-cols-[1fr_340px] gap-5 items-start">
        <section className="card border border-[var(--color-ink-100)]">
          <h2 className="font-display font-bold text-[var(--color-ink-900)] px-5 pt-5 pb-3">History</h2>
          {!data ? (
            <div className="p-5 space-y-2">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-10 w-full" />)}</div>
          ) : data.history.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-[var(--color-ink-500)]">No coin activity yet.</p>
          ) : (
            <ul className="divide-y divide-[var(--color-ink-100)]">
              {data.history.map((t) => (
                <li key={t._id} className="px-5 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--color-ink-900)]">{REASON_LABELS[t.reason] || t.reason}</p>
                    <p className="text-xs text-[var(--color-ink-500)] truncate">{t.note} · {format(new Date(t.createdAt), 'd MMM, HH:mm')}</p>
                  </div>
                  <span className={clsx('font-bold tabular-nums', t.amount > 0 ? 'text-[var(--color-teal-600)]' : 'text-[var(--color-ink-500)]')}>
                    {t.amount > 0 ? '+' : ''}{t.amount}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card border border-[var(--color-ink-100)] p-5">
          <h2 className="font-display font-bold text-[var(--color-ink-900)] flex items-center gap-2"><Sparkles className="w-4 h-4 text-[#b45309]" /> Top finders</h2>
          <p className="text-xs text-[var(--color-ink-500)] mt-1 mb-4">Coins earned by finding and returning items.</p>
          {leaders.length === 0 ? (
            <p className="text-sm text-[var(--color-ink-500)]">Nobody yet – be the first.</p>
          ) : (
            <ol className="space-y-3">
              {leaders.map((l, i) => (
                <li key={`${l.name}-${i}`} className="flex items-center gap-3">
                  <span className={clsx('w-6 text-center text-sm font-bold', i === 0 ? 'text-[#b45309]' : 'text-[var(--color-ink-400)]')}>{i + 1}</span>
                  <Avatar user={l} size="w-8 h-8" text="text-xs" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--color-ink-900)] truncate">{l.name}</p>
                    <p className="text-xs text-[var(--color-ink-500)]">{l.returned} returned</p>
                  </div>
                  <span className="flex items-center gap-1 font-bold text-[#92400e] tabular-nums"><Coin size={14} />{l.earned}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
