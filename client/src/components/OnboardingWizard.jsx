import React, { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import { CircularProgress } from '@mui/material';
import { ArrowForward, ArrowBack, Check } from '@mui/icons-material';
import { EXPENSE_CATEGORIES as BUDGET_CATEGORIES } from '../constants/categories';

const STEPS = [
  { id: 1, title: 'Welcome to WealthAI! 👋', subtitle: 'Let\'s set up your financial profile in 3 quick steps.' },
  { id: 2, title: 'Set your first budget 💰', subtitle: 'Pick a category and set a monthly spending limit.' },
  { id: 3, title: 'Create a savings goal 🎯', subtitle: 'What are you saving toward?' },
  { id: 4, title: 'You\'re all set! 🎉', subtitle: 'Your WealthAI dashboard is ready.' },
];

export default function OnboardingWizard({ onComplete }) {
  const { theme } = useTheme();
  const { showToast } = useToast();
  const isDark = theme === 'dark';

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 1 — income
  const [income, setIncome] = useState('');

  // Step 2 — budget
  const [budgetCategory, setBudgetCategory] = useState('Food');
  const [budgetLimit, setBudgetLimit] = useState('');

  // Step 3 — goal
  const [goalName, setGoalName] = useState('');
  const [goalAmount, setGoalAmount] = useState('');
  const [goalDate, setGoalDate] = useState('');

  const inputStyle = {
    background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
    borderRadius: 12, padding: '12px 16px', width: '100%',
    color: isDark ? '#f9fafb' : '#111827', fontSize: 15,
    outline: 'none', fontFamily: 'Inter, sans-serif',
    boxSizing: 'border-box',
  };

  const labelStyle = {
    display: 'block', fontSize: 13, fontWeight: 600,
    color: isDark ? '#9ca3af' : '#6b7280', marginBottom: 8,
  };

  const handleNext = async () => {
    if (step === 1) {
      // Save monthly income to user profile
      if (income && Number(income) > 0) {
        try {
          await api.put('/auth/profile', { monthlyIncome: Number(income) });
        } catch { /* not critical */ }
      }
      setStep(2);
    } else if (step === 2) {
      if (budgetCategory && budgetLimit && Number(budgetLimit) > 0) {
        setSaving(true);
        try {
          const currentMonth = new Date().toISOString().substring(0, 7);
          await api.post('/budgets', {
            category: budgetCategory,
            monthlyLimit: Number(budgetLimit),
            month: currentMonth,
          });
          showToast(`${budgetCategory} budget set! ✅`, 'success');
        } catch { /* ignore */ }
        setSaving(false);
      }
      setStep(3);
    } else if (step === 3) {
      if (goalName && goalAmount && goalDate) {
        setSaving(true);
        try {
          await api.post('/goals', {
            name: goalName.trim(),
            targetAmount: Number(goalAmount),
            currentAmount: 0,
            deadline: goalDate,
            color: '#16A34A',
          });
          showToast(`Goal "${goalName}" created! 🚀`, 'success');
        } catch { /* ignore */ }
        setSaving(false);
      }
      setStep(4);
    } else if (step === 4) {
      localStorage.setItem('onboarding_complete', 'true');
      onComplete();
    }
  };

  const canProceed = () => {
    if (step === 1) return true; // income is optional
    if (step === 2) return !!budgetCategory && !!budgetLimit && Number(budgetLimit) > 0;
    if (step === 3) return !!goalName && !!goalAmount && !!goalDate;
    return true;
  };

  const progress = ((step - 1) / 3) * 100;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
      background: 'rgba(0,0,0,0.7)',
      backdropFilter: 'blur(12px)',
    }}>
      <div style={{
        width: '100%', maxWidth: 480,
        background: isDark ? '#0a1710' : '#ffffff',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.1)'}`,
        borderRadius: 24, overflow: 'hidden',
        boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
      }}>
        {/* Progress bar */}
        <div style={{ height: 4, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}>
          <div style={{
            height: '100%', width: `${progress}%`,
            background: 'linear-gradient(90deg, #16A34A, #0d9488)',
            transition: 'width 0.5s ease',
            borderRadius: 999,
          }} />
        </div>

        <div style={{ padding: '36px 36px 32px' }}>
          {/* Step indicator */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 28, justifyContent: 'center' }}>
            {[1, 2, 3, 4].map(s => (
              <div key={s} style={{
                width: s === step ? 24 : 8, height: 8, borderRadius: 999,
                background: s <= step ? '#16A34A' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'),
                transition: 'all 0.3s ease',
              }} />
            ))}
          </div>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <h2 style={{
              fontSize: 22, fontWeight: 800, fontFamily: 'Outfit, sans-serif',
              color: isDark ? '#f9fafb' : '#111827', marginBottom: 8,
            }}>
              {STEPS[step - 1].title}
            </h2>
            <p style={{ fontSize: 14, color: isDark ? '#9ca3af' : '#6b7280' }}>
              {STEPS[step - 1].subtitle}
            </p>
          </div>

          {/* Step 1 — Income */}
          {step === 1 && (
            <div>
              <label style={labelStyle}>Monthly Income (₹) — Optional</label>
              <input
                type="number" min="0" placeholder="e.g. 65000"
                value={income}
                onChange={e => setIncome(e.target.value)}
                style={inputStyle}
                autoFocus
              />
              <p style={{ fontSize: 12, color: isDark ? '#4b5563' : '#9ca3af', marginTop: 8 }}>
                This helps Aurelia give you personalized savings advice.
              </p>

              <div style={{
                marginTop: 24, padding: '16px 18px', borderRadius: 14,
                background: isDark ? 'rgba(22,163,74,0.06)' : 'rgba(22,163,74,0.05)',
                border: '1px solid rgba(22,163,74,0.15)',
              }}>
                <p style={{ fontSize: 13, color: isDark ? '#9ca3af' : '#6b7280', lineHeight: 1.6 }}>
                  👋 <strong style={{ color: isDark ? '#f9fafb' : '#111827' }}>Hi! I'm Aurelia</strong>, your AI financial advisor.<br />
                  I'll help you track spending, grow savings, and make smarter money decisions.
                </p>
              </div>
            </div>
          )}

          {/* Step 2 — Budget */}
          {step === 2 && (
            <div>
              <label style={labelStyle}>Category</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {BUDGET_CATEGORIES.map(cat => (
                  <button key={cat} onClick={() => setBudgetCategory(cat)} style={{
                    padding: '7px 14px', borderRadius: 999, fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                    background: budgetCategory === cat
                      ? 'linear-gradient(135deg, #16A34A, #16A34A)'
                      : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'),
                    color: budgetCategory === cat ? 'white' : (isDark ? '#9ca3af' : '#6b7280'),
                    border: budgetCategory === cat ? 'none' : `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                    transition: 'all 0.15s',
                  }}>
                    {cat}
                  </button>
                ))}
              </div>

              <label style={labelStyle}>Monthly Limit (₹)</label>
              <input
                type="number" min="1" placeholder="e.g. 5000"
                value={budgetLimit}
                onChange={e => setBudgetLimit(e.target.value)}
                style={inputStyle}
              />
            </div>
          )}

          {/* Step 3 — Goal */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Goal Name *</label>
                <input
                  type="text" placeholder="e.g. Emergency Fund, New Laptop, Europe Trip"
                  value={goalName}
                  onChange={e => setGoalName(e.target.value)}
                  style={inputStyle}
                  autoFocus
                />
              </div>
              <div>
                <label style={labelStyle}>Target Amount (₹) *</label>
                <input
                  type="number" min="1" placeholder="e.g. 100000"
                  value={goalAmount}
                  onChange={e => setGoalAmount(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Target Date *</label>
                <input
                  type="date"
                  value={goalDate}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={e => setGoalDate(e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>
          )}

          {/* Step 4 — Celebration */}
          {step === 4 && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 72, marginBottom: 20 }}>🎉</div>
              <p style={{ fontSize: 15, color: isDark ? '#9ca3af' : '#6b7280', lineHeight: 1.7, marginBottom: 8 }}>
                Your dashboard is ready. Add your first transaction to get personalised insights from Aurelia!
              </p>
              <div style={{
                display: 'inline-flex', gap: 20, marginTop: 20,
                padding: '16px 24px', borderRadius: 14,
                background: isDark ? 'rgba(13,148,136,0.06)' : 'rgba(13,148,136,0.05)',
                border: '1px solid rgba(13,148,136,0.2)',
              }}>
                {[
                  { emoji: '📊', label: 'Dashboard' },
                  { emoji: '💬', label: 'Ask Aurelia' },
                  { emoji: '🎯', label: 'Your Goals' },
                ].map(item => (
                  <div key={item.label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 24, marginBottom: 4 }}>{item.emoji}</div>
                    <p style={{ fontSize: 11, fontWeight: 600, color: isDark ? '#6b7280' : '#9ca3af' }}>{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 10, marginTop: 32 }}>
            {step > 1 && step < 4 && (
              <button onClick={() => setStep(s => s - 1)} style={{
                flex: 1, padding: '12px', borderRadius: 12, fontWeight: 600, fontSize: 14,
                background: 'transparent',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                color: isDark ? '#9ca3af' : '#6b7280',
                cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
                <ArrowBack style={{ fontSize: 16 }} /> Back
              </button>
            )}
            {step < 3 && (
              <button onClick={() => setStep(s => s + 1)} style={{
                flex: 1, padding: '12px', borderRadius: 12, fontWeight: 600, fontSize: 14,
                background: 'transparent',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                color: isDark ? '#9ca3af' : '#6b7280',
                cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              }}>
                Skip
              </button>
            )}
            <button
              onClick={handleNext}
              disabled={!canProceed() || saving}
              style={{
                flex: 2, padding: '12px', borderRadius: 12, fontWeight: 700, fontSize: 15,
                background: 'linear-gradient(135deg, #16A34A, #0d9488)',
                color: 'white', border: 'none',
                cursor: canProceed() && !saving ? 'pointer' : 'not-allowed',
                opacity: canProceed() ? 1 : 0.5,
                fontFamily: 'Outfit, sans-serif',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: '0 4px 16px rgba(22,163,74,0.3)',
              }}
            >
              {saving ? <CircularProgress size={18} style={{ color: 'white' }} /> : null}
              {step === 4 ? <><Check style={{ fontSize: 18 }} /> Let's Go!</> : <>{step === 3 ? 'Create Goal' : 'Continue'} <ArrowForward style={{ fontSize: 18 }} /></>}
            </button>
          </div>

          {step < 4 && (
            <button onClick={() => { localStorage.setItem('onboarding_complete', 'true'); onComplete(); }} style={{
              display: 'block', margin: '12px auto 0', background: 'transparent', border: 'none',
              fontSize: 12, color: isDark ? '#4b5563' : '#9ca3af',
              cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            }}>
              Skip setup for now
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
