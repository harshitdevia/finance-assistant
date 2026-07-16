import React, { useState } from 'react';
import api from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { CATEGORIES } from '../constants/categories';

// Quick-add transaction modal — usable from any page (Dashboard, Navbar, ...)
export default function QuickAddModal({ onClose, onAdded }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { showToast } = useToast();
  const [form, setForm] = useState({ amount: '', type: 'expense', category: 'Food', description: '' });
  const [saving, setSaving] = useState(false);

  const CATS = CATEGORIES;

  const inputStyle = {
    background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)'}`,
    borderRadius: '10px', padding: '11px 14px',
    color: isDark ? '#f9fafb' : '#111827',
    fontSize: '14px', width: '100%', outline: 'none',
    fontFamily: 'Inter, sans-serif',
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.amount || Number(form.amount) <= 0) {
      showToast('Enter a valid amount', 'warning'); return;
    }
    setSaving(true);
    try {
      await api.post('/transactions', {
        amount: Number(form.amount),
        type: form.type,
        category: form.category,
        description: form.description,
      });
      showToast(`${form.type === 'income' ? '💰' : '💸'} ₹${Number(form.amount).toLocaleString()} ${form.type} added!`, 'success');
      onAdded();
      onClose();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to add transaction', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9500,
        background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
      }}
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={e => e.stopPropagation()}
        style={{
          background: isDark ? '#0f172a' : '#ffffff',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.1)'}`,
          borderRadius: '20px', padding: '28px',
          width: '100%', maxWidth: '400px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        }}
      >
        <h2 style={{ color: isDark ? '#f9fafb' : '#111827', fontSize: 20, fontWeight: 800, marginBottom: 20, fontFamily: 'Outfit, sans-serif' }}>
          Quick Add Transaction
        </h2>

        {/* Type toggle */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {['expense', 'income'].map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setForm(p => ({ ...p, type: t }))}
              style={{
                flex: 1, padding: '9px', borderRadius: '10px', fontWeight: 600,
                fontSize: '13px', cursor: 'pointer',
                border: form.type === t ? 'none' : `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)'}`,
                background: form.type === t
                  ? t === 'expense' ? 'linear-gradient(135deg,#ef4444,#dc2626)' : 'linear-gradient(135deg,#16A34A,#16A34A)'
                  : 'transparent',
                color: form.type === t ? 'white' : isDark ? '#9ca3af' : '#6b7280',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {t === 'expense' ? '💸 Expense' : '💰 Income'}
            </button>
          ))}
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: isDark ? '#9ca3af' : '#6b7280', marginBottom: 6 }}>Amount (₹)</label>
          <input type="number" min="1" placeholder="0" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} style={inputStyle} autoFocus />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: isDark ? '#9ca3af' : '#6b7280', marginBottom: 6 }}>Category</label>
          <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} style={inputStyle}>
            {CATS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: isDark ? '#9ca3af' : '#6b7280', marginBottom: 6 }}>Description (optional)</label>
          <input type="text" placeholder="What's this for?" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} style={inputStyle} />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" onClick={onClose} style={{ ...inputStyle, width: 'auto', flex: 1, background: 'transparent', cursor: 'pointer', fontWeight: 600, textAlign: 'center' }}>Cancel</button>
          <button type="submit" disabled={saving} style={{
            flex: 2, background: form.type === 'expense' ? 'linear-gradient(135deg,#ef4444,#dc2626)' : 'linear-gradient(135deg,#16A34A,#16A34A)',
            color: 'white', border: 'none', borderRadius: '10px', padding: '11px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.7 : 1, fontFamily: 'Inter, sans-serif', fontSize: 14,
          }}>
            {saving ? 'Adding...' : 'Add Transaction'}
          </button>
        </div>
      </form>
    </div>
  );
}
