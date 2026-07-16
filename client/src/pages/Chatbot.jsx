import React, { useState, useRef, useEffect } from 'react';
import api from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { 
  Send as SendIcon, 
  Person as UserIcon,
  AutoAwesome,
  ClearAll,
  WorkspacePremium,
  Mic,
  MicOff,
  VolumeUp,
  VolumeOff
} from '@mui/icons-material';
import { CircularProgress, IconButton } from '@mui/material';
import { useLocation } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip as RechartsTooltip, 
  Cell 
} from 'recharts';

export default function Chatbot() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const isDark = theme === 'dark';
  
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `Welcome to the WealthAI Executive Console, ${user?.username || 'Valued Member'}. 

I am **Aurelia**, your dedicated AI Private Wealth Advisor. I have synchronized with your secure transaction vaults and am prepared to compile bespoke financial intelligence.

You may request analysis of your savings velocity, predicted next-month expenditure profiles, or prompt me for anomalies and leaks.

How may I assist in optimizing your portfolio today?`
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [viewModes, setViewModes] = useState({}); // Stores 'table' or 'chart' for each tableKey
  const [insights, setInsights] = useState([]); // Extracted tables/charts, newest first
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'insights' (mobile only)
  const messagesEndRef = useRef(null);

  const location = useLocation();
  const { showToast } = useToast();
  const [isListening, setIsListening] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [didRunPreQuery, setDidRunPreQuery] = useState(false);
  const recognitionRef = useRef(null);

  // Pre-Query Auto-Submit
  useEffect(() => {
    if (location.state?.preQuery && !didRunPreQuery) {
      setDidRunPreQuery(true);
      submitMessage(location.state.preQuery);
      window.history.replaceState({}, document.title);
    }
  }, [location, didRunPreQuery]);

  // Speech Recognition (Speech-to-Text) setup
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';

      rec.onstart = () => {
        setIsListening(true);
        showToast('Aurelia is listening... 🎙', 'info');
      };

      rec.onresult = (e) => {
        const resultText = e.results[0][0].transcript;
        if (resultText) {
          setInput(resultText);
          showToast(`Captured: "${resultText}"`, 'success');
          submitMessage(resultText);
        }
      };

      rec.onerror = (e) => {
        console.error('Speech recognition error:', e.error);
        if (e.error === 'not-allowed') {
          showToast('Microphone access denied.', 'error');
        } else {
          showToast(`Speech error: ${e.error}`, 'error');
        }
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = rec;
    }

    // Stop any in-progress recognition/speech if the user navigates away mid-session.
    return () => {
      recognitionRef.current?.abort();
      window.speechSynthesis.cancel();
    };
  }, [showToast]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      showToast('Speech recognition is not supported in this browser.', 'warning');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      recognitionRef.current.start();
    }
  };

  // Text-to-Speech (Audio Synthesizer)
  const cleanTextForSpeech = (str) => {
    if (!str) return '';
    return str
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/#+/g, '')
      .replace(/\|.*?\|/g, '')
      .replace(/-{3,}/g, '')
      .replace(/`{3}[\s\S]*?`{3}/g, '')
      .replace(/`.*?`/g, '')
      .trim();
  };

  const speakResponse = (text) => {
    if (isMuted) return;
    
    window.speechSynthesis.cancel();
    const cleaned = cleanTextForSpeech(text);
    if (!cleaned) return;

    const utterance = new SpeechSynthesisUtterance(cleaned);
    const voices = window.speechSynthesis.getVoices();
    const premiumVoice = voices.find(v => 
      v.name.includes('Google US English') || 
      v.name.includes('Google UK English Female') || 
      v.name.includes('Microsoft Zira') || 
      v.lang.startsWith('en-')
    );
    if (premiumVoice) {
      utterance.voice = premiumVoice;
    }
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  const toggleMute = () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    if (nextMute) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      showToast('Aurelia voice feedback muted.', 'info');
    } else {
      showToast('Aurelia voice feedback enabled.', 'info');
      const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant');
      if (lastAssistantMsg) {
        speakResponse(lastAssistantMsg.content);
      }
    }
  };

  const handleUserInteract = () => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const SUGGESTION_CHIPS = [
    { label: "💰 Can I afford ₹5,000?", query: "Can I afford to spend ₹5,000 right now?" },
    { label: "📊 Where am I overspending?", query: "Where am I overspending?" },
    { label: "🔮 Predict my expenses", query: "What is my predicted next month spending?" },
    { label: "🚨 Scan for budget leaks", query: "Are there any suspicious anomalies in my activities?" },
    { label: "💡 Give me savings velocity advice", query: "What is my current savings velocity?" }
  ];

  // Pulls markdown pipe-tables out of bot reply text, replacing each with an
  // inline marker line so parseMarkdown can render a pill pointing at the Insights panel.
  const extractTablesAndStrip = (text, sourceQuery) => {
    const lines = text.split('\n');
    const outLines = [];
    const tables = [];
    let inTable = false;
    let tableHeaders = null;
    let tableRows = [];
    const uid = Date.now();

    const flushTable = () => {
      if (tableHeaders) {
        const key = `table-${uid}-${tables.length}`;
        tables.push({ tableKey: key, headers: tableHeaders, rows: tableRows, sourceQuery, timestamp: uid });
        outLines.push(`⟦INSIGHT:${key}⟧`);
      }
      inTable = false;
      tableHeaders = null;
      tableRows = [];
    };

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (line.startsWith('|') && line.endsWith('|')) {
        if (line.includes('---')) continue;
        const cells = line.split('|').map(c => c.trim()).filter((c, idx, arr) => idx > 0 && idx < arr.length - 1);
        if (!inTable) {
          inTable = true;
          tableHeaders = cells;
        } else {
          tableRows.push(cells);
        }
        continue;
      }
      if (inTable) flushTable();
      outLines.push(rawLine);
    }
    if (inTable) flushTable();

    return { text: outLines.join('\n'), tables };
  };

  const submitMessage = async (text) => {
    if (!text.trim() || loading) return;

    const newUserMsg = { role: 'user', content: text };
    setMessages(prev => [...prev, newUserMsg]);
    setLoading(true);

    try {
      // Build history for memory — exclude the very first welcome message
      const historyForApi = [...messages.slice(1), newUserMsg].map(m => ({
        role: m.role,
        content: m.content
      }));

      const res = await api.post('/chatbot', { 
        message: text,
        conversation_history: historyForApi
      });
      const reply = res.data.reply;
      const actionTriggered = res.data.actionTriggered;
      const { text: strippedReply, tables } = extractTablesAndStrip(reply, text);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: strippedReply,
        actionTriggered: actionTriggered
      }]);
      if (tables.length > 0) {
        setInsights(prev => [...tables.slice().reverse(), ...prev]);
      }
      speakResponse(reply);
    } catch (err) {
      console.error('Chatbot endpoint error:', err);
      const errorMsg = err.response?.data?.message || 'The AI service is currently offline. Ensure your server and ml-service are running.';
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `⚠ **Error**: ${errorMsg}` 
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = (e) => {
    e.preventDefault();
    handleUserInteract();
    const userMessage = input.trim();
    if (userMessage) {
      setInput('');
      submitMessage(userMessage);
    }
  };

  const clearChat = () => {
    if (window.confirm('Do you want to reset the conversation history?')) {
      setMessages([
        {
          role: 'assistant',
          content: `Chat history cleared. I'm ready for new questions, ${user?.username || 'Valued Member'}!`
        }
      ]);
      setViewModes({});
      setInsights([]);
    }
  };

  const setViewMode = (tableKey, mode) => {
    setViewModes(prev => ({ ...prev, [tableKey]: mode }));
  };

  // Parses currency formatted values or rates into floats
  const parseNumericValue = (str) => {
    if (!str) return 0;
    // Strip common currency/rate symbols and thousands separators
    const cleaned = str.replace(/[₹$,%\s]/g, '').replace(/,/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  };

  // Helper to format inline bold text
  const formatBold = (line) => {
    const boldRegex = /\*\*(.*?)\*\*/g;
    const parts = [];
    let lastIndex = 0;
    let match;
    const boldColor = isDark ? 'text-brand-teal' : 'text-[#0D9488] font-bold';
    
    while ((match = boldRegex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        parts.push(line.substring(lastIndex, match.index));
      }
      parts.push(
        <strong key={match.index} className={`font-semibold ${boldColor}`}>
          {match[1]}
        </strong>
      );
      lastIndex = boldRegex.lastIndex;
    }
    
    if (lastIndex < line.length) {
      parts.push(line.substring(lastIndex));
    }
    
    return parts.length > 0 ? parts : line;
  };

  // Render dynamic bar chart from table rows
  const renderChart = (headers, rows) => {
    const chartData = rows.map(row => {
      // Find the first column containing numeric values
      let val = 0;
      let label = 'Value';
      for (let i = 1; i < row.length; i++) {
        const parsed = parseNumericValue(row[i]);
        if (parsed !== 0) {
          val = parsed;
          label = headers[i];
          break;
        }
      }
      return {
        name: row[0],
        value: val,
        formatted: row[1] || `₹${val.toLocaleString()}`,
        label: label
      };
    }).filter(d => d.value > 0);

    if (chartData.length === 0) {
      return (
        <div className="p-6 text-center text-xs text-slate-500 dark:text-gray-400 italic">
          No numeric financial records identified to generate chart.
        </div>
      );
    }

    const valueLabel = chartData[0]?.label || 'Amount';
    const COLORS = ['#0D9488', '#4F46E5', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899', '#3b82f6', '#16A34A'];

    return (
      <div className="py-5 px-3" style={{ height: 210 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
            <XAxis 
              dataKey="name" 
              stroke={isDark ? '#4b5563' : '#64748b'} 
              style={{ fontSize: 10, fontWeight: 500 }} 
              tickLine={false}
            />
            <YAxis 
              stroke={isDark ? '#4b5563' : '#64748b'} 
              style={{ fontSize: 10, fontWeight: 500 }} 
              tickLine={false}
            />
            <RechartsTooltip 
              contentStyle={{
                backgroundColor: isDark ? '#0f172a' : '#F1F5F9',
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(79,70,229,0.3)',
                borderRadius: 8,
                fontSize: 11,
                color: isDark ? '#ffffff' : '#0f172a'
              }}
              formatter={(value) => [`₹${value.toLocaleString()}`, valueLabel]}
            />
            <Bar dataKey="value" radius={[5, 5, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  };

  // Helper to render HTML table or dynamic Recharts bar chart
  const renderTableOrChart = (headers, rows, tableKey) => {
    const mode = viewModes[tableKey] || 'table';
    
    // Check if the table is chartable (has at least one numeric cell)
    const isChartable = rows.some(row => {
      for (let i = 1; i < row.length; i++) {
        if (parseNumericValue(row[i]) > 0) return true;
      }
      return false;
    });

    return (
      <div key={tableKey} className="my-4 rounded-xl border border-gray-800/10 dark:border-gray-800/30 bg-gray-500/5 backdrop-blur-md overflow-hidden animate-slide-up">
        {/* Toggle Header */}
        {isChartable && (
          <div className="flex justify-between items-center px-4 py-2 border-b border-gray-800/10 dark:border-gray-800/30 bg-gray-500/10">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
              Data Visualization
            </span>
            <div className="flex gap-1 bg-slate-200/50 dark:bg-slate-900/60 p-0.5 rounded-lg border border-gray-800/5 dark:border-white/5">
              <button 
                type="button"
                onClick={() => setViewMode(tableKey, 'table')} 
                className={`text-[9px] px-2.5 py-1 rounded-md font-bold transition-all ${
                  mode === 'table' 
                    ? isDark 
                      ? 'bg-slate-800 shadow-sm text-white' 
                      : 'bg-white shadow-sm text-slate-850'
                    : 'text-slate-500 dark:text-gray-400 hover:text-slate-750 dark:hover:text-gray-200'
                }`}
              >
                Table
              </button>
              <button 
                type="button"
                onClick={() => setViewMode(tableKey, 'chart')} 
                className={`text-[9px] px-2.5 py-1 rounded-md font-bold transition-all ${
                  mode === 'chart' 
                    ? isDark 
                      ? 'bg-slate-800 shadow-sm text-white' 
                      : 'bg-white shadow-sm text-slate-850'
                    : 'text-slate-500 dark:text-gray-400 hover:text-slate-750 dark:hover:text-gray-200'
                }`}
              >
                Chart
              </button>
            </div>
          </div>
        )}

        {/* Content Body */}
        {mode === 'table' ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-800/10 dark:divide-gray-800 text-xs">
              <thead className="bg-gray-500/5">
                <tr>
                  {headers.map((h, i) => (
                    <th key={i} className="px-4 py-2.5 text-left font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/10 dark:divide-gray-800/50">
                {rows.map((row, ri) => (
                  <tr key={ri} className="hover:bg-gray-500/5 transition-colors">
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-4 py-2.5 text-gray-800 dark:text-gray-200 font-medium">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          renderChart(headers, rows)
        )}
      </div>
    );
  };

  // Helper to format messages with markdown elements
  const parseMarkdown = (text, msgIndex) => {
    const lines = text.split('\n');
    const elements = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Insight marker left behind by extractTablesAndStrip - render a pill
      // pointing at the Insights panel instead of an inline table.
      const insightMatch = line.match(/^⟦INSIGHT:(.+)⟧$/);
      if (insightMatch) {
        elements.push(
          <button
            key={`insight-${i}`}
            type="button"
            onClick={() => setActiveTab('insights')}
            className={`my-2 flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg border transition-colors ${
              isDark
                ? 'bg-brand-teal/10 border-brand-teal/25 text-brand-teal hover:bg-brand-teal/20'
                : 'bg-[#0D9488]/10 border-[#0D9488]/25 text-[#0D9488] hover:bg-[#0D9488]/20'
            }`}
          >
            📊 Insight added — see panel
            <span className="md:hidden">→</span>
          </button>
        );
        continue;
      }

      if (line === '') {
        continue;
      }

      // Check for headers
      if (line.startsWith('### ')) {
        elements.push(
          <h3 key={`h3-${i}`} className={`text-sm font-bold mt-4 mb-1.5 font-outfit uppercase tracking-wider ${isDark ? 'text-brand-teal' : 'text-[#0D9488]'}`}>
            {formatBold(line.substring(4))}
          </h3>
        );
      } else if (line.startsWith('## ')) {
        elements.push(
          <h2 key={`h2-${i}`} className={`text-base font-extrabold mt-5 mb-2 font-outfit ${isDark ? 'text-brand-indigo' : 'text-slate-800'}`}>
            {formatBold(line.substring(3))}
          </h2>
        );
      } else if (line.startsWith('* ')) {
        elements.push(
          <div key={`li-${i}`} className="flex items-start gap-2.5 my-1.5 text-sm leading-relaxed">
            <span className={isDark ? 'text-brand-teal mt-1' : 'text-[#0D9488] mt-1'} style={{ fontSize: '10px' }}>✦</span>
            <span className={isDark ? 'text-gray-200' : 'text-slate-700'}>{formatBold(line.substring(2))}</span>
          </div>
        );
      } else {
        // Check for Callout Boxes
        const isCallout = line.startsWith('🚨') || line.startsWith('⚠️') || line.startsWith('🟢') || line.startsWith('🌟');
        if (isCallout) {
          const borderColor = line.startsWith('🚨') ? 'border-red-500/30 border-l-red-500' : line.startsWith('⚠️') ? 'border-amber-500/30 border-l-amber-500' : 'border-emerald-500/30 border-l-emerald-500';
          const bgColor = isDark ? 'rgba(255,255,255,0.02)' : 'rgba(15,23,42,0.02)';
          const textColor = line.startsWith('🚨') ? 'text-red-600 dark:text-red-400' : line.startsWith('⚠️') ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400';
          elements.push(
            <div key={`callout-${i}`} className={`p-4 rounded-xl border-l-4 border my-3 text-xs flex items-start gap-3 backdrop-blur-md ${borderColor} ${textColor}`} style={{ backgroundColor: bgColor }}>
              <span className="leading-relaxed">{formatBold(line)}</span>
            </div>
          );
        } else {
          elements.push(
            <p key={`p-${i}`} className={`mb-2 leading-relaxed text-sm ${isDark ? 'text-gray-200' : 'text-slate-700'}`}>
              {formatBold(line)}
            </p>
          );
        }
      }
    }

    return elements;
  };

  const textTitleColor = isDark ? 'text-white' : 'text-slate-800';
  const textSubColor = isDark ? 'text-gray-400' : 'text-slate-500';

  const paneGlassStyle = {
    background: isDark ? 'rgba(10, 15, 26, 0.5)' : 'rgba(248, 250, 252, 0.45)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(79, 70, 229, 0.2)',
    boxShadow: isDark ? '0 16px 48px rgba(0,0,0,0.4)' : '0 16px 48px rgba(139, 92, 26, 0.05)',
  };
  const paneHeaderBorder = `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(79, 70, 229, 0.15)'}`;

  return (
    <div className="h-[calc(100vh-9.5rem)] md:h-[calc(100vh-6rem)] max-w-7xl mx-auto w-full flex flex-col space-y-4">
      {/* Title */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className={`text-3xl font-extrabold tracking-tight ${textTitleColor} flex items-center gap-2`}>
            AI Private Advisor
          </h1>
          <p className={`text-sm mt-1 ${textSubColor}`}>
            Personalized wealth intelligence and financial advice.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Mobile Chat/Insights tab toggle */}
          <div className="flex md:hidden gap-1 bg-slate-200/50 dark:bg-slate-900/60 p-0.5 rounded-lg border border-gray-800/5 dark:border-white/5">
            <button
              type="button"
              onClick={() => setActiveTab('chat')}
              className={`text-xs px-3 py-1.5 rounded-md font-bold transition-all ${
                activeTab === 'chat'
                  ? isDark ? 'bg-slate-800 shadow-sm text-white' : 'bg-white shadow-sm text-slate-850'
                  : 'text-slate-500 dark:text-gray-400'
              }`}
            >
              Chat
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('insights')}
              className={`text-xs px-3 py-1.5 rounded-md font-bold transition-all ${
                activeTab === 'insights'
                  ? isDark ? 'bg-slate-800 shadow-sm text-white' : 'bg-white shadow-sm text-slate-850'
                  : 'text-slate-500 dark:text-gray-400'
              }`}
            >
              Insights{insights.length > 0 ? ` (${insights.length})` : ''}
            </button>
          </div>
          <IconButton onClick={clearChat} color="error" title="Clear Chat" size="small">
            <ClearAll />
          </IconButton>
        </div>
      </div>

      {/* Workspace: Chat pane + Insights panel */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-[1fr_340px] gap-4 overflow-hidden">

        {/* Chat Pane */}
        <div
          className={`${activeTab === 'chat' ? 'flex' : 'hidden'} md:flex flex-col overflow-hidden rounded-2xl border`}
          style={paneGlassStyle}
        >
          {/* Chat Header Indicator */}
          <div
            className="p-4 flex items-center justify-between flex-shrink-0"
            style={{ borderBottom: paneHeaderBorder, background: isDark ? 'rgba(0,0,0,0.1)' : 'rgba(248,250,252,0.3)' }}
          >
            <div className="flex items-center gap-3">
              {/* Advisor badge avatar */}
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-tr from-[#0D9488] to-[#4F46E5] text-white shadow-md flex-shrink-0"
                style={{ boxShadow: '0 0 12px rgba(13, 148, 136, 0.35)', border: '1px solid rgba(255,255,255,0.15)' }}
              >
                <WorkspacePremium fontSize="medium" style={{ color: '#ffffff' }} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold ${textTitleColor}`}>Aurelia Elite Core</span>
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                </div>
                <p className={`text-[10px] tracking-wider uppercase font-semibold ${isDark ? 'text-brand-teal' : 'text-[#0D9488]'}`}>
                  Private Wealth Advisor
                </p>
              </div>
            </div>
            <AutoAwesome className={isDark ? 'text-brand-teal animate-spin' : 'text-[#0D9488] animate-spin'} style={{ animationDuration: '8s', opacity: 0.7 }} />
          </div>

          {/* Message Row History Scroll Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {messages.map((msg, index) => {
              const isBot = msg.role === 'assistant';
              return (
                <div key={index} className="flex gap-3 pb-5 border-b border-gray-800/5 dark:border-white/5 last:border-b-0 last:pb-0">
                  {/* Avatar */}
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ${
                      isBot
                        ? 'bg-gradient-to-tr from-[#0D9488] to-[#4F46E5] text-white'
                        : isDark
                          ? 'bg-slate-800 text-slate-200'
                          : 'bg-slate-800 text-slate-100'
                    }`}
                  >
                    {isBot ? <WorkspacePremium style={{ fontSize: 16 }} /> : <UserIcon style={{ fontSize: 16 }} />}
                  </div>

                  {/* Row Content */}
                  <div className="flex-1 min-w-0">
                    <span className={`text-xs font-bold ${isBot ? (isDark ? 'text-brand-teal' : 'text-[#0D9488]') : textTitleColor}`}>
                      {isBot ? 'Aurelia' : (user?.username || 'You')}
                    </span>
                    <div className={`text-sm mt-1 ${isBot ? `pl-3 border-l-2 ${isDark ? 'border-l-brand-teal/40' : 'border-l-[#0D9488]/30'}` : ''}`}>
                      {parseMarkdown(msg.content, index)}

                      {isBot && msg.actionTriggered && (
                        <div
                          className={`mt-3 p-3 rounded-xl border flex items-start gap-2.5 bg-emerald-500/5 ${
                            isDark
                              ? 'border-emerald-500/20 text-emerald-400'
                              : 'border-emerald-500/30 text-emerald-600'
                          }`}
                        >
                          <span className="text-base font-bold">✓</span>
                          <div className="text-xs">
                            <span className="font-bold block mb-0.5">Database Action Executed:</span>
                            {msg.actionTriggered.type === 'CREATE_TRANSACTION' && (
                              <p className="opacity-90">
                                Logged transaction: {msg.actionTriggered.details.type === 'income' ? 'Income' : 'Expense'} of <strong>₹{msg.actionTriggered.details.amount.toLocaleString()}</strong> under "{msg.actionTriggered.details.category}" ({msg.actionTriggered.details.description})
                              </p>
                            )}
                            {msg.actionTriggered.type === 'CREATE_GOAL' && (
                              <p className="opacity-90">
                                Created savings goal: "{msg.actionTriggered.details.name}" with a target of <strong>₹{msg.actionTriggered.details.targetAmount.toLocaleString()}</strong> by {new Date(msg.actionTriggered.details.deadline).toLocaleDateString()}
                              </p>
                            )}
                            {msg.actionTriggered.type === 'CREATE_BUDGET' && (
                              <p className="opacity-90">
                                Configured budget: "{msg.actionTriggered.details.category}" limit set to <strong>₹{msg.actionTriggered.details.limit.toLocaleString()}</strong> for month {msg.actionTriggered.details.month}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Typing Indicator */}
            {loading && (
              <div className="flex gap-3 animate-pulse">
                <div
                  className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#0D9488] to-[#4F46E5] text-white flex items-center justify-center flex-shrink-0"
                >
                  <WorkspacePremium style={{ fontSize: 16 }} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className={`text-xs font-bold ${isDark ? 'text-brand-teal' : 'text-[#0D9488]'}`}>Aurelia</span>
                  <div className="flex items-center gap-1.5 py-1 mt-1">
                    <div className={`w-2 h-2 rounded-full animate-bounce ${isDark ? 'bg-brand-teal' : 'bg-[#0D9488]'}`} style={{ animationDelay: '0ms' }}></div>
                    <div className={`w-2 h-2 rounded-full animate-bounce ${isDark ? 'bg-brand-indigo' : 'bg-[#4F46E5]'}`} style={{ animationDelay: '150ms' }}></div>
                    <div className={`w-2 h-2 rounded-full animate-bounce ${isDark ? 'bg-brand-violet' : 'bg-slate-400'}`} style={{ animationDelay: '300ms' }}></div>
                  </div>
                  <span className={`text-[11px] ${textSubColor}`}>Aurelia is compiling secure statement records...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggestion Chips */}
          <div className="flex gap-2 px-4 py-2 overflow-x-auto flex-shrink-0 border-t border-gray-800/10 dark:border-gray-800/50 bg-gray-500/5 select-none no-scrollbar"
               style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(79,70,229,0.15)'}` }}>
            {SUGGESTION_CHIPS.map((chip, idx) => (
              <button
                key={idx}
                type="button"
                disabled={loading}
                onClick={() => submitMessage(chip.query)}
                className={`text-xs px-3.5 py-1.5 rounded-full border whitespace-nowrap transition-all duration-150 transform active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer ${
                  isDark
                    ? 'bg-slate-900/60 border-slate-800 text-gray-300 hover:bg-slate-850 hover:text-white'
                    : 'bg-[#F1F5F9]/80 border-[#E2E8F0] text-slate-700 hover:bg-[#E2E8F0] hover:text-slate-900'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Message Input Form */}
          <form
            onSubmit={handleSend}
            className="p-4 flex items-center gap-3 flex-shrink-0"
            style={{
              borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(79, 70, 229, 0.15)'}`,
              background: isDark ? 'rgba(0,0,0,0.05)' : 'rgba(248,250,252,0.2)'
            }}
          >
            {/* Speaker Mute/Unmute Toggle */}
            <IconButton
              onClick={toggleMute}
              disabled={loading}
              style={{
                color: isMuted ? (isDark ? '#4b5563' : '#64748b') : (isDark ? '#0D9488' : '#4F46E5'),
                background: isMuted ? 'transparent' : (isDark ? 'rgba(13,148,136,0.08)' : 'rgba(79,70,229,0.08)'),
                border: `1px solid ${isMuted ? isDark ? 'rgba(255,255,255,0.08)' : 'rgba(79,70,229,0.3)' : isDark ? 'rgba(13,148,136,0.2)' : 'rgba(79,70,229,0.25)'}`,
                borderRadius: '11px',
                width: '40px',
                height: '40px',
                flexShrink: 0
              }}
            >
              {isMuted ? <VolumeOff style={{ fontSize: 18 }} /> : <VolumeUp style={{ fontSize: 18 }} />}
            </IconButton>

            {/* Microphone Recognition Toggle */}
            <IconButton
              onClick={toggleListening}
              disabled={loading}
              style={{
                color: isListening ? '#ffffff' : (isDark ? '#4b5563' : '#64748b'),
                background: isListening
                  ? 'linear-gradient(135deg, #0D9488, #4F46E5)'
                  : 'transparent',
                border: `1px solid ${isListening ? 'transparent' : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(79,70,229,0.3)'}`,
                borderRadius: '11px',
                width: '40px',
                height: '40px',
                boxShadow: isListening ? '0 0 10px rgba(13,148,136,0.4)' : 'none',
                flexShrink: 0
              }}
            >
              {isListening ? <Mic style={{ fontSize: 18 }} /> : <MicOff style={{ fontSize: 18 }} />}
            </IconButton>

            <input
              type="text"
              placeholder="Ask Aurelia about your secure statements or projections..."
              value={input}
              onChange={(e) => {
                handleUserInteract();
                setInput(e.target.value);
              }}
              disabled={loading}
              style={{
                flex: 1,
                background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.65)',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(79,70,229,0.3)'}`,
                borderRadius: '12px',
                padding: '11px 16px',
                color: isDark ? '#ffffff' : '#0f172a',
                fontSize: '14px',
                outline: 'none',
                fontFamily: 'Inter, sans-serif',
                transition: 'all 0.2s',
              }}
              className="focus:border-brand-teal dark:focus:border-brand-teal focus:ring-1 focus:ring-brand-teal/20"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              style={{
                background: input.trim()
                  ? 'linear-gradient(135deg, #0D9488, #4F46E5)'
                  : 'transparent',
                border: input.trim() ? 'none' : `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(79,70,229,0.3)'}`,
                color: input.trim() ? '#ffffff' : isDark ? '#4b5563' : '#64748b',
                borderRadius: '11px',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: input.trim() && !loading ? 'pointer' : 'default',
                transition: 'all 0.2s ease',
                flexShrink: 0,
              }}
            >
              {loading ? <CircularProgress size={16} color="inherit" /> : <SendIcon style={{ fontSize: 16 }} />}
            </button>
          </form>
        </div>

        {/* Insights Panel */}
        <div
          className={`${activeTab === 'insights' ? 'flex' : 'hidden'} md:flex flex-col overflow-hidden rounded-2xl border`}
          style={paneGlassStyle}
        >
          <div
            className="p-4 flex items-center justify-between flex-shrink-0"
            style={{ borderBottom: paneHeaderBorder, background: isDark ? 'rgba(0,0,0,0.1)' : 'rgba(248,250,252,0.3)' }}
          >
            <span className={`text-sm font-bold ${textTitleColor}`}>Insights</span>
            <span className={`text-[10px] font-semibold uppercase tracking-wider ${textSubColor}`}>
              {insights.length} pinned
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {insights.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-4 gap-2">
                <AutoAwesome className={isDark ? 'text-brand-teal' : 'text-[#0D9488]'} style={{ fontSize: 32, opacity: 0.5 }} />
                <p className={`text-xs ${textSubColor}`}>
                  Structured data from Aurelia's answers will appear here.
                </p>
              </div>
            ) : (
              insights.map((entry) => (
                <div key={entry.tableKey}>
                  <p className={`text-[10px] uppercase tracking-wider font-semibold mt-1 ${textSubColor}`}>
                    From: "{entry.sourceQuery}"
                  </p>
                  {renderTableOrChart(entry.headers, entry.rows, entry.tableKey)}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
