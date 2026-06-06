import React from 'react';
import {
  TrendingDown, AlertTriangle, Zap, ClipboardList, ArrowRight,
  TrendingUp, Package, Eye
} from 'lucide-react';
import { useFetch } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';
import { useBrand } from '../contexts/BrandContext';

function mapProduct(p) {
  const lots = p.stockLots || [];
  const totalQty = lots.reduce((sum, l) => sum + (l.quantity || 0), 0);
  const hasConflict = lots.some(l => l.confidenceState === 'conflict_detected');
  const hasVerified = lots.some(l => ['count_verified', 'sales_reconciled'].includes(l.confidenceState));
  const status = hasConflict ? 'unverified' : hasVerified ? 'verified' : 'draft';
  const missingDetails = [];
  if (!p.name) missingDetails.push('name');
  if (!p.sellingPrice) missingDetails.push('price');
  if (!totalQty && lots.length > 0) missingDetails.push('quantity');
  // Dead stock: has stock but all lots are unverified/photo-only and no price set
  const isDeadStock = totalQty > 0 && !p.sellingPrice && status !== 'verified';
  const stuckValue = isDeadStock && p.costPrice ? totalQty * parseFloat(p.costPrice) : null;
  return { ...p, status, missingDetails, quantity: totalQty || null, price: p.sellingPrice ? parseFloat(p.sellingPrice) : null, isDeadStock, stuckValue };
}

const fmt = (n) => n == null ? '—' : `₹${n >= 100000 ? (n / 100000).toFixed(1) + 'L' : n.toLocaleString('en-IN')}`;

const MetricCard = ({ icon: Icon, label, value, sub, color, accent, onClick }) => (
  <button
    onClick={onClick}
    style={{
      background: 'var(--surface)', border: `1px solid var(--border)`,
      borderRadius: 'var(--radius-lg)', padding: '20px', textAlign: 'left',
      cursor: onClick ? 'pointer' : 'default', transition: 'all 0.15s ease', width: '100%',
      position: 'relative', overflow: 'hidden'
    }}
    onMouseEnter={e => { if (onClick) { e.currentTarget.style.borderColor = accent || 'var(--border2)'; e.currentTarget.style.background = 'var(--surface2)'; } }}
    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surface)'; }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
      <div style={{
        width: 36, height: 36, borderRadius: 8, background: `${color}18`,
        border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <Icon size={16} color={color} />
      </div>
      {onClick && <ArrowRight size={14} color="var(--text-muted)" />}
    </div>
    <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-mono)', color, lineHeight: 1 }}>{value}</div>
    <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500, marginTop: 6 }}>{label}</div>
    {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
  </button>
);

export default function Dashboard({ onNavigate }) {
  const { user } = useAuth();
  const { brand } = useBrand();
  const { data: rawProducts, loading } = useFetch('/products');
  const products     = (rawProducts || []).map(mapProduct);
  const pendingActionsList = [];  // populated from API in Phase 2

  const atRisk         = products.filter(p => p.missingDetails.length > 0 || p.status !== 'verified').length;
  const deadStockValue = products.filter(p => p.isDeadStock && p.stuckValue).reduce((s, p) => s + p.stuckValue, 0);
  const deadStockCount = products.filter(p => p.isDeadStock).length;
  const pendingActions = pendingActionsList.length;

  return (
    <div style={{ padding: '28px 24px', maxWidth: 1100, margin: '0 auto', animation: 'fadeIn 0.3s ease' }}>
      {/* Header */}
      <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 36, lineHeight: 1 }}>
            Good morning, <em style={{ color: 'var(--accent)' }}>{brand?.name || user?.email?.split('@')[0] || 'there'}</em>
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>
            {loading ? 'Loading…' : `${products.length} product${products.length !== 1 ? 's' : ''} in your inventory`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={() => onNavigate('photo')}>
            <Package size={14} /> Add products
          </button>
          <button className="btn btn-primary" onClick={() => onNavigate('inventory')}>
            <Eye size={14} /> View inventory
          </button>
        </div>
      </div>

      {/* Recovery banner */}
      {deadStockValue > 0 && (
        <div style={{
          padding: '16px 20px', marginBottom: 28,
          background: 'linear-gradient(135deg, rgba(232,197,71,0.08) 0%, rgba(232,197,71,0.03) 100%)',
          border: '1px solid var(--accent-border)', borderRadius: 'var(--radius-lg)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
          animation: 'slideUp 0.4s ease'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={18} color="#0D0D0B" />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>
                <span style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{fmt(deadStockValue)}</span>
                {' '}in potential recovery available
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{deadStockCount} dead stock products identified · Take action now</div>
            </div>
          </div>
          <button className="btn btn-primary" style={{ fontSize: 12, padding: '8px 16px' }} onClick={() => onNavigate('actions')}>
            Review opportunities <ArrowRight size={13} />
          </button>
        </div>
      )}

      {/* Main metric cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
        <MetricCard
          icon={AlertTriangle} label="Inventory At Risk" color="var(--danger)"
          value={atRisk} sub={`${atRisk} products can't be sold`}
          accent="var(--danger)" onClick={() => onNavigate('inventory')}
        />
        <MetricCard
          icon={TrendingUp} label="Potential Recovery" color="var(--success)"
          value={fmt(deadStockValue)} sub={`Across ${deadStockCount} dead stock items`}
          accent="var(--success)" onClick={() => onNavigate('actions')}
        />
        <MetricCard
          icon={TrendingDown} label="Dead Stock Opportunity" color="var(--warning)"
          value={deadStockCount} sub="Products unmoved 30+ days"
          accent="var(--warning)" onClick={() => onNavigate('inventory')}
        />
        <MetricCard
          icon={ClipboardList} label="Action Center" color="var(--accent)"
          value={pendingActions} sub="Pending tasks"
          accent="var(--accent)" onClick={() => onNavigate('actions')}
        />
      </div>

      {/* Two-column: Action Center + Dead Stock */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        {/* Action Center */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ClipboardList size={16} color="var(--accent)" />
              <span style={{ fontWeight: 600, fontSize: 14 }}>Action Center</span>
            </div>
            <button
              onClick={() => onNavigate('actions')}
              style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 500, cursor: 'pointer', background: 'none', border: 'none' }}
            >
              View all →
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pendingActionsList.length === 0 && (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                No pending actions yet
              </div>
            )}
            {pendingActionsList.slice(0, 4).map(action => (
              <div key={action.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                background: 'var(--surface2)', borderRadius: 'var(--radius)',
                cursor: 'pointer', transition: 'background 0.1s ease'
              }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface3)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--surface2)'}
                onClick={() => onNavigate('actions')}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{action.label}</div>
                </div>
                <span className={`tag tag-${action.priority}`}>{action.priority}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Dead Stock */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <TrendingDown size={16} color="var(--warning)" />
              <span style={{ fontWeight: 600, fontSize: 14 }}>Dead Stock</span>
            </div>
            <button
              onClick={() => onNavigate('inventory')}
              style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 500, cursor: 'pointer', background: 'none', border: 'none' }}
            >
              View all →
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {products.filter(p => p.isDeadStock).length === 0 && (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                {loading ? 'Loading…' : 'No dead stock detected'}
              </div>
            )}
            {products.filter(p => p.isDeadStock).slice(0, 4).map(p => (
              <div key={p.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '10px 12px',
                background: 'var(--surface2)', borderRadius: 'var(--radius)',
                cursor: 'pointer', transition: 'background 0.1s ease'
              }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface3)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--surface2)'}
                onClick={() => onNavigate('inventory')}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.daysUnmoved} days · qty {p.quantity ?? '?'}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {p.stuckValue
                    ? <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--warning)' }}>{fmt(p.stuckValue)}</div>
                    : <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>price missing</div>
                  }
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Products requiring attention */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Package size={16} color="var(--danger)" />
            <span style={{ fontWeight: 600, fontSize: 14 }}>Products Requiring Attention</span>
          </div>
          <button
            onClick={() => onNavigate('inventory')}
            style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 500, cursor: 'pointer', background: 'none', border: 'none' }}
          >
            View all →
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
          {loading && <div style={{ padding: '20px', color: 'var(--text-muted)', fontSize: 13 }}>Loading products…</div>}
          {!loading && products.filter(p => p.missingDetails.length > 0 || p.status !== 'verified').length === 0 && (
            <div style={{ padding: '20px', color: 'var(--text-muted)', fontSize: 13 }}>All products verified — great job!</div>
          )}
          {products.filter(p => p.missingDetails.length > 0 || p.status !== 'verified').slice(0, 4).map(p => (
            <div key={p.id} style={{
              padding: '14px', background: 'var(--surface2)', borderRadius: 'var(--radius)',
              border: '1px solid var(--border)', cursor: 'pointer'
            }}
              onClick={() => onNavigate('inventory')}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{p.name}</span>
                <span className={`tag tag-${p.status}`}>{p.status}</span>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {p.missingDetails.map(d => (
                  <span key={d} style={{ fontSize: 10, padding: '2px 8px', background: 'var(--danger-dim)', color: 'var(--danger)', borderRadius: 100, border: '1px solid rgba(232,90,79,0.2)' }}>
                    missing {d}
                  </span>
                ))}
                {p.missingDetails.length === 0 && (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Needs verification</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
