import React, { useState, useCallback, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import NotificationBell from './NotificationBell';
import {
  Dashboard as DashboardIcon,
  ReceiptLong as TxIcon,
  SmartToy as ChatIcon,
  Logout as LogoutIcon,
  DarkMode,
  LightMode,
  AccountBalanceWallet,
  TrackChanges,
  BarChart,
  Person as PersonOutline,
  TrendingUp,
  Flag,
  Repeat,
  Menu as MenuIcon,
  Close as CloseIcon,
  ChevronLeft,
  ChevronRight,
} from '@mui/icons-material';

/* ─────────────────────────────────────────────
   CSS injected once — all transitions live here
   so React re-renders never interrupt them.
───────────────────────────────────────────── */
const SIDEBAR_STYLES = `
  .wb-sidebar {
    width: 64px;
    min-width: 64px;
    transition:
      width 0.35s cubic-bezier(0.4, 0, 0.2, 1),
      min-width 0.35s cubic-bezier(0.4, 0, 0.2, 1);
    will-change: width;
    overflow: hidden;
  }
  .wb-sidebar[data-open="true"] {
    width: 240px;
    min-width: 240px;
  }

  /* Labels: fade + slide in */
  .wb-label {
    max-width: 0;
    opacity: 0;
    overflow: hidden;
    white-space: nowrap;
    transition:
      max-width 0.32s cubic-bezier(0.4, 0, 0.2, 1),
      opacity   0.28s cubic-bezier(0.4, 0, 0.2, 1);
    display: inline-block;
  }
  .wb-sidebar[data-open="true"] .wb-label {
    max-width: 180px;
    opacity: 1;
  }

  /* Section headings */
  .wb-section-title {
    max-height: 0;
    opacity: 0;
    overflow: hidden;
    transition:
      max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1),
      opacity    0.25s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .wb-sidebar[data-open="true"] .wb-section-title {
    max-height: 32px;
    opacity: 1;
  }

  /* Brand text */
  .wb-brand-text {
    max-width: 0;
    opacity: 0;
    overflow: hidden;
    white-space: nowrap;
    transition:
      max-width 0.32s cubic-bezier(0.4, 0, 0.2, 1),
      opacity   0.25s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
  }
  .wb-sidebar[data-open="true"] .wb-brand-text {
    max-width: 160px;
    opacity: 1;
  }

  /* Nav link base — centred icons when collapsed, left-aligned when expanded */
  .wb-nav-link {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 9px 0;
    justify-content: center;
    border-radius: 12px;
    font-family: 'Inter', sans-serif;
    font-weight: 600;
    font-size: 13.5px;
    text-decoration: none;
    transition:
      background 0.15s ease,
      color 0.15s ease,
      border-color 0.15s ease,
      padding 0.32s cubic-bezier(0.4, 0, 0.2, 1);
    border-left: 3px solid transparent;
    margin-bottom: 2px;
    overflow: hidden;
  }
  .wb-sidebar[data-open="true"] .wb-nav-link {
    padding: 9px 12px;
    justify-content: flex-start;
  }

  /* User meta text */
  .wb-user-meta {
    max-width: 0;
    opacity: 0;
    overflow: hidden;
    white-space: nowrap;
    transition:
      max-width 0.32s cubic-bezier(0.4, 0, 0.2, 1),
      opacity   0.25s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .wb-sidebar[data-open="true"] .wb-user-meta {
    max-width: 160px;
    opacity: 1;
  }

  /* Theme / logout buttons */
  .wb-action-btn {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 8px 0;
    border-radius: 12px;
    border: none;
    background: transparent;
    cursor: pointer;
    font-family: 'Inter', sans-serif;
    font-size: 13px;
    font-weight: 600;
    transition:
      background 0.15s ease,
      padding    0.32s cubic-bezier(0.4, 0, 0.2, 1);
    overflow: hidden;
  }
  .wb-sidebar[data-open="true"] .wb-action-btn {
    padding: 8px 10px;
    justify-content: space-between;
  }

  /* Mobile drawer */
  .wb-drawer {
    transform: translateX(-100%);
    transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .wb-drawer[data-open="true"] {
    transform: translateX(0);
  }
  .wb-overlay {
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.28s ease;
  }
  .wb-overlay[data-open="true"] {
    opacity: 1;
    pointer-events: all;
  }
`;

const NAV_ITEMS = [
  { name: 'Dashboard',     path: '/dashboard',    icon: <DashboardIcon fontSize="small" /> },
  { name: 'Transactions',  path: '/transactions', icon: <TxIcon fontSize="small" /> },
  { name: 'Budgets',       path: '/budgets',       icon: <TrackChanges fontSize="small" /> },
  { name: 'Goals',         path: '/goals',         icon: <Flag fontSize="small" /> },
  { name: 'Subscriptions', path: '/subscriptions',icon: <Repeat fontSize="small" /> },
  { name: 'Portfolio',     path: '/portfolio',     icon: <TrendingUp fontSize="small" />, badge: 'NEW' },
  { name: 'Reports',       path: '/reports',       icon: <BarChart fontSize="small" /> },
  { name: 'AI Chatbot',    path: '/chatbot',       icon: <ChatIcon fontSize="small" /> },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const isDark = theme === 'dark';

  /* ── Desktop: sidebar expand/collapse is click-to-toggle, not hover ── */
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const toggleSidebar = useCallback(() => {
    setSidebarOpen(o => !o);
  }, []);

  /* ── Mobile drawer: React state OK (full re-render on open/close is fine) ── */
  const [mobileOpen, setMobileOpen] = useState(false);

  /* MobileNav's bell (below) and Navbar.jsx's bell are both always mounted (CSS
     toggles which is visible per Tailwind's `md` breakpoint), so track viewport
     width to make only the visible one actually fetch alerts — avoids doubling
     every alert API call. */
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 768px)').matches : true
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const handler = (e) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const handleLogout = () => { logout(); navigate('/login'); };

  const avatarColor = user?.avatarColor || '#4F46E5';
  const initials    = user?.username ? user.username.substring(0, 2).toUpperCase() : 'U';

  /* ── Design tokens ── */
  const bg          = isDark ? 'rgba(11,17,32,0.88)'       : 'rgba(248,250,252,0.88)';
  const border      = isDark ? 'rgba(255,255,255,0.07)'  : 'rgba(0,0,0,0.07)';
  const textPrimary = isDark ? '#f9fafb'                 : '#111827';
  const textSub     = isDark ? '#6b7280'                 : '#9ca3af';
  const hoverBg     = isDark ? 'rgba(255,255,255,0.06)'  : 'rgba(0,0,0,0.05)';
  const activeBg    = isDark ? 'rgba(13,148,136,0.15)'   : 'rgba(13,148,136,0.12)';
  const activeColor = isDark ? '#2DD4BF' : '#0D9488';

  /* ── Reusable nav link (renders identically in sidebar & drawer) ── */
  const NavItem = ({ item, onClick }) => (
    <NavLink
      to={item.path}
      onClick={onClick}
      title={item.name}
      className="wb-nav-link"
      style={({ isActive }) => ({
        color:      isActive ? activeColor : (isDark ? '#9ca3af' : '#6b7280'),
        background: isActive ? activeBg   : 'transparent',
        borderLeftColor: isActive ? activeColor : 'transparent',
      })}
      onMouseEnter={e => !e.currentTarget.style.background.includes('rgba(13,148,136') && (e.currentTarget.style.background = hoverBg)}
      onMouseLeave={e => !e.currentTarget.style.background.includes('rgba(13,148,136') && (e.currentTarget.style.background = 'transparent')}
    >
      <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>{item.icon}</span>
      <span className="wb-label">{item.name}</span>
      {item.badge && (
        <span className="wb-label" style={{
          fontSize: 8, fontWeight: 800, padding: '2px 5px',
          borderRadius: 4, background: '#16A34A', color: 'white',
          letterSpacing: '0.05em',
        }}>{item.badge}</span>
      )}
    </NavLink>
  );

  /* ── Desktop sidebar ── */
  const DesktopSidebar = () => (
    <aside
      data-open={sidebarOpen ? 'true' : 'false'}
      className="wb-sidebar"
      style={{
        position: 'sticky', top: 0, height: '100vh',
        display: 'flex', flexDirection: 'column', flexShrink: 0,
        background: bg, backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
        borderRight: `1px solid ${border}`, zIndex: 20,
      }}
    >
      {/* ── Brand ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 10, padding: '16px 0', minHeight: 60, flexShrink: 0,
        borderBottom: `1px solid ${border}`,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 9, flexShrink: 0,
          background: 'linear-gradient(135deg, #0D9488, #4F46E5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 16px rgba(13,148,136,0.35)',
        }}>
          <AccountBalanceWallet style={{ fontSize: 16, color: 'white' }} />
        </div>
        <span className="wb-brand-text" style={{ fontSize: 16, fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: textPrimary }}>
          Wealth<span style={{ color: '#0D9488' }}>AI</span>
        </span>
      </div>

      {/* ── Nav ── */}
      <nav style={{ flex: 1, padding: '10px 6px', overflowY: 'auto', overflowX: 'hidden' }}>
        <p className="wb-section-title" style={{
          fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase',
          letterSpacing: '0.1em', color: textSub, padding: '0 8px', marginBottom: 4,
        }}>Main Menu</p>

        {NAV_ITEMS.map(item => <NavItem key={item.name} item={item} />)}

        <div style={{ height: 1, background: border, margin: '8px 4px' }} />

        <p className="wb-section-title" style={{
          fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase',
          letterSpacing: '0.1em', color: textSub, padding: '0 8px', marginBottom: 4,
        }}>Account</p>
        <NavItem item={{ name: 'Profile & Settings', path: '/profile', icon: <PersonOutline fontSize="small" /> }} />
      </nav>

      {/* ── Actions (user identity + logout now live in Navbar's avatar menu) ── */}
      <div style={{ padding: '8px 6px', borderTop: `1px solid ${border}`, flexShrink: 0 }}>
        {/* Theme toggle */}
        <button
          className="wb-action-btn"
          onClick={toggleTheme}
          title="Toggle Theme"
          style={{ color: textSub }}
          onMouseEnter={e => e.currentTarget.style.background = hoverBg}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <span className="wb-label" style={{ flex: 1, textAlign: 'left' }}>Theme</span>
          {isDark
            ? <LightMode style={{ fontSize: 18, color: '#f59e0b', flexShrink: 0 }} />
            : <DarkMode  style={{ fontSize: 18, color: '#4F46E5', flexShrink: 0 }} />}
        </button>
      </div>
    </aside>
  );

  /* ── Mobile top-bar + slide-in drawer ── */
  const MobileNav = () => (
    <>
      {/* Top bar */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px',
        background: isDark ? 'rgba(11,17,32,0.93)' : 'rgba(248,250,252,0.93)',
        backdropFilter: 'blur(20px)', borderBottom: `1px solid ${border}`,
      }}>
        <button onClick={() => setMobileOpen(true)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: textSub, display: 'flex', padding: 4 }}>
          <MenuIcon />
        </button>
        <span style={{ fontSize: 16, fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: textPrimary }}>
          Wealth<span style={{ color: '#0D9488' }}>AI</span>
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <NotificationBell active={!isDesktop} />
          <button onClick={toggleTheme} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: textSub, display: 'flex', padding: 4 }}>
            {isDark ? <LightMode style={{ fontSize: 18, color: '#f59e0b' }} /> : <DarkMode style={{ fontSize: 18, color: '#4F46E5' }} />}
          </button>
        </div>
      </div>

      {/* Backdrop */}
      <div
        className="wb-overlay"
        data-open={mobileOpen ? 'true' : 'false'}
        onClick={() => setMobileOpen(false)}
        style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
      />

      {/* Drawer */}
      <div
        className="wb-drawer"
        data-open={mobileOpen ? 'true' : 'false'}
        style={{
          position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 70, width: 260,
          background: isDark ? 'rgba(11,17,32,0.99)' : 'rgba(248,250,252,0.99)',
          backdropFilter: 'blur(24px)', borderRight: `1px solid ${border}`,
          display: 'flex', flexDirection: 'column', overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderBottom: `1px solid ${border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg,#0D9488,#4F46E5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AccountBalanceWallet style={{ fontSize: 16, color: 'white' }} />
            </div>
            <span style={{ fontSize: 16, fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: textPrimary }}>
              Wealth<span style={{ color: '#0D9488' }}>AI</span>
            </span>
          </div>
          <button onClick={() => setMobileOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: textSub, display: 'flex', padding: 4 }}>
            <CloseIcon />
          </button>
        </div>

        {user && (
          <div onClick={() => { navigate('/profile'); setMobileOpen(false); }} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer', borderBottom: `1px solid ${border}` }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0, background: avatarColor, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, fontFamily: 'Outfit, sans-serif', boxShadow: `0 0 12px ${avatarColor}55` }}>
              {initials}
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: textPrimary, margin: 0 }}>{user.username}</p>
              <p style={{ fontSize: 12, color: textSub, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</p>
            </div>
          </div>
        )}

        {/* Drawer nav — always show labels */}
        <nav style={{ flex: 1, padding: '12px 10px' }}>
          <p style={{ fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: textSub, padding: '0 8px', marginBottom: 6 }}>Main Menu</p>
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.name}
              to={item.path}
              onClick={() => setMobileOpen(false)}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 12px', borderRadius: 12,
                fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 14,
                textDecoration: 'none', marginBottom: 2,
                color: isActive ? activeColor : (isDark ? '#9ca3af' : '#6b7280'),
                background: isActive ? activeBg : 'transparent',
                borderLeft: `3px solid ${isActive ? activeColor : 'transparent'}`,
              })}
            >
              <span style={{ flexShrink: 0, display: 'flex' }}>{item.icon}</span>
              <span>{item.name}</span>
              {item.badge && <span style={{ fontSize: 8, fontWeight: 800, padding: '2px 5px', borderRadius: 4, background: '#16A34A', color: 'white', marginLeft: 'auto' }}>{item.badge}</span>}
            </NavLink>
          ))}
          <div style={{ height: 1, background: border, margin: '8px 4px' }} />
          <p style={{ fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: textSub, padding: '0 8px', marginBottom: 6 }}>Account</p>
          <NavLink to="/profile" onClick={() => setMobileOpen(false)} style={({ isActive }) => ({ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 14, textDecoration: 'none', color: isActive ? activeColor : (isDark ? '#9ca3af' : '#6b7280'), background: isActive ? activeBg : 'transparent', borderLeft: `3px solid ${isActive ? activeColor : 'transparent'}` })}>
            <PersonOutline fontSize="small" />
            <span>Profile &amp; Settings</span>
          </NavLink>
        </nav>

        <div style={{ padding: '10px', borderTop: `1px solid ${border}` }}>
          <button onClick={toggleTheme} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '10px 12px', borderRadius: 12, border: 'none', background: 'transparent', color: textSub, cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
            <span>Theme Mode</span>
            {isDark ? <LightMode style={{ fontSize: 18, color: '#f59e0b' }} /> : <DarkMode style={{ fontSize: 18, color: '#4F46E5' }} />}
          </button>
          <button onClick={() => { handleLogout(); setMobileOpen(false); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 12, border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 600 }}>
            <LogoutIcon style={{ fontSize: 18 }} /> Sign Out
          </button>
        </div>
      </div>

      <div style={{ height: 56 }} />
    </>
  );

  return (
    <>
      {/* Inject CSS once */}
      <style>{SIDEBAR_STYLES}</style>

      {/* Desktop */}
      <div className="hidden md:flex" style={{ position: 'relative' }}>
        <DesktopSidebar />

        {/* Collapse/expand toggle handle — rendered outside the sidebar's own
            overflow:hidden box (used for the collapse-width animation) so it
            never gets clipped, with a solid background so it's always visible
            against both the sidebar and the page behind it. */}
        <button
          onClick={toggleSidebar}
          title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          style={{
            position: 'absolute', top: 72, left: sidebarOpen ? 228 : 52, zIndex: 30,
            width: 26, height: 26, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: isDark ? '#131C2E' : '#FFFFFF',
            border: `1.5px solid ${activeColor}66`,
            color: activeColor, cursor: 'pointer', padding: 0,
            boxShadow: isDark ? '0 2px 10px rgba(0,0,0,0.4)' : '0 2px 10px rgba(15,23,42,0.18)',
            transition: 'left 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {sidebarOpen ? <ChevronLeft style={{ fontSize: 17 }} /> : <ChevronRight style={{ fontSize: 17 }} />}
        </button>
      </div>

      {/* Mobile */}
      <div className="md:hidden">
        <MobileNav />
      </div>
    </>
  );
}
