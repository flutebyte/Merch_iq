import React, { useEffect, useState } from 'react';
import { LayoutDashboard, Package, ClipboardList, BarChart2, Camera, MoreHorizontal, TrendingUp, Settings, Plug, LogOut, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const NAV_ITEMS = [
  { id: 'dashboard',  icon: LayoutDashboard, label: 'Home' },
  { id: 'inventory',  icon: Package,          label: 'Inventory' },
  { id: 'actions',    icon: ClipboardList,    label: 'Actions' },
  { id: 'sales',      icon: BarChart2,        label: 'Sales' },
  { id: 'photo',      icon: Camera,           label: 'Add' },
];

const MORE_ITEMS = [
  { id: 'sales-intelligence', icon: TrendingUp, label: 'Intelligence' },
  { id: 'integrations',       icon: Plug,       label: 'Integrations' },
  { id: 'settings',           icon: Settings,   label: 'Settings' },
];

export default function MobileBottomNav({ current, onNavigate, actionCount = 0 }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const { user, logout } = useAuth();

  useEffect(() => {
    if (!moreOpen) return;
    const onKeyDown = (e) => { if (e.key === 'Escape') setMoreOpen(false); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [moreOpen]);

  const isMoreActive = MORE_ITEMS.some(item => item.id === current);

  return (
    <>
      {moreOpen && (
        <div
          role="presentation"
          onClick={() => setMoreOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 149, background: 'rgba(0,0,0,0.5)' }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="More navigation options"
            onClick={e => e.stopPropagation()}
            style={{
              position: 'fixed', bottom: 64, left: 0, right: 0, zIndex: 150,
              background: 'var(--surface)', borderTop: '1px solid var(--border)',
              borderRadius: '14px 14px 0 0', padding: '8px 8px calc(8px + env(safe-area-inset-bottom, 0px))',
              boxShadow: '0 -8px 32px rgba(0,0,0,0.5)', animation: 'fadeIn 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px 4px' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.email}
              </span>
              <button
                onClick={() => setMoreOpen(false)}
                aria-label="Close menu"
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, display: 'flex' }}
              >
                <X size={16} />
              </button>
            </div>

            {MORE_ITEMS.map(item => {
              const Icon = item.icon;
              const isActive = current === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => { setMoreOpen(false); onNavigate(item.id); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '11px 10px',
                    background: isActive ? 'var(--accent-dim)' : 'none', border: 'none', borderRadius: 8,
                    color: isActive ? 'var(--accent)' : 'var(--text-secondary)', fontSize: 14, cursor: 'pointer',
                    fontFamily: 'var(--font-body)', textAlign: 'left',
                  }}
                >
                  <Icon size={16} /> {item.label}
                </button>
              );
            })}

            <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0' }} />

            <button
              onClick={() => { setMoreOpen(false); logout(); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '11px 10px',
                background: 'none', border: 'none', borderRadius: 8,
                color: 'var(--danger)', fontSize: 14, cursor: 'pointer', fontFamily: 'var(--font-body)', textAlign: 'left',
              }}
            >
              <LogOut size={16} /> Sign out
            </button>
          </div>
        </div>
      )}

      <div
        className="mobile-bottom-nav"
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
          background: 'var(--surface)', borderTop: '1px solid var(--border)',
          display: 'flex', height: 64,
          boxShadow: '0 -4px 24px rgba(0,0,0,0.5)',
        }}
      >
        {NAV_ITEMS.map(item => {
          const Icon = item.icon;
          const isActive = current === item.id;
          const showBadge = item.id === 'actions' && actionCount > 0;

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: 3, background: 'none', border: 'none',
                cursor: 'pointer', position: 'relative', padding: '8px 4px',
                transition: 'opacity 0.1s',
              }}
            >
              <div style={{ position: 'relative' }}>
                <Icon size={20} color={isActive ? 'var(--accent)' : 'var(--text-muted)'} />
                {showBadge && (
                  <span style={{
                    position: 'absolute', top: -4, right: -6,
                    fontSize: 9, fontWeight: 700, padding: '1px 4px', borderRadius: 100,
                    background: 'var(--danger)', color: '#fff', minWidth: 14, textAlign: 'center',
                  }}>
                    {actionCount > 9 ? '9+' : actionCount}
                  </span>
                )}
              </div>
              <span style={{ fontSize: 10, fontWeight: isActive ? 600 : 400, color: isActive ? 'var(--accent)' : 'var(--text-muted)' }}>
                {item.label}
              </span>
            </button>
          );
        })}

        <button
          onClick={() => setMoreOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 3, background: 'none', border: 'none',
            cursor: 'pointer', position: 'relative', padding: '8px 4px',
            transition: 'opacity 0.1s',
          }}
        >
          <MoreHorizontal size={20} color={isMoreActive ? 'var(--accent)' : 'var(--text-muted)'} />
          <span style={{ fontSize: 10, fontWeight: isMoreActive ? 600 : 400, color: isMoreActive ? 'var(--accent)' : 'var(--text-muted)' }}>
            More
          </span>
        </button>
      </div>
    </>
  );
}
