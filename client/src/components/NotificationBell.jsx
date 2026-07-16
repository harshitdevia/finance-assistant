import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
  Notifications, NotificationsNone, Close,
  Warning, Flag, TrendingDown, Receipt, Repeat,
} from '@mui/icons-material';

const ALERT_TYPES = {
  budget: { icon: <Warning style={{ fontSize: 16, color: '#f59e0b' }} />, color: '#f59e0b', link: '/budgets' },
  goal: { icon: <Flag style={{ fontSize: 16, color: '#4F46E5' }} />, color: '#4F46E5', link: '/goals' },
  anomaly: { icon: <Receipt style={{ fontSize: 16, color: '#ef4444' }} />, color: '#ef4444', link: '/transactions' },
  savings: { icon: <TrendingDown style={{ fontSize: 16, color: '#ef4444' }} />, color: '#ef4444', link: '/reports' },
  subscription: { icon: <Repeat style={{ fontSize: 16, color: '#d97706' }} />, color: '#d97706', link: '/subscriptions' },
};

function timeAgo(date) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotificationBell({ iconOnly = false, active = true }) {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const isDark = theme === 'dark';
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [dismissed, setDismissed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('dismissed_alerts') || '[]'); }
    catch { return []; }
  });
  const panelRef = useRef(null);

  const buildAlerts = useCallback(async () => {
    const now = Date.now();
    const generated = [];

    try {
      // 1. Budget alerts
      const [budgetsRes, summaryRes] = await Promise.all([
        api.get('/budgets'),
        api.get('/analytics/summary'),
      ]);

      const budgets = budgetsRes.data || [];
      const { categoryBreakdown = [] } = summaryRes.data || {};

      budgets.forEach(budget => {
        const spent = categoryBreakdown.find(c => c.category === budget.category)?.amount || 0;
        const pct = budget.monthlyLimit > 0 ? (spent / budget.monthlyLimit) * 100 : 0;
        if (pct >= 90) {
          generated.push({
            id: `budget-${budget.category}`,
            type: 'budget',
            title: `${budget.category} budget ${pct >= 100 ? 'exceeded!' : 'almost full'}`,
            message: `₹${Math.round(spent).toLocaleString()} of ₹${budget.monthlyLimit.toLocaleString()} used (${Math.round(pct)}%)`,
            ts: now - 600000,
          });
        }
      });
    } catch { /* ignore */ }

    try {
      // 2. Goal deadline alerts
      const goalsRes = await api.get('/goals');
      const goals = goalsRes.data?.goals || [];
      goals.forEach(goal => {
        const days = Math.ceil((new Date(goal.deadline) - new Date()) / 86400000);
        if (days > 0 && days <= 30 && goal.currentAmount < goal.targetAmount) {
          generated.push({
            id: `goal-${goal._id}`,
            type: 'goal',
            title: `Goal deadline approaching`,
            message: `"${goal.name}" is due in ${days} days — ₹${(goal.targetAmount - goal.currentAmount).toLocaleString()} still needed`,
            ts: now - 1200000,
          });
        }
      });
    } catch { /* ignore */ }

    try {
      // 3. Anomaly alerts
      const txRes = await api.get('/transactions');
      const transactions = txRes.data?.transactions || txRes.data || [];
      const anomalies = transactions.filter(t => t.isAnomaly);
      if (anomalies.length > 0) {
        const latest = anomalies[0];
        generated.push({
          id: `anomaly-${latest._id}`,
          type: 'anomaly',
          title: 'Unusual transaction flagged',
          message: `₹${latest.amount?.toLocaleString()} in ${latest.category} — unusually high compared to your history`,
          ts: new Date(latest.date).getTime(),
        });
      }
    } catch { /* ignore */ }

    try {
      // 4. Low savings rate
      const sumRes = await api.get('/analytics/summary');
      const { savingsRate = 0 } = sumRes.data || {};
      if (savingsRate > 0 && savingsRate < 10) {
        generated.push({
          id: 'low-savings',
          type: 'savings',
          title: 'Low savings rate detected',
          message: `Your savings rate is only ${savingsRate}%. Financial experts recommend saving at least 20% of income.`,
          ts: now - 3600000,
        });
      }
    } catch { /* ignore */ }

    try {
      // 5. Subscription due soon
      const subRes = await api.get('/analytics/recurring');
      const subs = subRes.data || [];
      subs.filter(s => !s.isPaidThisMonth && s.daysRemaining >= 0 && s.daysRemaining <= 5).forEach(sub => {
        generated.push({
          id: `sub-${sub.name}`,
          type: 'subscription',
          title: `${sub.name} due soon`,
          message: `₹${sub.amount?.toLocaleString()} due in ${sub.daysRemaining} day${sub.daysRemaining !== 1 ? 's' : ''}`,
          ts: now - 7200000,
        });
      });
    } catch { /* ignore */ }

    // Filter out dismissed
    const visible = generated.filter(a => !dismissed.includes(a.id));
    setAlerts(visible);
  }, [dismissed]);

  // Both the desktop sidebar and mobile top-bar render a NotificationBell (only one
  // is ever visible per breakpoint, via CSS), so only the active one should fetch —
  // otherwise every alert source gets hit twice on each page load.
  useEffect(() => { if (active) buildAlerts(); }, [buildAlerts, active]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const dismiss = (id) => {
    const newDismissed = [...dismissed, id];
    setDismissed(newDismissed);
    localStorage.setItem('dismissed_alerts', JSON.stringify(newDismissed));
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  const dismissAll = () => {
    const ids = alerts.map(a => a.id);
    const newDismissed = [...dismissed, ...ids];
    setDismissed(newDismissed);
    localStorage.setItem('dismissed_alerts', JSON.stringify(newDismissed));
    setAlerts([]);
    setOpen(false);
  };

  const unread = alerts.length;

  return (
    <div style={{ position: 'relative' }} ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(o => !o)}
        title={`${unread} notification${unread !== 1 ? 's' : ''}`}
        style={{
          position: 'relative', background: 'transparent', border: 'none',
          cursor: 'pointer', padding: 6, borderRadius: 10, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          color: isDark ? '#9ca3af' : '#6b7280',
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        {unread > 0
          ? <Notifications style={{ fontSize: 22, color: '#d97706' }} />
          : <NotificationsNone style={{ fontSize: 22 }} />
        }
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: 2, right: 2,
            width: 16, height: 16, borderRadius: '50%',
            background: '#ef4444', color: 'white',
            fontSize: 9, fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: `2px solid ${isDark ? '#0a0f0b' : '#f8fafc'}`,
          }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 'calc(100% + 8px)',
          width: 340, maxHeight: 420, overflowY: 'auto',
          background: isDark ? '#0f1a14' : '#ffffff',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
          borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
          zIndex: 9999,
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 16px 10px',
            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}`,
          }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: isDark ? '#f9fafb' : '#111827', fontFamily: 'Outfit, sans-serif' }}>
              Notifications {unread > 0 && <span style={{ color: '#ef4444', fontSize: 13 }}>({unread})</span>}
            </p>
            {unread > 0 && (
              <button onClick={dismissAll} style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                fontSize: 11, color: '#4F46E5', fontWeight: 600, fontFamily: 'Inter, sans-serif',
              }}>
                Clear all
              </button>
            )}
          </div>

          {/* Alert list */}
          {alerts.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
              <p style={{ fontSize: 13, color: isDark ? '#6b7280' : '#9ca3af' }}>You're all caught up!</p>
            </div>
          ) : (
            <div>
              {alerts.map(alert => {
                const config = ALERT_TYPES[alert.type] || ALERT_TYPES.budget;
                return (
                  <div
                    key={alert.id}
                    style={{
                      display: 'flex', gap: 10, padding: '12px 16px',
                      borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
                      cursor: 'pointer', transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    onClick={() => { navigate(config.link); setOpen(false); }}
                  >
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                      background: `${config.color}18`,
                      border: `1px solid ${config.color}30`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {config.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: isDark ? '#f9fafb' : '#111827', marginBottom: 2 }}>
                        {alert.title}
                      </p>
                      <p style={{ fontSize: 11, color: isDark ? '#6b7280' : '#9ca3af', lineHeight: 1.4 }}>
                        {alert.message}
                      </p>
                      <p style={{ fontSize: 10, color: isDark ? '#4b5563' : '#d1d5db', marginTop: 3 }}>
                        {timeAgo(alert.ts)}
                      </p>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); dismiss(alert.id); }}
                      style={{
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        color: isDark ? '#4b5563' : '#d1d5db', flexShrink: 0, padding: 2,
                      }}
                    >
                      <Close style={{ fontSize: 14 }} />
                    </button>
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
