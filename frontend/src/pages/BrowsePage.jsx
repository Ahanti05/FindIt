import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Search, SlidersHorizontal, X, ChevronDown } from 'lucide-react';
import { lostApi, foundApi } from '../services/api';
import ItemCard from '../components/ItemCard';
import { useSearchParams } from 'react-router-dom';

const CATEGORIES = [
  'All', 'ID Card', 'Wallet', 'Keys', 'Phone', 'Laptop', 'Bag/Backpack',
  'Watch', 'Earphones/AirPods', 'Charger/Cable', 'Water Bottle',
  'Umbrella', 'Glasses', 'Clothing', 'Books/Notes', 'Jewelry', 'Other',
];

export default function BrowsePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [type, setType] = useState(searchParams.get('type') || 'lost');
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [filters, setFilters] = useState({
    search: searchParams.get('search') || '',
    category: searchParams.get('category') || '',
    building: '',
    sortBy: 'createdAt',
  });

  const [searchInput, setSearchInput] = useState(filters.search);

  const fetchItems = useCallback(async (reset = true) => {
    setLoading(true);
    const currentPage = reset ? 1 : page;
    if (reset) setPage(1);

    const params = {
      page: currentPage,
      limit: 12,
      ...(filters.category && filters.category !== 'All' && { category: filters.category }),
      ...(filters.search && { search: filters.search }),
      ...(filters.building && { building: filters.building }),
      sortBy: filters.sortBy,
    };

    try {
      const api = type === 'lost' ? lostApi : foundApi;
      const { data } = await api.getAll(params);
      setItems(reset ? data.items : (prev) => [...prev, ...data.items]);
      setTotal(data.total);
      setHasMore(currentPage < data.pages);
      if (!reset) setPage((p) => p + 1);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [type, filters]);

  useEffect(() => { fetchItems(true); }, [type, filters]);

  const handleSearch = (e) => {
    e.preventDefault();
    setFilters((f) => ({ ...f, search: searchInput }));
  };

  const clearFilter = (key) => {
    setFilters((f) => ({ ...f, [key]: '' }));
    if (key === 'search') setSearchInput('');
  };

  const activeFilters = Object.entries(filters).filter(([k, v]) => v && k !== 'sortBy' && v !== 'All');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display font-bold text-2xl text-[var(--color-ink-900)]">Browse Items</h1>
        <p className="text-sm text-[var(--color-ink-500)] mt-1">
          {total > 0 ? `${total.toLocaleString()} items on campus` : 'No items found'}
        </p>
      </div>

      {/* Search + type toggle */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        {/* Type toggle */}
        <div className="flex bg-[var(--color-canvas-dark)] p-1 rounded-lg shrink-0">
          {['lost', 'found'].map((t) => (
            <button
              key={t}
              onClick={() => { setType(t); }}
              className={`px-4 py-2 rounded-md text-sm font-semibold capitalize transition-all ${
                type === t ? 'bg-white shadow-sm text-[var(--color-ink-900)]' : 'text-[var(--color-ink-500)]'
              }`}
            >
              {t === 'lost' ? '🔍 Lost' : '📦 Found'}
            </button>
          ))}
        </div>

        {/* Search bar */}
        <form onSubmit={handleSearch} className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-ink-300)]" />
            <input
              className="input pl-9"
              placeholder="Search by name or description..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary px-4">Search</button>
          <button
            type="button"
            onClick={() => setFiltersOpen(!filtersOpen)}
            className={`btn btn-ghost gap-2 ${filtersOpen ? 'bg-[var(--color-violet-50)] border-[var(--color-violet-300)]' : ''}`}
          >
            <SlidersHorizontal className="w-4 h-4" /> Filters
          </button>
        </form>
      </div>

      {/* Filter panel */}
      {filtersOpen && (
        <motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="card border border-[var(--color-ink-100)] p-5 mb-5 grid sm:grid-cols-3 gap-4"
        >
          {/* Category */}
          <div>
            <label className="label">Category</label>
            <div className="relative">
              <select
                className="input appearance-none pr-8"
                value={filters.category}
                onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
              >
                {CATEGORIES.map((c) => <option key={c} value={c === 'All' ? '' : c}>{c}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-ink-300)] pointer-events-none" />
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="label">Building</label>
            <input
              className="input"
              placeholder="e.g. Main Library"
              value={filters.building}
              onChange={(e) => setFilters((f) => ({ ...f, building: e.target.value }))}
            />
          </div>

          {/* Sort */}
          <div>
            <label className="label">Sort by</label>
            <div className="relative">
              <select
                className="input appearance-none pr-8"
                value={filters.sortBy}
                onChange={(e) => setFilters((f) => ({ ...f, sortBy: e.target.value }))}
              >
                <option value="createdAt">Most Recent</option>
                <option value="lostDate">Date Lost/Found</option>
                <option value="views">Most Viewed</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-ink-300)] pointer-events-none" />
            </div>
          </div>
        </motion.div>
      )}

      {/* Active filter chips */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5">
          {activeFilters.map(([key, value]) => (
            <span key={key} className="badge badge-violet gap-1.5">
              {value}
              <button onClick={() => clearFilter(key)} className="hover:text-white">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <button
            onClick={() => { setFilters({ search: '', category: '', building: '', sortBy: 'createdAt' }); setSearchInput(''); }}
            className="text-xs text-[var(--color-ink-500)] hover:text-[var(--color-ink-900)] font-semibold"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Items grid */}
      {loading && items.length === 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="card p-4">
              <div className="skeleton h-44 w-full rounded-lg mb-4" />
              <div className="skeleton h-3 w-2/3 mb-2" />
              <div className="skeleton h-2.5 w-full" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20">
          <Search className="w-10 h-10 text-[var(--color-ink-300)] mx-auto mb-3" />
          <h3 className="font-display font-bold text-lg text-[var(--color-ink-800)] mb-2">No items found</h3>
          <p className="text-sm text-[var(--color-ink-500)]">Try adjusting your search or filters.</p>
        </div>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {items.map((item, i) => (
              <motion.div
                key={item._id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.3) }}
              >
                <ItemCard item={item} type={type} />
              </motion.div>
            ))}
          </div>

          {/* Load more */}
          {hasMore && (
            <div className="text-center mt-8">
              <button
                onClick={() => fetchItems(false)}
                disabled={loading}
                className="btn btn-ghost gap-2"
              >
                {loading ? 'Loading...' : 'Load more items'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
