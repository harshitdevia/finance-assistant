import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Alert, 
  CircularProgress
} from '@mui/material';
import { 
  AccountBalanceWallet,
  Person,
  Email,
  Lock
} from '@mui/icons-material';

export default function LoginRegister() {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const canvasRef = useRef(null);

  // Dynamic Silk Wave Animation Canvas Logic (Confined to the Left Branding Panel)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const ctx = canvas.getContext('2d');
    
    let animationFrameId;
    let width = (canvas.width = parent.clientWidth || window.innerWidth * 0.55);
    let height = (canvas.height = parent.clientHeight || window.innerHeight);

    const handleResize = () => {
      if (!canvas || !parent) return;
      width = canvas.width = parent.clientWidth;
      height = canvas.height = parent.clientHeight;
    };
    window.addEventListener('resize', handleResize);

    const drawSilkWave = (ctx, width, height, time, yBase, amplitude, lineCount, colorGrad, glowColor) => {
      ctx.save();
      ctx.shadowBlur = 4;
      ctx.shadowColor = glowColor;

      for (let i = 0; i < lineCount; i++) {
        ctx.beginPath();
        const offset = i * 0.05 + time;
        
        for (let x = 0; x <= width; x += 15) {
          const y = yBase + 
            Math.sin(x * 0.0015 + offset) * amplitude + 
            Math.sin(x * 0.003 - offset * 0.5) * (amplitude * 0.3) +
            i * 1.5;
          
          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        
        ctx.strokeStyle = colorGrad;
        ctx.lineWidth = 1.3;
        ctx.stroke();
      }
      ctx.restore();
    };

    const draw = () => {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);

      const time = Date.now() * 0.0006;

      // 1. Top Wave Bundle: Teal Silk
      const goldGrad = ctx.createLinearGradient(0, 0, width, 0);
      goldGrad.addColorStop(0, 'rgba(45, 212, 191, 0.0)');
      goldGrad.addColorStop(0.3, 'rgba(45, 212, 191, 0.55)');
      goldGrad.addColorStop(0.7, 'rgba(13, 148, 136, 0.45)');
      goldGrad.addColorStop(1, 'rgba(13, 148, 136, 0.0)');
      drawSilkWave(ctx, width, height, time, height * 0.20, 30, 9, goldGrad, 'rgba(45, 212, 191, 0.30)');

      // 2. Middle Wave Bundle: Indigo Silk
      const copperGrad = ctx.createLinearGradient(0, 0, width, 0);
      copperGrad.addColorStop(0, 'rgba(99, 102, 241, 0.0)');
      copperGrad.addColorStop(0.4, 'rgba(129, 140, 248, 0.45)');
      copperGrad.addColorStop(0.8, 'rgba(99, 102, 241, 0.4)');
      copperGrad.addColorStop(1, 'rgba(99, 102, 241, 0.0)');
      drawSilkWave(ctx, width, height, time * 0.88 - 20, height * 0.45, 38, 8, copperGrad, 'rgba(129, 140, 248, 0.25)');

      // 3. Bottom Wave Bundle: Slate Silk
      const tealGrad = ctx.createLinearGradient(0, 0, width, 0);
      tealGrad.addColorStop(0, 'rgba(148, 163, 184, 0.0)');
      tealGrad.addColorStop(0.4, 'rgba(148, 163, 184, 0.45)');
      tealGrad.addColorStop(0.8, 'rgba(100, 116, 139, 0.4)');
      tealGrad.addColorStop(1, 'rgba(100, 116, 139, 0.0)');
      drawSilkWave(ctx, width, height, time * 0.78 + 40, height * 0.70, 45, 10, tealGrad, 'rgba(148, 163, 184, 0.30)');

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!formData.email || !formData.password) {
      setError('Please fill in all required fields.');
      return;
    }
    if (!isLogin && !formData.username) {
      setError('Username is required for registration.');
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        await login(formData.email, formData.password);
      } else {
        await register(formData.username, formData.email, formData.password);
      }
      navigate('/'); 
    } catch (err) {
      setError(err.response?.data?.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const textTitleColor = 'text-slate-900';
  const textSubColor = 'text-slate-500';

  const inputBorder = 'border-slate-300';
  const inputFocus = 'focus:border-teal-600 focus:ring-teal-600/10';
  const inputTextColor = 'text-slate-900';
  const inputPlaceholderColor = 'placeholder:text-slate-400';
  
  const customInputStyle = `w-full pl-11 pr-4 py-3 bg-transparent border rounded-xl outline-none transition-all focus:ring-4 ${inputBorder} ${inputFocus} ${inputTextColor} ${inputPlaceholderColor}`;

  return (
    <div className="min-h-screen flex flex-col md:flex-row relative overflow-hidden">
      
      {/* LEFT COLUMN: Premium SaaS Showcase / Teaser (Navy, Visible on desktop) */}
      <div className="hidden md:flex md:w-[55%] bg-gradient-to-br from-[#0B1120] via-[#0F1A2E] to-[#0B1120] relative flex-col justify-between p-12 overflow-hidden border-r border-white/10">
        {/* Animated Background Canvas */}
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none opacity-70 z-0" />

        {/* Subtle Grid overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.01] bg-[linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:32px_32px] z-0" />

        {/* Ambient Glows */}
        <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] rounded-full blur-[130px] pointer-events-none" style={{ backgroundColor: 'rgba(45, 212, 191, 0.05)' }} />
        <div className="absolute bottom-[-10%] right-[-10%] w-[35vw] h-[35vw] rounded-full blur-[130px] pointer-events-none" style={{ backgroundColor: 'rgba(99, 102, 241, 0.05)' }} />

        {/* Top Header Logo */}
        <div className="flex items-center gap-3.5 z-10">
          <div className="relative flex items-center justify-center">
            {/* Concentric Logo Rings */}
            <div className="absolute w-12 h-12 rounded-full border border-dashed border-teal-400/25 animate-[spin_20s_linear_infinite]" />
            <div className="absolute w-14 h-14 rounded-full border border-dashed border-indigo-400/15 animate-[spin_30s_linear_infinite_reverse]" />

            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-brand-teal to-brand-indigo text-white shadow-lg neon-glow-teal z-10">
              <AccountBalanceWallet fontSize="medium" />
            </div>
          </div>
          <span className="text-2xl font-extrabold tracking-tight text-white">
            Wealth<span className="text-brand-teal">AI</span>
          </span>
        </div>

        {/* Middle Tagline / Teaser content */}
        <div className="my-auto z-10 max-w-lg">
          <h2 className="text-4xl font-extrabold text-white leading-tight tracking-tight">
            Take Control of Your <br />
            <span className="bg-gradient-to-r from-teal-300 via-cyan-300 to-indigo-300 bg-clip-text text-transparent">
              Wealth Intelligence
            </span>
          </h2>
          <p className="text-gray-400 mt-4 leading-relaxed text-sm">
            Access institutional-grade portfolio tracking, automated machine learning classification, savings goal simulations, and real-time AI advisory in one unified workspace.
          </p>

          {/* Interactive Mockup Dashboard Teaser */}
          <div className="mt-8 p-6 rounded-2xl glass-card-dark border border-white/5 w-full max-w-md backdrop-blur-md shadow-2xl relative overflow-hidden group">
            {/* Gloss light strip reflect */}
            <div className="absolute top-0 -left-[100%] w-[50%] h-full bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-12 transition-all duration-1000 group-hover:left-[150%] pointer-events-none" />

            <div className="flex justify-between items-center mb-4">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold">Live Portfolio Valuation</span>
                <h3 className="text-2xl font-bold text-white mt-0.5">₹14,25,800.00</h3>
              </div>
              <span className="bg-emerald-500/10 text-emerald-400 text-xs px-2.5 py-0.5 rounded-full font-bold border border-emerald-500/20">
                +12.4%
              </span>
            </div>

            {/* Vector Sparkline */}
            <div className="h-14 flex items-end gap-1.5 mb-5 px-1">
              <svg viewBox="0 0 100 30" className="w-full h-full text-emerald-400" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                <path d="M0,25 Q15,10 30,18 T60,4 T90,14 T100,2" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M0,25 Q15,10 30,18 T60,4 T90,14 T100,2 L100,30 L0,30 Z" fill="url(#chartGrad)" />
              </svg>
            </div>

            {/* Assets Allocation bars */}
            <div className="space-y-3 mb-5 text-[11px] text-gray-300">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="font-semibold text-white">Equity & Mutual Funds</span>
                  <span>60%</span>
                </div>
                <div className="w-full bg-white/5 rounded-full h-1">
                  <div className="bg-emerald-500 h-1 rounded-full" style={{ width: '60%' }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="font-semibold text-white">Fixed Deposits & Debt</span>
                  <span>25%</span>
                </div>
                <div className="w-full bg-white/5 rounded-full h-1">
                  <div className="bg-amber-500 h-1 rounded-full" style={{ width: '25%' }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="font-semibold text-white">Gold & FDs</span>
                  <span>15%</span>
                </div>
                <div className="w-full bg-white/5 rounded-full h-1">
                  <div className="bg-yellow-400 h-1 rounded-full" style={{ width: '15%' }} />
                </div>
              </div>
            </div>

            {/* Activity Ticker Feed */}
            <div className="border-t border-white/5 pt-4 space-y-2 text-[10px] text-gray-400">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>💰 Live sync: Portfolio values updated successfully</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span>🤖 AI Advisor: Asset rebalancing threshold advice ready</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer legal placeholder */}
        <div className="text-gray-500 text-xs z-10">
          © {new Date().getFullYear()} WealthAI. All rights reserved. Secured with SSL.
        </div>
      </div>

      {/* RIGHT COLUMN: Glassmorphic Form Column (Always forced Light Mode) */}
      <div className="w-full md:w-[45%] flex items-center justify-center p-6 relative"
        style={{
          background: 'linear-gradient(145deg, rgba(248,250,252,0.92) 0%, rgba(241,245,249,0.85) 50%, rgba(226,232,240,0.8) 100%)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >

        {/* Decorative Grid for Light Form Column */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.015] bg-[linear-gradient(to_right,rgba(15,23,42,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.08)_1px,transparent_1px)] bg-[size:32px_32px]" />

        <div className="w-full max-w-md z-10">
          {/* Mobile Header (Hidden on desktop) */}
          <div className="flex flex-col items-center mb-8 md:hidden">
            <div className="relative mb-3 flex items-center justify-center">
              <div className="absolute w-16 h-16 rounded-full border border-dashed border-teal-500/25 animate-[spin_20s_linear_infinite]" />
              <div className="p-3 rounded-xl bg-gradient-to-tr from-brand-teal to-brand-indigo text-white shadow-lg z-10">
                <AccountBalanceWallet fontSize="medium" />
              </div>
            </div>
            <h1 className={`text-2xl font-extrabold tracking-tight ${textTitleColor}`}>
              Wealth<span className="text-brand-teal">AI</span>
            </h1>
            <p className={`text-xs mt-1 ${textSubColor}`}>
              Your AI-Powered Personal Finance Assistant
            </p>
          </div>

          {/* Card Form Container */}
          <div className="p-8 glass-login-card glass-login-card-light border border-slate-200 transition-all duration-300 relative group overflow-hidden shadow-xl">
            {/* Shimmer reflecting strips */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-transparent via-white/10 to-white/20 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="absolute top-0 -left-[100%] w-[50%] h-full bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12 transition-all duration-1000 group-hover:left-[150%] pointer-events-none" />

            <h2 className={`text-2xl font-bold mb-2 text-center ${textTitleColor}`}>
              {isLogin ? 'Welcome Back' : 'Create Account'}
            </h2>
            <p className={`text-xs text-center mb-6 ${textSubColor}`}>
              {isLogin ? 'Access your financial intelligence dashboard' : 'Start your personal wealth-building journey'}
            </p>

            {error && (
              <Alert severity="error" className="mb-6 rounded-xl">
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {!isLogin && (
                <div className="relative group">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-teal-600 transition-colors">
                    <Person fontSize="small" />
                  </span>
                  <input
                    type="text"
                    name="username"
                    placeholder="Username"
                    required
                    value={formData.username}
                    onChange={handleInputChange}
                    className={customInputStyle}
                  />
                </div>
              )}

              <div className="relative group">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-teal-600 transition-colors">
                  <Email fontSize="small" />
                </span>
                <input
                  type="email"
                  name="email"
                  placeholder="Email Address"
                  required
                  value={formData.email}
                  onChange={handleInputChange}
                  className={customInputStyle}
                />
              </div>

              <div className="relative group">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-teal-600 transition-colors">
                  <Lock fontSize="small" />
                </span>
                <input
                  type="password"
                  name="password"
                  placeholder="Password"
                  required
                  value={formData.password}
                  onChange={handleInputChange}
                  className={customInputStyle}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 mt-4 text-white font-bold rounded-xl btn-primary flex items-center justify-center cursor-pointer select-none border-none"
              >
                {loading ? (
                  <CircularProgress size={24} color="inherit" />
                ) : isLogin ? (
                  'Sign In'
                ) : (
                  'Sign Up'
                )}
              </button>
            </form>

            {/* Toggle form footer link */}
            <div className="mt-6 text-center relative z-10">
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError('');
                }}
                className="text-sm font-semibold hover:underline transition-colors focus:outline-none bg-transparent border-none cursor-pointer"
                style={{ color: '#0D9488' }}
              >
                {isLogin ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
