import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import AureliaFloat from '../components/AureliaFloat';
import OnboardingWizard from '../components/OnboardingWizard';
import QuickAddModal from '../components/QuickAddModal';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, Legend,
  PieChart, Pie, Cell, RadialBarChart, RadialBar,
  LineChart, Line
} from 'recharts';
import {
  TrendingUp, TrendingDown, AccountBalance, Percent,
  WarningAmber, AutoAwesome, Refresh, Add,
  SpeedOutlined, CheckCircle as CheckCircleOutline, ArrowUpward, ArrowDownward
} from '@mui/icons-material';
import { CircularProgress } from '@mui/material';

const COLORS = ['#0D9488', '#4F46E5', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899', '#3b82f6', '#16A34A'];

// Generates mini sparkline data from daily grouped amounts
function buildSparkline(transactions, type, days = 7) {
  const map = {};
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    map[d.toDateString()] = 0;
  }
  transactions.filter(t => t.type === type).forEach(t => {
    const ds = new Date(t.date).toDateString();
    if (ds in map) map[ds] += t.amount;
  });
  return Object.values(map).map((v, i) => ({ i, v }));
}

// Inline mini sparkline chart
function Sparkline({ data, color }) {
  return (
    <div style={{ width: 90, height: 32 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// Financial Health Score Ring
function HealthScoreRing({ score, grade, isDark }) {
  const gradeColors = {
    'A+': '#16A34A', 'A': '#22c55e', 'B+': '#3b82f6',
    'B': '#4F46E5', 'C': '#f59e0b', 'D': '#ef4444'
  };
  const color = gradeColors[grade] || '#0D9488';
  const ringData = [{ value: score, fill: color }, { value: 100 - score, fill: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }];

  return (
    <div style={{ position: 'relative', width: 140, height: 140 }}>
      <div className="score-ring-glow" style={{ width: '100%', height: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%" cy="50%"
            innerRadius="62%" outerRadius="85%"
            startAngle={220} endAngle={-40}
            data={ringData}
            barSize={12}
          >
            <RadialBar
              dataKey="value"
              cornerRadius={6}
              background={false}
              data={ringData}
            />
          </RadialBarChart>
        </ResponsiveContainer>
      </div>
      {/* Center label */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center'
      }}>
        <span style={{ fontSize: 28, fontWeight: 800, color, fontFamily: 'Outfit, sans-serif', lineHeight: 1 }}>
          {score}
        </span>
        <span style={{
          fontSize: 13, fontWeight: 700, color,
          background: `${color}18`,
          padding: '2px 8px', borderRadius: '99px',
          marginTop: 4,
          fontFamily: 'Outfit, sans-serif',
        }}>
          {grade}
        </span>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [summary, setSummary] = useState(null);
  const [trendData, setTrendData] = useState([]);
  const [predictions, setPredictions] = useState(null);
  const [healthScore, setHealthScore] = useState(null);
  const [recentTx, setRecentTx] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [allTx, setAllTx] = useState([]);
  const [allBudgets, setAllBudgets] = useState([]);
  const [currentInsightIndex, setCurrentInsightIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [predLoading, setPredLoading] = useState(true);
  const [error, setError] = useState('');
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [smsInput, setSmsInput] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [portfolioSummary, setPortfolioSummary] = useState(null);
  const [portfolioHoldings, setPortfolioHoldings] = useState([]);
  const [showOnboarding, setShowOnboarding] = useState(
    () => localStorage.getItem('onboarding_complete') !== 'true'
  );

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

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const [summaryRes, txRes, healthRes, budgetRes, portfolioRes] = await Promise.all([
        api.get('/analytics/summary'),
        api.get('/transactions'),
        api.get('/analytics/health-score').catch(() => ({ data: { score: 50, grade: 'C' } })),
        api.get(`/budgets?month=${currentMonth}`).catch(() => ({ data: [] })),
        api.get('/portfolio').catch(() => ({ data: { holdings: [], summary: { totalInvested: 0, totalCurrent: 0, totalPnl: 0, totalPnlPercent: 0 } } }))
      ]);
      setSummary(summaryRes.data);
      setHealthScore(healthRes.data);
      setBudgets(budgetRes.data.slice(0, 4));
      setAllBudgets(budgetRes.data);
      setAllTx(txRes.data);
      setPortfolioSummary(portfolioRes.data.summary);
      setPortfolioHoldings(portfolioRes.data.holdings);

      // Recent 5 transactions
      const sorted = [...txRes.data].sort((a, b) => new Date(b.date) - new Date(a.date));
      setRecentTx(sorted.slice(0, 5));

      // Trend
      processTrendData(txRes.data);
    } catch (err) {
      console.error('Dashboard load error:', err);
      setError('Could not retrieve dashboard data. Check your connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPredictions = useCallback(async () => {
    setPredLoading(true);
    try {
      const res = await api.get('/analytics/prediction');
      setPredictions(res.data);
    } catch {
      setPredictions(null);
    } finally {
      setPredLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); fetchPredictions(); }, [fetchAll, fetchPredictions]);

  const compileInsights = () => {
    const insights = [];

    const now = new Date();
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const monthElapsedPct = (dayOfMonth / daysInMonth) * 100;

    allBudgets.forEach(b => {
      const spentPct = b.percentUsed;
      if (spentPct > monthElapsedPct + 15 && spentPct < 100) {
        insights.push({
          type: 'budget_pace',
          title: 'Spending Velocity Warning',
          category: b.category,
          message: `You have consumed ${spentPct}% of your ${b.category} budget, while only ${Math.round(monthElapsedPct)}% of the month has elapsed. Adjust spending velocity to prevent exceeding the limit.`,
          severity: 'warning'
        });
      } else if (spentPct >= 100) {
        insights.push({
          type: 'budget_pace',
          title: 'Budget Limit Exceeded',
          category: b.category,
          message: `Your ${b.category} category spending has exceeded the ₹${b.monthlyLimit.toLocaleString()} budget limit by ₹${(b.spent - b.monthlyLimit).toLocaleString()}.`,
          severity: 'error'
        });
      }
    });

    const savingsRate = summary?.savingsRate || 0;
    if (savingsRate < 0) {
      insights.push({
        type: 'savings_velocity',
        title: 'Negative Savings Rate',
        message: `Your expenses exceeded your income this month (Savings Rate: ${savingsRate}%). Aurelia recommends reviewing discretionary categories like dining and shopping.`,
        severity: 'error'
      });
    } else if (savingsRate < 15) {
      insights.push({
        type: 'savings_velocity',
        title: 'Low Savings Margin',
        message: `Your current monthly savings rate is at ${savingsRate}%, which falls below the recommended 20% baseline for wealth accumulation.`,
        severity: 'warning'
      });
    } else {
      insights.push({
        type: 'savings_velocity',
        title: 'Healthy Savings Rate',
        message: `Splendid! You saved ${savingsRate}% of your income this month, maintaining strong capital accumulation velocity.`,
        severity: 'success'
      });
    }

    const anomalies = allTx.filter(t => t.isAnomaly);
    if (anomalies.length > 0) {
      insights.push({
        type: 'anomaly',
        title: 'Anomalous Spending Detected',
        message: `AI identified ${anomalies.length} suspicious or unusual spending charge(s) (e.g. ${anomalies[0].description} of ₹${anomalies[0].amount}). Please review details in Transactions.`,
        severity: 'warning',
        action: '/transactions'
      });
    }

    return insights;
  };

  const processTrendData = (transactions) => {
    if (!transactions.length) { setTrendData([]); return; }
    const grouped = {};
    [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date)).forEach(t => {
      const ds = new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (!grouped[ds]) grouped[ds] = { date: ds, income: 0, expense: 0 };
      if (t.type === 'income') grouped[ds].income += t.amount;
      else grouped[ds].expense += t.amount;
    });
    setTrendData(Object.values(grouped).slice(-10));
  };

  const incomeSparkline = allTx.length ? buildSparkline(allTx, 'income') : [];
  const expenseSparkline = allTx.length ? buildSparkline(allTx, 'expense') : [];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] gap-4">
        <CircularProgress color="primary" />
        <p className={sub}>Loading your financial dashboard...</p>
      </div>
    );
  }

  const hasExpenses = summary?.categoryBreakdown?.length > 0;
  const greeting = user?.username ? `Hey, ${user.username.split(' ')[0]}! 👋` : 'Welcome back! 👋';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-slide-up">
        <div>
          <h1 className={`text-3xl font-extrabold tracking-tight ${text}`}>{greeting}</h1>
          <p className={`text-sm mt-1 ${sub}`}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <button
          onClick={() => { fetchAll(); fetchPredictions(); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'transparent',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)'}`,
            borderRadius: '12px', padding: '9px 16px',
            color: isDark ? '#9ca3af' : '#6b7280',
            cursor: 'pointer', fontSize: 14, fontWeight: 600,
            fontFamily: 'Inter, sans-serif',
          }}
        >
          <Refresh fontSize="small" /> Refresh
        </button>
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, padding: '12px 16px', color: '#ef4444', fontSize: 14 }}>
          {error}
        </div>
      )}

      {/* AI Proactive Insights & SMS Simulator Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-slide-up animate-slide-up-delay-1">
        {/* Left Column: AI Proactive Insights */}
        <div className="lg:col-span-2">
          {(() => {
            const insights = compileInsights();
            if (insights.length === 0) {
              insights.push({
                type: 'neutral',
                title: 'Aurelia Wealth Intelligence',
                message: 'All systems clear. Your spending velocity is aligned with your budget pacing, and no anomalies are currently detected.',
                severity: 'success'
              });
            }

            const currentInsight = insights[currentInsightIndex % insights.length] || insights[0];
            
            let borderClr = 'border-amber-500/20';
            let bgClr = isDark ? 'rgba(217, 119, 6, 0.05)' : 'rgba(248, 250, 252, 0.95)';
            let titleClr = isDark ? 'text-amber-400' : 'text-amber-700';
            let iconElement = <AutoAwesome className="text-amber-500" />;

            if (currentInsight.severity === 'error') {
              borderClr = 'border-rose-500/20';
              bgClr = isDark ? 'rgba(239, 68, 68, 0.05)' : 'rgba(254, 242, 242, 0.95)';
              titleClr = isDark ? 'text-rose-400' : 'text-rose-700';
              iconElement = <WarningAmber className="text-rose-500" />;
            } else if (currentInsight.severity === 'success') {
              borderClr = 'border-emerald-500/20';
              bgClr = isDark ? 'rgba(22, 163, 74, 0.05)' : 'rgba(240, 253, 250, 0.95)';
              titleClr = isDark ? 'text-emerald-400' : 'text-emerald-700';
              iconElement = <CheckCircleOutline className="text-emerald-500" />;
            }

            return (
              <div
                className={`p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden flex items-start gap-4 h-full ${card}`}
                style={{
                  borderColor: isDark ? 'rgba(217,119,6,0.15)' : 'rgba(217,119,6,0.25)',
                  background: bgClr,
                  boxShadow: isDark ? 'none' : '0 4px 20px rgba(217,119,6,0.04)'
                }}
              >
                <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-amber-500 to-amber-600" />
                
                <div className="flex-shrink-0 p-2 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  {iconElement}
                </div>

                <div className="flex-grow pr-16">
                  <span className={`text-[10px] uppercase font-bold tracking-widest ${sub} block`}>AI PROACTIVE INSIGHT</span>
                  <h4 className={`text-base font-extrabold mt-0.5 ${titleClr}`}>{currentInsight.title}</h4>
                  <p className={`text-xs mt-1 leading-relaxed ${text}`}>{currentInsight.message}</p>
                  
                  {currentInsight.action && (
                    <button
                      onClick={() => navigate(currentInsight.action)}
                      className="mt-2 text-xs font-semibold text-amber-500 hover:text-amber-600 flex items-center gap-1 bg-none border-none cursor-pointer"
                      style={{ background: 'none', border: 'none', padding: 0 }}
                    >
                      Action Required <ArrowUpward style={{ transform: 'rotate(90deg)', fontSize: 12 }} />
                    </button>
                  )}
                </div>

                {insights.length > 1 && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setCurrentInsightIndex(prev => (prev - 1 + insights.length) % insights.length)}
                        className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-gray-400 hover:text-white border-none bg-none cursor-pointer flex items-center justify-center"
                        style={{ background: 'none', border: 'none' }}
                      >
                        <ArrowDownward style={{ transform: 'rotate(90deg)', fontSize: 14 }} />
                      </button>
                      <button
                        onClick={() => setCurrentInsightIndex(prev => (prev + 1) % insights.length)}
                        className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-gray-400 hover:text-white border-none bg-none cursor-pointer flex items-center justify-center"
                        style={{ background: 'none', border: 'none' }}
                      >
                        <ArrowUpward style={{ transform: 'rotate(90deg)', fontSize: 14 }} />
                      </button>
                    </div>
                    <div className="flex gap-1 justify-center mt-1">
                      {insights.map((_, idx) => (
                        <div
                          key={idx}
                          className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                            idx === (currentInsightIndex % insights.length)
                              ? 'bg-amber-500 scale-125'
                              : 'bg-gray-400/30'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* Right Column: Bank SMS Simulator */}
        <div>
          {(() => {
            const templates = [
              { label: 'Select Template...', value: '' },
              { label: 'Netflix Debit (₹499)', value: 'Alert: Your credit card was charged INR 499.00 at Netflix on 19-Jun-2026.' },
              { label: 'Starbucks UPI spend (₹500)', value: 'Rs. 500.00 spent at Starbucks Coffee using UPI.' },
              { label: 'Apple Store Card spend (₹12,500)', value: 'Alert: Spent INR 12,500.00 at Apple Store on credit card.' },
              { label: 'Salary Credit (₹85,000)', value: 'Salary of INR 85,000.00 credited to account XX4958 on 01-Jun-2026.' }
            ];

            const handleSimulate = async () => {
              if (!smsInput.trim()) {
                showToast('Please type or select a mock bank text first.', 'warning');
                return;
              }
              setSyncing(true);
              try {
                const res = await api.post('/transactions/parse-sms', { smsText: smsInput });
                showToast(`Sync Successful! Parsed ₹${res.data.amount.toLocaleString()} ${res.data.type} for ${res.data.description} (${res.data.category})`, 'success');
                setSmsInput('');
                fetchAll();
                fetchPredictions();
              } catch (err) {
                showToast(err.response?.data?.message || 'Failed to sync simulated bank SMS', 'error');
              } finally {
                setSyncing(false);
              }
            };

            return (
              <div
                className={`p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden flex flex-col justify-between h-full ${card}`}
                style={{
                  borderColor: isDark ? 'rgba(217,119,6,0.15)' : 'rgba(217,119,6,0.25)',
                  boxShadow: isDark ? 'none' : '0 4px 20px rgba(217,119,6,0.04)',
                  minHeight: '180px'
                }}
              >
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-amber-500" style={{ fontSize: '18px' }}>💬</span>
                    <h4 className={`text-base font-extrabold ${text}`}>SMS Sync Simulator</h4>
                  </div>
                  
                  <div className="mb-3">
                    <select
                      value=""
                      onChange={e => {
                        if (e.target.value) setSmsInput(e.target.value);
                      }}
                      className="text-xs w-full outline-none"
                      style={{
                        background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(248, 250, 252, 0.6)',
                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(217,119,6,0.2)'}`,
                        borderRadius: '8px',
                        padding: '6px 8px',
                        color: isDark ? '#f9fafb' : '#111827',
                        fontFamily: 'Inter, sans-serif'
                      }}
                    >
                      {templates.map((t, idx) => (
                        <option key={idx} value={t.value} style={{ background: isDark ? '#1f2937' : '#fff' }}>{t.label}</option>
                      ))}
                    </select>
                  </div>

                  <textarea
                    rows="2"
                    placeholder="Type bank SMS or select a template..."
                    value={smsInput}
                    onChange={e => setSmsInput(e.target.value)}
                    className="text-xs w-full p-2 outline-none resize-none"
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(248, 250, 252, 0.4)',
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(217,119,6,0.15)'}`,
                      borderRadius: '8px',
                      color: isDark ? '#f9fafb' : '#111827',
                      fontFamily: 'Courier New, monospace'
                    }}
                  />
                </div>

                <button
                  onClick={handleSimulate}
                  disabled={syncing}
                  className="mt-3 w-full py-2 rounded-xl text-xs font-semibold text-white transition-all flex items-center justify-center gap-1 cursor-pointer"
                  style={{
                    background: 'linear-gradient(135deg, #0D9488, #4F46E5)',
                    border: 'none',
                    boxShadow: '0 2px 10px rgba(13,148,136,0.2)'
                  }}
                >
                  {syncing ? <CircularProgress size={12} style={{ color: 'white' }} /> : 'Simulate Bank Sync'}
                </button>
              </div>
            );
          })()}
        </div>
      </div>

      {/* === ROW 1: Stat Cards with Sparklines === */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 animate-slide-up animate-slide-up-delay-1">
        {[
          {
            label: 'Total Income',
            value: `₹${(summary?.totalIncome || 0).toLocaleString()}`,
            icon: <TrendingUp />, iconBg: 'rgba(22,163,74,0.12)', iconColor: '#16A34A',
            spark: incomeSparkline, sparkColor: '#16A34A',
            trend: '+', trendColor: '#16A34A',
          },
          {
            label: 'Total Expenses',
            value: `₹${(summary?.totalExpense || 0).toLocaleString()}`,
            icon: <TrendingDown />, iconBg: 'rgba(239,68,68,0.12)', iconColor: '#ef4444',
            spark: expenseSparkline, sparkColor: '#ef4444',
          },
          {
            label: 'Net Savings',
            value: `₹${(summary?.netSavings || 0).toLocaleString()}`,
            icon: <AccountBalance />, iconBg: 'rgba(59,130,246,0.12)', iconColor: '#3b82f6',
            valueColor: (summary?.netSavings || 0) >= 0 ? '#16A34A' : '#ef4444',
          },
          {
            label: 'Savings Rate',
            value: `${summary?.savingsRate || 0}%`,
            icon: <Percent />, iconBg: 'rgba(139,92,246,0.12)', iconColor: '#8b5cf6',
            valueColor: (summary?.savingsRate || 0) >= 20 ? '#16A34A' : '#f59e0b',
          },
        ].map((stat, i) => (
          <div
            key={stat.label}
            className={`p-5 rounded-2xl ${card} border animate-slide-up`}
            style={{ animationDelay: `${i * 0.07}s` }}
          >
            <div className="flex items-start justify-between">
              <div
                style={{
                  padding: '10px', borderRadius: '12px',
                  background: stat.iconBg, color: stat.iconColor, flexShrink: 0,
                }}
              >
                {stat.icon}
              </div>
              {stat.spark && stat.spark.length > 0 && (
                <Sparkline data={stat.spark} color={stat.sparkColor} />
              )}
            </div>
            <p className={`text-xs font-semibold uppercase tracking-wider mt-3 ${sub}`}>{stat.label}</p>
            <p
              className={`text-2xl font-bold mt-1`}
              style={{ color: stat.valueColor || (isDark ? '#f9fafb' : '#111827') }}
            >
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* === Consult Aurelia AI Prompts Section === */}
      <div className="space-y-3 animate-slide-up">
        <div className="flex items-center gap-2">
          <AutoAwesome className="text-amber-500" fontSize="small" />
          <h3 className={`text-base font-bold ${text}`}>Consult Aurelia AI</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              title: 'Analyze Budget Leaks',
              desc: 'Check for anomalies and leaking discretionary funds.',
              query: 'Are there any suspicious anomalies or budget leaks in my activities?'
            },
            {
              title: 'Optimize Savings Rate',
              desc: 'Get customized suggestions to increase savings accumulation.',
              query: 'How can I optimize my savings velocity and category budgets?'
            },
            {
              title: 'Expense Forecast',
              desc: 'Project next-month category spends using AI models.',
              query: 'What is my predicted next month spending forecast?'
            },
            {
              title: 'Affordability Inquiry',
              desc: 'Verify if a discretionary ₹5,000 spend is safe now.',
              query: 'Can I afford to spend ₹5,000 right now based on my numbers?'
            }
          ].map((prompt, idx) => (
            <div
              key={idx}
              onClick={() => navigate('/chatbot', { state: { preQuery: prompt.query } })}
              className={`p-4 rounded-xl ${card} border cursor-pointer hover:border-amber-500/40 hover:-translate-y-1 transition-all duration-300 relative group flex flex-col justify-between`}
              style={{
                borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(217,119,6,0.1)'
              }}
            >
              <div>
                <h4 className={`text-sm font-bold group-hover:text-amber-500 transition-colors ${text}`}>
                  {prompt.title}
                </h4>
                <p className={`text-xs mt-1 leading-relaxed ${sub}`}>
                  {prompt.desc}
                </p>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold tracking-wider text-amber-500 group-hover:text-amber-600 transition-colors">
                  Ask Aurelia
                </span>
                <span className="text-xs text-amber-500 group-hover:translate-x-1 transition-transform">
                  ➔
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* === ROW 2: Health Score + Cash Flow Chart === */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Financial Health Score */}
        <div className={`p-6 rounded-2xl ${card} border animate-slide-up animate-slide-up-delay-2 flex flex-col items-center justify-center gap-4`}>
          <div className="flex items-center gap-2 self-start">
            <SpeedOutlined style={{ color: '#0D9488' }} />
            <h3 className={`text-base font-bold ${text}`}>Financial Health</h3>
          </div>
          {healthScore ? (
            <>
              <HealthScoreRing score={healthScore.score} grade={healthScore.grade} isDark={isDark} />
              <div className="w-full space-y-2">
                {[
                  { label: 'Savings Score', value: healthScore.breakdown?.savingsScore || 0, max: 40, color: '#16A34A' },
                  { label: 'Consistency', value: healthScore.breakdown?.consistencyScore || 0, max: 40, color: '#4F46E5' },
                  { label: 'Anomaly Penalty', value: -(healthScore.breakdown?.anomalyPenalty || 0), max: 20, color: '#ef4444', negative: true },
                ].map(item => (
                  <div key={item.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className={sub}>{item.label}</span>
                      <span style={{ color: item.color, fontWeight: 600 }}>
                        {item.negative ? '' : '+'}{item.value}pts
                      </span>
                    </div>
                    <div className="budget-bar-track">
                      <div
                        className="budget-bar-fill"
                        style={{
                          width: `${Math.abs(item.value) / item.max * 100}%`,
                          background: item.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <CircularProgress size={36} />
          )}
        </div>

        {/* Cash Flow Trend Chart */}
        <div className={`lg:col-span-2 p-6 rounded-2xl ${card} border animate-slide-up animate-slide-up-delay-2`}>
          <h3 className={`text-base font-bold mb-4 ${text}`}>Cash Flow Trend</h3>
          <div style={{ height: 240 }}>
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gIncome" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#16A34A" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#16A34A" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gExpense" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" stroke={isDark ? '#4b5563' : '#9ca3af'} style={{ fontSize: 11 }} />
                  <YAxis stroke={isDark ? '#4b5563' : '#9ca3af'} style={{ fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipStyle} formatter={v => `₹${v.toLocaleString()}`} />
                  <Legend verticalAlign="top" height={32} />
                  <Area type="monotone" name="Income (₹)" dataKey="income" stroke="#16A34A" fill="url(#gIncome)" strokeWidth={2} />
                  <Area type="monotone" name="Expense (₹)" dataKey="expense" stroke="#ef4444" fill="url(#gExpense)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className={`text-sm ${sub}`}>Add transactions to see your cash flow trend.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* === ROW 3: Category Pie + Budget Progress + Recent Tx === */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Category Pie */}
        <div className={`p-6 rounded-2xl ${card} border animate-slide-up animate-slide-up-delay-3`}>
          <h3 className={`text-base font-bold mb-4 ${text}`}>Expense Breakdown</h3>
          {hasExpenses ? (
            <div>
              <div style={{ height: 180, position: 'relative' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={summary.categoryBreakdown} cx="50%" cy="50%"
                      innerRadius={52} outerRadius={74} paddingAngle={3}
                      dataKey="amount" nameKey="category"
                    >
                      {summary.categoryBreakdown.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={v => `₹${v.toLocaleString()}`} contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                  <span className={`text-xs ${sub}`}>Total Spent</span>
                  <span className={`text-lg font-bold ${text}`}>₹{(summary.totalExpense || 0).toLocaleString()}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5 mt-3 text-xs">
                {summary.categoryBreakdown.slice(0, 6).map((item, i) => (
                  <div key={item.category} className="flex items-center gap-1.5 truncate">
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                    <span className={`${sub} truncate`}>{item.category}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className={`flex items-center justify-center h-48 ${sub} text-sm text-center`}>No expenses logged yet.</div>
          )}
        </div>

        {/* Budget Progress */}
        <div className={`p-6 rounded-2xl ${card} border animate-slide-up animate-slide-up-delay-3`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`text-base font-bold ${text}`}>Budget Progress</h3>
            <button
              onClick={() => navigate('/budgets')}
              style={{ fontSize: 12, color: '#0D9488', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontFamily: 'Inter, sans-serif' }}
            >
              Manage →
            </button>
          </div>
          {budgets.length > 0 ? (
            <div className="space-y-4">
              {budgets.map(b => {
                const barColor = b.percentUsed >= 100 ? '#ef4444' : b.percentUsed >= 80 ? '#f59e0b' : '#16A34A';
                return (
                  <div key={b._id}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className={`font-medium ${text}`}>{b.category}</span>
                      <span className={sub}>{b.percentUsed}% of ₹{b.monthlyLimit.toLocaleString()}</span>
                    </div>
                    <div className="budget-bar-track">
                      <div
                        className="budget-bar-fill"
                        style={{ width: `${b.percentUsed}%`, background: barColor }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={`flex flex-col items-center justify-center h-40 gap-3 text-center ${sub}`}>
              <p className="text-sm">No budget goals set.</p>
              <button
                onClick={() => navigate('/budgets')}
                style={{
                  background: 'linear-gradient(135deg, #0D9488, #4F46E5)',
                  color: 'white', border: 'none', borderRadius: '10px',
                  padding: '8px 16px', fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                }}
              >
                + Set Budgets
              </button>
            </div>
          )}
        </div>

        {/* Recent Transactions */}
        <div className={`p-6 rounded-2xl ${card} border animate-slide-up animate-slide-up-delay-3`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`text-base font-bold ${text}`}>Recent Activity</h3>
            <button
              onClick={() => navigate('/transactions')}
              style={{ fontSize: 12, color: '#0D9488', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontFamily: 'Inter, sans-serif' }}
            >
              View All →
            </button>
          </div>
          {recentTx.length > 0 ? (
            <div className="space-y-3">
              {recentTx.map(tx => (
                <div key={tx._id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '10px', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: tx.type === 'income' ? 'rgba(22,163,74,0.12)' : 'rgba(239,68,68,0.12)',
                    color: tx.type === 'income' ? '#16A34A' : '#ef4444',
                  }}>
                    {tx.type === 'income' ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: isDark ? '#f9fafb' : '#111827', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tx.description || tx.category}
                    </p>
                    <p style={{ fontSize: 11, color: isDark ? '#6b7280' : '#9ca3af', margin: 0 }}>
                      {tx.category} · {new Date(tx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: tx.type === 'income' ? '#16A34A' : '#ef4444', flexShrink: 0 }}>
                    {tx.type === 'income' ? '+' : '-'}₹{tx.amount.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className={`text-sm text-center py-8 ${sub}`}>No transactions yet. Add your first one!</p>
          )}
        </div>
      </div>

      {/* === ROW 4: AI Predictions + Anomalies === */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className={`p-6 rounded-2xl ${card} border md:col-span-2 animate-slide-up animate-slide-up-delay-4`}>
          <div className="flex items-center gap-2 mb-4">
            <AutoAwesome style={{ color: '#8b5cf6' }} />
            <h3 className={`text-base font-bold ${text}`}>AI Expense Predictions (Next Month)</h3>
          </div>
          {predLoading ? (
            <div className="flex items-center gap-2 py-4">
              <CircularProgress size={18} />
              <span className={`text-sm ${sub}`}>Querying AI models...</span>
            </div>
          ) : predictions && Object.keys(predictions).length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Object.entries(predictions).map(([cat, amt]) => (
                <div
                  key={cat}
                  style={{
                    padding: '14px', borderRadius: '14px',
                    background: isDark ? 'rgba(139,92,246,0.06)' : 'rgba(139,92,246,0.04)',
                    border: `1px solid ${isDark ? 'rgba(139,92,246,0.15)' : 'rgba(139,92,246,0.12)'}`,
                  }}
                >
                  <span className={`text-xs font-semibold ${sub}`}>{cat}</span>
                  <p className="text-xl font-bold mt-1" style={{ color: '#8b5cf6' }}>
                    ₹{Math.round(amt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div style={{
              padding: '14px 18px', borderRadius: '12px',
              background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
              border: `1px dashed ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
              fontSize: 14, color: isDark ? '#6b7280' : '#9ca3af',
            }}>
              ⚡ <strong>AI forecasting needs more data.</strong> Keep logging transactions to unlock predictions!
            </div>
          )}
        </div>

        <div className={`p-6 rounded-2xl ${card} border animate-slide-up animate-slide-up-delay-4`}>
          <div className="flex items-center gap-2 mb-4">
            <WarningAmber style={{ color: '#f59e0b' }} />
            <h3 className={`text-base font-bold ${text}`}>Security & Anomalies</h3>
          </div>
          <p className={`text-xs ${sub} mb-4`}>
            Isolation Forest models flag unusual spending patterns in real time.
          </p>
          <div style={{
            padding: '12px 14px', borderRadius: '12px',
            background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.2)',
            color: '#16A34A', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <CheckCircleOutline fontSize="small" />
            <span>No suspicious anomalies detected.</span>
          </div>
          {healthScore?.meta?.anomalyCount > 0 && (
            <div style={{
              marginTop: 10, padding: '12px 14px', borderRadius: '12px',
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              color: '#ef4444', fontSize: 13,
            }}>
              ⚠️ {healthScore.meta.anomalyCount} anomalous transaction{healthScore.meta.anomalyCount > 1 ? 's' : ''} flagged.
            </div>
          )}
        </div>
      </div>

      {/* === Portfolio Snapshot Widget (Option C Hybrid) === */}
      <div className={`p-6 rounded-2xl ${card} border animate-slide-up animate-slide-up-delay-4`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="text-[#5368F5]" />
            <h3 className={`text-base font-bold ${text}`}>Investment Portfolio Snapshot</h3>
          </div>
          <button
            onClick={() => navigate('/portfolio')}
            className="text-xs font-semibold hover:underline flex items-center gap-1 border-none bg-none cursor-pointer"
            style={{ color: isDark ? '#5368F5' : '#4257E6', background: 'none', border: 'none', padding: 0 }}
          >
            View Full Portfolio →
          </button>
        </div>
        
        {portfolioHoldings && portfolioHoldings.length > 0 ? (
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Left Side: Summary metrics */}
            <div className="flex items-center gap-6 flex-wrap">
              <div>
                <span className={`text-[10px] uppercase font-bold tracking-widest ${sub}`}>Portfolio Value</span>
                <h4 className={`text-2xl font-extrabold font-outfit mt-1 ${text}`}>
                  ₹{portfolioSummary?.totalCurrent.toLocaleString('en-IN', { maximumFractionDigits: 2 }) || '0'}
                </h4>
              </div>
              
              <div>
                <span className={`text-[10px] uppercase font-bold tracking-widest ${sub}`}>Overall Return</span>
                <div className="flex items-center gap-2 mt-1">
                  <span 
                    className="text-lg font-bold font-outfit"
                    style={{ color: (portfolioSummary?.totalPnl || 0) >= 0 ? '#16A34A' : '#ef4444' }}
                  >
                    {(portfolioSummary?.totalPnl || 0) >= 0 ? '+' : ''}
                    {(portfolioSummary?.totalPnlPercent || 0).toFixed(2)}%
                  </span>
                  <span className={`text-xs ${sub}`}>
                    ({(portfolioSummary?.totalPnl || 0) >= 0 ? '+' : ''}₹{Math.round(portfolioSummary?.totalPnl || 0).toLocaleString()})
                  </span>
                </div>
              </div>
            </div>

            {/* Right Side: Quick view holdings list */}
            <div className="flex items-center gap-3 overflow-x-auto max-w-full no-scrollbar">
              {portfolioHoldings.slice(0, 3).map((h, idx) => (
                <div 
                  key={idx} 
                  className="p-3 rounded-xl border flex flex-col justify-between min-w-[120px]"
                  style={{
                    backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                    borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'
                  }}
                >
                  <span className="font-bold text-xs">{h.symbol}</span>
                  <span 
                    className="text-xs font-bold mt-1 animate-pulse"
                    style={{ color: h.pnl >= 0 ? '#16A34A' : '#ef4444' }}
                  >
                    {h.pnl >= 0 ? '▲' : '▼'} {Math.abs(h.pnlPercent).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div 
            className="p-6 text-center rounded-xl border border-dashed"
            style={{
              backgroundColor: isDark ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.01)',
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
              color: isDark ? '#64748B' : '#475569'
            }}
          >
            <span className="text-sm font-semibold block">No assets in portfolio yet.</span>
            <button 
              onClick={() => navigate('/portfolio')}
              className="mt-2 text-xs font-bold hover:underline border-none bg-none cursor-pointer"
              style={{ color: isDark ? '#818cf8' : '#4338ca', background: 'none', border: 'none' }}
            >
              + Add holdings to start tracking investments
            </button>
          </div>
        )}
      </div>


      {/* Floating Aurelia AI Bubble — above the + button */}
      <AureliaFloat />

      {/* Floating Quick-Add Button */}
      <button
        className="fab"
        onClick={() => setShowQuickAdd(true)}
        title="Quick Add Transaction"
      >
        <Add fontSize="medium" />
      </button>

      {showQuickAdd && (
        <QuickAddModal
          onClose={() => setShowQuickAdd(false)}
          onAdded={() => { fetchAll(); fetchPredictions(); }}
        />
      )}

      {/* Onboarding wizard — shown once for new users */}
      {showOnboarding && (
        <OnboardingWizard onComplete={() => { setShowOnboarding(false); fetchAll(); }} />
      )}
    </div>
  );
}
