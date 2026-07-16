import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import {
  FileDownload, FileUpload, BarChart as BarChartIcon,
  TrendingUp, TrendingDown, CalendarMonth, Print, AutoAwesome, TrackChanges
} from '@mui/icons-material';
import { CircularProgress } from '@mui/material';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  Legend, Cell
} from 'recharts';

const MONTHS_BACK = 6;

const formatMonth = (ym) => {
  const [y, m] = ym.split('-');
  return new Date(y, m - 1).toLocaleString('default', { month: 'short', year: '2-digit' });
};

const getCurrentMonth = () => new Date().toISOString().slice(0, 7);

// Client-side CSV parser
function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, ''));
  return lines.slice(1).map(line => {
    const vals = line.split(',');
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (vals[i] || '').trim().replace(/^"|"$/g, ''); });
    return obj;
  }).filter(r => r.amount && r.type);
}

export default function Reports() {
  const { theme } = useTheme();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const fileRef = useRef();

  const [monthlyData, setMonthlyData] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [monthDetail, setMonthDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [dragging, setDragging] = useState(false);

  // AI Assessment State
  const [aiAssessment, setAiAssessment] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // Tab State
  const [activeTab, setActiveTab] = useState('reports'); // 'reports' | 'projections'

  // Projections & Simulation State
  const [simNetWorth, setSimNetWorth] = useState(null);
  const [simSavings, setSimSavings] = useState(null);
  const [simYears, setSimYears] = useState(15);
  const [simRisk, setSimRisk] = useState('balanced');
  const [simulationData, setSimulationData] = useState([]);
  const [simLoading, setSimLoading] = useState(false);

  // Goals Feasibility State
  const [goals, setGoals] = useState([]);
  const [goalsLoading, setGoalsLoading] = useState(false);

  const isDark = theme === 'dark';
  const card = isDark ? 'glass-card-dark' : 'glass-card-light';
  const text = isDark ? 'text-white' : 'text-gray-900';
  const sub = isDark ? 'text-gray-400' : 'text-gray-500';
  const tooltipStyle = {
    backgroundColor: isDark ? '#1f2937' : '#ffffff',
    borderColor: isDark ? '#374151' : '#e5e7eb',
    borderRadius: 12,
    color: isDark ? '#fff' : '#000',
  };

  // Build monthly summaries for last N months
  const buildMonthlyReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/transactions');
      const txns = res.data;

      const grouped = {};
      txns.forEach(t => {
        const month = new Date(t.date).toISOString().slice(0, 7);
        if (!grouped[month]) grouped[month] = { income: 0, expense: 0, transactions: [] };
        if (t.type === 'income') grouped[month].income += t.amount;
        else grouped[month].expense += t.amount;
        grouped[month].transactions.push(t);
      });

      const months = [];
      for (let i = MONTHS_BACK - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(1);
        d.setMonth(d.getMonth() - i);
        const ym = d.toISOString().slice(0, 7);
        months.push({
          month: ym,
          label: formatMonth(ym),
          income: grouped[ym]?.income || 0,
          expense: grouped[ym]?.expense || 0,
          savings: (grouped[ym]?.income || 0) - (grouped[ym]?.expense || 0),
          transactions: grouped[ym]?.transactions || [],
        });
      }
      setMonthlyData(months);

      // Detail for selected month
      const detail = grouped[selectedMonth];
      let currentMonthDetail = null;
      if (detail) {
        const catMap = {};
        detail.transactions.filter(t => t.type === 'expense').forEach(t => {
          catMap[t.category] = (catMap[t.category] || 0) + t.amount;
        });
        currentMonthDetail = {
          income: detail.income,
          expense: detail.expense,
          savings: detail.income - detail.expense,
          categories: Object.entries(catMap).map(([cat, amt]) => ({ cat, amt })).sort((a, b) => b.amt - a.amt),
          txCount: detail.transactions.length,
        };
        setMonthDetail(currentMonthDetail);
      } else {
        setMonthDetail(null);
      }

      // Fetch AI assessment if data exists
      if (currentMonthDetail) {
        setAiLoading(true);
        setAiAssessment('');
        try {
          const monthLabel = new Date(selectedMonth + '-01').toLocaleString('default', { month: 'long', year: 'numeric' });
          const prompt = `System Request: Review the financial status for ${monthLabel}. Income is ₹${currentMonthDetail.income}, Expense is ₹${currentMonthDetail.expense}, Savings is ₹${currentMonthDetail.savings}. Category breakdown: ${JSON.stringify(currentMonthDetail.categories)}. Provide a professional, concise 3-sentence summary of where the user is overspending and how to optimize. Start directly with the analysis.`;
          
          const aiRes = await api.post('/chatbot', { message: prompt });
          setAiAssessment(aiRes.data.reply || 'No assessment generated.');
        } catch (err) {
          console.error('AI Assessment fetch error:', err);
          setAiAssessment('Unable to compile AI report assessment. Ensure the Flask ML service is online.');
        } finally {
          setAiLoading(false);
        }
      } else {
        setAiAssessment('No transaction data available for this month to generate an assessment.');
      }

    } catch {
      showToast('Failed to load report data', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, showToast]);

  useEffect(() => { buildMonthlyReport(); }, [buildMonthlyReport]);

  const fetchGoals = useCallback(async () => {
    setGoalsLoading(true);
    try {
      const res = await api.get('/goals');
      setGoals(res.data.goals || []);
    } catch (err) {
      console.error('Failed to load goals:', err);
    } finally {
      setGoalsLoading(false);
    }
  }, []);

  const fetchProjections = useCallback(async (params = {}) => {
    setSimLoading(true);
    try {
      const payload = {};
      const nextNetWorth = params.netWorth !== undefined ? params.netWorth : simNetWorth;
      const nextSavings = params.savings !== undefined ? params.savings : simSavings;
      const nextYears = params.years !== undefined ? params.years : simYears;
      const nextRisk = params.risk !== undefined ? params.risk : simRisk;

      if (nextNetWorth !== null) payload.current_net_worth = nextNetWorth;
      if (nextSavings !== null) payload.monthly_savings = nextSavings;
      payload.years = nextYears;
      payload.risk_profile = nextRisk;

      const res = await api.post('/analytics/projection', payload);
      const { defaults, simulation } = res.data;

      if (nextNetWorth === null) setSimNetWorth(defaults.current_net_worth);
      if (nextSavings === null) setSimSavings(defaults.monthly_savings);
      
      setSimulationData(simulation.projections || []);
    } catch (err) {
      console.error('Failed to simulate:', err);
      showToast('Failed to load projections', 'error');
    } finally {
      setSimLoading(false);
    }
  }, [simNetWorth, simSavings, simYears, simRisk, showToast]);

  useEffect(() => {
    if (activeTab === 'projections') {
      fetchGoals();
      fetchProjections();
    }
  }, [activeTab, fetchGoals, fetchProjections]);

  // CSV Export
  const handleExport = async () => {
    setExporting(true);
    try {
      const token = sessionStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/transactions/export`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wealthai_transactions_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Transactions exported successfully! 📥', 'success');
    } catch {
      showToast('Failed to export transactions', 'error');
    } finally {
      setExporting(false);
    }
  };

  // CSV Import
  const handleFileImport = async (file) => {
    if (!file || !file.name.endsWith('.csv')) {
      showToast('Please select a valid .csv file', 'warning');
      return;
    }
    setImporting(true);
    try {
      const text = await file.text();
      const rows = parseCSV(text);
      if (rows.length === 0) {
        showToast('No valid rows found in CSV. Check the format.', 'warning');
        return;
      }
      const res = await api.post('/transactions/import', { rows });
      showToast(`${res.data.imported} transactions imported! 🎉`, 'success');
      buildMonthlyReport();
    } catch (err) {
      showToast(err.response?.data?.message || 'Import failed', 'error');
    } finally {
      setImporting(false);
    }
  };

  const monthOptions = [];
  for (let i = MONTHS_BACK - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    monthOptions.push(d.toISOString().slice(0, 7));
  }

  const inputStyle = {
    background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(248, 250, 252, 0.6)',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(13, 148, 136, 0.2)'}`,
    borderRadius: '10px', padding: '10px 14px',
    color: isDark ? '#f9fafb' : '#111827',
    fontSize: '14px', outline: 'none',
    fontFamily: 'Inter, sans-serif',
  };

  const COLORS = ['#0D9488', '#4F46E5', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899', '#3b82f6'];

  return (
    <div className="space-y-6 relative">
      {/* Dynamic print overrides stylesheet */}
      <style>{`
        @media print {
          /* Hide navigation, sidebar, quick actions, dropdowns, import/export buttons, and dropzones */
          aside, nav, button, select, input, .no-print, .csv-drop-zone, .mobile-nav-bar {
            display: none !important;
          }
          
          /* Expand layout container to full width */
          main, .max-w-7xl {
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          /* Set light mode look for clean paper printout */
          body {
            background: #ffffff !important;
            color: #000000 !important;
          }

          /* Lighten glass cards for clean printout without gradient overlays */
          .glass-card-dark, .glass-card-light {
            background: #ffffff !important;
            border: 1px solid #e2e8f0 !important;
            box-shadow: none !important;
            color: #000000 !important;
            page-break-inside: avoid;
            margin-bottom: 20px !important;
          }

          /* Force text styles to be black and clear */
          h1, h2, h3, h4, p, span, td, th {
            color: #000000 !important;
          }

          /* Force black text inside charts */
          .recharts-text {
            fill: #000000 !important;
          }
        }
      `}</style>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-slide-up">
        <div>
          <h1 className={`text-3xl font-extrabold tracking-tight ${text}`}>Financial Reports</h1>
          <p className={`text-sm mt-1 ${sub}`}>Monthly summaries, category breakdowns & data management.</p>
        </div>
        <div className="flex gap-3 flex-wrap no-print">
          {/* Export PDF */}
          <button
            onClick={() => window.print()}
            className="hover:scale-105 active:scale-95 transition-all"
            style={{
              background: 'linear-gradient(135deg, #0D9488, #4F46E5)',
              color: 'white', border: 'none', borderRadius: '12px',
              padding: '10px 16px', fontWeight: 600, fontSize: '14px',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
              fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap',
              boxShadow: '0 4px 14px rgba(13,148,136,0.3)',
            }}
          >
            <Print fontSize="small" />
            Print Report
          </button>
          
          {activeTab === 'reports' && (
            <>
              {/* Export CSV */}
              <button
                onClick={handleExport}
                disabled={exporting}
                style={{
                  background: isDark ? 'rgba(13,148,136,0.1)' : 'rgba(13,148,136,0.08)',
                  border: '1px solid rgba(13,148,136,0.3)',
                  color: '#0D9488', borderRadius: '12px',
                  padding: '10px 16px', fontWeight: 600, fontSize: '14px',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                  fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap',
                }}
              >
                {exporting ? <CircularProgress size={16} /> : <FileDownload fontSize="small" />}
                Export CSV
              </button>

              {/* Import CSV */}
              <button
                onClick={() => fileRef.current?.click()}
                disabled={importing}
                style={{
                  background: isDark ? 'rgba(79,70,229,0.1)' : 'rgba(79,70,229,0.08)',
                  border: '1px solid rgba(79,70,229,0.3)',
                  color: '#4F46E5', borderRadius: '12px',
                  padding: '10px 16px', fontWeight: 600, fontSize: '14px',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                  fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap',
                }}
              >
                {importing ? <CircularProgress size={16} /> : <FileUpload fontSize="small" />}
                Import CSV
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                style={{ display: 'none' }}
                onChange={e => handleFileImport(e.target.files[0])}
              />
            </>
          )}
        </div>
      </div>

      {/* Tab Switcher Panel */}
      <div className={`p-1.5 rounded-2xl ${card} border flex gap-1 items-center max-w-md animate-slide-up no-print`}>
        {[
          { id: 'reports', label: 'Reports Dashboard', icon: <BarChartIcon fontSize="small" /> },
          { id: 'projections', label: 'Future Projections', icon: <TrendingUp fontSize="small" /> }
        ].map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id === 'projections') {
                  fetchGoals();
                  if (simNetWorth === null) {
                    fetchProjections();
                  }
                }
              }}
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

      {activeTab === 'reports' && (
        <>
          {/* CSV Drop Zone */}
          <div
        className={`p-6 rounded-2xl border-2 border-dashed transition-all csv-drop-zone no-print ${
          dragging
            ? 'border-brand-teal bg-brand-teal/5 scale-[1.01]'
            : isDark ? 'border-gray-700' : 'border-gray-300'
        }`}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) handleFileImport(file);
        }}
        style={{ cursor: 'default' }}
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <FileUpload style={{ color: isDark ? '#4b5563' : '#9ca3af', fontSize: 36 }} />
          <p className={`text-sm font-medium ${sub}`}>
            Drag & drop your bank statement CSV here, or{' '}
            <span
              style={{ color: '#4F46E5', cursor: 'pointer', textDecoration: 'underline' }}
              onClick={() => fileRef.current?.click()}
            >
              browse
            </span>
          </p>
          <p className={`text-xs ${sub}`}>
            Expected columns: <code className="font-mono">Date, Type, Category, Amount, Description</code>
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <CircularProgress size={36} style={{ color: '#0D9488' }} />
        </div>
      ) : (
        <>
          {/* Aurelia AI Wealth Assessment Card */}
          <div
            className={`p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden ${card}`}
            style={{
              borderLeft: '5px solid #0D9488',
              boxShadow: isDark ? 'none' : '0 4px 24px rgba(13,148,136,0.03)'
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <AutoAwesome className="text-teal-500" fontSize="small" />
              <h3 className={`text-base font-extrabold ${text}`}>Aurelia AI Wealth Assessment</h3>
              {aiLoading && <CircularProgress size={12} style={{ color: '#0D9488' }} />}
            </div>

            {aiLoading ? (
              <p className={`text-xs italic ${sub}`}>Generating month assessment report...</p>
            ) : (
              <p className={`text-sm leading-relaxed ${text}`} style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
                "{aiAssessment}"
              </p>
            )}
          </div>

          {/* 6-Month Bar Chart */}
          <div className={`p-6 rounded-2xl ${card} border animate-slide-up animate-slide-up-delay-1`}>
            <div className="flex items-center gap-2 mb-5">
              <BarChartIcon style={{ color: '#0D9488' }} />
              <h2 className={`text-lg font-bold ${text}`}>6-Month Income vs Expense</h2>
            </div>
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} barGap={4} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis dataKey="label" stroke={isDark ? '#4b5563' : '#64748b'} style={{ fontSize: 12 }} />
                  <YAxis stroke={isDark ? '#4b5563' : '#64748b'} style={{ fontSize: 12 }} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => `₹${v.toLocaleString()}`} />
                  <Legend />
                  <Bar dataKey="income" name="Income (₹)" fill="#16A34A" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="expense" name="Expense (₹)" fill="#ef4444" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Month-Detail Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Month selector + stats */}
            <div className={`p-6 rounded-2xl ${card} border animate-slide-up animate-slide-up-delay-2`}>
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <CalendarMonth style={{ color: '#0D9488' }} />
                  <h2 className={`text-lg font-bold ${text}`}>Monthly Detail</h2>
                </div>
                <select
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                  style={inputStyle}
                  className="no-print"
                >
                  {monthOptions.map(m => (
                    <option key={m} value={m} style={{ background: isDark ? '#1f2937' : '#fff' }}>{formatMonth(m)} ({m})</option>
                  ))}
                </select>
                {/* Print Month Indicator (Only visible in Print) */}
                <span className="hidden print:inline font-bold text-sm text-slate-800">
                  For: {formatMonth(selectedMonth)}
                </span>
              </div>
              {monthDetail ? (
                <div className="space-y-4">
                  {[
                    { label: 'Total Income', value: monthDetail.income, icon: <TrendingUp />, color: '#16A34A' },
                    { label: 'Total Expense', value: monthDetail.expense, icon: <TrendingDown />, color: '#ef4444' },
                    { label: 'Net Savings', value: monthDetail.savings, color: monthDetail.savings >= 0 ? '#3b82f6' : '#ef4444' },
                    { label: 'Transactions', value: monthDetail.txCount, isCount: true, color: '#8b5cf6' },
                  ].map(item => (
                    <div
                      key={item.label}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 14px',
                        borderRadius: '12px',
                        background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(248,250,252,0.3)',
                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(13,148,136,0.1)'}`,
                      }}
                    >
                      <span className={`text-sm ${sub}`}>{item.label}</span>
                      <span className="text-sm font-bold" style={{ color: item.color }}>
                        {item.isCount ? item.value : `₹${item.value.toLocaleString()}`}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={`text-sm text-center py-8 ${sub}`}>No transactions in this month.</p>
              )}
            </div>

            {/* Category breakdown */}
            <div className={`p-6 rounded-2xl ${card} border animate-slide-up animate-slide-up-delay-3`}>
              <h2 className={`text-lg font-bold mb-5 ${text}`}>Expense by Category</h2>
              {monthDetail && monthDetail.categories.length > 0 ? (
                <div className="space-y-3">
                  {monthDetail.categories.map((item, i) => {
                    const pct = monthDetail.expense > 0 ? (item.amt / monthDetail.expense * 100).toFixed(1) : 0;
                    const color = COLORS[i % COLORS.length];
                    return (
                      <div key={item.cat}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className={`font-medium ${text}`}>{item.cat}</span>
                          <span className={sub}>₹{item.amt.toLocaleString()} ({pct}%)</span>
                        </div>
                        <div className="budget-bar-track">
                          <div
                            className="budget-bar-fill"
                            style={{ width: `${pct}%`, background: color }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className={`text-sm text-center py-8 ${sub}`}>No expenses in this month.</p>
              )}
            </div>
          </div>

          {/* Monthly summary table */}
          <div className={`p-6 rounded-2xl ${card} border animate-slide-up animate-slide-up-delay-4`}>
            <h2 className={`text-lg font-bold mb-4 ${text}`}>Month-by-Month Summary</h2>
            <div className="overflow-x-auto">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr>
                    {['Month', 'Income', 'Expense', 'Savings', 'Savings Rate'].map(h => (
                      <th
                        key={h}
                        style={{
                          textAlign: 'left',
                          padding: '10px 12px',
                          fontSize: '11px',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          color: isDark ? '#6b7280' : '#64748b',
                          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(13,148,136,0.1)'}`,
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {monthlyData.map((row, i) => {
                    const rate = row.income > 0 ? ((row.savings / row.income) * 100).toFixed(1) : '0';
                    return (
                      <tr
                        key={row.month}
                        style={{
                          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)'}`,
                          background: selectedMonth === row.month
                            ? isDark ? 'rgba(13,148,136,0.05)' : 'rgba(13,148,136,0.03)'
                            : 'transparent',
                        }}
                      >
                        <td style={{ padding: '11px 12px', fontWeight: 600, color: isDark ? '#f9fafb' : '#111827' }}>
                          {formatMonth(row.month)}
                        </td>
                        <td style={{ padding: '11px 12px', color: '#16A34A', fontWeight: 500 }}>
                          ₹{row.income.toLocaleString()}
                        </td>
                        <td style={{ padding: '11px 12px', color: '#ef4444', fontWeight: 500 }}>
                          ₹{row.expense.toLocaleString()}
                        </td>
                        <td style={{ padding: '11px 12px', color: row.savings >= 0 ? '#3b82f6' : '#ef4444', fontWeight: 600 }}>
                          {row.savings >= 0 ? '+' : ''}₹{row.savings.toLocaleString()}
                        </td>
                        <td style={{ padding: '11px 12px' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '3px 8px',
                              borderRadius: '99px',
                              fontSize: '12px',
                              fontWeight: 600,
                              background: Number(rate) >= 20 ? 'rgba(22,163,74,0.12)' : 'rgba(245,158,11,0.12)',
                              color: Number(rate) >= 20 ? '#16A34A' : '#f59e0b',
                            }}
                          >
                            {rate}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
        </>
      )}

      {activeTab === 'projections' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-slide-up">
          {/* Left Column: Sliders */}
          <div className={`p-6 rounded-2xl ${card} border space-y-6`}>
            <h2 className={`text-lg font-bold ${text}`}>Simulation Controls</h2>
            
            {/* Starting Capital */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <label className={`text-sm font-semibold ${text}`}>Starting Capital (₹)</label>
                <input
                  type="number"
                  value={simNetWorth === null ? '' : simNetWorth}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setSimNetWorth(val);
                    fetchProjections({ netWorth: val });
                  }}
                  className="w-24 text-right bg-transparent text-sm font-bold border-b border-gray-500 focus:outline-none"
                  style={{ color: isDark ? '#fff' : '#000' }}
                />
              </div>
              <input
                type="range"
                min="0"
                max="5000000"
                step="10000"
                value={simNetWorth || 0}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setSimNetWorth(val);
                }}
                onMouseUp={() => fetchProjections()}
                onTouchEnd={() => fetchProjections()}
                className="w-full accent-teal-500"
              />
              <div className="flex justify-between text-xs text-gray-400">
                <span>₹0</span>
                <span>₹50L</span>
              </div>
            </div>

            {/* Monthly Contribution */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <label className={`text-sm font-semibold ${text}`}>Monthly Savings (₹)</label>
                <input
                  type="number"
                  value={simSavings === null ? '' : simSavings}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setSimSavings(val);
                    fetchProjections({ savings: val });
                  }}
                  className="w-24 text-right bg-transparent text-sm font-bold border-b border-gray-500 focus:outline-none"
                  style={{ color: isDark ? '#fff' : '#000' }}
                />
              </div>
              <input
                type="range"
                min="0"
                max="500000"
                step="1000"
                value={simSavings || 0}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setSimSavings(val);
                }}
                onMouseUp={() => fetchProjections()}
                onTouchEnd={() => fetchProjections()}
                className="w-full accent-teal-500"
              />
              <div className="flex justify-between text-xs text-gray-400">
                <span>₹0</span>
                <span>₹5L</span>
              </div>
            </div>

            {/* Time Horizon */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <label className={`text-sm font-semibold ${text}`}>Simulation Horizon</label>
                <span className="text-sm font-bold text-teal-500">{simYears} Years</span>
              </div>
              <input
                type="range"
                min="10"
                max="30"
                step="1"
                value={simYears}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setSimYears(val);
                }}
                onMouseUp={() => fetchProjections()}
                onTouchEnd={() => fetchProjections()}
                className="w-full accent-teal-500"
              />
              <div className="flex justify-between text-xs text-gray-400">
                <span>10 Years</span>
                <span>30 Years</span>
              </div>
            </div>

            {/* Risk Allocation Profile */}
            <div className="space-y-2">
              <label className={`text-sm font-semibold block ${text}`}>Investment Strategy</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'conservative', label: 'Conservative', return: '7%', color: 'text-emerald-500' },
                  { id: 'balanced', label: 'Balanced', return: '11%', color: 'text-amber-500' },
                  { id: 'aggressive', label: 'Aggressive', return: '15%', color: 'text-rose-500' }
                ].map(strat => {
                  const isSelected = simRisk === strat.id;
                  return (
                    <button
                      key={strat.id}
                      onClick={() => {
                        setSimRisk(strat.id);
                        fetchProjections({ risk: strat.id });
                      }}
                      className={`p-2.5 rounded-xl border text-center transition-all duration-300 ${
                        isSelected
                          ? isDark
                            ? 'bg-teal-500/20 border-teal-500 text-teal-300'
                            : 'bg-teal-600 border-teal-600 text-white shadow'
                          : isDark
                          ? 'border-gray-800 text-gray-400 hover:bg-white/5'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <p className="text-xs font-bold">{strat.label}</p>
                      <p className="text-xs opacity-80 mt-0.5">{strat.return} Return</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Chart & Goals Checklist */}
          <div className="lg:col-span-2 space-y-6">
            {/* Chart Card */}
            <div className={`p-6 rounded-2xl ${card} border`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-lg font-bold ${text}`}>Monte Carlo Wealth Forecast</h3>
                <span className="text-xs px-2.5 py-1 rounded-full bg-gray-500/10 text-gray-400 border border-gray-500/20">
                  1,000 Statistical Runs
                </span>
              </div>

              {simLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <CircularProgress size={36} style={{ color: '#0D9488' }} />
                  <p className={`text-sm ${sub}`}>Simulating financial trajectories...</p>
                </div>
              ) : (
                <div style={{ height: 320 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={simulationData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <XAxis dataKey="year" stroke={isDark ? '#4b5563' : '#64748b'} style={{ fontSize: 11 }} />
                      <YAxis stroke={isDark ? '#4b5563' : '#64748b'} formatter={(v) => `₹${(v / 100000).toFixed(0)}L`} style={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(v) => `₹${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                        labelFormatter={(label) => `Year ${label}`}
                      />
                      <Legend verticalAlign="top" height={36} />
                      <Line
                        type="monotone"
                        dataKey="p90"
                        name="Best Case (90th%)"
                        stroke="#16A34A"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="p50"
                        name="Median Case (50th%)"
                        stroke="#f59e0b"
                        strokeWidth={3}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="p10"
                        name="Worst Case (10th%)"
                        stroke="#ef4444"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Goals Probability Card */}
            <div className={`p-6 rounded-2xl ${card} border space-y-4`}>
              <div className="flex items-center gap-2">
                <AutoAwesome className="text-teal-500" />
                <h3 className={`text-lg font-bold ${text}`}>Aurelia AI Goals Feasibility Check</h3>
              </div>

              {goalsLoading ? (
                <div className="flex justify-center py-6">
                  <CircularProgress size={24} style={{ color: '#0D9488' }} />
                </div>
              ) : goals.length === 0 ? (
                <div className="text-center py-8">
                  <TrackChanges style={{ fontSize: 40, color: '#0D9488', opacity: 0.6, marginBottom: 8 }} />
                  <p className={`text-sm mb-4 ${sub}`}>No active savings goals found. Set up a goal to analyze feasibility.</p>
                  <button
                    onClick={() => navigate('/goals')}
                    style={{
                      background: 'transparent',
                      color: '#0D9488', border: '1px solid #0D9488', borderRadius: 12,
                      padding: '8px 20px', fontWeight: 700, fontSize: 13,
                      cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                    }}
                  >
                    Go to Goals
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {goals.map(goal => {
                    const deadlineDate = new Date(goal.deadline);
                    const diffYears = (deadlineDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 365.25);
                    const roundedYear = Math.max(1, Math.min(simYears, Math.round(diffYears)));
                    
                    const yearProj = simulationData.find(d => d.year === roundedYear);
                    let probability = 50; 
                    
                    if (yearProj) {
                      const target = goal.targetAmount;
                      const { p10, p50, p90 } = yearProj;
                      
                      if (target <= p10) {
                        probability = Math.round(90 + 5 * (1 - target / (p10 || 1)));
                      } else if (target <= p50) {
                        probability = Math.round(90 - ((target - p10) / ((p50 - p10) || 1)) * 40);
                      } else if (target <= p90) {
                        probability = Math.round(50 - ((target - p50) / ((p90 - p50) || 1)) * 40);
                      } else {
                        probability = Math.round(Math.max(5, 10 - ((target - p90) / (p90 || 1)) * 5));
                      }
                      probability = Math.min(99, Math.max(1, probability));
                    }
                    
                    const color = probability >= 80 ? 'text-green-600' : probability >= 40 ? 'text-amber-500' : 'text-red-600';
                    const progressColor = probability >= 80 ? 'bg-green-600' : probability >= 40 ? 'bg-amber-500' : 'bg-red-600';
                    
                    return (
                      <div key={goal._id} className="p-4 rounded-xl border border-gray-500/10 space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className={`font-bold ${text}`}>{goal.name}</h4>
                            <p className="text-xs text-gray-400">Target: ₹{goal.targetAmount.toLocaleString()} ({roundedYear}y)</p>
                          </div>
                          <div className="text-right">
                            <span className={`text-lg font-black ${color}`}>{probability}%</span>
                            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Success Odds</p>
                          </div>
                        </div>

                        <div className="h-2 w-full bg-gray-500/10 rounded-full overflow-hidden">
                          <div className={`h-full ${progressColor}`} style={{ width: `${probability}%` }} />
                        </div>

                        <p className="text-xs text-gray-400 leading-relaxed">
                          {probability >= 80 ? (
                            <span className="text-green-500 font-semibold">✓ Secure trajectory.</span>
                          ) : probability >= 40 ? (
                            <span className="text-amber-400 font-semibold">⚠ Moderate risk.</span>
                          ) : (
                            <span className="text-red-500 font-semibold">🗙 High shortfall risk.</span>
                          )}{' '}
                          {probability < 80 && `Consider saving ₹${Math.round(goal.targetAmount / (roundedYear * 12)).toLocaleString()}/mo or dialing up risk.`}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
