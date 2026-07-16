import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef({});

  const removeToast = useCallback((id) => {
    clearTimeout(timersRef.current[id]);
    delete timersRef.current[id];
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((message, type = 'success', duration = 3500) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type, duration }]);
    timersRef.current[id] = setTimeout(() => {
      delete timersRef.current[id];
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration + 400); // extra 400ms for exit animation
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
};

// Toast icons map
const ICONS = {
  success: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  error: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  warning: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  info: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
};

const TYPE_STYLES = {
  success: {
    bg: 'rgba(22,163,74,0.12)',
    border: 'rgba(22,163,74,0.35)',
    icon: '#16A34A',
    bar: '#16A34A',
  },
  error: {
    bg: 'rgba(239,68,68,0.12)',
    border: 'rgba(239,68,68,0.35)',
    icon: '#ef4444',
    bar: '#ef4444',
  },
  warning: {
    bg: 'rgba(245,158,11,0.12)',
    border: 'rgba(245,158,11,0.35)',
    icon: '#f59e0b',
    bar: '#f59e0b',
  },
  info: {
    bg: 'rgba(79,70,229,0.12)',
    border: 'rgba(79,70,229,0.35)',
    icon: '#4F46E5',
    bar: '#4F46E5',
  },
};

// Internal toast container rendered inside provider
function ToastContainer({ toasts, removeToast }) {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        maxWidth: '360px',
        width: '100%',
        pointerEvents: 'none',
      }}
    >
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          toast={toast}
          onRemove={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
}

function Toast({ toast, onRemove }) {
  const { message, type = 'success', duration = 3500 } = toast;
  const styles = TYPE_STYLES[type] || TYPE_STYLES.success;

  return (
    <div
      className="toast-enter"
      style={{
        pointerEvents: 'auto',
        background: 'rgba(17, 24, 39, 0.92)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: `1px solid ${styles.border}`,
        borderRadius: '14px',
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        overflow: 'hidden',
        position: 'relative',
        cursor: 'pointer',
        animation: 'toastSlideIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
      }}
      onClick={onRemove}
    >
      {/* Icon badge */}
      <div style={{
        width: '32px',
        height: '32px',
        borderRadius: '8px',
        background: styles.bg,
        border: `1px solid ${styles.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: styles.icon,
        flexShrink: 0,
        marginTop: '1px',
      }}>
        {ICONS[type] || ICONS.success}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: 0,
          color: '#f9fafb',
          fontSize: '13.5px',
          fontWeight: 500,
          lineHeight: 1.5,
          fontFamily: 'Inter, sans-serif',
          wordBreak: 'break-word',
        }}>
          {message}
        </p>
      </div>

      {/* Close X */}
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        style={{
          background: 'none',
          border: 'none',
          color: 'rgba(156,163,175,0.7)',
          cursor: 'pointer',
          padding: '0',
          lineHeight: 1,
          flexShrink: 0,
          marginTop: '2px',
          fontSize: '16px',
        }}
      >
        ×
      </button>

      {/* Progress bar */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        height: '3px',
        background: styles.bar,
        borderRadius: '0 0 14px 14px',
        animation: `toastProgress ${duration}ms linear forwards`,
      }} />
    </div>
  );
}
