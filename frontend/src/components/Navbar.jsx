import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Bell, User, Menu, X, ChevronDown, LogOut, LayoutDashboard, Settings, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { notifApi } from '../services/api';
import { clsx } from 'clsx';
import NotificationDropdown from './NotificationDropdown';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { connected } = useSocket();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setUserMenuOpen(false);
    setNotifOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!user) return;
    notifApi.getAll({ limit: 1 }).then(({ data }) => setUnreadCount(data.unreadCount)).catch(() => {});
  }, [user]);

  const isActive = (path) => location.pathname === path;

  const navLinks = [
    { to: '/browse', label: 'Browse Items' },
    { to: '/report/lost', label: 'Report Lost' },
    { to: '/report/found', label: 'Report Found' },
  ];

  return (
    <header
      className={clsx(
        'sticky top-0 z-50 transition-all duration-300',
        scrolled
          ? 'bg-white/95 backdrop-blur-md shadow-[0_1px_16px_rgba(13,27,42,0.08)]'
          : 'bg-white/80 backdrop-blur-sm border-b border-[var(--color-ink-100)]'
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group shrink-0">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-violet-600)] flex items-center justify-center transition-transform group-hover:scale-105">
              <Search className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
            <span className="font-display font-800 text-[var(--color-ink-900)] text-lg tracking-tight">
              Find<span className="text-[var(--color-violet-600)]">It</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={clsx(
                  'px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors duration-150',
                  isActive(link.to)
                    ? 'bg-[var(--color-violet-50)] text-[var(--color-violet-600)]'
                    : 'text-[var(--color-ink-700)] hover:bg-[var(--color-canvas-dark)] hover:text-[var(--color-ink-900)]'
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {user ? (
              <>
                {/* Notification Bell */}
                <div className="relative">
                  <button
                    onClick={() => { setNotifOpen(!notifOpen); setUserMenuOpen(false); }}
                    className="btn btn-icon btn-ghost relative"
                    aria-label="Notifications"
                  >
                    <Bell className="w-4.5 h-4.5" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-4 h-4 text-[10px] font-bold bg-[var(--color-amber-500)] text-white rounded-full flex items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>
                  <AnimatePresence>
                    {notifOpen && (
                      <NotificationDropdown
                        onClose={() => setNotifOpen(false)}
                        onCountChange={setUnreadCount}
                      />
                    )}
                  </AnimatePresence>
                </div>

                {/* User menu */}
                <div className="relative">
                  <button
                    onClick={() => { setUserMenuOpen(!userMenuOpen); setNotifOpen(false); }}
                    className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg hover:bg-[var(--color-canvas-dark)] transition-colors"
                  >
                    <div className="w-7 h-7 rounded-full bg-[var(--color-violet-100)] flex items-center justify-center overflow-hidden">
                      {user.avatar ? (
                        <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[var(--color-violet-600)] text-xs font-bold">
                          {user.name?.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <span className="hidden sm:block text-sm font-semibold text-[var(--color-ink-800)]">
                      {user.name?.split(' ')[0]}
                    </span>
                    <ChevronDown className={clsx('w-3.5 h-3.5 text-[var(--color-ink-500)] transition-transform', userMenuOpen && 'rotate-180')} />
                  </button>

                  <AnimatePresence>
                    {userMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.96 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl shadow-[var(--shadow-modal)] border border-[var(--color-ink-100)] py-1 z-50"
                      >
                        <div className="px-3 py-2 border-b border-[var(--color-ink-100)] mb-1">
                          <p className="text-xs font-semibold text-[var(--color-ink-900)]">{user.name}</p>
                          <p className="text-xs text-[var(--color-ink-500)] capitalize">{user.role}</p>
                        </div>
                        {[
                          { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
                          { to: '/profile', icon: Settings, label: 'Profile' },
                          ...(user.role === 'admin' ? [{ to: '/admin', icon: ShieldCheck, label: 'Admin Panel' }] : []),
                        ].map((item) => (
                          <Link
                            key={item.to}
                            to={item.to}
                            className="flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--color-ink-800)] hover:bg-[var(--color-canvas-dark)] transition-colors"
                          >
                            <item.icon className="w-4 h-4 text-[var(--color-ink-500)]" />
                            {item.label}
                          </Link>
                        ))}
                        <div className="border-t border-[var(--color-ink-100)] mt-1 pt-1">
                          <button
                            onClick={() => { logout(); navigate('/'); }}
                            className="flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--color-red-500)] hover:bg-[var(--color-red-100)] w-full text-left transition-colors"
                          >
                            <LogOut className="w-4 h-4" />
                            Log out
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            ) : (
              <div className="hidden sm:flex items-center gap-2">
                <Link to="/login" className="btn btn-ghost btn-sm">Log in</Link>
                <Link to="/register" className="btn btn-primary btn-sm">Get started</Link>
              </div>
            )}

            {/* Mobile hamburger */}
            <button
              className="md:hidden btn btn-icon btn-ghost"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-[var(--color-ink-100)] bg-white"
          >
            <div className="p-4 space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={clsx(
                    'block px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors',
                    isActive(link.to)
                      ? 'bg-[var(--color-violet-50)] text-[var(--color-violet-600)]'
                      : 'text-[var(--color-ink-700)]'
                  )}
                >
                  {link.label}
                </Link>
              ))}
              {!user && (
                <div className="flex gap-2 pt-2">
                  <Link to="/login" className="btn btn-ghost flex-1">Log in</Link>
                  <Link to="/register" className="btn btn-primary flex-1">Get started</Link>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
