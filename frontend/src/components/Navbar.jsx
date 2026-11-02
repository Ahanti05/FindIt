import { useState, useEffect, useCallback } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Menu, X, ChevronDown, LogOut, LayoutDashboard, Settings, ShieldCheck, Coins } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useSocket, useSocketEvent } from '../context/SocketContext';
import { notifApi } from '../services/api';
import { clsx } from 'clsx';
import NotificationDropdown from './NotificationDropdown';
import { Avatar } from './ui';
import { Coin } from './Owl';
import { useCoins } from '../context/CoinContext';

export function Logo({ dark = false }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="w-8 h-8 rounded-lg bg-[var(--color-violet-600)] flex items-center justify-center font-display font-extrabold text-white text-base">F</span>
      <span className={clsx('font-display font-extrabold text-lg tracking-tight', dark ? 'text-white' : 'text-[var(--color-ink-900)]')}>FindIt</span>
    </span>
  );
}

const NAV_LINKS = [
  { to: '/browse', label: 'Browse' },
  { to: '/report/lost', label: 'Report lost' },
  { to: '/report/found', label: 'Report found' },
];

// Coin balance; counts up one coin at a time when a reward arrives.
function CoinBadge() {
  const { shown, lastDelta } = useCoins();
  return (
    <Link
      to="/coins"
      className="relative flex items-center gap-1.5 pl-2 pr-2.5 py-1.5 rounded-full bg-[var(--color-amber-50)] border border-[var(--color-amber-100)] hover:border-[var(--color-amber-400)] transition-colors"
      aria-label={`${shown} FindIt coins`}
      title="Your FindIt coins"
    >
      <Coin size={18} className={lastDelta ? 'coin-bump' : undefined} key={shown} />
      <span className="text-sm font-bold text-[#92400e] tabular-nums">{shown}</span>
      {lastDelta?.amount > 0 && <span key={lastDelta.key} className="coin-pop">+{lastDelta.amount}</span>}
    </Link>
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const { connected } = useSocket();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    setMobileOpen(false);
    setUserMenuOpen(false);
    setNotifOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!user) { setUnreadCount(0); return; }
    notifApi.getAll({ limit: 1 }).then(({ data }) => setUnreadCount(data.unreadCount)).catch(() => {});
  }, [user]);

  const onNotification = useCallback((n) => {
    setUnreadCount((c) => c + 1);
    toast(n.title, { icon: <Bell className="w-4 h-4 text-[var(--color-violet-600)]" /> });
  }, []);
  useSocketEvent('notification', onNotification);

  const doLogout = () => { logout(); navigate('/'); toast.success('Signed out'); };

  const menuItems = user ? [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/coins', icon: Coins, label: 'FindIt coins' },
    { to: '/profile', icon: Settings, label: 'Profile' },
    ...(user.role === 'admin' ? [{ to: '/admin', icon: ShieldCheck, label: 'Admin' }] : []),
  ] : [];

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-[var(--color-ink-100)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="shrink-0" aria-label="FindIt home"><Logo /></Link>

          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) => clsx(
                  'px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors',
                  isActive
                    ? 'bg-[var(--color-violet-50)] text-[var(--color-violet-600)]'
                    : 'text-[var(--color-ink-700)] hover:bg-[var(--color-canvas-dark)]'
                )}
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-1.5">
            {user ? (
              <>
                <CoinBadge />
                <div className="relative">
                  <button
                    onClick={() => { setNotifOpen(!notifOpen); setUserMenuOpen(false); }}
                    className="btn btn-icon btn-ghost relative border-0"
                    aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ''}`}
                    title={connected ? 'Live updates on' : 'Reconnecting...'}
                  >
                    <Bell className="w-[18px] h-[18px]" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 text-[10px] font-bold bg-[var(--color-amber-500)] text-white rounded-full flex items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>
                  <AnimatePresence>
                    {notifOpen && (
                      <NotificationDropdown onClose={() => setNotifOpen(false)} onCountChange={setUnreadCount} />
                    )}
                  </AnimatePresence>
                </div>

                <div className="relative hidden md:block">
                  <button
                    onClick={() => { setUserMenuOpen(!userMenuOpen); setNotifOpen(false); }}
                    className="flex items-center gap-2 pl-1.5 pr-2.5 py-1.5 rounded-lg hover:bg-[var(--color-canvas-dark)] transition-colors"
                    aria-haspopup="menu"
                    aria-expanded={userMenuOpen}
                  >
                    <Avatar user={user} size="w-7 h-7" text="text-xs" />
                    <span className="text-sm font-semibold text-[var(--color-ink-800)]">{user.name?.split(' ')[0]}</span>
                    <ChevronDown className={clsx('w-3.5 h-3.5 text-[var(--color-ink-500)] transition-transform', userMenuOpen && 'rotate-180')} />
                  </button>

                  <AnimatePresence>
                    {userMenuOpen && (
                      <motion.div
                        role="menu"
                        initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.12 }}
                        className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl shadow-[var(--shadow-modal)] border border-[var(--color-ink-100)] py-1 z-50"
                      >
                        <div className="px-3 py-2 border-b border-[var(--color-ink-100)] mb-1">
                          <p className="text-sm font-semibold text-[var(--color-ink-900)] truncate">{user.name}</p>
                          <p className="text-xs text-[var(--color-ink-500)] truncate">{user.email}</p>
                        </div>
                        {menuItems.map((item) => (
                          <Link key={item.to} to={item.to} role="menuitem" className="flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--color-ink-800)] hover:bg-[var(--color-canvas-dark)]">
                            <item.icon className="w-4 h-4 text-[var(--color-ink-500)]" />{item.label}
                          </Link>
                        ))}
                        <div className="border-t border-[var(--color-ink-100)] mt-1 pt-1">
                          <button onClick={doLogout} role="menuitem" className="flex items-center gap-2.5 px-3 py-2 text-sm text-[#b91c1c] hover:bg-[var(--color-red-100)] w-full text-left">
                            <LogOut className="w-4 h-4" /> Sign out
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            ) : (
              <div className="hidden sm:flex items-center gap-2">
                <Link to="/login" className="btn btn-ghost btn-sm">Sign in</Link>
                <Link to="/register" className="btn btn-primary btn-sm">Create account</Link>
              </div>
            )}

            <button
              className="md:hidden btn btn-icon btn-ghost border-0"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.nav
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-[var(--color-ink-100)] bg-white overflow-hidden"
          >
            <div className="p-3 space-y-0.5">
              {[...NAV_LINKS, ...menuItems].map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) => clsx(
                    'block px-3 py-2.5 rounded-lg text-sm font-semibold',
                    isActive ? 'bg-[var(--color-violet-50)] text-[var(--color-violet-600)]' : 'text-[var(--color-ink-700)]'
                  )}
                >
                  {link.label}
                </NavLink>
              ))}
              {user ? (
                <button onClick={doLogout} className="block w-full text-left px-3 py-2.5 rounded-lg text-sm font-semibold text-[#b91c1c]">Sign out</button>
              ) : (
                <div className="flex gap-2 pt-2">
                  <Link to="/login" className="btn btn-ghost flex-1">Sign in</Link>
                  <Link to="/register" className="btn btn-primary flex-1">Create account</Link>
                </div>
              )}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
