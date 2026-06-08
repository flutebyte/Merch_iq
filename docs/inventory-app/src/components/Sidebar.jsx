import React, { useEffect, useRef } from 'react';
import { LayoutDashboard, Package, ClipboardList, Camera, LogOut, BarChart2, TrendingUp, Settings, Plug } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useBrand } from '../contexts/BrandContext';
import { useFetch } from '../hooks/useApi';

export default function Sidebar({ current, onNavigate, onReset }) {
  const { user, logout }                          = useAuth();
  const { brand }                                 = useBrand();
  const { data: actionData, refetch: refetchAQ }  = useFetch('/action-queue');

  // Always reflect the latest refetch function without re-registering the event listener
  const refetchRef = useRef(refetchAQ);
  useEffect(() => { refetchRef.current = refetchAQ; }, [refetchAQ]);

  useEffect(() => {
    const handler = () => refetchRef.current?.();
    window.addEventListener('inv:mutation', handler);
    return () => window.removeEventListener('inv:mutation', handler);
  }, []);

  const displayName = brand?.name || user?.email?.split('@')[0] || 'You';
  const initial     = displayName.charAt(0).toUpperCase();
  const actionCount = actionData?.total || 0;

  const navItems = [
    { id: 'dashboard',          icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'inventory',          icon: Package,         label: 'Inventory' },
    { id: 'actions',            icon: ClipboardList,   label: 'Action Center', badge: actionCount },
    { id: 'sales',              icon: BarChart2,       label: 'Sales' },
    { id: 'sales-intelligence', icon: TrendingUp,      label: 'Intelligence' },
    { id: 'photo',              icon: Camera,          label: 'Add via Photo' },
    { id: 'integrations',       icon: Plug,            label: 'Integrations' },
  ];

  return (
    <div
      className="sidebar-desktop"
      style={{
        width: 'var(--sidebar-w)', flexShrink: 0,
        background: 'var(--surface)', borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', height: '100vh',
        position: 'sticky', top: 0,
      }}
    >
      {/* Brand */}
      <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 7, background: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0,
          }}>
            {initial}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {displayName}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Inventory</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 1, overflowY: 'auto' }}>
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = current === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px',
                borderRadius: 7, cursor: 'pointer', transition: 'all 0.1s ease',
                background: isActive ? 'var(--accent-dim)' : 'transparent',
                border: `1px solid ${isActive ? 'var(--accent-border)' : 'transparent'}`,
                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                width: '100%', textAlign: 'left',
              }}
              onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.color = 'var(--text-primary)'; } }}
              onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; } }}
            >
              <Icon size={15} />
              <span style={{ fontSize: 13, fontWeight: isActive ? 600 : 400, flex: 1 }}>{item.label}</span>
              {item.badge > 0 && (
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 100,
                  background: isActive ? 'var(--accent)' : 'var(--danger)',
                  color: '#fff', minWidth: 16, textAlign: 'center', flexShrink: 0,
                }}>
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* User footer */}
      <div style={{ padding: '10px 8px', borderTop: '1px solid var(--border)' }}>
        {/* Settings button */}
        <button
          onClick={() => onNavigate('settings')}
          style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '7px 10px', width: '100%',
            color: current === 'settings' ? 'var(--accent)' : 'var(--text-muted)',
            background: current === 'settings' ? 'var(--accent-dim)' : 'none',
            border: current === 'settings' ? '1px solid var(--accent-border)' : '1px solid transparent',
            fontSize: 12, cursor: 'pointer', borderRadius: 6, marginBottom: 2,
            fontFamily: 'var(--font-body)', transition: 'all 0.1s ease',
          }}
          onMouseEnter={e => { if (current !== 'settings') { e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.color = 'var(--text-primary)'; } }}
          onMouseLeave={e => { if (current !== 'settings') { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted)'; } }}
        >
          <Settings size={13} /> Settings
        </button>

        {/* User email */}
        <div style={{ padding: '6px 10px', marginBottom: 2 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.email}
          </div>
        </div>

        {/* Sign out */}
        <button
          onClick={logout}
          style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '7px 10px', width: '100%',
            color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', borderRadius: 6,
            background: 'none', border: 'none', transition: 'all 0.1s ease', fontFamily: 'var(--font-body)',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.background = 'var(--danger-dim)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'none'; }}
        >
          <LogOut size={13} /> Sign out
        </button>
      </div>
    </div>
  );
}
