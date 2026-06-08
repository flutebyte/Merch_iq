import React from 'react';
import { LayoutDashboard, Package, ClipboardList, BarChart2, Camera } from 'lucide-react';

const NAV_ITEMS = [
  { id: 'dashboard',  icon: LayoutDashboard, label: 'Home' },
  { id: 'inventory',  icon: Package,          label: 'Inventory' },
  { id: 'actions',    icon: ClipboardList,    label: 'Actions' },
  { id: 'sales',      icon: BarChart2,        label: 'Sales' },
  { id: 'photo',      icon: Camera,           label: 'Add' },
];

export default function MobileBottomNav({ current, onNavigate, actionCount = 0 }) {
  return (
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
    </div>
  );
}
