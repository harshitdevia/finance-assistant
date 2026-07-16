import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import NotificationBell from './NotificationBell';
import QuickAddModal from './QuickAddModal';
import {
  Search as SearchIcon,
  Add as AddIcon,
  Logout as LogoutIcon,
  Person as PersonIcon,
  ExpandMore,
} from '@mui/icons-material';

// Pages available for the quick-navigation search and for the page-title lookup.
const PAGES = [
  { name: 'Dashboard', path: '/dashboard' },
  { name: 'Transactions', path: '/transactions' },
  { name: 'Budgets', path: '/budgets' },
  { name: 'Goals', path: '/goals' },
  { name: 'Subscriptions', path: '/subscriptions' },
  { name: 'Portfolio', path: '/portfolio' },
  { name: 'Reports', path: '/reports' },
  { name: 'AI Chatbot', path: '/chatbot' },
  { name: 'Profile & Settings', path: '/profile' },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const isDark = theme === 'dark';

  const currentTitle = PAGES.find(p => p.path === location.pathname)?.name || 'WealthAI';

  // Same pattern as Sidebar.jsx: two NotificationBell instances exist at once
  // (this one for desktop, MobileNav's for mobile) — only the visible one should fetch.
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 768px)').matches : true
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const handler = (e) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const [showQuickAdd, setShowQuickAdd] = useState(false);

  /* ── Quick-navigation search ── */
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef(null);

  const searchItems = useMemo(() => [
    ...PAGES.map(p => ({ type: 'page', name: p.name, path: p.path })),
    { type: 'action', name: 'Add Transaction', run: () => setShowQuickAdd(true) },
  ], []);

  const filteredItems = query.trim()
    ? searchItems.filter(item => item.name.toLowerCase().includes(query.trim().toLowerCase()))
    : [];

  const selectItem = (item) => {
    if (item.type === 'page') navigate(item.path);
    else item.run();
    setQuery('');
    setSearchOpen(false);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter' && filteredItems.length > 0) {
      selectItem(filteredItems[0]);
    } else if (e.key === 'Escape') {
      setQuery('');
      setSearchOpen(false);
      e.currentTarget.blur();
    }
  };

  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setSearchOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* ── User avatar dropdown ── */
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => { logout(); navigate('/login'); };

  /* ── Design tokens (mirrors Sidebar.jsx) ── */
  const bg = isDark ? 'rgba(11,17,32,0.88)' : 'rgba(248,250,252,0.88)';
  const border = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
  const textPrimary = isDark ? '#f9fafb' : '#111827';
  const textSub = isDark ? '#6b7280' : '#9ca3af';
  const hoverBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
  const activeColor = isDark ? '#2DD4BF' : '#0D9488';
  const avatarColor = user?.avatarColor || '#4F46E5';
  const initials = user?.username ? user.username.substring(0, 2).toUpperCase() : 'U';

  return (
    <div
      className="hidden md:flex"
      style={{
        position: 'sticky', top: 0, zIndex: 15,
        alignItems: 'center', justifyContent: 'space-between',
        gap: 16, padding: '0 24px', height: 64, flexShrink: 0,
        background: bg, backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
        borderBottom: `1px solid ${border}`,
      }}
    >
      {/* Page title */}
      <h1 style={{
        fontSize: 17, fontWeight: 800, fontFamily: 'Outfit, sans-serif',
        color: textPrimary, whiteSpace: 'nowrap', flexShrink: 0,
      }}>
        {currentTitle}
      </h1>

      {/* Quick-navigation search */}
      <div ref={searchRef} style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
          borderRadius: 10, padding: '8px 12px',
        }}>
          <SearchIcon style={{ fontSize: 18, color: textSub, flexShrink: 0 }} />
          <input
            value={query}
            onChange={e => { setQuery(e.target.value); setSearchOpen(true); }}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search pages, actions..."
            style={{
              background: 'transparent', border: 'none', outline: 'none',
              color: textPrimary, fontSize: 13, fontFamily: 'Inter, sans-serif',
              width: '100%',
            }}
          />
        </div>

        {searchOpen && filteredItems.length > 0 && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
            background: isDark ? '#131C2E' : '#FFFFFF',
            border: `1px solid ${border}`, borderRadius: 12,
            boxShadow: '0 16px 40px rgba(0,0,0,0.25)',
            overflow: 'hidden', zIndex: 40,
          }}>
            {filteredItems.map((item, i) => (
              <div
                key={`${item.type}-${item.name}`}
                onClick={() => selectItem(item)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px', cursor: 'pointer', fontSize: 13,
                  color: textPrimary,
                  borderBottom: i < filteredItems.length - 1 ? `1px solid ${border}` : 'none',
                }}
                onMouseEnter={e => e.currentTarget.style.background = hoverBg}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {item.type === 'action' ? <AddIcon style={{ fontSize: 16, color: activeColor }} /> : null}
                {item.name}
                {item.type === 'page' && <span style={{ marginLeft: 'auto', fontSize: 10, color: textSub }}>Page</span>}
                {item.type === 'action' && <span style={{ marginLeft: 'auto', fontSize: 10, color: textSub }}>Quick action</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right-side actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <button
          onClick={() => setShowQuickAdd(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg, #0D9488, #4F46E5)', color: 'white',
            fontSize: 13, fontWeight: 700, fontFamily: 'Inter, sans-serif',
          }}
        >
          <AddIcon style={{ fontSize: 16 }} />
          Add Transaction
        </button>

        <NotificationBell active={isDesktop} />

        {/* User avatar dropdown */}
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setMenuOpen(o => !o)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: 'transparent', border: 'none', cursor: 'pointer', padding: 4,
              borderRadius: 10,
            }}
          >
            <div style={{
              width: 30, height: 30, borderRadius: '50%',
              background: avatarColor, color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: 11, fontFamily: 'Outfit, sans-serif',
            }}>
              {initials}
            </div>
            <ExpandMore style={{ fontSize: 18, color: textSub }} />
          </button>

          {menuOpen && (
            <div style={{
              position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: 220,
              background: isDark ? '#131C2E' : '#FFFFFF',
              border: `1px solid ${border}`, borderRadius: 14,
              boxShadow: '0 16px 40px rgba(0,0,0,0.25)', overflow: 'hidden', zIndex: 40,
            }}>
              <div style={{ padding: '14px 16px', borderBottom: `1px solid ${border}` }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: textPrimary, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user?.username}
                </p>
                <p style={{ fontSize: 11, color: textSub, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user?.email}
                </p>
              </div>
              <div
                onClick={() => { setMenuOpen(false); navigate('/profile'); }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', cursor: 'pointer', fontSize: 13, color: textPrimary }}
                onMouseEnter={e => e.currentTarget.style.background = hoverBg}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <PersonIcon style={{ fontSize: 16 }} />
                Profile & Settings
              </div>
              <div
                onClick={() => { setMenuOpen(false); handleLogout(); }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', cursor: 'pointer', fontSize: 13, color: '#ef4444' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <LogoutIcon style={{ fontSize: 16 }} />
                Sign Out
              </div>
            </div>
          )}
        </div>
      </div>

      {showQuickAdd && (
        <QuickAddModal
          onClose={() => setShowQuickAdd(false)}
          onAdded={() => {}}
        />
      )}
    </div>
  );
}
