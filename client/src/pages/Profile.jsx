import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import {
  Person, AttachMoney, Lock, BarChart, Save, Visibility,
  VisibilityOff, DeleteForever, Logout, WorkspacePremium,
  CalendarMonth, AccountBalance, TrendingUp, Receipt,
} from '@mui/icons-material';
import { CircularProgress } from '@mui/material';

const CURRENCY_OPTIONS = [
  { symbol: '₹', label: 'Indian Rupee (₹)' },
  { symbol: '$', label: 'US Dollar ($)' },
  { symbol: '€', label: 'Euro (€)' },
  { symbol: '£', label: 'British Pound (£)' },
  { symbol: '¥', label: 'Japanese Yen (¥)' },
  { symbol: '₩', label: 'South Korean Won (₩)' },
];

const AVATAR_COLORS = [
  '#4F46E5', '#0D9488', '#f59e0b', '#ef4444', '#ec4899',
  '#8b5cf6', '#3b82f6', '#16A34A', '#f97316', '#06b6d4',
  '#e11d48', '#84cc16',
];

const TABS = [
  { id: 'personal', label: 'Personal', icon: <Person fontSize="small" /> },
  { id: 'security', label: 'Security', icon: <Lock fontSize="small" /> },
  { id: 'stats', label: 'Account Stats', icon: <BarChart fontSize="small" /> },
];

export default function Profile() {
  const { user, login, logout } = useAuth();
  const { theme } = useTheme();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState('personal');
  const [username, setUsername] = useState(user?.username || '');
  const [monthlyIncome, setMonthlyIncome] = useState(user?.monthlyIncome || '');
  const [currency, setCurrency] = useState(user?.currency || '₹');
  const [avatarColor, setAvatarColor] = useState(user?.avatarColor || '#4F46E5');
  const [saving, setSaving] = useState(false);

  // Security tab
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwdSaving, setPwdSaving] = useState(false);

  // Stats tab
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Delete modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [deleting, setDeleting] = useState(false);

  const isDark = theme === 'dark';
  const card = isDark ? 'glass-card-dark' : 'glass-card-light';
  const text = isDark ? 'text-white' : 'text-gray-900';
  const sub = isDark ? 'text-gray-400' : 'text-gray-500';

  const inputStyle = {
    background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)'}`,
    borderRadius: '12px', padding: '12px 16px',
    color: isDark ? '#f9fafb' : '#111827',
    fontSize: '14px', width: '100%', outline: 'none',
    fontFamily: 'Inter, sans-serif', transition: 'border-color 0.2s',
  };

  // Load stats when switching to stats tab
  useEffect(() => {
    if (activeTab === 'stats' && !stats) {
      loadStats();
    }
  }, [activeTab]);

  const loadStats = async () => {
    setStatsLoading(true);
    try {
      const [summaryRes, txRes] = await Promise.all([
        api.get('/analytics/summary'),
        api.get('/transactions'),
      ]);
      const txs = txRes.data || [];
      const totalIncome = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const totalExpense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      setStats({
        totalTransactions: txs.length,
        totalIncome,
        totalExpense,
        netSavings: summaryRes.data.netSavings || 0,
        savingsRate: summaryRes.data.savingsRate || 0,
        anomalyCount: txs.filter(t => t.isAnomaly).length,
        memberSince: user?.createdAt
          ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
          : '—',
        accountId: user?._id ? `#${user._id.slice(-8).toUpperCase()}` : '—',
      });
    } catch {
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!username.trim()) { showToast('Username cannot be empty', 'warning'); return; }
    setSaving(true);
    try {
      const res = await api.put('/auth/profile', {
        username: username.trim(),
        monthlyIncome: Number(monthlyIncome) || 0,
        currency, avatarColor,
      });
      const stored = JSON.parse(sessionStorage.getItem('user') || '{}');
      sessionStorage.setItem('user', JSON.stringify({ ...stored, ...res.data }));
      login({ ...stored, ...res.data });
      showToast('Profile updated successfully! ✅', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!currentPwd || !newPwd || !confirmPwd) {
      showToast('Please fill in all password fields', 'warning'); return;
    }
    if (newPwd.length < 6) {
      showToast('New password must be at least 6 characters', 'warning'); return;
    }
    if (newPwd !== confirmPwd) {
      showToast('New passwords do not match', 'warning'); return;
    }
    setPwdSaving(true);
    try {
      await api.put('/auth/password', { currentPassword: currentPwd, newPassword: newPwd });
      showToast('Password changed successfully! 🔐', 'success');
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to change password', 'error');
    } finally {
      setPwdSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteInput !== username) {
      showToast('Please type your username correctly to confirm', 'warning'); return;
    }
    setDeleting(true);
    try {
      await api.delete('/auth/account');
      showToast('Account deleted. Goodbye 👋', 'success');
      setTimeout(() => logout(), 1500);
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to delete account', 'error');
      setDeleting(false);
    }
  };

  const initials = username ? username.substring(0, 2).toUpperCase() : 'U';

  const gradientBtn = {
    background: 'linear-gradient(135deg, #0D9488, #4F46E5)',
    color: 'white', border: 'none', borderRadius: '12px',
    padding: '12px 28px', fontWeight: 700, fontSize: '15px',
    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
    fontFamily: 'Inter, sans-serif',
    boxShadow: '0 4px 14px rgba(13,148,136,0.3)',
    transition: 'all 0.2s',
  };

  return (
    <div className="space-y-6">
      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="animate-slide-up">
        <h1 className={`text-3xl font-extrabold tracking-tight ${text}`}>Profile & Settings</h1>
        <p className={`text-sm mt-1 ${sub}`}>Manage your account, security, and preferences.</p>
      </div>

      {/* ── Avatar Hero ──────────────────────────────────────────── */}
      <div className={`p-6 rounded-2xl ${card} border animate-slide-up`}>
        <div className="flex items-center gap-5">
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            background: `radial-gradient(circle at 35% 35%, ${avatarColor}dd, ${avatarColor}88)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 30, fontWeight: 800, color: 'white',
            fontFamily: 'Outfit, sans-serif',
            boxShadow: `0 0 28px ${avatarColor}50, 0 4px 14px rgba(0,0,0,0.2)`,
            border: `2px solid ${avatarColor}55`,
            flexShrink: 0,
          }}>
            {initials}
          </div>
          <div>
            <h2 className={`text-xl font-extrabold ${text}`}>{username || 'Your Name'}</h2>
            <p className={`text-sm ${sub}`}>{user?.email}</p>
            <div className="flex items-center gap-2 mt-1.5">
              <WorkspacePremium style={{ color: '#0D9488', fontSize: 16 }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#0D9488', letterSpacing: '0.05em' }}>
                WealthAI Premium Member
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: 4,
        background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
        borderRadius: 14, padding: 4,
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)'}`,
      }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '10px 12px', borderRadius: 10, fontSize: 13, fontWeight: 600,
              cursor: 'pointer', border: 'none', fontFamily: 'Inter, sans-serif',
              transition: 'all 0.2s',
              background: activeTab === tab.id
                ? isDark ? 'rgba(255,255,255,0.09)' : 'white'
                : 'transparent',
              color: activeTab === tab.id
                ? isDark ? '#f9fafb' : '#111827'
                : isDark ? '#6b7280' : '#9ca3af',
              boxShadow: activeTab === tab.id
                ? isDark ? 'none' : '0 2px 8px rgba(0,0,0,0.08)'
                : 'none',
            }}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════
          TAB 1: Personal
      ═══════════════════════════════════════════════════════════ */}
      {activeTab === 'personal' && (
        <form onSubmit={handleSave} className="space-y-5 animate-slide-up">
          <div className={`p-6 rounded-2xl ${card} border space-y-5`}>
            <h3 className={`text-base font-bold ${text} flex items-center gap-2`}>
              <Person style={{ color: '#0D9488', fontSize: 20 }} /> Personal Information
            </h3>

            {/* Avatar color picker */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${sub}`}>Avatar Color</label>
              <div className="flex flex-wrap gap-2">
                {AVATAR_COLORS.map(c => (
                  <button
                    key={c} type="button" onClick={() => setAvatarColor(c)}
                    style={{
                      width: 30, height: 30, borderRadius: '50%', background: c,
                      border: avatarColor === c ? '3px solid white' : '3px solid transparent',
                      cursor: 'pointer',
                      outline: avatarColor === c ? `2px solid ${c}` : 'none',
                      outlineOffset: '2px', transition: 'transform 0.15s',
                      transform: avatarColor === c ? 'scale(1.15)' : 'scale(1)',
                    }}
                  />
                ))}
              </div>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-1.5 ${sub}`}>Display Name</label>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="Your name" style={inputStyle} />
            </div>

            <div>
              <label className={`block text-sm font-medium mb-1 ${sub}`}>Email Address</label>
              <input type="email" value={user?.email || ''} disabled style={{ ...inputStyle, opacity: 0.5, cursor: 'not-allowed' }} />
              <p className={`text-xs mt-1 ${sub}`}>Email cannot be changed.</p>
            </div>
          </div>

          <div className={`p-6 rounded-2xl ${card} border space-y-5`}>
            <h3 className={`text-base font-bold ${text} flex items-center gap-2`}>
              <AttachMoney style={{ color: '#f59e0b', fontSize: 20 }} /> Financial Settings
            </h3>

            <div>
              <label className={`block text-sm font-medium mb-1.5 ${sub}`}>Monthly Income Target</label>
              <input
                type="number" min="0" step="1000"
                value={monthlyIncome} onChange={e => setMonthlyIncome(e.target.value)}
                placeholder="e.g. 50000" style={inputStyle}
              />
              <p className={`text-xs mt-1 ${sub}`}>Used to calculate your financial health score.</p>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-1.5 ${sub}`}>Currency Symbol</label>
              <select value={currency} onChange={e => setCurrency(e.target.value)} style={inputStyle}>
                {CURRENCY_OPTIONS.map(c => <option key={c.symbol} value={c.symbol}>{c.label}</option>)}
              </select>
            </div>
          </div>

          <div className="flex justify-end">
            <button type="submit" disabled={saving} style={{ ...gradientBtn, opacity: saving ? 0.7 : 1 }}>
              {saving ? <CircularProgress size={18} style={{ color: 'white' }} /> : <Save fontSize="small" />}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      )}

      {/* ═══════════════════════════════════════════════════════════
          TAB 2: Security
      ═══════════════════════════════════════════════════════════ */}
      {activeTab === 'security' && (
        <div className="space-y-5 animate-slide-up">
          {/* Change Password */}
          <form onSubmit={handleChangePassword} className={`p-6 rounded-2xl ${card} border space-y-5`}>
            <h3 className={`text-base font-bold ${text} flex items-center gap-2`}>
              <Lock style={{ color: '#4F46E5', fontSize: 20 }} /> Change Password
            </h3>

            {[
              { label: 'Current Password', value: currentPwd, onChange: setCurrentPwd, show: showCurrent, toggle: () => setShowCurrent(p => !p) },
              { label: 'New Password', value: newPwd, onChange: setNewPwd, show: showNew, toggle: () => setShowNew(p => !p) },
              { label: 'Confirm New Password', value: confirmPwd, onChange: setConfirmPwd, show: showNew, toggle: null },
            ].map(({ label, value, onChange, show, toggle }) => (
              <div key={label}>
                <label className={`block text-sm font-medium mb-1.5 ${sub}`}>{label}</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={show ? 'text' : 'password'}
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    placeholder="••••••••"
                    style={{ ...inputStyle, paddingRight: toggle ? 44 : 16 }}
                  />
                  {toggle && (
                    <button
                      type="button" onClick={toggle}
                      style={{
                        position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: isDark ? '#6b7280' : '#9ca3af',
                      }}
                    >
                      {show ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* Password strength hint */}
            {newPwd && (
              <div style={{ fontSize: 12, color: newPwd.length >= 8 ? '#16A34A' : newPwd.length >= 6 ? '#f59e0b' : '#ef4444' }}>
                {newPwd.length >= 8 ? '✅ Strong password' : newPwd.length >= 6 ? '⚠️ Moderate — consider longer password' : '❌ Too short (min 6 chars)'}
              </div>
            )}

            <div className="flex justify-end">
              <button type="submit" disabled={pwdSaving} style={{ ...gradientBtn, background: 'linear-gradient(135deg, #4F46E5, #8b5cf6)', opacity: pwdSaving ? 0.7 : 1 }}>
                {pwdSaving ? <CircularProgress size={18} style={{ color: 'white' }} /> : <Lock fontSize="small" />}
                {pwdSaving ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </form>

          {/* Session */}
          <div className={`p-6 rounded-2xl ${card} border`}>
            <h3 className={`text-base font-bold mb-4 ${text} flex items-center gap-2`}>
              <Logout style={{ color: '#16A34A', fontSize: 20 }} /> Session
            </h3>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: isDark ? 'rgba(22,163,74,0.06)' : 'rgba(22,163,74,0.05)',
              border: '1px solid rgba(22,163,74,0.15)',
              borderRadius: 12, padding: '14px 16px',
            }}>
              <div>
                <p className={`text-sm font-semibold ${text}`}>Active Session</p>
                <p className={`text-xs ${sub}`}>{user?.email} · This device</p>
              </div>
              <button
                type="button" onClick={logout}
                style={{
                  background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                  borderRadius: 8, padding: '7px 14px',
                  color: '#ef4444', fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                }}
              >
                Sign Out
              </button>
            </div>
          </div>

          {/* Danger Zone */}
          <div className={`p-6 rounded-2xl border`} style={{
            borderColor: 'rgba(239,68,68,0.25)',
            background: isDark ? 'rgba(239,68,68,0.04)' : 'rgba(254,242,242,0.8)',
          }}>
            <h3 style={{ color: '#ef4444', fontSize: 15, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <DeleteForever fontSize="small" /> Danger Zone
            </h3>
            <p className={`text-sm mb-4 ${sub}`}>
              Permanently delete your account and all associated data. This action cannot be undone.
            </p>
            <button
              type="button" onClick={() => setShowDeleteModal(true)}
              style={{
                background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: 10, padding: '10px 18px',
                color: '#ef4444', fontSize: 13, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              }}
            >
              Delete My Account
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          TAB 3: Account Stats
      ═══════════════════════════════════════════════════════════ */}
      {activeTab === 'stats' && (
        <div className="animate-slide-up">
          {statsLoading ? (
            <div className="flex justify-center py-12">
              <CircularProgress />
            </div>
          ) : stats ? (
            <div className="space-y-5">
              {/* Grid stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { icon: <Receipt style={{ color: '#4F46E5' }} />, label: 'Total Transactions', value: stats.totalTransactions.toLocaleString(), bg: 'rgba(79,70,229,0.08)' },
                  { icon: <TrendingUp style={{ color: '#16A34A' }} />, label: 'Total Income', value: `₹${stats.totalIncome.toLocaleString()}`, bg: 'rgba(22,163,74,0.08)' },
                  { icon: <AccountBalance style={{ color: '#3b82f6' }} />, label: 'Net Savings', value: `₹${stats.netSavings.toLocaleString()}`, bg: 'rgba(59,130,246,0.08)' },
                  { icon: <CalendarMonth style={{ color: '#0D9488' }} />, label: 'Member Since', value: stats.memberSince, bg: 'rgba(13,148,136,0.08)' },
                ].map((s, i) => (
                  <div key={i} className={`p-5 rounded-2xl ${card} border`} style={{ background: s.bg }}>
                    <div style={{ marginBottom: 10 }}>{s.icon}</div>
                    <p className={`text-xs font-semibold uppercase tracking-wider ${sub}`}>{s.label}</p>
                    <p className={`text-lg font-bold mt-1 ${text}`}>{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Account ID card */}
              <div className={`p-5 rounded-2xl ${card} border`}>
                <p className={`text-sm font-semibold mb-3 ${text}`}>Account Details</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Account ID', value: stats.accountId },
                    { label: 'Savings Rate', value: `${stats.savingsRate}%` },
                    { label: 'Anomalies Detected', value: stats.anomalyCount },
                    { label: 'Total Expenses', value: `₹${stats.totalExpense.toLocaleString()}` },
                  ].map(item => (
                    <div key={item.label} style={{
                      background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
                      borderRadius: 10, padding: '12px 14px',
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'}`,
                    }}>
                      <p className={`text-xs ${sub} mb-0.5`}>{item.label}</p>
                      <p className={`text-sm font-bold ${text}`}>{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex justify-center py-12">
              <p className={sub}>Could not load statistics.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Delete Confirmation Modal ─────────────────────────────── */}
      {showDeleteModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}
          onClick={() => { setShowDeleteModal(false); setDeleteInput(''); }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: isDark ? '#0f172a' : '#ffffff',
              border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 20, padding: 28, width: '100%', maxWidth: 400,
              boxShadow: '0 24px 64px rgba(239,68,68,0.2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <DeleteForever style={{ color: '#ef4444', fontSize: 28 }} />
              <h3 style={{ fontSize: 18, fontWeight: 800, color: '#ef4444', fontFamily: 'Outfit, sans-serif' }}>
                Delete Account
              </h3>
            </div>
            <p style={{ fontSize: 14, color: isDark ? '#9ca3af' : '#6b7280', marginBottom: 20, lineHeight: 1.6 }}>
              This will permanently delete your account, all transactions, goals, budgets, and portfolio data.
              Type <strong style={{ color: isDark ? '#f9fafb' : '#111827' }}>{username}</strong> to confirm.
            </p>
            <input
              type="text" value={deleteInput} onChange={e => setDeleteInput(e.target.value)}
              placeholder={`Type "${username}" to confirm`}
              style={{ ...inputStyle, marginBottom: 16, borderColor: deleteInput === username ? '#ef4444' : undefined }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => { setShowDeleteModal(false); setDeleteInput(''); }}
                style={{ ...inputStyle, width: 'auto', flex: 1, background: 'transparent', cursor: 'pointer', fontWeight: 600, textAlign: 'center' }}>
                Cancel
              </button>
              <button type="button" onClick={handleDeleteAccount}
                disabled={deleteInput !== username || deleting}
                style={{
                  flex: 2, background: deleteInput === username ? 'linear-gradient(135deg,#ef4444,#dc2626)' : 'rgba(239,68,68,0.3)',
                  color: 'white', border: 'none', borderRadius: 10, padding: 11,
                  fontWeight: 700, cursor: deleteInput === username && !deleting ? 'pointer' : 'not-allowed',
                  fontFamily: 'Inter, sans-serif', fontSize: 14,
                }}>
                {deleting ? 'Deleting...' : 'Delete Forever'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
