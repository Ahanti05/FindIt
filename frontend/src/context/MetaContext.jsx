import { createContext, useContext, useEffect, useState } from 'react';
import { publicApi } from '../services/api';

// Categories, campus buildings and handover options come from the backend so
// the forms, filters and seed data always agree.
const FALLBACK = {
  categories: [
    'ID Card', 'Wallet', 'Keys', 'Phone', 'Laptop', 'Bag/Backpack',
    'Watch', 'Earphones/AirPods', 'Charger/Cable', 'Water Bottle',
    'Umbrella', 'Glasses', 'Clothing', 'Books/Notes', 'Jewelry', 'Other',
  ],
  buildings: [],
  handoverOptions: ['lost-found-office', 'security-desk', 'in-person', 'other'],
  demoMode: false,
};

const MetaContext = createContext(FALLBACK);

export const MetaProvider = ({ children }) => {
  const [meta, setMeta] = useState(FALLBACK);
  useEffect(() => {
    publicApi.meta().then(({ data }) => setMeta({ ...FALLBACK, ...data })).catch(() => {});
  }, []);
  return <MetaContext.Provider value={meta}>{children}</MetaContext.Provider>;
};

export const useMeta = () => useContext(MetaContext);

export const HANDOVER_LABELS = {
  'lost-found-office': 'Lost & Found Office',
  'security-desk': 'Security desk',
  'in-person': 'In person (arrange in chat)',
  other: 'Other',
};
