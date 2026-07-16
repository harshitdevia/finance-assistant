import React, { useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  IconButton,
  Alert,
  CircularProgress,
  Chip
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  TrendingUp,
  TrendingDown,
  Delete as DeleteIcon,
  Search,
  ShowChart as ChartIcon,
  AccountBalanceWallet,
  AccountBalance,
  Warning,
  History as HistoryIcon,
  TrackChanges as TargetIcon,
  AutoAwesome,
  InfoOutlined
} from '@mui/icons-material';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as ChartTooltip,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  BarChart,
  Bar
} from 'recharts';

export default function Portfolio() {
  const { theme } = useTheme();
  const { showToast } = useToast();
  
  // Navigation Tabs State
  const [activeTab, setActiveTab] = useState('holdings'); // 'holdings' | 'transactions' | 'advisor' | 'goals'
  
  // Core Portfolio and Transactions State
  const [holdings, setHoldings] = useState([]);
  const [summary, setSummary] = useState({
    totalInvested: 0,
    totalCurrent: 0,
    totalPnl: 0,
    totalPnlPercent: 0,
    totalLtcgGain: 0,
    totalStcgGain: 0,
    totalEstimatedTax: 0,
    totalDividends: 0
  });
  const [transactions, setTransactions] = useState([]);
  const [goals, setGoals] = useState([]);
  const [linkedGoals, setLinkedGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Growth chart range selector
  const [performanceRange, setPerformanceRange] = useState('6M');

  // AI Advisor State
  const [riskProfile, setRiskProfile] = useState('balanced');
  const [advisorData, setAdvisorData] = useState(null);
  const [advisorLoading, setAdvisorLoading] = useState(false);
  const [advisorError, setAdvisorError] = useState('');

  // Modal State
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState('transaction'); // 'transaction'
  
  // Form fields for logging transactions
  const [formFields, setFormFields] = useState({
    symbol: '',
    name: '',
    type: 'buy', // 'buy' | 'sell' | 'dividend' | 'interest'
    quantity: '',
    price: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });
  
  const [formError, setFormError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  
  // Autocomplete search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedResult, setSelectedResult] = useState(null);

  // Fetch Core Portfolio Data
  const fetchPortfolio = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const res = await api.get('/portfolio');
      setHoldings(res.data.holdings || []);
      setSummary(res.data.summary || {
        totalInvested: 0,
        totalCurrent: 0,
        totalPnl: 0,
        totalPnlPercent: 0,
        totalLtcgGain: 0,
        totalStcgGain: 0,
        totalEstimatedTax: 0,
        totalDividends: 0
      });
      if (isRefresh) {
        showToast('Portfolio quotes updated successfully', 'success');
      }
    } catch (err) {
      console.error('Fetch portfolio error:', err);
      setError('Could not load portfolio holdings.');
      showToast('Failed to update portfolio data', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showToast]);

  // Fetch Transaction Logs
  const fetchTransactions = useCallback(async () => {
    try {
      const res = await api.get('/portfolio/transactions');
      setTransactions(res.data || []);
    } catch (err) {
      console.error('Fetch transactions error:', err);
    }
  }, []);

  // Fetch Financial Goals
  const fetchGoals = useCallback(async () => {
    try {
      const res = await api.get('/goals');
      setGoals(res.data.goals || []);
      // Load linked goals mapping
      const savedLinks = localStorage.getItem('linked_goals');
      if (savedLinks) {
        setLinkedGoals(JSON.parse(savedLinks));
      }
    } catch (err) {
      console.error('Fetch goals error:', err);
    }
  }, []);

  // Fetch Robo-Advisor Rebalancing Analytics
  const fetchAdvisorAnalytics = useCallback(async () => {
    if (holdings.length === 0) {
      setAdvisorLoading(false);
      setAdvisorData(null);
      return;
    }
    setAdvisorLoading(true);
    setAdvisorError('');
    try {
      // Map holdings structure to send to analysis service
      const payload = holdings.map(h => ({
        assetType: h.assetType,
        currentValue: h.currentValue
      }));
      const res = await api.post('/portfolio/analyze', {
        riskProfile,
        holdings: payload
      });
      setAdvisorData(res.data);
    } catch (err) {
      console.error('Fetch advisor error:', err);
      setAdvisorError('Could not compute AI rebalancing suggestions.');
    } finally {
      setAdvisorLoading(false);
    }
  }, [holdings, riskProfile]);

  // Combined Initial Loads
  useEffect(() => {
    fetchPortfolio();
    fetchTransactions();
    fetchGoals();
  }, [fetchPortfolio, fetchTransactions, fetchGoals]);

  // Reload AI Advisor recommendations when profile or holdings change
  useEffect(() => {
    if (activeTab === 'advisor') {
      fetchAdvisorAnalytics();
    }
  }, [activeTab, riskProfile, holdings, fetchAdvisorAnalytics]);

  // Auto-calculate Transaction Amount
  useEffect(() => {
    if (formFields.type === 'buy' || formFields.type === 'sell') {
      const q = Number(formFields.quantity) || 0;
      const p = Number(formFields.price) || 0;
      if (q > 0 && p > 0) {
        setFormFields(prev => ({ ...prev, amount: String(q * p) }));
      }
    }
  }, [formFields.quantity, formFields.price, formFields.type]);

  // Autocomplete Search Debounce
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const delayDebounce = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.get(`/portfolio/search?q=${encodeURIComponent(searchQuery)}`);
        setSearchResults(res.data || []);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setSearching(false);
      }
    }, 450);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  // Handler: Selecting search query suggestion
  const selectSearchResult = (item) => {
    setSelectedResult(item);
    setFormFields(prev => ({
      ...prev,
      symbol: item.symbol,
      name: item.name
    }));
    setSearchQuery('');
    setSearchResults([]);
  };

  // Handler: Open modal in log transaction mode
  const handleOpenAdd = () => {
    setSelectedResult(null);
    setSearchQuery('');
    setFormFields({
      symbol: '',
      name: '',
      type: 'buy',
      quantity: '',
      price: '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      notes: ''
    });
    setFormError('');
    setOpenDialog(true);
  };

  // Handler: Quick-add transaction from existing holding
  const handleLogFromHolding = (holdingSymbol) => {
    setSelectedResult({ symbol: holdingSymbol, name: holdingSymbol });
    setSearchQuery('');
    setFormFields({
      symbol: holdingSymbol,
      name: holdingSymbol,
      type: 'buy',
      quantity: '',
      price: '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      notes: ''
    });
    setFormError('');
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  // Handler: Form Submission
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formFields.symbol) {
      setFormError('Please search and select a symbol.');
      return;
    }
    if ((formFields.type === 'buy' || formFields.type === 'sell') && (!formFields.quantity || Number(formFields.quantity) <= 0)) {
      setFormError('Quantity must be greater than 0.');
      return;
    }
    if ((formFields.type === 'buy' || formFields.type === 'sell') && (!formFields.price || Number(formFields.price) <= 0)) {
      setFormError('Price must be greater than 0.');
      return;
    }
    if (!formFields.amount || Number(formFields.amount) <= 0) {
      setFormError('Total amount must be greater than 0.');
      return;
    }

    setActionLoading(true);
    try {
      await api.post('/portfolio/transaction', {
        symbol: formFields.symbol,
        type: formFields.type,
        quantity: formFields.type in { buy: 1, sell: 1 } ? Number(formFields.quantity) : 0,
        price: formFields.type in { buy: 1, sell: 1 } ? Number(formFields.price) : 0,
        amount: Number(formFields.amount),
        date: formFields.date,
        notes: formFields.notes
      });
      showToast('Transaction logged successfully', 'success');
      setOpenDialog(false);
      fetchPortfolio();
      fetchTransactions();
    } catch (err) {
      console.error('Save transaction error:', err);
      setFormError(err.response?.data?.message || 'Failed to save transaction.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handler: Delete Transaction
  const handleDeleteTransaction = async (id, type, symbol) => {
    if (!window.confirm(`Are you sure you want to delete this ${type} transaction for ${symbol}?`)) return;
    
    try {
      await api.delete(`/portfolio/transaction/${id}`);
      showToast('Transaction deleted successfully', 'success');
      fetchPortfolio();
      fetchTransactions();
    } catch (err) {
      console.error('Delete transaction error:', err);
      showToast('Could not delete transaction.', 'error');
    }
  };

  // Handler: Toggle financial goal linking
  const handleToggleGoalLink = (goalId) => {
    let updated;
    if (linkedGoals.includes(goalId)) {
      updated = linkedGoals.filter(id => id !== goalId);
    } else {
      updated = [...linkedGoals, goalId];
    }
    setLinkedGoals(updated);
    localStorage.setItem('linked_goals', JSON.stringify(updated));
    showToast(linkedGoals.includes(goalId) ? 'Goal unlinked' : 'Goal linked to investment portfolio', 'info');
  };

  const isDark = theme === 'dark';
  const cardClass = isDark ? 'glass-card-dark' : 'glass-card-light';
  const textMuted = isDark ? 'text-gray-400' : 'text-gray-500';
  
  // Theme Color Accents (Corporate Navy & Teal)
  const accentPrimary = isDark ? '#2DD4BF' : '#0D9488';
  const accentGold = isDark ? '#FBBF24' : '#B45309'; // Gold/ETFs asset-class color (kept warm — represents literal gold holdings)
  const gainGreen = isDark ? '#4ADE80' : '#16A34A';
  const lossRed = isDark ? '#F43F5E' : '#E11D48';

  // Prepare Asset Allocation Chart Data
  const allocationMap = {};
  holdings.forEach(h => {
    const typeLabel = h.assetType === 'stock' ? 'Stocks' 
                    : h.assetType === 'mutual_fund' ? 'Mutual Funds' 
                    : h.assetType === 'gold' ? 'Gold/ETFs' 
                    : 'Fixed Deposits';
    allocationMap[typeLabel] = (allocationMap[typeLabel] || 0) + h.currentValue;
  });

  const donutColors = {
    'Stocks': isDark ? '#2DD4BF' : '#0D9488',
    'Mutual Funds': '#4F46E5',
    'Gold/ETFs': isDark ? '#FBBF24' : '#B45309',
    'Fixed Deposits': isDark ? '#64748B' : '#475569'
  };

  const donutData = Object.entries(allocationMap).map(([name, value]) => ({
    name,
    value,
    color: donutColors[name] || '#4F46E5'
  }));

  // Prepare Dividends & Cash Yield Chart Data
  const dividendMap = {};
  transactions.forEach(t => {
    if (t.type === 'dividend' || t.type === 'interest') {
      const month = new Date(t.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      dividendMap[month] = (dividendMap[month] || 0) + t.amount;
    }
  });
  
  const dividendChartData = Object.entries(dividendMap).map(([month, amount]) => ({
    month,
    payout: amount
  })).reverse().slice(-6); // show latest 6 months

  // Illustrative growth curve — not real tracked history (there's no historical
  // portfolio-value endpoint), just a smoothed synthetic path from invested capital
  // to the current value, with a point count that varies by the selected range.
  const RANGE_POINTS = { '1M': 4, '3M': 6, '6M': 6, '1Y': 12, 'ALL': 24 };
  const performanceData = (() => {
    const points = RANGE_POINTS[performanceRange] || 6;
    const start = summary.totalInvested || 10000;
    const end = summary.totalCurrent || summary.totalInvested || 10000;
    const wobble = [0.92, 0.95, 1.01, 0.98, 1.07, 1.0, 0.96, 1.03, 0.99, 1.05, 0.94, 1.02];
    return Array.from({ length: points }, (_, i) => {
      const t = points === 1 ? 1 : i / (points - 1);
      const base = start + (end - start) * t;
      const isLast = i === points - 1;
      return {
        name: performanceRange === 'ALL' || performanceRange === '1Y' ? `M${i + 1}` : `Pt ${i + 1}`,
        value: isLast ? end : base * wobble[i % wobble.length],
      };
    });
  })();

  return (
    <div className="space-y-6 animate-slide-up">
      
      {/* 1. HERO HEADER */}
      <div className={`p-8 rounded-3xl border ${cardClass} relative overflow-hidden transition-all duration-300 shadow-xl`}>
        {/* Glow blobs */}
        <div className="absolute top-[-100px] right-[-100px] w-80 h-80 rounded-full blur-[120px] pointer-events-none" style={{ background: isDark ? 'rgba(45, 212, 191, 0.10)' : 'rgba(13, 148, 136, 0.05)' }} />
        <div className="absolute bottom-[-100px] left-[-100px] w-60 h-60 rounded-full blur-[100px] pointer-events-none" style={{ background: isDark ? 'rgba(13, 148, 136, 0.08)' : 'rgba(13, 148, 136, 0.04)' }} />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <span className={`text-xs font-bold tracking-[0.25em] uppercase ${textMuted}`}>
              My Investment Portfolio
            </span>
            <div className="flex items-baseline gap-4 mt-2">
              <h1 className={`text-4xl md:text-5xl font-extrabold tracking-tight font-outfit ${isDark ? 'text-white' : 'text-slate-900'}`}>
                ₹{summary.totalCurrent.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </h1>
              <Chip
                label={`${summary.totalPnl >= 0 ? '+' : ''}₹${Math.abs(summary.totalPnl).toLocaleString('en-IN', { maximumFractionDigits: 0 })} (${summary.totalPnlPercent.toFixed(2)}%)`}
                size="small"
                style={{
                  backgroundColor: summary.totalPnl >= 0 ? 'rgba(22,163,74,0.12)' : 'rgba(244,63,94,0.12)',
                  color: summary.totalPnl >= 0 ? gainGreen : lossRed,
                  fontWeight: 700,
                  fontSize: '12px',
                  border: `1px solid ${summary.totalPnl >= 0 ? 'rgba(22,163,74,0.2)' : 'rgba(244,63,94,0.2)'}`
                }}
              />
            </div>
            <p className={`text-xs mt-2 ${textMuted}`}>
              Overall returns calculated dynamically across {holdings.length} assets
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outlined"
              onClick={() => fetchPortfolio(true)}
              disabled={refreshing}
              startIcon={<RefreshIcon className={refreshing ? 'animate-spin' : ''} />}
              style={{
                textTransform: 'none',
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.15)',
                color: 'inherit',
                borderRadius: 12,
                padding: '8px 16px',
                fontWeight: '600'
              }}
            >
              {refreshing ? 'Refreshing...' : 'Refresh Quotes'}
            </Button>

            <Button
              variant="contained"
              onClick={handleOpenAdd}
              startIcon={<AddIcon />}
              style={{
                background: `linear-gradient(135deg, ${accentPrimary}, #4F46E5)`,
                textTransform: 'none',
                borderRadius: 12,
                fontWeight: 'bold',
                padding: '10px 20px',
                boxShadow: isDark ? '0 4px 14px rgba(45, 212, 191, 0.35)' : '0 4px 14px rgba(13, 148, 136, 0.2)'
              }}
            >
              Log Transaction
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <Alert severity="error" className="rounded-xl">
          {error}
        </Alert>
      )}

      {/* 2. NAVIGATION TAB MENU */}
      <div className={`flex flex-wrap gap-2 p-1.5 rounded-2xl ${cardClass} border border-gray-800/10 max-w-2xl`}>
        {[
          { id: 'holdings', label: 'Holdings & Charts', icon: <ChartIcon style={{ fontSize: 16 }} /> },
          { id: 'transactions', label: 'Transaction Logs', icon: <HistoryIcon style={{ fontSize: 16 }} /> },
          { id: 'advisor', label: 'Aurelia AI Advisor', icon: <AutoAwesome style={{ fontSize: 16 }} /> },
          { id: 'goals', label: 'Linked Goals', icon: <TargetIcon style={{ fontSize: 16 }} /> }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all duration-300 border-none cursor-pointer outline-none ${
              activeTab === tab.id
                ? 'bg-gradient-to-r from-[#0D9488] to-[#4F46E5] text-white shadow-lg shadow-indigo-500/20'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* 3. CONDITIONAL TAB BODY */}
      {loading ? (
        <div className="py-20 flex justify-center">
          <CircularProgress />
        </div>
      ) : (
        <>
          {/* TAB 1: HOLDINGS & CHARTS */}
          {activeTab === 'holdings' && (
            <div className="space-y-6">
              {/* Stats Metrics Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {/* Stat 1: Invested */}
                <div className={`p-6 rounded-2xl border ${cardClass} shadow-md hover:-translate-y-1 transition-all duration-300`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className={`text-[10px] tracking-wider font-bold uppercase ${textMuted}`}>Invested Capital</p>
                      <h3 className="text-2xl font-bold mt-2 font-outfit">
                        ₹{summary.totalInvested.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </h3>
                    </div>
                    <div className="p-2 rounded-xl" style={{ backgroundColor: 'rgba(79,70,229,0.1)' }}>
                      <AccountBalanceWallet style={{ color: accentPrimary }} />
                    </div>
                  </div>
                </div>

                {/* Stat 2: Current */}
                <div className={`p-6 rounded-2xl border ${cardClass} shadow-md hover:-translate-y-1 transition-all duration-300`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className={`text-[10px] tracking-wider font-bold uppercase ${textMuted}`}>Current Value</p>
                      <h3 className="text-2xl font-bold mt-2 font-outfit">
                        ₹{summary.totalCurrent.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </h3>
                    </div>
                    <div className="p-2 rounded-xl" style={{ backgroundColor: 'rgba(13,148,136,0.1)' }}>
                      <AccountBalance style={{ color: accentGold }} />
                    </div>
                  </div>
                </div>

                {/* Stat 3: Total Gain */}
                <div className={`p-6 rounded-2xl border ${cardClass} shadow-md hover:-translate-y-1 transition-all duration-300`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className={`text-[10px] tracking-wider font-bold uppercase ${textMuted}`}>Total Gain/Loss</p>
                      <h3 className="text-2xl font-bold mt-2 font-outfit" style={{ color: summary.totalPnl >= 0 ? gainGreen : lossRed }}>
                        {summary.totalPnl >= 0 ? '+' : '-'}₹{Math.abs(summary.totalPnl).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </h3>
                    </div>
                    <div className="p-2 rounded-xl" style={{ backgroundColor: summary.totalPnl >= 0 ? 'rgba(22,163,74,0.1)' : 'rgba(244,63,94,0.1)' }}>
                      {summary.totalPnl >= 0 ? <TrendingUp style={{ color: gainGreen }} /> : <TrendingDown style={{ color: lossRed }} />}
                    </div>
                  </div>
                </div>

                {/* Stat 4: Unrealized Est. Tax */}
                <div className={`p-6 rounded-2xl border ${cardClass} shadow-md hover:-translate-y-1 transition-all duration-300`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-1">
                        <p className={`text-[10px] tracking-wider font-bold uppercase ${textMuted}`}>Est. Capital Gains Tax</p>
                        <InfoOutlined style={{ fontSize: 12, color: 'orange' }} titleAccess="FIFO Unrealized tax estimate (Equity LTCG 12.5%, STCG 20%)" />
                      </div>
                      <h3 className="text-2xl font-bold mt-2 font-outfit text-orange-400">
                        ₹{summary.totalEstimatedTax.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </h3>
                    </div>
                    <div className="p-2 rounded-xl" style={{ backgroundColor: 'rgba(245,158,11,0.1)' }}>
                      <Warning style={{ color: 'orange' }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Donut Allocation */}
                <div className={`p-6 rounded-2xl border ${cardClass} shadow-md lg:col-span-2 flex flex-col justify-between`}>
                  <div>
                    <h3 className="text-base font-bold font-outfit">Asset Allocation</h3>
                    <p className={`text-xs mt-1 ${textMuted}`}>Portfolio spread by asset classification</p>
                  </div>

                  {donutData.length > 0 ? (
                    <div className="flex flex-col items-center py-4">
                      <div style={{ width: 220, height: 220, position: 'relative' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={donutData}
                              innerRadius={68}
                              outerRadius={88}
                              paddingAngle={3}
                              dataKey="value"
                            >
                              {donutData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <ChartTooltip 
                              formatter={(value) => `₹${value.toLocaleString()}`}
                              contentStyle={{
                                backgroundColor: isDark ? '#060f0c' : '#FFFFFF',
                                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                                borderRadius: 10,
                                color: isDark ? '#FFFFFF' : '#000000'
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <span className={`text-[10px] uppercase font-bold tracking-widest ${textMuted}`}>Total Assets</span>
                          <span className="text-xl font-bold font-outfit mt-1">
                            ₹{(summary.totalCurrent / 1000).toFixed(0)}k
                          </span>
                        </div>
                      </div>

                      {/* Legend */}
                      <div className="w-full grid grid-cols-2 gap-3 mt-4">
                        {donutData.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                            <div className="flex flex-col">
                              <span className="text-xs font-semibold">{item.name}</span>
                              <span className={`text-[10px] ${textMuted}`}>
                                {(summary.totalCurrent > 0 ? (item.value / summary.totalCurrent) * 100 : 0).toFixed(1)}% (₹{Math.round(item.value).toLocaleString()})
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className={`py-20 text-center ${textMuted} text-sm`}>
                      Add holdings to view allocation spread
                    </div>
                  )}
                </div>

                {/* Performance Growth Trend */}
                <div className={`p-6 rounded-2xl border ${cardClass} shadow-md lg:col-span-3 flex flex-col justify-between`}>
                  <div>
                    <h3 className="text-base font-bold font-outfit">Portfolio Growth</h3>
                    <p className={`text-xs mt-1 ${textMuted}`}>Illustrative trend based on current holdings — not tracked historical data</p>
                  </div>

                  <div style={{ height: 220 }} className="mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={performanceData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={accentPrimary} stopOpacity={0.2} />
                            <stop offset="95%" stopColor={accentPrimary} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis 
                          dataKey="name" 
                          stroke={isDark ? '#4B5563' : '#9CA3AF'} 
                          fontSize={11} 
                          tickLine={false} 
                          axisLine={false} 
                        />
                        <YAxis 
                          stroke={isDark ? '#4B5563' : '#9CA3AF'} 
                          fontSize={11} 
                          tickLine={false} 
                          axisLine={false} 
                          tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} 
                        />
                        <ChartTooltip 
                          formatter={(value) => `₹${value.toLocaleString()}`}
                          contentStyle={{
                            backgroundColor: isDark ? '#060f0c' : '#FFFFFF',
                            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                            borderRadius: 10,
                            color: isDark ? '#FFFFFF' : '#000000'
                          }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="value" 
                          stroke={accentPrimary} 
                          strokeWidth={2} 
                          fillOpacity={1} 
                          fill="url(#colorValue)" 
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="flex justify-end gap-1 mt-4">
                    {['1M', '3M', '6M', '1Y', 'ALL'].map((tab) => (
                      <Button
                        key={tab}
                        size="small"
                        onClick={() => setPerformanceRange(tab)}
                        variant={tab === performanceRange ? 'contained' : 'text'}
                        style={{
                          minWidth: 40,
                          fontSize: '11px',
                          textTransform: 'none',
                          fontWeight: 600,
                          borderRadius: 8,
                          backgroundColor: tab === performanceRange ? accentPrimary : 'transparent',
                          color: tab === performanceRange ? '#FFFFFF' : (isDark ? '#9CA3AF' : '#4B5563')
                        }}
                      >
                        {tab}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Holdings Table */}
              <div className={`p-6 rounded-2xl border ${cardClass} shadow-md`}>
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-base font-bold font-outfit">My Holdings ({holdings.length})</h3>
                    <p className={`text-xs mt-1 ${textMuted}`}>Asset holdings performance, dividend income, and FIFO gains breakdown</p>
                  </div>
                </div>

                {holdings.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
                          {['Asset Ticker', 'Asset Type', 'Qty', 'W.A. Buy Price', 'Live Quote', 'Current Value', 'Gain & FIFO Tax Estimate', 'Actions'].map((h, i) => (
                            <th
                              key={h}
                              style={{
                                padding: '12px 16px',
                                textAlign: i >= 5 ? 'right' : 'left',
                                fontSize: 10,
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.1em',
                                color: isDark ? '#64748B' : '#475569',
                                ...(i === 7 ? { textAlign: 'center' } : {}),
                              }}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {holdings.map((h) => (
                          <tr
                            key={h._id}
                            style={{
                              borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)'}`,
                              transition: 'background 0.2s',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            {/* Symbol & Name */}
                            <td style={{ padding: '14px 16px' }}>
                              <div className="flex flex-col">
                                <span className="font-bold font-outfit text-sm">{h.symbol}</span>
                                <span className={`text-xs ${textMuted} truncate max-w-[200px]`}>{h.name}</span>
                              </div>
                            </td>

                            {/* Type chip */}
                            <td style={{ padding: '14px 16px' }}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '3px 8px',
                                  borderRadius: 8,
                                  fontSize: 11,
                                  fontWeight: 700,
                                  textTransform: 'uppercase',
                                  background: h.assetType === 'stock' ? 'rgba(129,140,248,0.1)'
                                            : h.assetType === 'mutual_fund' ? 'rgba(79,70,229,0.1)'
                                            : h.assetType === 'gold' ? 'rgba(13,148,136,0.1)' 
                                            : 'rgba(100,116,139,0.1)',
                                  color: h.assetType === 'stock' ? (isDark ? '#818CF8' : '#4338CA')
                                       : h.assetType === 'mutual_fund' ? (isDark ? '#A78BFA' : '#4F46E5')
                                       : h.assetType === 'gold' ? (isDark ? '#FBBF24' : '#B45309')
                                       : (isDark ? '#94A3B8' : '#475569')
                                }}
                              >
                                {h.assetType === 'mutual_fund' ? 'Mutual Fund' : h.assetType === 'gold' ? 'Gold/ETF' : h.assetType === 'fd' ? 'Fixed Deposit' : 'Stock'}
                              </span>
                            </td>

                            {/* Qty */}
                            <td style={{ padding: '14px 16px', fontWeight: 500, fontSize: 13 }}>
                              {h.quantity}
                            </td>

                            {/* Avg Price */}
                            <td style={{ padding: '14px 16px', fontWeight: 500, fontSize: 13 }}>
                              ₹{(h.avgBuyPrice ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>

                            {/* Live Price */}
                            <td style={{ padding: '14px 16px', fontSize: 13 }}>
                              {h.assetType === 'fd' ? (
                                <span className={textMuted}>FD Yield</span>
                              ) : (
                                <div className="flex items-center gap-2 font-semibold">
                                  <span>₹{h.livePrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                  {h.success && (
                                    <span 
                                      className="w-2 h-2 rounded-full animate-pulse" 
                                      style={{ backgroundColor: gainGreen, boxShadow: `0 0 8px ${gainGreen}` }} 
                                    />
                                  )}
                                </div>
                              )}
                            </td>

                            {/* Current Value */}
                            <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 700, fontSize: 13 }}>
                              ₹{h.currentValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>

                            {/* Gains & FIFO Tax Breakdown */}
                            <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                              <div className="flex flex-col items-end">
                                <span style={{ color: h.pnl >= 0 ? gainGreen : lossRed, fontWeight: 700, fontSize: 13 }}>
                                  {h.pnl >= 0 ? '+' : '-'}₹{Math.abs(h.pnl).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                </span>
                                <span className="text-[10px] text-gray-400 mt-0.5">
                                  LTCG: {h.ltcgQty} shrs · STCG: {h.stcgQty} shrs
                                </span>
                                <span className="text-[9px] text-orange-400 font-semibold mt-0.5">
                                  Est. Tax: ₹{Math.round(h.estimatedTax).toLocaleString()}
                                </span>
                              </div>
                            </td>

                            {/* Actions */}
                            <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                              <div className="flex justify-center gap-2">
                                <IconButton size="small" onClick={() => handleLogFromHolding(h.symbol)} title="Log BUY/SELL transaction">
                                  <AddIcon fontSize="small" className="text-gray-400 hover:text-blue-500" />
                                </IconButton>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div
                    className="p-12 text-center rounded-2xl animate-slide-up"
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.01)',
                      border: `1.5px dashed ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                    }}
                  >
                    <ChartIcon style={{ fontSize: 56, color: accentPrimary, opacity: 0.7, marginBottom: 12 }} />
                    <h3 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>Your Portfolio Is Empty</h3>
                    <p className={`text-sm mb-6 ${textMuted}`}>
                      Log your first stock or mutual fund transaction to start tracking your investments.
                    </p>
                    <button
                      onClick={handleOpenAdd}
                      style={{
                        background: `linear-gradient(135deg, ${accentPrimary}, #4F46E5)`,
                        color: 'white', border: 'none', borderRadius: 12,
                        padding: '12px 28px', fontWeight: 700, fontSize: 15,
                        cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                      }}
                    >
                      <AddIcon /> Log My First Transaction
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: TRANSACTION LOGS */}
          {activeTab === 'transactions' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Transactions List - 2/3 width */}
              <div className={`p-6 rounded-2xl border ${cardClass} shadow-md lg:col-span-2`}>
                <h3 className="text-base font-bold font-outfit mb-4">Transaction History Logs</h3>
                
                {transactions.length > 0 ? (
                  <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
                          {['Date', 'Asset', 'Action', 'Qty', 'Price', 'Net Cash', 'Notes', 'Actions'].map((h, i) => (
                            <th
                              key={h}
                              style={{
                                padding: '10px 12px',
                                textAlign: i === 5 ? 'right' : 'left',
                                fontSize: 9,
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                color: isDark ? '#64748B' : '#475569',
                                ...(i === 7 ? { textAlign: 'center' } : {})
                              }}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map(t => (
                          <tr 
                            key={t._id}
                            style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}` }}
                          >
                            <td className="text-xs py-3 px-2">
                              {new Date(t.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </td>
                            <td className="text-xs font-bold py-3 px-2">{t.symbol}</td>
                            <td className="text-xs py-3 px-2">
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '2px 6px',
                                  borderRadius: 6,
                                  fontSize: 10,
                                  fontWeight: 700,
                                  textTransform: 'uppercase',
                                  backgroundColor: t.type === 'buy' ? 'rgba(22,163,74,0.1)' 
                                                 : t.type === 'sell' ? 'rgba(244,63,94,0.1)' 
                                                 : t.type === 'dividend' ? 'rgba(59,130,246,0.1)' 
                                                 : 'rgba(13,148,136,0.1)',
                                  color: t.type === 'buy' ? gainGreen
                                       : t.type === 'sell' ? lossRed
                                       : t.type === 'dividend' ? '#60a5fa'
                                       : '#fbbf24'
                                }}
                              >
                                {t.type}
                              </span>
                            </td>
                            <td className="text-xs py-3 px-2">{t.type in {buy:1, sell:1} ? t.quantity : '-'}</td>
                            <td className="text-xs py-3 px-2">{t.type in {buy:1, sell:1} ? `₹${t.price}` : '-'}</td>
                            <td className="text-xs font-bold text-right py-3 px-2">
                              ₹{t.amount.toLocaleString()}
                            </td>
                            <td className="text-[10px] text-gray-400 py-3 px-2 max-w-[120px] truncate" title={t.notes}>
                              {t.notes || '-'}
                            </td>
                            <td className="py-3 px-2 text-center">
                              <IconButton size="small" onClick={() => handleDeleteTransaction(t._id, t.type, t.symbol)}>
                                <DeleteIcon fontSize="small" className="text-gray-400 hover:text-red-500" />
                              </IconButton>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-10">
                    <HistoryIcon style={{ fontSize: 32, color: accentPrimary, opacity: 0.6, marginBottom: 8 }} />
                    <p className={`text-sm ${textMuted}`}>No transactions logged yet.</p>
                  </div>
                )}
              </div>

              {/* Dividends & Yield Analytics - 1/3 width */}
              <div className={`p-6 rounded-2xl border ${cardClass} shadow-md`}>
                <h3 className="text-base font-bold font-outfit mb-1">Dividends & Accruals</h3>
                <p className={`text-xs ${textMuted} mb-4`}>Track payouts and FD cash accruals</p>

                <div className="flex justify-between items-center py-3 border-b border-gray-800/10 mb-4">
                  <div>
                    <span className={`text-[10px] uppercase font-bold tracking-wider ${textMuted}`}>Total Cash Received</span>
                    <h4 className="text-2xl font-bold mt-1 font-outfit text-indigo-400">
                      ₹{summary.totalDividends.toLocaleString()}
                    </h4>
                  </div>
                  <div>
                    <span className={`text-[10px] uppercase font-bold tracking-wider ${textMuted}`}>Yield-on-Cost (YoC)</span>
                    <h4 className="text-2xl font-bold mt-1 font-outfit text-yellow-500">
                      {summary.totalInvested > 0 ? ((summary.totalDividends / summary.totalInvested) * 100).toFixed(2) : '0.00'}%
                    </h4>
                  </div>
                </div>

                {dividendChartData.length > 0 ? (
                  <div>
                    <span className={`text-xs font-bold ${textMuted} block mb-2`}>Recent Monthly Payouts</span>
                    <div style={{ height: 160 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dividendChartData}>
                          <XAxis dataKey="month" stroke={isDark ? '#4B5563' : '#9CA3AF'} fontSize={10} axisLine={false} tickLine={false} />
                          <YAxis stroke={isDark ? '#4B5563' : '#9CA3AF'} fontSize={10} axisLine={false} tickLine={false} tickFormatter={v => `₹${v}`} />
                          <ChartTooltip formatter={v => `₹${v.toLocaleString()}`} contentStyle={{ backgroundColor: isDark ? '#060f0c' : '#FFF', border: 'none', borderRadius: 8 }} />
                          <Bar dataKey="payout" fill={accentPrimary} radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ) : (
                  <p className={`text-xs text-center py-10 ${textMuted}`}>Log a 'dividend' or 'interest' payout to initialize cash yield charts.</p>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: AURELIA AI ROBO-ADVISOR */}
          {activeTab === 'advisor' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Risk Profile and target allocations - 1/3 width */}
              <div className={`p-6 rounded-2xl border ${cardClass} shadow-md flex flex-col justify-between`}>
                <div>
                  <h3 className="text-base font-bold font-outfit mb-1">Robo-Advisor Setup</h3>
                  <p className={`text-xs ${textMuted} mb-4`}>Select portfolio risk profile target</p>

                  <FormControl fullWidth className="mt-2">
                    <InputLabel style={{ color: isDark ? '#94A3B8' : '#475569' }}>Risk Appetite Profile</InputLabel>
                    <Select
                      value={riskProfile}
                      onChange={(e) => setRiskProfile(e.target.value)}
                      label="Risk Appetite Profile"
                      style={{ color: isDark ? '#FFFFFF' : '#000000', borderRadius: 12 }}
                    >
                      <MenuItem value="conservative">Conservative (30% Equity / 50% FD / 20% Gold)</MenuItem>
                      <MenuItem value="balanced">Balanced (60% Equity / 25% FD / 15% Gold)</MenuItem>
                      <MenuItem value="aggressive">Aggressive (80% Equity / 10% FD / 10% Gold)</MenuItem>
                    </Select>
                  </FormControl>
                </div>

                {advisorData && (
                  <div className="mt-6 flex flex-col items-center gap-4">
                    <div style={{ position: 'relative', width: 140, height: 140 }}>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl font-extrabold font-outfit text-red-400">
                          {advisorData.riskScore}
                        </span>
                        <span className={`text-[9px] uppercase font-bold tracking-widest ${textMuted}`}>Risk index</span>
                      </div>
                      <CircularProgress
                        variant="determinate"
                        value={advisorData.riskScore}
                        size={140}
                        thickness={5}
                        style={{ color: advisorData.riskScore > 70 ? lossRed : advisorData.riskScore > 40 ? 'orange' : gainGreen }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-center leading-relaxed">
                      Your equity weight sets your portfolio risk score at <strong style={{ color: advisorData.riskScore > 50 ? lossRed : gainGreen }}>{advisorData.riskScore}</strong>.
                    </span>
                  </div>
                )}
              </div>

              {/* AI Rebalancing Recommendations - 2/3 width */}
              <div className={`p-6 rounded-2xl border ${cardClass} shadow-md lg:col-span-2`}>
                <div className="flex items-center gap-2 mb-4">
                  <AutoAwesome className="text-yellow-500 animate-pulse" />
                  <h3 className="text-base font-bold font-outfit">Aurelia AI Rebalancing Recommendations</h3>
                </div>

                {advisorLoading ? (
                  <div className="py-20 flex flex-col items-center justify-center gap-2">
                    <CircularProgress size={30} />
                    <span className={`text-xs ${textMuted}`}>Running machine learning portfolio allocation analysis...</span>
                  </div>
                ) : advisorError ? (
                  <Alert severity="error">{advisorError}</Alert>
                ) : advisorData ? (
                  <div className="space-y-6">
                    {/* Visual Comparison Grid */}
                    <div className="grid grid-cols-3 gap-4 border-b border-gray-800/10 pb-4">
                      {['Equity', 'Debt (FD)', 'Gold'].map(assetClass => {
                        const key = assetClass.toLowerCase().includes('debt') ? 'debt' : assetClass.toLowerCase().includes('gold') ? 'gold' : 'equity';
                        const actual = advisorData.actualAllocation[key] || 0;
                        const target = advisorData.targetAllocation[key] || 0;
                        return (
                          <div key={assetClass} className="flex flex-col">
                            <span className="text-xs font-bold">{assetClass}</span>
                            <div className="flex items-baseline gap-2 mt-1">
                              <span className="text-base font-bold" style={{ color: accentPrimary }}>{actual}%</span>
                              <span className={`text-[10px] ${textMuted}`}>Target: {target}%</span>
                            </div>
                            {/* Mini comparison bar */}
                            <div className="w-full bg-gray-800/20 rounded-full h-1.5 mt-1 overflow-hidden">
                              <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${actual}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Recommendations bullet list */}
                    <div 
                      className="p-5 rounded-2xl border relative overflow-hidden" 
                      style={{ 
                        backgroundColor: isDark ? 'rgba(217, 119, 6, 0.05)' : 'rgba(248, 250, 252, 0.95)',
                        borderColor: isDark ? 'rgba(217, 119, 6, 0.15)' : 'rgba(217, 119, 6, 0.25)'
                      }}
                    >
                      <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-amber-500 to-amber-600" />
                      <span className={`text-[9px] uppercase font-bold tracking-widest ${textMuted} block mb-2`}>Aurelia Wealth Advisor Tips</span>
                      <ul className="space-y-3 pl-4 list-disc text-xs leading-relaxed">
                        {advisorData.recommendations.map((tip, idx) => (
                          <li key={idx} className={isDark ? 'text-slate-200' : 'text-slate-800'}>{tip}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : (
                  <p className={`text-sm text-center py-20 ${textMuted}`}>Add assets to view Robo-Advisor statistics.</p>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: LINKED GOALS PROGRESS */}
          {activeTab === 'goals' && (
            <div className={`p-6 rounded-2xl border ${cardClass} shadow-md`}>
              <div className="flex items-center gap-2 mb-4">
                <TargetIcon style={{ color: accentGold }} />
                <h3 className="text-base font-bold font-outfit">Linked Savings Goals Progress</h3>
              </div>
              <p className={`text-xs ${textMuted} mb-6`}>
                Connect Mongoose goal structures to your live portfolio value to dynamically fund goals with investment capital.
              </p>

              {goals.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {goals.map(goal => {
                    const isLinked = linkedGoals.includes(goal._id);
                    const fundingAmount = isLinked ? summary.totalCurrent : goal.currentAmount;
                    const pct = Math.min(100, (fundingAmount / goal.targetAmount) * 100);
                    
                    return (
                      <div 
                        key={goal._id} 
                        className="p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden flex flex-col justify-between"
                        style={{
                          backgroundColor: isLinked ? (isDark ? 'rgba(13,148,136,0.03)' : 'rgba(13,148,136,0.02)') : 'transparent',
                          borderColor: isLinked ? 'rgba(13,148,136,0.25)' : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)')
                        }}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: goal.color }} />
                              <span className="font-bold font-outfit text-sm">{goal.name}</span>
                            </div>
                            <span className={`text-[10px] ${textMuted} mt-0.5 block`}>
                              Target deadline: {new Date(goal.deadline).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                            </span>
                          </div>
                          
                          {/* Linking action checkbox button */}
                          <Button
                            size="small"
                            variant={isLinked ? 'contained' : 'outlined'}
                            onClick={() => handleToggleGoalLink(goal._id)}
                            style={{
                              textTransform: 'none',
                              fontSize: 10,
                              fontWeight: 700,
                              borderRadius: 8,
                              padding: '2px 8px',
                              backgroundColor: isLinked ? accentGold : 'transparent',
                              borderColor: accentGold,
                              color: isLinked ? '#FFF' : accentGold
                            }}
                          >
                            {isLinked ? 'Linked to Portfolio' : 'Link Portfolio'}
                          </Button>
                        </div>

                        {/* Progress Bar visual indicator */}
                        <div className="mt-6 space-y-2">
                          <div className="flex justify-between text-xs font-semibold">
                            <span className={textMuted}>
                              {isLinked ? 'Funded by Portfolio Value' : 'Funded by Cash Savings'}
                            </span>
                            <span style={{ color: isLinked ? accentGold : accentPrimary }}>
                              ₹{Math.round(fundingAmount).toLocaleString()} / ₹{goal.targetAmount.toLocaleString()} ({pct.toFixed(1)}%)
                            </span>
                          </div>
                          <div className="budget-bar-track">
                            <div 
                              className="budget-bar-fill" 
                              style={{ 
                                width: `${pct}%`,
                                background: isLinked ? `linear-gradient(90deg, ${accentGold}, #F59E0B)` : goal.color
                              }} 
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-10">
                  <TargetIcon style={{ fontSize: 32, color: accentPrimary, opacity: 0.6, marginBottom: 8 }} />
                  <p className={`text-sm ${textMuted}`}>No active savings goals found. Create a goal on the Goals page to link funding here.</p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* 4. ADD TRANSACTION DIALOG MODAL */}
      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        sx={{
          '& .MuiDialog-paper': {
            backgroundColor: isDark ? 'rgba(19, 28, 46, 0.85)' : 'rgba(255, 255, 255, 0.85)',
            color: isDark ? '#f1f5f9' : '#0F172A',
            borderRadius: '24px',
            width: '100%',
            maxWidth: '480px',
            border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(255, 255, 255, 0.45)',
            padding: '12px',
            boxShadow: isDark 
              ? '0 20px 48px 0 rgba(0, 0, 0, 0.7), inset 0 1px 1px 0 rgba(255, 255, 255, 0.15)' 
              : '0 16px 40px 0 rgba(79, 70, 229, 0.08), inset 0 1px 1px 0 rgba(255, 255, 255, 0.8)',
            backdropFilter: 'blur(28px) saturate(200%)'
          }
        }}
      >
        <form onSubmit={handleFormSubmit}>
          <DialogTitle style={{ fontFamily: 'Outfit', fontWeight: '800', fontSize: '24px' }}>
            Log Portfolio Transaction
          </DialogTitle>
          <DialogContent className="space-y-4 pt-2">
            
            {formError && (
              <Alert severity="error" className="mb-4 rounded-xl">
                {formError}
              </Alert>
            )}

            {/* Action Type Toggle */}
            <div className="flex gap-2 mb-2">
              {[
                { id: 'buy', label: 'BUY' },
                { id: 'sell', label: 'SELL' },
                { id: 'dividend', label: 'DIVIDEND' },
                { id: 'interest', label: 'INTEREST' }
              ].map(typeOpt => (
                <button
                  key={typeOpt.id}
                  type="button"
                  onClick={() => setFormFields(prev => ({ ...prev, type: typeOpt.id }))}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all border outline-none cursor-pointer ${
                    formFields.type === typeOpt.id
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                      : 'bg-transparent border-gray-800/10 text-gray-400 hover:text-white'
                  }`}
                >
                  {typeOpt.label}
                </button>
              ))}
            </div>

            {/* Symbol Autocomplete (Only pre-filled in direct log mode) */}
            {!selectedResult ? (
              <div className="space-y-2 relative">
                <InputLabel style={{ fontSize: 12, fontWeight: 700, color: isDark ? '#94A3B8' : '#475569' }}>
                  Search Stock/Mutual Fund Ticker
                </InputLabel>
                <TextField
                  placeholder="e.g. RELIANCE.NS, TCS.NS, AAPL, 119598"
                  variant="outlined"
                  fullWidth
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  slotProps={{
                    input: {
                      startAdornment: <Search className="text-gray-400 mr-2" fontSize="small" />,
                      style: { color: isDark ? '#FFFFFF' : '#000000' }
                    }
                  }}
                />
                
                {searching && (
                  <div className="absolute right-4 top-10">
                    <CircularProgress size={18} />
                  </div>
                )}

                {/* Suggestions Dropdown list */}
                {searchResults.length > 0 && (
                  <div 
                    className="absolute left-0 right-0 mt-1 rounded-xl shadow-2xl border z-30 max-h-56 overflow-y-auto"
                    style={{
                      backgroundColor: isDark ? '#0d1f19' : '#FFFFFF',
                      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                    }}
                  >
                    {searchResults.map((item, idx) => (
                      <div
                        key={idx}
                        onClick={() => selectSearchResult(item)}
                        className="p-3 cursor-pointer transition-colors hover:bg-opacity-20 flex flex-col"
                        style={{
                          borderBottom: idx < searchResults.length - 1 ? `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` : 'none',
                        }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <span className="font-bold text-xs">{item.symbol}</span>
                        <span className={`text-[10px] ${textMuted} truncate`}>
                          {item.name} ({item.exchange} · {item.type})
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-xl border mb-2 flex items-center justify-between" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}>
                <div>
                  <span className={`text-[10px] uppercase font-bold tracking-wider ${textMuted}`}>Selected Symbol</span>
                  <h4 className="text-base font-bold font-outfit mt-0.5">{formFields.symbol}</h4>
                </div>
                {/* Reset button */}
                <Button 
                  size="small" 
                  onClick={() => setSelectedResult(null)}
                  style={{ textTransform: 'none', color: accentGold }}
                >
                  Change
                </Button>
              </div>
            )}

            {/* Quantity and Price (Only for BUY/SELL actions) */}
            {(formFields.type === 'buy' || formFields.type === 'sell') && (
              <div className="grid grid-cols-2 gap-4">
                <TextField
                  label="Quantity"
                  type="number"
                  value={formFields.quantity}
                  onChange={(e) => setFormFields({ ...formFields, quantity: e.target.value })}
                  variant="outlined"
                  fullWidth
                  required
                  slotProps={{
                    inputLabel: { style: { color: isDark ? '#94A3B8' : '#475569' } },
                    input: { style: { color: isDark ? '#FFFFFF' : '#000000' } }
                  }}
                />

                <TextField
                  label="Price per Share (₹)"
                  type="number"
                  value={formFields.price}
                  onChange={(e) => setFormFields({ ...formFields, price: e.target.value })}
                  variant="outlined"
                  fullWidth
                  required
                  slotProps={{
                    inputLabel: { style: { color: isDark ? '#94A3B8' : '#475569' } },
                    input: { style: { color: isDark ? '#FFFFFF' : '#000000' } }
                  }}
                />
              </div>
            )}

            {/* Net Amount Field */}
            <TextField
              label={formFields.type in { buy:1, sell:1 } ? "Total Net Amount (₹)" : "Cash Payout Amount (₹)"}
              type="number"
              value={formFields.amount}
              onChange={(e) => setFormFields({ ...formFields, amount: e.target.value })}
              variant="outlined"
              fullWidth
              required
              disabled={formFields.type === 'buy' || formFields.type === 'sell'}
              slotProps={{
                inputLabel: { style: { color: isDark ? '#94A3B8' : '#475569' } },
                input: { style: { color: isDark ? '#FFFFFF' : '#000000' } }
              }}
            />

            {/* Transaction Date */}
            <TextField
              label="Transaction Date"
              type="date"
              value={formFields.date}
              onChange={(e) => setFormFields({ ...formFields, date: e.target.value })}
              variant="outlined"
              fullWidth
              required
              slotProps={{
                inputLabel: { shrink: true, style: { color: isDark ? '#94A3B8' : '#475569' } },
                input: { style: { color: isDark ? '#FFFFFF' : '#000000' } }
              }}
            />

            {/* Notes */}
            <TextField
              label="Transaction Notes (optional)"
              value={formFields.notes}
              onChange={(e) => setFormFields({ ...formFields, notes: e.target.value })}
              variant="outlined"
              fullWidth
              multiline
              rows={2}
              slotProps={{
                inputLabel: { style: { color: isDark ? '#94A3B8' : '#475569' } },
                input: { style: { color: isDark ? '#FFFFFF' : '#000000' } }
              }}
            />

          </DialogContent>
          <DialogActions className="p-6">
            <Button
              onClick={handleCloseDialog}
              color="inherit"
              style={{ textTransform: 'none', fontWeight: 600 }}
            >
              Cancel
            </Button>
            
            <Button
              type="submit"
              variant="contained"
              disabled={actionLoading}
              style={{
                background: `linear-gradient(135deg, ${accentPrimary}, #4F46E5)`,
                textTransform: 'none',
                fontWeight: 'bold',
                borderRadius: 12,
                padding: '10px 24px'
              }}
            >
              {actionLoading ? <CircularProgress size={20} color="inherit" /> : 'Confirm'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </div>
  );
}
