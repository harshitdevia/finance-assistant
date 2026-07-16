import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import AnimatedBackground from './components/AnimatedBackground';
import LoginRegister from './pages/LoginRegister';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Chatbot from './pages/Chatbot';
import Budgets from './pages/Budgets';
import Profile from './pages/Profile';
import Reports from './pages/Reports';
import Portfolio from './pages/Portfolio';
import Goals from './pages/Goals';
import Subscriptions from './pages/Subscriptions';
import Landing from './pages/Landing';
import { CircularProgress } from '@mui/material';

// Router guard to protect private pages
const PrivateRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <CircularProgress color="inherit" />
        <p style={{ fontSize: 14, color: '#6b7280' }}>Checking auth credentials...</p>
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

// Layout container for sidebar + responsive pages
// Background is transparent so the global AnimatedBackground layer shows through
const MainLayout = ({ children }) => {
  const { theme } = useTheme();

  return (
    <div
      className={`min-h-screen flex flex-row transition-colors duration-500 relative ${
        theme === 'dark' ? 'text-slate-100' : 'text-slate-900'
      }`}
      style={{ background: 'transparent' }}
    >
      <Sidebar />
      {/* On mobile, Sidebar renders a fixed top-bar (56px) + no bottom nav, so pb-6 is enough.
          On desktop, Navbar sits above <main> in this column (it's hidden on mobile itself). */}
      <div className="flex flex-col flex-1 min-w-0">
        <Navbar />
        <main className="flex-1 p-4 md:p-8 pb-8 overflow-x-hidden relative z-[1] min-w-0">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

// Helper to make protected routes cleaner
const ProtectedPage = ({ component: Component }) => (
  <PrivateRoute>
    <MainLayout>
      <Component />
    </MainLayout>
  </PrivateRoute>
);

// Root route: show Landing to guests, redirect logged-in users to /dashboard
const LandingOrDashboard = () => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress color="inherit" />
      </div>
    );
  }
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <Landing />;
};

// Inner app — needs ThemeProvider in scope for AnimatedBackground
function ThemedApp() {
  const { theme } = useTheme();
  return (
    // Apply dark class to html root here via ThemeContext, and set bg on this wrapper
    <div
      className="relative min-h-screen"
      style={{ isolation: 'isolate', background: 'transparent' }}
    >
      {/* ── Global animated background — fixed, z-index 0, covers ALL pages ── */}
      <AnimatedBackground />

      {/* ── All routes sit above the background (z-index 1+) ──────────── */}
      <div className="relative" style={{ zIndex: 1 }}>
        <AuthProvider>
          <ToastProvider>
            <Routes>
              {/* Public pages */}
              <Route path="/" element={<LandingOrDashboard />} />
              <Route path="/landing" element={<Landing />} />
              <Route path="/login" element={<LoginRegister />} />

              {/* Protected routes */}
              <Route path="/dashboard" element={<ProtectedPage component={Dashboard} />} />
              <Route path="/transactions" element={<ProtectedPage component={Transactions} />} />
              <Route path="/chatbot" element={<ProtectedPage component={Chatbot} />} />
              <Route path="/budgets" element={<ProtectedPage component={Budgets} />} />
              <Route path="/portfolio" element={<ProtectedPage component={Portfolio} />} />
              <Route path="/goals" element={<ProtectedPage component={Goals} />} />
              <Route path="/subscriptions" element={<ProtectedPage component={Subscriptions} />} />
              <Route path="/reports" element={<ProtectedPage component={Reports} />} />
              <Route path="/profile" element={<ProtectedPage component={Profile} />} />

              {/* Catch-all redirect */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ToastProvider>
        </AuthProvider>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <ThemeProvider>
        <ThemedApp />
      </ThemeProvider>
    </Router>
  );
}
