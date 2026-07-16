import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import {
  Add, Delete, TrendingDown, CheckCircle, Warning, Error as ErrorIcon,
  CalendarToday, TrackChanges, TrendingUp, SettingsInputAntenna, ArrowForward
} from '@mui/icons-material';
import { CircularProgress } from '@mui/material';
import { EXPENSE_CATEGORIES as CATEGORY_OPTIONS, CATEGORY_COLORS } from '../constants/categories';

const getCurrentMonth = () => new Date().toISOString().slice(0, 7);
const formatMonth = (ym) => {
  const [y, m] = ym.split('-');
  return new Date(y, m - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
};

export default function Budgets() {
  const { theme } = useTheme();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // Navigation / Tabs state: 'budgets', 'goals', 'subscriptions'
  const [activeTab, setActiveTab] = useState('budgets');

  // Tab 1: Budgets State
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [showForm, setShowForm] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [form, setForm] = useState({ category: 'Food', monthlyLimit: '' });
  const [saving, setSaving] = useState(false);

  // Tab 3: Subscriptions State
  const [subscriptions, setSubscriptions] = useState([]);
  const [subsLoading, setSubsLoading] = useState(true);

  const isDark = theme === 'dark';
  const card = isDark ? 'glass-card-dark' : 'glass-card-light';
  const text = isDark ? 'text-white' : 'text-gray-900';
  const sub = isDark ? 'text-gray-400' : 'text-gray-500';
  const inputStyle = {
    background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(248, 250, 252, 0.6)',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(13, 148, 136, 0.2)'}`,
    borderRadius: '10px',
    padding: '10px 14px',
    color: isDark ? '#f9fafb' : '#111827',
    fontSize: '14px',
    width: '100%',
    outline: 'none',
    fontFamily: 'Inter, sans-serif',
  };

  const selectStyle = {
    ...inputStyle,
    appearance: 'none',
    backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none'%3E%3Cpath d='M7 9l3 3 3-3' stroke='%23${isDark ? '9ca3af' : '0d9488'}' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
    backgroundPosition: 'right 10px center',
    backgroundSize: '20px',
    backgroundRepeat: 'no-repeat',
    paddingRight: '30px'
  };

  // FETCHERS
  const fetchBudgets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/budgets?month=${selectedMonth}`);
      setBudgets(res.data);
    } catch {
      showToast('Failed to load budgets', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, showToast]);

  const fetchSubscriptions = useCallback(async () => {
    setSubsLoading(true);
    try {
      const res = await api.get('/analytics/recurring');
      setSubscriptions(res.data || []);
    } catch {
      showToast('Failed to load subscriptions', 'error');
    } finally {
      setSubsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (activeTab === 'budgets') {
      fetchBudgets();
    } else if (activeTab === 'subscriptions') {
      fetchSubscriptions();
    }
  }, [activeTab, fetchBudgets, fetchSubscriptions]);

  // BUDGET OPERATIONS
  const handleSaveBudget = async (e) => {
    e.preventDefault();
    if (!form.monthlyLimit || Number(form.monthlyLimit) <= 0) {
      showToast('Please enter a valid budget amount', 'warning');
      return;
    }
    setSaving(true);
    try {
      await api.post('/budgets', {
        category: form.category,
        monthlyLimit: Number(form.monthlyLimit),
        month: selectedMonth,
        color: CATEGORY_COLORS[form.category] || '#0D9488'
      });
      showToast(`Budget for ${form.category} saved! 🎯`, 'success');
      setShowForm(false);
      setForm({ category: 'Food', monthlyLimit: '' });
      fetchBudgets();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to save budget', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBudget = async (id, category) => {
    setDeleting(id);
    try {
      await api.delete(`/budgets/${id}`);
      showToast(`Removed budget for ${category}`, 'info');
      setBudgets(prev => prev.filter(b => b._id !== id));
    } catch {
      showToast('Failed to delete budget', 'error');
    } finally {
      setDeleting(null);
    }
  };

  // STATS CALCULATIONS
  const totalBudgeted = budgets.reduce((s, b) => s + b.monthlyLimit, 0);
  const totalSpent = budgets.reduce((s, b) => s + b.spent, 0);
  const overBudgetCount = budgets.filter(b => b.percentUsed >= 100).length;

  const getBudgetStatus = (pct) => {
    if (pct >= 100) return { color: '#ef4444', icon: <ErrorIcon fontSize="small" />, label: 'Over budget' };
    if (pct >= 80) return { color: '#f59e0b', icon: <Warning fontSize="small" />, label: 'Near limit' };
    return { color: '#16A34A', icon: <CheckCircle fontSize="small" />, label: 'On track' };
  };

  // Generate month options (last 6 + next 2 months)
  const monthOptions = [];
  for (let i = -5; i <= 2; i++) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + i);
    monthOptions.push(d.toISOString().slice(0, 7));
  }

  // Total Subscriptions Cost Calculation
  const totalSubscriptionsMonthly = subscriptions.reduce((sum, sub) => {
    return sum + (sub.frequency === 'Weekly' ? sub.amount * 4 : sub.amount);
  }, 0);

  return (
    <div className="space-y-6">
      {/* Tab Switcher Panel */}
      <div className={`p-1.5 rounded-2xl ${card} border flex gap-1 items-center max-w-md animate-slide-up`}>
        {[
          { id: 'budgets', label: 'Budgets', icon: <TrendingDown fontSize="small" /> },
          { id: 'goals', label: 'Savings Goals', icon: <TrackChanges fontSize="small" /> },
          { id: 'subscriptions', label: 'Subscriptions', icon: <CalendarToday fontSize="small" /> }
        ].map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 font-semibold text-sm transition-all duration-300 ${
                isActive
                  ? isDark
                    ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                    : 'bg-teal-600 text-white shadow-md'
                  : isDark
                  ? 'text-gray-400 hover:text-white hover:bg-white/5'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/50'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: BUDGETS VIEW */}
      {activeTab === 'budgets' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-slide-up">
            <div>
              <h1 className={`text-3xl font-extrabold tracking-tight ${text}`}>Budget Limits</h1>
              <p className={`text-sm mt-1 ${sub}`}>
                Set monthly spending caps per category and track your actual expenditure.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                style={{ ...selectStyle, width: 'auto', minWidth: '160px' }}
              >
                {monthOptions.map(m => (
                  <option key={m} value={m} style={{ background: isDark ? '#1f2937' : '#fff' }}>{formatMonth(m)}</option>
                ))}
              </select>
              <button
                onClick={() => setShowForm(true)}
                className="hover:scale-105 active:scale-95 transition-all"
                style={{
                  background: 'linear-gradient(135deg, #0D9488, #4F46E5)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '10px 18px',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                  fontFamily: 'Inter, sans-serif',
                  boxShadow: '0 4px 14px rgba(13,148,136,0.3)',
                }}
              >
                <Add fontSize="small" /> Add Budget
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 animate-slide-up animate-slide-up-delay-1">
            {[
              { label: 'Total Budgeted', value: `₹${totalBudgeted.toLocaleString()}`, color: '#0D9488' },
              { label: 'Total Spent', value: `₹${totalSpent.toLocaleString()}`, color: '#ef4444' },
              { label: 'Over Budget', value: `${overBudgetCount} categories`, color: overBudgetCount > 0 ? '#ef4444' : '#16A34A' },
            ].map(stat => (
              <div key={stat.label} className={`p-4 rounded-2xl ${card} border`}>
                <p className={`text-xs font-semibold uppercase tracking-wider ${sub}`}>{stat.label}</p>
                <p className="text-xl font-bold mt-1" style={{ color: stat.color }}>{stat.value}</p>
              </div>
            ))}
          </div>

          {showForm && (
            <div
              style={{
                position: 'fixed', inset: 0, zIndex: 9000,
                background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
              }}
              onClick={() => setShowForm(false)}
            >
              <form
                onSubmit={handleSaveBudget}
                onClick={e => e.stopPropagation()}
                className={card}
                style={{
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(13, 148, 136, 0.2)'}`,
                  borderRadius: '20px',
                  padding: '28px',
                  width: '100%',
                  maxWidth: '420px',
                  boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                }}
              >
                <h2 className={`text-xl font-bold mb-5 ${text}`}>Set Budget Goal</h2>

                <div style={{ marginBottom: '16px' }}>
                  <label className={`block text-sm font-medium mb-1.5 ${sub}`}>Category</label>
                  <select
                    value={form.category}
                    onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                    style={selectStyle}
                  >
                    {CATEGORY_OPTIONS.map(c => <option key={c} value={c} style={{ background: isDark ? '#1f2937' : '#fff' }}>{c}</option>)}
                  </select>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label className={`block text-sm font-medium mb-1.5 ${sub}`}>Monthly Limit (₹)</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 5000"
                    value={form.monthlyLimit}
                    onChange={e => setForm(p => ({ ...p, monthlyLimit: e.target.value }))}
                    style={inputStyle}
                  />
                </div>

                <p className={`text-xs mb-5 ${sub}`}>For: <strong>{formatMonth(selectedMonth)}</strong></p>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    style={{
                      ...inputStyle, width: 'auto', flex: 1,
                      background: 'transparent', cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >Cancel</button>
                  <button
                    type="submit"
                    disabled={saving}
                    style={{
                      flex: 2, background: 'linear-gradient(135deg, #0D9488, #4F46E5)',
                      color: 'white', border: 'none', borderRadius: '10px',
                      padding: '10px', fontWeight: 600, fontSize: '14px',
                      cursor: saving ? 'not-allowed' : 'pointer',
                      opacity: saving ? 0.7 : 1,
                      fontFamily: 'Inter, sans-serif',
                    }}
                  >
                    {saving ? 'Saving...' : 'Save Budget'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-16">
              <CircularProgress size={36} style={{ color: '#0D9488' }} />
            </div>
          ) : budgets.length === 0 ? (
            <div className={`p-16 rounded-2xl ${card} border flex flex-col items-center justify-center gap-4`}>
              <TrendingDown style={{ fontSize: 52, color: isDark ? '#4b5563' : '#d1d5db' }} />
              <p className={`text-lg font-semibold ${text}`}>No budgets set for {formatMonth(selectedMonth)}</p>
              <p className={sub}>Click "Add Budget" to set your first spending goal.</p>
            </div>
          ) : (
            <div className="space-y-4 animate-slide-up animate-slide-up-delay-2">
              {budgets.map((budget) => {
                const status = getBudgetStatus(budget.percentUsed);
                const color = CATEGORY_COLORS[budget.category] || budget.color || '#0D9488';
                return (
                  <div key={budget._id} className={`p-5 rounded-2xl ${card} border`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div
                          style={{
                            width: 12, height: 12, borderRadius: '50%',
                            background: color, flexShrink: 0,
                            boxShadow: `0 0 8px ${color}88`
                          }}
                        />
                        <span className={`font-semibold ${text}`}>{budget.category}</span>
                        <span
                          className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1"
                          style={{
                            background: `${status.color}18`,
                            color: status.color,
                            border: `1px solid ${status.color}33`
                          }}
                        >
                          {status.icon} {status.label}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDeleteBudget(budget._id, budget.category)}
                        disabled={deleting === budget._id}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: '#ef4444', opacity: deleting === budget._id ? 0.4 : 0.7,
                          transition: 'opacity 0.2s',
                        }}
                      >
                        {deleting === budget._id ? <CircularProgress size={16} /> : <Delete fontSize="small" />}
                      </button>
                    </div>

                    <div className="budget-bar-track mb-2">
                      <div
                        className="budget-bar-fill"
                        style={{
                          width: `${budget.percentUsed}%`,
                          background: budget.percentUsed >= 100
                            ? 'linear-gradient(90deg, #ef4444, #dc2626)'
                            : budget.percentUsed >= 80
                            ? 'linear-gradient(90deg, #f59e0b, #d97706)'
                            : `linear-gradient(90deg, ${color}, ${color}99)`
                        }}
                      />
                    </div>

                    <div className="flex justify-between text-xs">
                      <span className={sub}>
                        ₹{budget.spent.toLocaleString()} spent
                      </span>
                      <span className={`font-medium ${text}`}>
                        {budget.percentUsed}% of ₹{budget.monthlyLimit.toLocaleString()}
                      </span>
                      <span style={{ color: budget.remaining === 0 ? '#ef4444' : '#16A34A' }}>
                        {budget.remaining === 0
                          ? `₹${(budget.spent - budget.monthlyLimit).toLocaleString()} over`
                          : `₹${budget.remaining.toLocaleString()} left`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SAVINGS GOALS (moved to its own page — this is a link-out card) */}
      {activeTab === 'goals' && (
        <div className="space-y-6">
          <div className="animate-slide-up">
            <h1 className={`text-3xl font-extrabold tracking-tight ${text}`}>Savings Goals</h1>
            <p className={`text-sm mt-1 ${sub}`}>
              Goals now live on their own page, with progress rings, contribution tracking, and AI feasibility projections.
            </p>
          </div>

          <div className={`p-10 rounded-2xl ${card} border flex flex-col items-center justify-center gap-4 text-center animate-slide-up`}>
            <TrackChanges style={{ fontSize: 48, color: isDark ? '#2DD4BF' : '#0D9488' }} />
            <div>
              <p className={`text-lg font-semibold ${text}`}>Manage your savings goals</p>
              <p className={`text-sm mt-1 max-w-md ${sub}`}>
                Create goals, track contributions, and see AI-projected completion dates on the dedicated Goals page.
              </p>
            </div>
            <button
              onClick={() => navigate('/goals')}
              className="hover:scale-105 active:scale-95 transition-all"
              style={{
                background: 'linear-gradient(135deg, #0D9488, #4F46E5)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                padding: '10px 20px',
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontFamily: 'Inter, sans-serif',
                boxShadow: '0 4px 14px rgba(13,148,136,0.3)',
              }}
            >
              Go to Goals <ArrowForward fontSize="small" />
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: SUBSCRIPTIONS & BILLS VIEW */}
      {activeTab === 'subscriptions' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-slide-up">
            <div>
              <h1 className={`text-3xl font-extrabold tracking-tight ${text}`}>Subscriptions & Bills Calendar</h1>
              <p className={`text-sm mt-1 ${sub}`}>
                Automated monthly bills and digital subscriptions detected by AI analysis.
              </p>
            </div>
            <div className={`p-4 rounded-xl ${card} border flex items-center gap-3`}>
              <div>
                <p className={`text-xs ${sub}`}>Total Monthly Cost</p>
                <p className="text-xl font-black text-teal-500">₹{totalSubscriptionsMonthly.toLocaleString()}<span className="text-xs font-normal text-gray-400"> / mo</span></p>
              </div>
            </div>
          </div>

          {subsLoading ? (
            <div className="flex justify-center py-16">
              <CircularProgress size={36} style={{ color: '#0D9488' }} />
            </div>
          ) : subscriptions.length === 0 ? (
            <div className={`p-16 rounded-2xl ${card} border flex flex-col items-center justify-center gap-4`}>
              <CalendarToday style={{ fontSize: 52, color: isDark ? '#4b5563' : '#d1d5db' }} />
              <p className={`text-lg font-semibold ${text}`}>No recurring subscriptions detected yet</p>
              <p className={sub}>Log repeating transactions spaced a week or month apart (e.g. Netflix, Rent, Utility bills) to view them here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-slide-up">
              {subscriptions.map((subItem, index) => {
                const isPaid = subItem.isPaidThisMonth;
                const borderLeftColor = CATEGORY_COLORS[subItem.category] || '#0D9488';

                return (
                  <div
                    key={`${subItem.name}-${index}`}
                    className={`p-5 rounded-2xl ${card} border relative overflow-hidden transition-all duration-300 hover:-translate-y-1`}
                    style={{
                      borderLeft: `5px solid ${borderLeftColor}`
                    }}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className={`font-bold text-lg ${text}`}>{subItem.name}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${sub}`} style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }}>
                          {subItem.category}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className={`text-lg font-black ${text}`}>₹{subItem.amount.toLocaleString()}</p>
                        <p className={`text-[10px] font-semibold uppercase ${sub}`}>{subItem.frequency}</p>
                      </div>
                    </div>

                    <div className="space-y-1 mb-4 text-xs">
                      <div className="flex justify-between">
                        <span className={sub}>Last Paid:</span>
                        <span className={`font-medium ${text}`}>{new Date(subItem.lastPaymentDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className={sub}>Next Due:</span>
                        <span className={`font-medium ${text}`}>{new Date(subItem.nextDueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-gray-500/10">
                      <span className={`text-xs font-semibold ${sub}`}>Billing Status:</span>
                      {isPaid ? (
                        <span className="text-[10px] uppercase font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle fontSize="inherit" /> Paid This Month
                        </span>
                      ) : (
                        <span className="text-[10px] uppercase font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Warning fontSize="inherit" /> Due in {subItem.daysRemaining} days
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
