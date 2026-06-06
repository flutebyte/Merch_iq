import React from 'react';
import { LayoutDashboard, Package, ClipboardList, Camera, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useBrand } from '../contexts/BrandContext';

const navItems = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { id: 'inventory', icon: Package, label: 'Inventory' },
  { id: 'actions', icon: ClipboardList, label: 'Action Center' },
  { id: 'photo', icon: Camera, label: 'Add via Photo' },
];

export default function Sidebar({ current, onNavigate, onReset }) {
  const { user, logout } = useAuth();
  const { brand } = useBrand();

  const displayName = brand?.name || user?.email?.split('@')[0] || 'You';
  const initial = displayName.charAt(0).toUpperCase();

  const handleLogout = () => {
    logout();
  };

  return (
    <div style={{
      width: 'var(--sidebar-w)', flexShrink: 0,
      background: 'var(--surface)', borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', height: '100vh',
      position: 'sticky', top: 0
    }}>
      {/* Logo */}
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, lineHeight: 1 }}>
          Adaptive<br /><em style={{ color: 'var(--accent)' }}>Inventory</em>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = current === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
                borderRadius: 8, cursor: 'pointer', transition: 'all 0.12s ease',
                background: isActive ? 'var(--surface2)' : 'transparent',
                border: `1px solid ${isActive ? 'var(--border2)' : 'transparent'}`,
                color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                width: '100%', textAlign: 'left'
              }}
              onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.color = 'var(--text-primary)'; } }}
              onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; } }}
            >
              <Icon size={15} />
              <span style={{ fontSize: 13, fontWeight: isActive ? 500 : 400, flex: 1 }}>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* User */}
      <div style={{ padding: '12px 10px', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', marginBottom: 4 }}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
            background: 'var(--accent-dim)', border: '1px solid var(--accent-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, color: 'var(--accent)'
          }}>{initial}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{user?.email}</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', width: '100%',
            color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', borderRadius: 6,
            background: 'none', border: 'none', transition: 'all 0.1s ease'
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
