import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import {
  Repeat, CalendarMonth, CheckCircle, Schedule,
  Warning, CreditCard, AutoAwesome, Refresh,
} from '@mui/icons-material';
import { CircularProgress } from '@mui/material';

// Category icon mapping
const CATEGORY_ICONS = {
  entertainment: '🎬',
  streaming: '📺',
  music: '🎵',
  fitness: '💪',
  utilities: '💡',
  rent: '🏠',
  internet: '📡',
  phone: '📱',
  insurance: '🛡️',
  software: '💻',
  food: '🍔',
  default: '💳',
};

function getCategoryIcon(name = '', category = '') {
  const n = (name + ' ' + category).toLowerCase();
  if (n.includes('netflix') || n.includes('disney') || n.includes('hulu') || n.includes('hbo') || n.includes('youtube')) return '🎬';
  if (n.includes('spotify') || n.includes('music') || n.includes('apple music')) return '🎵';
  if (n.includes('gym') || n.includes('fitness')) return '💪';
  if (n.includes('rent') || n.includes('house') || n.includes('flat')) return '🏠';
  if (n.includes('electric') || n.includes('power') || n.includes('gas') || n.includes('water')) return '💡';
  if (n.includes('internet') || n.includes('wifi') || n.includes('broadband')) return '📡';
  if (n.includes('phone') || n.includes('mobile') || n.includes('jio') || n.includes('airtel')) return '📱';
  if (n.includes('insurance')) return '🛡️';
  if (n.includes('prime') || n.includes('amazon')) return '📦';
  if (n.includes('github') || n.includes('adobe') || n.includes('office') || n.includes('cursor') || n.includes('zoom') || n.includes('canva')) return '💻';
  return CATEGORY_ICONS[category?.toLowerCase()] || CATEGORY_ICONS.default;
}

function urgencyConfig(days) {
  if (days < 0) return { label: 'Overdue', color: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.25)' };
  if (days <= 3) return { label: `Due in ${days}d`, color: '#ef4444', bg: 'rgba(239,68,68,0.10)', border: 'rgba(239,68,68,0.22)' };
  if (days <= 7) return { label: `Due in ${days}d`, color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.22)' };
  return { label: `Due in ${days}d`, color: '#16A34A', bg: 'rgba(22,163,74,0.08)', border: 'rgba(22,163,74,0.18)' };
}

function SubscriptionCard({ item, isDark }) {
  const card = isDark ? 'glass-card-dark' : 'glass-card-light';
  const text = isDark ? '#f9fafb' : '#111827';
  const sub = isDark ? '#9ca3af' : '#6b7280';
  const urg = urgencyConfig(item.daysRemaining);
  const icon = getCategoryIcon(item.name, item.category);

  return (
    <div
      className={`p-5 rounded-2xl ${card} border transition-all duration-200 hover:-translate-y-0.5`}
      style={{ borderColor: item.isPaidThisMonth ? 'rgba(22,163,74,0.2)' : urg.border }}
    >
      {/* Top row */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div style={{
            width: 44, height: 44, borderRadius: 12, fontSize: 22,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
            flexShrink: 0,
          }}>
            {icon}
          </div>
          <div>
            <p style={{ fontWeight: 700, fontSize: 15, color: text, fontFamily: 'Outfit, sans-serif' }}>{item.name}</p>
            <p style={{ fontSize: 12, color: sub, marginTop: 1, textTransform: 'capitalize' }}>
              {item.frequency} · {item.category}
            </p>
          </div>
        </div>

        {/* Amount */}
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: 18, fontWeight: 800, color: text, fontFamily: 'Outfit, sans-serif' }}>
            ₹{item.amount.toLocaleString()}
          </p>
          <p style={{ fontSize: 11, color: sub }}>per {item.frequency === 'Monthly' ? 'month' : 'week'}</p>
        </div>
      </div>

      {/* Status row */}
      <div className="flex items-center justify-between">
        {item.isPaidThisMonth ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'rgba(22,163,74,0.1)', color: '#16A34A',
            border: '1px solid rgba(22,163,74,0.25)',
            borderRadius: 20, padding: '4px 10px', fontSize: 11, fontWeight: 700,
          }}>
            <CheckCircle style={{ fontSize: 13 }} />
            Paid this month
          </div>
        ) : (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: urg.bg, color: urg.color,
            border: `1px solid ${urg.border}`,
            borderRadius: 20, padding: '4px 10px', fontSize: 11, fontWeight: 700,
          }}>
            {item.daysRemaining <= 7 ? <Warning style={{ fontSize: 13 }} /> : <Schedule style={{ fontSize: 13 }} />}
            {urg.label}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: sub }}>
          <CalendarMonth style={{ fontSize: 13 }} />
          Next: {new Date(item.nextDueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
        </div>
      </div>
    </div>
  );
}

export default function Subscriptions() {
  const { theme } = useTheme();
  const { showToast } = useToast();
  const isDark = theme === 'dark';
  const text = isDark ? 'text-white' : 'text-gray-900';
  const sub = isDark ? 'text-gray-400' : 'text-gray-500';
  const card = isDark ? 'glass-card-dark' : 'glass-card-light';

  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchSubscriptions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/analytics/recurring');
      setSubscriptions(res.data || []);
    } catch {
      showToast('Failed to load subscriptions', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSubscriptions(); }, [fetchSubscriptions]);

  const totalMonthly = subscriptions
    .filter(s => s.frequency === 'Monthly')
    .reduce((sum, s) => sum + s.amount, 0);
  const totalWeekly = subscriptions
    .filter(s => s.frequency === 'Weekly')
    .reduce((sum, s) => sum + s.amount, 0);
  const unpaidThisMonth = subscriptions.filter(s => !s.isPaidThisMonth).length;
  const dueSoon = subscriptions.filter(s => !s.isPaidThisMonth && s.daysRemaining <= 7).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between animate-slide-up">
        <div>
          <h1 className={`text-3xl font-extrabold tracking-tight ${text}`}>Recurring Bills</h1>
          <p className={`text-sm mt-1 ${sub}`}>Auto-detected subscriptions and recurring payments.</p>
        </div>
        <button
          onClick={fetchSubscriptions}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
            color: isDark ? '#9ca3af' : '#6b7280',
            borderRadius: 10, padding: '8px 14px', fontSize: 13,
            cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: 600,
          }}
        >
          <Refresh style={{ fontSize: 16 }} /> Refresh
        </button>
      </div>

      {/* Summary strip */}
      {subscriptions.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-slide-up">
          {[
            { icon: <Repeat style={{ color: '#4F46E5' }} />, label: 'Total Detected', value: subscriptions.length },
            { icon: <CreditCard style={{ color: '#0D9488' }} />, label: 'Monthly Spend', value: `₹${totalMonthly.toLocaleString()}` },
            { icon: <Warning style={{ color: '#ef4444' }} />, label: 'Unpaid This Month', value: unpaidThisMonth },
            { icon: <Schedule style={{ color: '#f59e0b' }} />, label: 'Due in 7 Days', value: dueSoon },
          ].map((s, i) => (
            <div key={i} className={`p-4 rounded-2xl ${card} border text-center`}>
              <div className="flex justify-center mb-2">{s.icon}</div>
              <p className={`text-xs font-semibold uppercase tracking-wider ${sub}`}>{s.label}</p>
              <p className={`text-xl font-extrabold mt-0.5 ${text}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Main content */}
      {loading ? (
        <div className="flex justify-center py-16"><CircularProgress /></div>
      ) : subscriptions.length === 0 ? (
        <div className={`p-12 rounded-2xl ${card} border text-center animate-slide-up`}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>🔍</div>
          <h3 className={`text-xl font-bold mb-2 ${text}`}>No Recurring Bills Detected</h3>
          <p className={`text-sm mb-2 ${sub}`}>
            Add more transactions and Aurelia will automatically detect your recurring subscriptions and bills.
          </p>
          <p className={`text-xs ${sub}`}>
            Tip: Add Netflix, Spotify, Rent, or Gym transactions — they'll appear here automatically.
          </p>
        </div>
      ) : (
        <>
          {/* Due Soon section */}
          {dueSoon > 0 && (
            <div>
              <h2 className={`text-base font-bold mb-3 ${text} flex items-center gap-2`}>
                <Warning style={{ color: '#f59e0b', fontSize: 18 }} />
                Due Soon
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {subscriptions
                  .filter(s => !s.isPaidThisMonth && s.daysRemaining <= 7)
                  .map((item, i) => (
                    <SubscriptionCard key={i} item={item} isDark={isDark} />
                  ))}
              </div>
            </div>
          )}

          {/* All subscriptions */}
          <div>
            <h2 className={`text-base font-bold mb-3 ${text} flex items-center gap-2`}>
              <Repeat style={{ color: '#4F46E5', fontSize: 18 }} />
              All Subscriptions ({subscriptions.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {subscriptions.map((item, i) => (
                <SubscriptionCard key={i} item={item} isDark={isDark} />
              ))}
            </div>
          </div>

          {/* Aurelia tip */}
          <div className={`p-4 rounded-2xl border flex items-start gap-3`} style={{
            borderColor: 'rgba(13,148,136,0.2)',
            background: isDark ? 'rgba(13,148,136,0.05)' : 'rgba(13,148,136,0.04)',
          }}>
            <AutoAwesome style={{ color: '#0D9488', flexShrink: 0, marginTop: 2 }} />
            <p className={`text-sm ${sub}`}>
              <strong style={{ color: isDark ? '#f9fafb' : '#111827' }}>Aurelia tip: </strong>
              {totalMonthly > 0
                ? `You're spending ₹${totalMonthly.toLocaleString()} per month on recurring subscriptions${totalWeekly > 0 ? ` and ₹${totalWeekly.toLocaleString()} weekly` : ''}. That's ₹${(totalMonthly * 12).toLocaleString()} per year — review if all of these are essential!`
                : 'Track your subscriptions to see where your money goes every month.'}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
