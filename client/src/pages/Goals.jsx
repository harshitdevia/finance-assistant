import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  Add, Edit, Delete, Flag, AutoAwesome, TrendingUp,
  CalendarMonth, CheckCircle as CheckCircleIcon, Rocket,
} from '@mui/icons-material';
import { CircularProgress } from '@mui/material';

const GOAL_COLORS = [
  '#0D9488', '#4F46E5', '#16A34A', '#ef4444', '#ec4899',
  '#8b5cf6', '#3b82f6', '#f97316', '#d97706', '#06b6d4',
];

// ─── Circular progress ring SVG ─────────────────────────────────────
function RingProgress({ percent, color, size = 120, stroke = 10 }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const filled = Math.min(percent / 100, 1) * circ;

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={circ - filled}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.34,1.56,0.64,1)' }}
      />
    </svg>
  );
}

// ─── Days remaining ──────────────────────────────────────────────────
function daysLeft(deadline) {
  const diff = new Date(deadline) - new Date();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

// ─── Goal card ───────────────────────────────────────────────────────
function GoalCard({ goal, onEdit, onDelete, onContribute, isDark }) {
  const card = isDark ? 'glass-card-dark' : 'glass-card-light';
  const text = isDark ? 'text-white' : 'text-gray-900';
  const sub = isDark ? 'text-gray-400' : 'text-gray-500';

  const progress = goal.targetAmount > 0
    ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100)
    : 0;
  const remaining = goal.targetAmount - goal.currentAmount;
  const days = daysLeft(goal.deadline);
  const monthlyNeeded = days > 0 ? remaining / (days / 30) : 0;
  const isComplete = progress >= 100;

  return (
    <div className={`p-6 rounded-2xl ${card} border animate-slide-up`} style={{
      borderColor: `${goal.color}30`,
      boxShadow: isComplete ? `0 0 24px ${goal.color}20` : 'none',
    }}>
      {/* Top row */}
      <div className="flex items-start justify-between mb-4">
        <div style={{ flex: 1 }}>
          <div className="flex items-center gap-2">
            <Flag style={{ color: goal.color, fontSize: 18 }} />
            <h3 className={`font-extrabold text-base ${text}`}>{goal.name}</h3>
            {isComplete && (
              <span style={{
                background: `${goal.color}22`, color: goal.color,
                fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                border: `1px solid ${goal.color}44`,
              }}>✅ ACHIEVED</span>
            )}
          </div>
          <p className={`text-xs mt-1 ${sub} flex items-center gap-1`}>
            <CalendarMonth style={{ fontSize: 12 }} />
            {new Date(goal.deadline).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            {days > 0 && <span style={{ color: days < 30 ? '#ef4444' : days < 90 ? '#f59e0b' : '#16A34A' }}>
              · {days}d left
            </span>}
          </p>
        </div>

        {/* Ring */}
        <div style={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }}>
          <RingProgress percent={progress} color={goal.color} size={72} stroke={7} />
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column',
          }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: goal.color, lineHeight: 1 }}>
              {Math.round(progress)}%
            </span>
          </div>
        </div>
      </div>

      {/* Amount progress */}
      <div className="mb-4">
        <div style={{
          height: 6, borderRadius: 999,
          background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)',
          overflow: 'hidden', marginBottom: 6,
        }}>
          <div style={{
            height: '100%', borderRadius: 999,
            width: `${progress}%`,
            background: `linear-gradient(90deg, ${goal.color}99, ${goal.color})`,
            transition: 'width 0.8s cubic-bezier(0.34,1.56,0.64,1)',
          }} />
        </div>
        <div className="flex justify-between">
          <span className={`text-xs font-semibold ${sub}`}>
            ₹{goal.currentAmount.toLocaleString()} saved
          </span>
          <span className={`text-xs font-bold ${text}`}>
            ₹{goal.targetAmount.toLocaleString()} target
          </span>
        </div>
      </div>

      {/* Stats row */}
      {!isComplete && (
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: 8, marginBottom: 16,
        }}>
          {[
            { label: 'Still needed', value: `₹${remaining.toLocaleString()}` },
            { label: 'Monthly pace', value: `₹${Math.round(monthlyNeeded).toLocaleString()}` },
          ].map(item => (
            <div key={item.label} style={{
              background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
              borderRadius: 8, padding: '8px 10px',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'}`,
            }}>
              <p className={`text-[10px] ${sub} uppercase font-semibold tracking-wider`}>{item.label}</p>
              <p className={`text-xs font-bold mt-0.5 ${text}`}>{item.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => onContribute(goal)}
          style={{
            flex: 1, padding: '9px', borderRadius: 10, fontSize: 12, fontWeight: 700,
            background: `linear-gradient(135deg, ${goal.color}cc, ${goal.color})`,
            color: 'white', border: 'none', cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          {isComplete ? '🎉 Goal Complete' : '+ Add Savings'}
        </button>
        <button onClick={() => onEdit(goal)} style={{
          padding: '9px 12px', borderRadius: 10, fontSize: 12,
          background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
          color: isDark ? '#9ca3af' : '#6b7280', cursor: 'pointer',
        }}>
          <Edit style={{ fontSize: 14 }} />
        </button>
        <button onClick={() => onDelete(goal._id)} style={{
          padding: '9px 12px', borderRadius: 10, fontSize: 12,
          background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.2)',
          color: '#ef4444', cursor: 'pointer',
        }}>
          <Delete style={{ fontSize: 14 }} />
        </button>
      </div>
    </div>
  );
}

// ─── Goal form modal ─────────────────────────────────────────────────
function GoalModal({ goal, onClose, onSaved, isDark }) {
  const { showToast } = useToast();
  const [form, setForm] = useState({
    name: goal?.name || '',
    targetAmount: goal?.targetAmount || '',
    currentAmount: goal?.currentAmount || '',
    deadline: goal?.deadline ? new Date(goal.deadline).toISOString().slice(0, 10) : '',
    color: goal?.color || '#0D9488',
  });
  const [saving, setSaving] = useState(false);

  const inputStyle = {
    background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)'}`,
    borderRadius: '12px', padding: '11px 14px',
    color: isDark ? '#f9fafb' : '#111827',
    fontSize: '14px', width: '100%', outline: 'none',
    fontFamily: 'Inter, sans-serif',
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.targetAmount || !form.deadline) {
      showToast('Please fill in all required fields', 'warning'); return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        targetAmount: Number(form.targetAmount),
        currentAmount: Number(form.currentAmount) || 0,
        deadline: form.deadline,
        color: form.color,
      };
      if (goal?._id) {
        await api.put(`/goals/${goal._id}`, payload);
        showToast('Goal updated! 🎯', 'success');
      } else {
        await api.post('/goals', payload);
        showToast('New goal created! 🚀', 'success');
      }
      onSaved();
      onClose();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to save goal', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9500,
      background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(10px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }} onClick={onClose}>
      <form onSubmit={handleSubmit} onClick={e => e.stopPropagation()} style={{
        background: isDark ? '#0f172a' : '#fff',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.1)'}`,
        borderRadius: 20, padding: 28, width: '100%', maxWidth: 440,
        boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
      }}>
        <h2 style={{ color: isDark ? '#f9fafb' : '#111827', fontSize: 20, fontWeight: 800, marginBottom: 20, fontFamily: 'Outfit, sans-serif' }}>
          {goal ? '✏️ Edit Goal' : '🎯 New Savings Goal'}
        </h2>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: isDark ? '#9ca3af' : '#6b7280', marginBottom: 6 }}>Goal Name *</label>
          <input type="text" placeholder="e.g. MacBook Pro, Emergency Fund, Europe Trip" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} style={inputStyle} autoFocus />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: isDark ? '#9ca3af' : '#6b7280', marginBottom: 6 }}>Target Amount (₹) *</label>
            <input type="number" min="1" placeholder="e.g. 100000" value={form.targetAmount} onChange={e => setForm(p => ({ ...p, targetAmount: e.target.value }))} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: isDark ? '#9ca3af' : '#6b7280', marginBottom: 6 }}>Saved So Far (₹)</label>
            <input type="number" min="0" placeholder="0" value={form.currentAmount} onChange={e => setForm(p => ({ ...p, currentAmount: e.target.value }))} style={inputStyle} />
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: isDark ? '#9ca3af' : '#6b7280', marginBottom: 6 }}>Target Deadline *</label>
          <input type="date" value={form.deadline} onChange={e => setForm(p => ({ ...p, deadline: e.target.value }))} style={inputStyle} min={new Date().toISOString().slice(0, 10)} />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: isDark ? '#9ca3af' : '#6b7280', marginBottom: 8 }}>Goal Color</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {GOAL_COLORS.map(c => (
              <button key={c} type="button" onClick={() => setForm(p => ({ ...p, color: c }))} style={{
                width: 28, height: 28, borderRadius: '50%', background: c, border: 'none',
                outline: form.color === c ? `3px solid ${c}` : 'none',
                outlineOffset: 2, cursor: 'pointer', transform: form.color === c ? 'scale(1.2)' : 'scale(1)',
                transition: 'transform 0.15s',
              }} />
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" onClick={onClose} style={{
            flex: 1, padding: '11px', borderRadius: 10, fontWeight: 600, fontSize: 14,
            background: 'transparent',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)'}`,
            color: isDark ? '#9ca3af' : '#6b7280', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
          }}>Cancel</button>
          <button type="submit" disabled={saving} style={{
            flex: 2, padding: '11px', borderRadius: 10, fontWeight: 700, fontSize: 14,
            background: `linear-gradient(135deg, ${form.color}cc, ${form.color})`,
            color: 'white', border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.7 : 1, fontFamily: 'Inter, sans-serif',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            {saving ? <CircularProgress size={16} style={{ color: 'white' }} /> : null}
            {saving ? 'Saving...' : goal ? 'Update Goal' : 'Create Goal'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Contribute modal ────────────────────────────────────────────────
function ContributeModal({ goal, onClose, onSaved, isDark }) {
  const { showToast } = useToast();
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const add = Number(amount);
    if (!add || add <= 0) { showToast('Enter a valid amount', 'warning'); return; }
    setSaving(true);
    try {
      const newCurrent = Math.min(goal.currentAmount + add, goal.targetAmount);
      await api.put(`/goals/${goal._id}`, {
        name: goal.name, targetAmount: goal.targetAmount,
        currentAmount: newCurrent, deadline: new Date(goal.deadline).toISOString().slice(0, 10),
        color: goal.color,
      });
      showToast(`₹${add.toLocaleString()} added to "${goal.name}"! 💰`, 'success');
      onSaved(); onClose();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update goal', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9500,
      background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(10px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }} onClick={onClose}>
      <form onSubmit={handleSubmit} onClick={e => e.stopPropagation()} style={{
        background: isDark ? '#0f172a' : '#fff',
        border: `1px solid ${goal.color}33`,
        borderRadius: 20, padding: 28, width: '100%', maxWidth: 380,
        boxShadow: `0 24px 64px rgba(0,0,0,0.4), 0 0 0 1px ${goal.color}15`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: `${goal.color}22`, border: `1px solid ${goal.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Flag style={{ color: goal.color, fontSize: 20 }} />
          </div>
          <div>
            <p style={{ fontSize: 16, fontWeight: 800, color: isDark ? '#f9fafb' : '#111827', fontFamily: 'Outfit, sans-serif' }}>Add Savings</p>
            <p style={{ fontSize: 12, color: isDark ? '#9ca3af' : '#6b7280' }}>{goal.name}</p>
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: isDark ? '#9ca3af' : '#6b7280', marginBottom: 6 }}>Amount to Add (₹)</label>
          <input type="number" min="1" placeholder="e.g. 5000" value={amount} onChange={e => setAmount(e.target.value)}
            autoFocus style={{
              background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)'}`,
              borderRadius: '12px', padding: '12px 16px',
              color: isDark ? '#f9fafb' : '#111827', fontSize: '16px', fontWeight: 700,
              width: '100%', outline: 'none', fontFamily: 'Inter, sans-serif',
            }}
          />
          <p style={{ fontSize: 11, color: isDark ? '#6b7280' : '#9ca3af', marginTop: 6 }}>
            Current: ₹{goal.currentAmount.toLocaleString()} / ₹{goal.targetAmount.toLocaleString()}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" onClick={onClose} style={{
            flex: 1, padding: '11px', borderRadius: 10, fontWeight: 600,
            background: 'transparent', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)'}`,
            color: isDark ? '#9ca3af' : '#6b7280', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: 14,
          }}>Cancel</button>
          <button type="submit" disabled={saving} style={{
            flex: 2, padding: '11px', borderRadius: 10, fontWeight: 700, fontSize: 14,
            background: `linear-gradient(135deg, ${goal.color}cc, ${goal.color})`,
            color: 'white', border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.7 : 1, fontFamily: 'Inter, sans-serif',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            {saving ? <CircularProgress size={16} style={{ color: 'white' }} /> : <TrendingUp style={{ fontSize: 16 }} />}
            {saving ? 'Saving...' : 'Add Savings'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Main Goals page ─────────────────────────────────────────────────
export default function Goals() {
  const { theme } = useTheme();
  const { showToast } = useToast();
  const { user } = useAuth();
  const isDark = theme === 'dark';
  const text = isDark ? 'text-white' : 'text-gray-900';
  const sub = isDark ? 'text-gray-400' : 'text-gray-500';
  const card = isDark ? 'glass-card-dark' : 'glass-card-light';

  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editGoal, setEditGoal] = useState(null);
  const [contributeGoal, setContributeGoal] = useState(null);

  const fetchGoals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/goals');
      setGoals(res.data.goals || []);
    } catch {
      showToast('Failed to load goals', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchGoals(); }, [fetchGoals]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this goal?')) return;
    try {
      await api.delete(`/goals/${id}`);
      showToast('Goal deleted', 'success');
      fetchGoals();
    } catch {
      showToast('Failed to delete goal', 'error');
    }
  };

  const totalTarget = goals.reduce((s, g) => s + g.targetAmount, 0);
  const totalSaved = goals.reduce((s, g) => s + g.currentAmount, 0);
  const completedGoals = goals.filter(g => g.currentAmount >= g.targetAmount).length;

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between animate-slide-up">
        <div>
          <h1 className={`text-3xl font-extrabold tracking-tight ${text}`}>Savings Goals</h1>
          <p className={`text-sm mt-1 ${sub}`}>Track your financial milestones and stay motivated.</p>
        </div>
        <button
          onClick={() => { setEditGoal(null); setShowModal(true); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'linear-gradient(135deg, #0D9488, #4F46E5)',
            color: 'white', border: 'none', borderRadius: 12,
            padding: '10px 20px', fontWeight: 700, fontSize: 14,
            cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            boxShadow: '0 4px 14px rgba(13,148,136,0.3)',
          }}
        >
          <Add fontSize="small" /> New Goal
        </button>
      </div>

      {/* ── Summary strip ───────────────────────────────────────── */}
      {goals.length > 0 && (
        <div className="grid grid-cols-3 gap-4 animate-slide-up animate-slide-up-delay-1">
          {[
            { icon: <Flag style={{ color: '#0D9488' }} />, label: 'Active Goals', value: goals.length },
            { icon: <TrendingUp style={{ color: '#16A34A' }} />, label: 'Total Saved', value: `₹${totalSaved.toLocaleString()}` },
            { icon: <CheckCircleIcon style={{ color: '#4F46E5' }} />, label: 'Achieved', value: completedGoals },
          ].map((s, i) => (
            <div key={i} className={`p-4 rounded-2xl ${card} border text-center`}>
              <div className="flex justify-center mb-2">{s.icon}</div>
              <p className={`text-xs font-semibold uppercase tracking-wider ${sub}`}>{s.label}</p>
              <p className={`text-xl font-extrabold mt-0.5 ${text}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Goals grid ──────────────────────────────────────────── */}
      {loading ? (
        <div className="flex justify-center py-16"><CircularProgress /></div>
      ) : goals.length === 0 ? (
        <div className={`p-12 rounded-2xl ${card} border text-center animate-slide-up`}>
          <Rocket style={{ fontSize: 56, color: '#0D9488', opacity: 0.7, marginBottom: 12 }} />
          <h3 className={`text-xl font-bold mb-2 ${text}`}>No Goals Yet</h3>
          <p className={`text-sm mb-6 ${sub}`}>
            Start by creating your first savings goal — a vacation, gadget, emergency fund, or anything you're working toward!
          </p>
          <button
            onClick={() => { setEditGoal(null); setShowModal(true); }}
            style={{
              background: 'linear-gradient(135deg, #0D9488, #4F46E5)',
              color: 'white', border: 'none', borderRadius: 12,
              padding: '12px 28px', fontWeight: 700, fontSize: 15,
              cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            <Add /> Create My First Goal
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {goals.map(goal => (
            <GoalCard
              key={goal._id}
              goal={goal}
              isDark={isDark}
              onEdit={(g) => { setEditGoal(g); setShowModal(true); }}
              onDelete={handleDelete}
              onContribute={(g) => setContributeGoal(g)}
            />
          ))}
        </div>
      )}

      {/* ── Aurelia tip banner ───────────────────────────────────── */}
      {goals.length > 0 && (
        <div className={`p-4 rounded-2xl border flex items-center gap-3 animate-slide-up`} style={{
          borderColor: 'rgba(13,148,136,0.2)',
          background: isDark ? 'rgba(13,148,136,0.05)' : 'rgba(13,148,136,0.04)',
        }}>
          <AutoAwesome style={{ color: '#0D9488', flexShrink: 0 }} />
          <p className={`text-sm ${sub}`}>
            <strong style={{ color: isDark ? '#f9fafb' : '#111827' }}>Aurelia tip:</strong>{' '}
            {totalSaved < totalTarget
              ? `You're ₹${(totalTarget - totalSaved).toLocaleString()} away from all goals. At ₹${Math.round((totalTarget - totalSaved) / 12).toLocaleString()}/month you'd hit them all in a year.`
              : '🎉 You\'ve funded all your goals! Time to set new ones and keep growing your wealth.'}
          </p>
        </div>
      )}

      {/* ── Modals ──────────────────────────────────────────────── */}
      {showModal && (
        <GoalModal
          goal={editGoal}
          isDark={isDark}
          onClose={() => { setShowModal(false); setEditGoal(null); }}
          onSaved={fetchGoals}
        />
      )}

      {contributeGoal && (
        <ContributeModal
          goal={contributeGoal}
          isDark={isDark}
          onClose={() => setContributeGoal(null)}
          onSaved={fetchGoals}
        />
      )}
    </div>
  );
}
