import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  Send as SendIcon,
  Close as CloseIcon,
  WorkspacePremium,
  OpenInFull,
  AutoAwesome,
} from '@mui/icons-material';

/**
 * AureliaFloat — Floating AI advisor bubble
 * Sits fixed bottom-right on Dashboard.
 * Shows a glowing avatar; on click expands to a mini chat panel.
 */
export default function AureliaFloat() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isDark = theme === 'dark';

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `Hey ${user?.username?.split(' ')[0] || 'there'}! 👋 I'm Aurelia. Ask me anything about your finances — budgets, savings, forecasts, or just say hi!`
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pulsing, setPulsing] = useState(true);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Stop pulse after first open
  useEffect(() => {
    if (isOpen) setPulsing(false);
  }, [isOpen]);

  // Auto scroll to latest message
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  const QUICK_CHIPS = [
    { label: '💰 Can I save more?', query: 'How can I improve my savings rate?' },
    { label: '📊 My spending?', query: 'Where am I spending the most money?' },
    { label: '🔮 Next month?', query: 'What is my predicted next month spending?' },
  ];

  const submitMessage = async (text) => {
    if (!text.trim() || loading) return;
    setInput('');

    const newUserMsg = { role: 'user', content: text };
    setMessages(prev => [...prev, newUserMsg]);
    setLoading(true);

    try {
      const historyForApi = [...messages.slice(1), newUserMsg].map(m => ({
        role: m.role,
        content: m.content,
      }));

      const res = await api.post('/chatbot', {
        message: text,
        conversation_history: historyForApi,
      });

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: res.data.reply || "I'm having trouble responding right now."
      }]);
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "⚠️ Couldn't reach the AI service. Make sure the server is running!"
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = (e) => {
    e.preventDefault();
    submitMessage(input.trim());
  };

  // Styles
  const panelBg = isDark
    ? 'rgba(8, 14, 24, 0.92)'
    : 'rgba(248, 250, 252, 0.95)';
  const borderClr = isDark ? 'rgba(13,148,136,0.18)' : 'rgba(13,148,136,0.30)';
  const inputBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';

  return (
    <>
      {/* ── Floating avatar button ─────────────────────────────────── */}
      <div
        style={{
          position: 'fixed',
        bottom: '148px',        // above the + FAB on mobile (80px + 56px + gap)
          right: '20px',
          zIndex: 9000,
        }}
      >
        {/* Pulse ring */}
        {pulsing && (
          <span
            style={{
              position: 'absolute', inset: '-6px',
              borderRadius: '50%',
              background: 'rgba(13,148,136,0.25)',
              animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite',
              pointerEvents: 'none',
            }}
          />
        )}

        <button
          onClick={() => setIsOpen(prev => !prev)}
          title="Chat with Aurelia"
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #0D9488, #4F46E5)',
            border: '2px solid rgba(255,255,255,0.2)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: isOpen
              ? '0 0 0 3px rgba(13,148,136,0.35), 0 8px 28px rgba(13,148,136,0.5)'
              : '0 0 18px rgba(13,148,136,0.45), 0 4px 16px rgba(0,0,0,0.3)',
            transform: isOpen ? 'scale(0.92)' : 'scale(1)',
            transition: 'all 0.25s cubic-bezier(0.34,1.56,0.64,1)',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {isOpen
            ? <CloseIcon style={{ color: '#fff', fontSize: 22 }} />
            : <WorkspacePremium style={{ color: '#fff', fontSize: 22 }} />
          }
          {/* Online indicator */}
          {!isOpen && (
            <span style={{
              position: 'absolute', top: 3, right: 3,
              width: 12, height: 12, borderRadius: '50%',
              background: '#16A34A',
              border: '2px solid white',
              boxShadow: '0 0 6px rgba(22,163,74,0.6)'
            }} />
          )}
        </button>
      </div>

      {/* ── Mini chat panel ────────────────────────────────────────── */}
      <div
        style={{
          position: 'fixed',
          bottom: '284px',
          right: '20px',
          width: '340px',
          maxHeight: '460px',
          zIndex: 8999,
          borderRadius: '20px',
          overflow: 'hidden',
          background: panelBg,
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: `1px solid ${borderClr}`,
          boxShadow: isDark
            ? '0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(13,148,136,0.08)'
            : '0 24px 64px rgba(0,0,0,0.12), 0 0 0 1px rgba(13,148,136,0.15)',
          display: 'flex',
          flexDirection: 'column',
          // Slide-up animation
          transformOrigin: 'bottom right',
          transform: isOpen ? 'scale(1) translateY(0)' : 'scale(0.85) translateY(20px)',
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'all' : 'none',
          transition: 'all 0.3s cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '14px 16px',
          borderBottom: `1px solid ${borderClr}`,
          background: isDark ? 'rgba(0,0,0,0.15)' : 'rgba(248,250,252,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: '50%',
              background: 'linear-gradient(135deg, #0D9488, #4F46E5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 10px rgba(13,148,136,0.35)',
              border: '1px solid rgba(255,255,255,0.15)',
              flexShrink: 0,
            }}>
              <WorkspacePremium style={{ color: '#fff', fontSize: 16 }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: isDark ? '#f9fafb' : '#0f172a', fontFamily: 'Outfit, sans-serif' }}>
                  Aurelia
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#16A34A', boxShadow: '0 0 5px rgba(22,163,74,0.6)', display: 'inline-block' }} />
                  <span style={{ fontSize: 10, color: '#16A34A', fontWeight: 600 }}>Online</span>
                </span>
              </div>
              <span style={{ fontSize: 10, color: isDark ? '#0D9488' : '#4F46E5', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                AI Financial Advisor
              </span>
            </div>
          </div>
          {/* Open full console button */}
          <button
            onClick={() => navigate('/chatbot')}
            title="Open full Aurelia console"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: isDark ? '#6b7280' : '#9ca3af', padding: 4, borderRadius: 8,
              display: 'flex', alignItems: 'center',
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = isDark ? '#0D9488' : '#4F46E5'}
            onMouseLeave={e => e.currentTarget.style.color = isDark ? '#6b7280' : '#9ca3af'}
          >
            <OpenInFull style={{ fontSize: 16 }} />
          </button>
        </div>

        {/* Messages */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '12px 14px',
          display: 'flex', flexDirection: 'column', gap: 10,
          minHeight: 0,
        }}>
          {messages.map((msg, idx) => {
            const isBot = msg.role === 'assistant';
            // Limit content display for mini panel
            const content = msg.content.replace(/\*\*/g, '').replace(/\*/g, '').replace(/#{1,3} /g, '').replace(/\|.*\|/g, '').trim();
            const truncated = content.length > 280 ? content.slice(0, 280) + '...' : content;

            return (
              <div key={idx} style={{
                display: 'flex',
                flexDirection: isBot ? 'row' : 'row-reverse',
                gap: 8, alignItems: 'flex-end',
              }}>
                {isBot && (
                  <div style={{
                    width: 26, height: 26, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #0D9488, #4F46E5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <WorkspacePremium style={{ color: '#fff', fontSize: 13 }} />
                  </div>
                )}
                <div style={{
                  maxWidth: '82%',
                  padding: '9px 12px',
                  borderRadius: isBot ? '14px 14px 14px 4px' : '14px 14px 4px 14px',
                  background: isBot
                    ? isDark ? 'rgba(15,23,42,0.7)' : 'rgba(248,250,252,0.9)'
                    : isDark ? 'linear-gradient(135deg, #0D9488, #4F46E5)' : 'linear-gradient(135deg, #0D9488, #4F46E5)',
                  border: isBot ? `1px solid ${borderClr}` : 'none',
                  borderLeft: isBot ? `3px solid ${isDark ? '#0D9488' : '#4F46E5'}` : undefined,
                  fontSize: 12,
                  lineHeight: 1.55,
                  color: isBot ? (isDark ? '#e5e7eb' : '#1e293b') : '#ffffff',
                  fontFamily: 'Inter, sans-serif',
                }}>
                  {truncated}
                  {content.length > 280 && (
                    <span
                      onClick={() => navigate('/chatbot')}
                      style={{ color: isDark ? '#0D9488' : '#4F46E5', cursor: 'pointer', fontWeight: 600, marginLeft: 4 }}
                    >
                      Open full console →
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {/* Typing indicator */}
          {loading && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <div style={{
                width: 26, height: 26, borderRadius: '50%',
                background: 'linear-gradient(135deg, #0D9488, #4F46E5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <WorkspacePremium style={{ color: '#fff', fontSize: 13 }} />
              </div>
              <div style={{
                padding: '10px 14px',
                borderRadius: '14px 14px 14px 4px',
                background: isDark ? 'rgba(15,23,42,0.7)' : 'rgba(248,250,252,0.9)',
                border: `1px solid ${borderClr}`,
                borderLeft: `3px solid ${isDark ? '#0D9488' : '#4F46E5'}`,
                display: 'flex', gap: 4, alignItems: 'center',
              }}>
                {[0, 150, 300].map(delay => (
                  <div key={delay} style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: isDark ? '#0D9488' : '#4F46E5',
                    animation: 'bounce 1s infinite',
                    animationDelay: `${delay}ms`,
                  }} />
                ))}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick chips */}
        {messages.length <= 2 && (
          <div style={{
            display: 'flex', gap: 6, padding: '6px 14px', flexWrap: 'wrap',
            borderTop: `1px solid ${borderClr}`,
            background: isDark ? 'rgba(0,0,0,0.1)' : 'rgba(248,250,252,0.4)',
            flexShrink: 0,
          }}>
            {QUICK_CHIPS.map((chip, idx) => (
              <button
                key={idx}
                onClick={() => submitMessage(chip.query)}
                disabled={loading}
                style={{
                  fontSize: 10, padding: '5px 10px',
                  borderRadius: 999,
                  background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                  border: `1px solid ${borderClr}`,
                  color: isDark ? '#d1d5db' : '#475569',
                  cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s',
                }}
              >
                {chip.label}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <form
          onSubmit={handleSend}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 12px',
            borderTop: `1px solid ${borderClr}`,
            background: isDark ? 'rgba(0,0,0,0.08)' : 'rgba(248,250,252,0.3)',
            flexShrink: 0,
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask Aurelia..."
            disabled={loading}
            style={{
              flex: 1,
              background: inputBg,
              border: `1px solid ${borderClr}`,
              borderRadius: 10,
              padding: '8px 12px',
              fontSize: 12,
              color: isDark ? '#f9fafb' : '#0f172a',
              outline: 'none',
              fontFamily: 'Inter, sans-serif',
            }}
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            style={{
              width: 34, height: 34,
              borderRadius: 10, border: 'none',
              background: input.trim()
                ? 'linear-gradient(135deg, #0D9488, #4F46E5)'
                : isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
              color: input.trim() ? '#fff' : isDark ? '#4b5563' : '#9ca3af',
              cursor: input.trim() && !loading ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s',
              flexShrink: 0,
            }}
          >
            <SendIcon style={{ fontSize: 15 }} />
          </button>
        </form>

        {/* Footer */}
        <div style={{
          textAlign: 'center', padding: '6px',
          borderTop: `1px solid ${borderClr}`,
          background: isDark ? 'rgba(0,0,0,0.1)' : 'rgba(248,250,252,0.4)',
        }}>
          <button
            onClick={() => navigate('/chatbot')}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 10, color: isDark ? '#0D9488' : '#4F46E5',
              fontWeight: 600, fontFamily: 'Inter, sans-serif',
              display: 'flex', alignItems: 'center', gap: 4, margin: '0 auto',
            }}
          >
            <AutoAwesome style={{ fontSize: 11 }} />
            Open Full Console
          </button>
        </div>
      </div>
    </>
  );
}
