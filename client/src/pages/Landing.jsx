import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { DarkMode, LightMode } from '@mui/icons-material';

const FEATURES = [
  {
    icon: '🤖',
    title: 'Aurelia AI Advisor',
    desc: 'Talk to your money like a best friend. Aurelia is powered by Claude — she knows your balances, goals, and spending habits, and gives real, human advice.',
    color: '#d97706',
  },
  {
    icon: '📊',
    title: 'Smart Dashboard',
    desc: 'See everything at a glance — income, expenses, savings rate, anomaly alerts, and AI-powered insights — all in one beautiful view.',
    color: '#4F46E5',
  },
  {
    icon: '🎯',
    title: 'Savings Goals',
    desc: 'Set goals with visual ring progress. Track your MacBook Fund, emergency fund, or dream vacation — Aurelia tells you if you\'re on track.',
    color: '#0D9488',
  },
  {
    icon: '📈',
    title: 'Portfolio Tracker',
    desc: 'Track live stock and mutual fund holdings. Auto-calculates FIFO capital gains, STCG, LTCG taxes, and unrealized profits in real time.',
    color: '#3b82f6',
  },
  {
    icon: '🔄',
    title: 'Recurring Bills',
    desc: 'Automatically detects Netflix, Spotify, gym, rent, and utilities from your transactions. Never miss a due date again.',
    color: '#ec4899',
  },
  {
    icon: '🧮',
    title: 'Monte Carlo Simulator',
    desc: 'Run 1,000 wealth projection paths — worst case, median, and best case — to see if your savings goals are actually achievable.',
    color: '#f59e0b',
  },
];

const STATS = [
  { value: '10+', label: 'AI-Powered Features' },
  { value: '100%', label: 'Private & Secure' },
  { value: 'Live', label: 'Portfolio Tracking' },
  { value: 'Free', label: 'During Preview' },
];

export default function Landing() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const canvasRef = useRef(null);

  // Subtle particle canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let w = canvas.width = window.innerWidth;
    let h = canvas.height = window.innerHeight;
    const resize = () => { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; };
    window.addEventListener('resize', resize);

    const particles = Array.from({ length: 60 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1.5 + 0.5,
      dx: (Math.random() - 0.5) * 0.3,
      dy: (Math.random() - 0.5) * 0.3,
      opacity: Math.random() * 0.4 + 0.1,
    }));

    let raf;
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      particles.forEach(p => {
        p.x += p.dx; p.y += p.dy;
        if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = isDark
          ? `rgba(13,148,136,${p.opacity})`
          : `rgba(79,70,229,${p.opacity * 0.6})`;
        ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, [isDark]);

  return (
    <div style={{
      minHeight: '100vh',
      background: isDark
        ? 'linear-gradient(135deg, #0B1120 0%, #0F1A2E 40%, #0B1120 100%)'
        : 'linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 40%, #F8FAFC 100%)',
      color: isDark ? '#f9fafb' : '#111827',
      fontFamily: 'Inter, sans-serif',
      overflowX: 'hidden',
      position: 'relative',
    }}>
      {/* Particle canvas */}
      <canvas ref={canvasRef} style={{
        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
        pointerEvents: 'none', zIndex: 0,
      }} />

      {/* Orb glows */}
      <div style={{
        position: 'fixed', top: '-10%', left: '-5%',
        width: '50vw', height: '50vw', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(45,212,191,0.12) 0%, transparent 70%)',
        filter: 'blur(40px)', pointerEvents: 'none', zIndex: 0,
      }} />
      <div style={{
        position: 'fixed', bottom: '-10%', right: '-5%',
        width: '45vw', height: '45vw', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(79,70,229,0.10) 0%, transparent 70%)',
        filter: 'blur(40px)', pointerEvents: 'none', zIndex: 0,
      }} />

      {/* ── NAVBAR ─────────────────────────────────────────────────── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 40px',
        background: isDark ? 'rgba(11,17,32,0.8)' : 'rgba(248,250,252,0.8)',
        backdropFilter: 'blur(20px)',
        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #0D9488, #4F46E5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, boxShadow: '0 0 20px rgba(13,148,136,0.3)',
          }}>💰</div>
          <span style={{ fontSize: 18, fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>
            Wealth<span style={{ color: '#0D9488' }}>AI</span>
          </span>
        </div>

        {/* Nav actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={toggleTheme} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: isDark ? '#9ca3af' : '#6b7280', padding: 6, borderRadius: 8,
            display: 'flex', alignItems: 'center',
          }}>
            {isDark ? <LightMode fontSize="small" /> : <DarkMode fontSize="small" />}
          </button>
          <button
            onClick={() => navigate('/login')}
            style={{
              padding: '8px 20px', borderRadius: 10, fontWeight: 600, fontSize: 14,
              background: 'transparent', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'}`,
              color: isDark ? '#f9fafb' : '#111827',
            }}
          >
            Sign In
          </button>
          <button
            onClick={() => navigate('/login')}
            style={{
              padding: '8px 20px', borderRadius: 10, fontWeight: 700, fontSize: 14,
              background: 'linear-gradient(135deg, #0D9488, #4F46E5)',
              color: 'white', border: 'none', cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
              boxShadow: '0 4px 14px rgba(13,148,136,0.3)',
            }}
          >
            Get Started Free
          </button>
        </div>
      </nav>

      {/* ── HERO ───────────────────────────────────────────────────── */}
      <section style={{
        position: 'relative', zIndex: 1,
        textAlign: 'center', padding: '100px 20px 80px',
        maxWidth: 800, margin: '0 auto',
      }}>
        {/* Badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: isDark ? 'rgba(13,148,136,0.1)' : 'rgba(13,148,136,0.08)',
          border: '1px solid rgba(13,148,136,0.25)',
          borderRadius: 999, padding: '5px 14px', fontSize: 12,
          fontWeight: 600, color: '#0D9488', marginBottom: 28,
          letterSpacing: '0.05em',
        }}>
          ✨ Powered by Claude AI · Now in Preview
        </div>

        {/* Headline */}
        <h1 style={{
          fontSize: 'clamp(36px, 6vw, 68px)',
          fontWeight: 900, lineHeight: 1.1,
          fontFamily: 'Outfit, sans-serif',
          marginBottom: 24, letterSpacing: '-0.02em',
        }}>
          Your Money,{' '}
          <span style={{
            background: 'linear-gradient(135deg, #0D9488, #2DD4BF, #4F46E5)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            Finally Understood
          </span>
        </h1>

        {/* Subheading */}
        <p style={{
          fontSize: 'clamp(16px, 2.5vw, 20px)',
          color: isDark ? '#9ca3af' : '#6b7280',
          lineHeight: 1.7, marginBottom: 40, maxWidth: 600, margin: '0 auto 40px',
        }}>
          WealthAI is your AI-powered personal finance advisor. Track spending, grow savings,
          monitor your portfolio — all guided by Aurelia, your 24/7 financial best friend.
        </p>

        {/* CTAs */}
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 60 }}>
          <button
            onClick={() => navigate('/login')}
            style={{
              padding: '14px 36px', borderRadius: 14, fontWeight: 800, fontSize: 16,
              background: 'linear-gradient(135deg, #0D9488, #4F46E5)',
              color: 'white', border: 'none', cursor: 'pointer',
              fontFamily: 'Outfit, sans-serif',
              boxShadow: '0 8px 30px rgba(13,148,136,0.35)',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(13,148,136,0.45)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 30px rgba(13,148,136,0.35)'; }}
          >
            🚀 Start for Free
          </button>
          <button
            onClick={() => navigate('/login')}
            style={{
              padding: '14px 32px', borderRadius: 14, fontWeight: 700, fontSize: 15,
              background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
              color: isDark ? '#f9fafb' : '#111827',
              cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              transition: 'background 0.2s',
            }}
          >
            Sign In to Dashboard →
          </button>
        </div>

        {/* Stats row */}
        <div style={{
          display: 'flex', justifyContent: 'center', gap: '40px', flexWrap: 'wrap',
          paddingTop: 40,
          borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'}`,
        }}>
          {STATS.map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 26, fontWeight: 900, color: '#0d9488', fontFamily: 'Outfit, sans-serif' }}>
                {s.value}
              </p>
              <p style={{ fontSize: 12, color: isDark ? '#6b7280' : '#9ca3af', fontWeight: 600, letterSpacing: '0.04em' }}>
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ───────────────────────────────────────────────── */}
      <section style={{
        position: 'relative', zIndex: 1,
        padding: '60px 20px 80px',
        maxWidth: 1100, margin: '0 auto',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <h2 style={{
            fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800,
            fontFamily: 'Outfit, sans-serif', marginBottom: 14, letterSpacing: '-0.02em',
          }}>
            Everything you need to{' '}
            <span style={{ color: '#0D9488' }}>master your money</span>
          </h2>
          <p style={{ fontSize: 16, color: isDark ? '#9ca3af' : '#6b7280', maxWidth: 500, margin: '0 auto' }}>
            Built for real people who want smart, actionable control over their financial life.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 20,
        }}>
          {FEATURES.map(f => (
            <div
              key={f.title}
              style={{
                padding: '28px 26px',
                background: isDark ? 'rgba(19,28,46,0.55)' : 'rgba(255,255,255,0.65)',
                backdropFilter: 'blur(20px)',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}`,
                borderRadius: 20,
                transition: 'transform 0.2s, box-shadow 0.2s',
                cursor: 'default',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = `0 20px 48px ${f.color}18`;
                e.currentTarget.style.borderColor = `${f.color}30`;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
              }}
            >
              <div style={{
                width: 52, height: 52, borderRadius: 14, fontSize: 26,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: `${f.color}18`, border: `1px solid ${f.color}30`,
                marginBottom: 18,
              }}>
                {f.icon}
              </div>
              <h3 style={{
                fontSize: 17, fontWeight: 700, marginBottom: 10,
                fontFamily: 'Outfit, sans-serif',
                color: isDark ? '#f9fafb' : '#111827',
              }}>
                {f.title}
              </h3>
              <p style={{
                fontSize: 14, lineHeight: 1.7,
                color: isDark ? '#9ca3af' : '#6b7280',
              }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── BOTTOM CTA ─────────────────────────────────────────────── */}
      <section style={{
        position: 'relative', zIndex: 1,
        textAlign: 'center', padding: '60px 20px 80px',
      }}>
        <div style={{
          maxWidth: 640, margin: '0 auto',
          padding: '56px 40px',
          background: isDark
            ? 'linear-gradient(135deg, rgba(13,148,136,0.08), rgba(79,70,229,0.06))'
            : 'linear-gradient(135deg, rgba(13,148,136,0.06), rgba(79,70,229,0.05))',
          border: `1px solid ${isDark ? 'rgba(13,148,136,0.15)' : 'rgba(13,148,136,0.12)'}`,
          borderRadius: 28,
          backdropFilter: 'blur(20px)',
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>💎</div>
          <h2 style={{
            fontSize: 32, fontWeight: 800, fontFamily: 'Outfit, sans-serif',
            marginBottom: 14, letterSpacing: '-0.02em',
            color: isDark ? '#f9fafb' : '#111827',
          }}>
            Ready to take control?
          </h2>
          <p style={{
            fontSize: 15, color: isDark ? '#9ca3af' : '#6b7280',
            lineHeight: 1.7, marginBottom: 32,
          }}>
            Join thousands of users building better financial habits with WealthAI.
            Set up your account in under 2 minutes — completely free.
          </p>
          <button
            onClick={() => navigate('/login')}
            style={{
              padding: '14px 44px', borderRadius: 14, fontWeight: 800, fontSize: 16,
              background: 'linear-gradient(135deg, #0D9488, #4F46E5)',
              color: 'white', border: 'none', cursor: 'pointer',
              fontFamily: 'Outfit, sans-serif',
              boxShadow: '0 8px 30px rgba(13,148,136,0.35)',
            }}
          >
            Get Started Free →
          </button>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────────── */}
      <footer style={{
        position: 'relative', zIndex: 1,
        textAlign: 'center', padding: '24px 20px',
        borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'}`,
        color: isDark ? '#4b5563' : '#9ca3af', fontSize: 13,
      }}>
        <p>
          WealthAI · Built with ❤️ as a Capstone Project ·{' '}
          <span style={{ color: '#0D9488', cursor: 'pointer' }} onClick={() => navigate('/login')}>
            Launch App
          </span>
        </p>
      </footer>
    </div>
  );
}
