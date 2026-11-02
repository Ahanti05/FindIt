import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from './AuthContext';
import { useSocketEvent } from './SocketContext';
import { coinApi } from '../services/api';
import { Coin } from '../components/Owl';

const CoinContext = createContext({ balance: 0, shown: 0, lastDelta: null, refresh: () => {} });

// Counts `shown` toward `target` one coin per tick, so a reward visibly adds
// up coin by coin instead of jumping.
function useCountUp(target) {
  const [shown, setShown] = useState(target);
  const shownRef = useRef(target);
  useEffect(() => {
    if (shownRef.current === target) return undefined;
    const diff = Math.abs(target - shownRef.current);
    const tick = diff > 80 ? 20 : 45; // ms per coin
    const timer = setInterval(() => {
      const cur = shownRef.current;
      if (cur === target) { clearInterval(timer); return; }
      shownRef.current = cur + (target > cur ? 1 : -1);
      setShown(shownRef.current);
    }, tick);
    return () => clearInterval(timer);
  }, [target]);
  return shown;
}

export const CoinProvider = ({ children }) => {
  const { user } = useAuth();
  const [balance, setBalance] = useState(user?.coins ?? 0);
  const [lastDelta, setLastDelta] = useState(null); // { amount, key }
  const shown = useCountUp(balance);

  const refresh = useCallback(() => {
    if (!user) return;
    coinApi.me().then(({ data }) => setBalance(data.balance)).catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!user) { setBalance(0); return; }
    setBalance(user.coins ?? 0);
    refresh();
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const onCoins = useCallback(({ balance: next, delta, note }) => {
    setBalance(next);
    setLastDelta({ amount: delta, key: Date.now() });
    if (delta > 0) {
      toast(`${note ? `${note}: ` : ''}+${delta} FindIt coins`, { icon: <Coin size={18} />, duration: 4000 });
    }
  }, []);
  useSocketEvent('coins', onCoins);

  return (
    <CoinContext.Provider value={{ balance, shown, lastDelta, refresh }}>
      {children}
    </CoinContext.Provider>
  );
};

export const useCoins = () => useContext(CoinContext);
