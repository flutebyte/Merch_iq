import React, { createContext, useContext, useCallback, useRef, useState } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

const ToastContext = createContext(null);

const VARIANT_STYLE = {
  error:   { icon: AlertCircle,   color: 'var(--danger)',  bg: 'var(--danger-dim)',  border: 'rgba(248,113,113,0.3)' },
  success: { icon: CheckCircle2,  color: 'var(--success)', bg: 'var(--success-dim)', border: 'rgba(52,211,153,0.3)' },
};

let nextId = 1;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const dismiss = useCallback((id) => {
    setToasts(t => t.filter(x => x.id !== id));
    clearTimeout(timers.current[id]);
    delete timers.current[id];
  }, []);

  const showToast = useCallback((message, { variant = 'error', duration = 5000 } = {}) => {
    const id = nextId++;
    setToasts(t => [...t, { id, message, variant }]);
    timers.current[id] = setTimeout(() => dismiss(id), duration);
    return id;
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ showToast, dismiss }}>
      {children}
      <div
        style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          zIndex: 1100, display: 'flex', flexDirection: 'column', gap: 8,
          width: 'min(420px, calc(100vw - 32px))', pointerEvents: 'none',
        }}
        className="toast-stack"
      >
        {toasts.map(t => {
          const meta = VARIANT_STYLE[t.variant] || VARIANT_STYLE.error;
          const Icon = meta.icon;
          return (
            <div
              key={t.id}
              role="alert"
              aria-live="assertive"
              style={{
                pointerEvents: 'auto', display: 'flex', alignItems: 'flex-start', gap: 10,
                background: 'var(--surface2)', border: `1px solid ${meta.border}`,
                borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)',
                padding: '12px 14px', animation: 'fadeIn 0.15s ease',
              }}
            >
              <Icon size={16} color={meta.color} style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                {t.message}
              </div>
              <button
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 2,
                  color: 'var(--text-muted)', flexShrink: 0, display: 'flex',
                }}
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
