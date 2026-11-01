import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, X, Loader2 } from 'lucide-react';
import { lostApi, foundApi } from '../services/api';
import { useMeta } from '../context/MetaContext';
import ItemCard from '../components/ItemCard';
import { EmptyState } from '../components/ui';

const PAGE_SIZE = 12;

export default function BrowsePage() {
  const { categories, buildings } = useMeta();
  const [params, setParams] = useSearchParams();
  const type = params.get('type') === 'lost' ? 'lost' : 'found';
  const filters = {
    search: params.get('search') || '',
    category: params.get('category') || '',
    building: params.get('building') || '',
    sortBy: params.get('sortBy') || 'createdAt',
  };
  const filterKey = `${type}|${filters.search}|${filters.category}|${filters.building}|${filters.sortBy}`;

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(filters.search);
  const requestId = useRef(0);

  const update = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next, { replace: true });
  };

  const fetchPage = useCallback(async (pageToLoad) => {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const api = type === 'lost' ? lostApi : foundApi;
      const { data } = await api.getAll({
        page: pageToLoad, limit: PAGE_SIZE, sortBy: filters.sortBy,
        ...(filters.search && { search: filters.search }),
        ...(filters.category && { category: filters.category }),
        ...(filters.building && { building: filters.building }),
      });
      if (id !== requestId.current) return; // a newer request superseded this one
      setItems((prev) => (pageToLoad === 1 ? data.items : [...prev, ...data.items]));
      setTotal(data.total);
      setPages(data.pages);
      setPage(pageToLoad);
    } catch {
      if (id === requestId.current && pageToLoad === 1) setItems([]);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [filterKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchPage(1); }, [fetchPage]);
  useEffect(() => { setSearchInput(filters.search); }, [filters.search]);

  const active = [
    filters.search && ['search', `“${filters.search}”`],
    filters.category && ['category', filters.category],
    filters.building && ['building', filters.building],
  ].filter(Boolean);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display font-bold text-2xl text-[var(--color-ink-900)]">Browse reports</h1>
          <p className="text-sm text-[var(--color-ink-500)] mt-1">
            {loading && page === 1 ? 'Searching...' : `${total} open ${type} report${total === 1 ? '' : 's'}`}
          </p>
        </div>
        <div className="flex bg-[var(--color-canvas-dark)] p-1 rounded-lg" role="tablist">
          {[['found', 'Found items'], ['lost', 'Lost items']].map(([t, label]) => (
            <button key={t} role="tab" aria-selected={type === t} onClick={() => update({ type: t })}
              className={`px-4 py-1.5 rounded-md text-sm font-semibold ${type === t ? 'bg-white shadow-sm text-[var(--color-ink-900)]' : 'text-[var(--color-ink-500)]'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="card border border-[var(--color-ink-100)] p-4 mb-4 grid gap-3 md:grid-cols-[1fr_180px_200px_160px]">
        <form onSubmit={(e) => { e.preventDefault(); update({ search: searchInput.trim() }); }} className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-ink-400)]" />
          <input className="input pl-9" placeholder="Search title, description or colour" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} aria-label="Search" />
        </form>
        <select className="input" value={filters.category} onChange={(e) => update({ category: e.target.value })} aria-label="Category">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="input" value={filters.building} onChange={(e) => update({ building: e.target.value })} aria-label="Building">
          <option value="">Anywhere on campus</option>
          {buildings.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <select className="input" value={filters.sortBy} onChange={(e) => update({ sortBy: e.target.value === 'createdAt' ? '' : e.target.value })} aria-label="Sort">
          <option value="createdAt">Newest reports</option>
          <option value="date">{type === 'lost' ? 'Date lost' : 'Date found'}</option>
          <option value="views">Most viewed</option>
        </select>
      </div>

      {active.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-5">
          {active.map(([key, label]) => (
            <button key={key} onClick={() => update({ [key]: '' })} className="badge badge-violet py-1 gap-1.5">
              {label} <X className="w-3 h-3" />
            </button>
          ))}
          <button onClick={() => setParams(type === 'lost' ? { type } : {}, { replace: true })} className="text-xs font-semibold text-[var(--color-ink-500)] hover:text-[var(--color-ink-900)]">Clear all</button>
        </div>
      )}

      {loading && page === 1 && items.length === 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => <div key={i} className="card p-4"><div className="skeleton h-40 w-full rounded-lg mb-3" /><div className="skeleton h-3 w-2/3" /></div>)}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={Search} title="Nothing matches those filters"
          desc={type === 'found' ? 'If you lost something, report it – you will be notified the moment a matching item is found.' : 'Try another category or building.'}
          action={type === 'found' ? { label: 'Report a lost item', to: '/report/lost' } : undefined} />
      ) : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {items.map((item) => <ItemCard key={item._id} item={item} type={type} />)}
          </div>
          {page < pages && (
            <div className="text-center mt-8">
              <button onClick={() => fetchPage(page + 1)} disabled={loading} className="btn btn-ghost">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Loading...</> : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
