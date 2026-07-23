import React, { useState } from 'react';
import { TrendingDown, AlertTriangle, ClipboardList, ArrowRight, TrendingUp, Package, Eye, Activity } from 'lucide-react';
import { useFetch } from '../hooks/useApi';
import { useLocalPref } from '../hooks/useLocalPref';
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
  const isDeadStock = totalQty > 0 && !p.sellingPrice && status !== 'verified';
  const stuckValue = isDeadStock && p.costPrice ? totalQty * parseFloat(p.costPrice) : null;
  return { ...p, status, missingDetails, quantity: totalQty || null, price: p.sellingPrice ? parseFloat(p.sellingPrice) : null, isDeadStock, stuckValue };
}

const fmt = (n) => {
  if (n == null) return '—';
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  return `₹${n.toLocaleString('en-IN')}`;
};

const METRIC_CARD_THEMES = {
  danger:  { bg: 'var(--danger-dim)',  border: 'rgba(248,113,113,0.22)', numColor: 'var(--danger)',  iconBg: 'rgba(248,113,113,0.14)' },
  success: { bg: 'var(--success-dim)', border: 'rgba(52,211,153,0.22)',  numColor: 'var(--success)', iconBg: 'rgba(52,211,153,0.14)' },
  warning: { bg: 'var(--warning-dim)', border: 'rgba(251,191,36,0.22)',  numColor: 'var(--warning)', iconBg: 'rgba(251,191,36,0.14)' },
  accent:  { bg: 'var(--accent-dim)',  border: 'var(--accent-border)',   numColor: 'var(--accent)',  iconBg: 'rgba(99,102,241,0.14)' },
};

function MetricCard({ icon: Icon, label, value, sub, theme = 'accent', onClick }) {
  const t = METRIC_CARD_THEMES[theme];
  return (
    <button
      onClick={onClick}
      style={{
        background: t.bg, border: `1px solid ${t.border}`,
        borderRadius: 'var(--radius-lg)', padding: '20px',
        textAlign: 'left', cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow 0.15s ease, transform 0.1s ease',
        width: '100%', boxShadow: 'var(--shadow-sm)',
      }}
      onMouseEnter={e => { if (onClick) { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8, background: t.iconBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <Icon size={16} color={t.numColor} />
        </div>
        {onClick && <ArrowRight size={14} color={t.numColor} style={{ opacity: 0.6 }} />}
      </div>
      <div style={{ fontSize: 30, fontWeight: 700, color: t.numColor, lineHeight: 1, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
        {value}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500, marginTop: 6 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
    </button>
  );
}

function ConfidenceBadge({ score }) {
  const color = score >= 70 ? 'var(--success)' : score >= 40 ? 'var(--warning)' : 'var(--danger)';
  const bg    = score >= 70 ? 'var(--success-dim)' : score >= 40 ? 'var(--warning-dim)' : 'var(--danger-dim)';
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px',
      background: bg, borderRadius: 100, border: `1px solid ${color}30`,
    }}>
      <Activity size={11} color={color} />
      <span style={{ fontSize: 12, fontWeight: 600, color, fontVariantNumeric: 'tabular-nums' }}>
        {score ?? '—'}% confidence
      </span>
    </div>
  );
}

// Dismissible alert strip shared by every Dashboard alert banner. Each banner is
// gated by its own Settings > Notifications toggle, so turning a toggle off must
// actually stop that banner from appearing here — see `notif_*` local prefs below.
function AlertBanner({ icon: Icon, iconColor, borderColor, background, message, detail, ctaLabel, onCta, onDismiss, dismissLabel }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '12px 18px', marginBottom: 16,
      background, border: `1px solid ${borderColor}`,
      borderRadius: 'var(--radius-lg)',
      animation: 'fadeIn 0.3s ease',
    }}>
      <Icon size={16} color={iconColor} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{message}</span>
        {detail && <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>{detail}</span>}
      </div>
      <button
        onClick={onCta}
        style={{ fontSize: 12, fontWeight: 600, color: iconColor, background: 'transparent', border: 'none', cursor: 'pointer', flexShrink: 0 }}
      >
        {ctaLabel} →
      </button>
      <button
        onClick={onDismiss}
        aria-label={dismissLabel}
        style={{ fontSize: 16, color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', lineHeight: 1, padding: '0 2px', flexShrink: 0 }}
      >
        ×
      </button>
    </div>
  );
}

export default function Dashboard({ onNavigate }) {
  const { user } = useAuth();
  const { brand } = useBrand();
  const { data: rawProducts, loading: productsLoading } = useFetch('/products');
  const { data: actionData,  loading: actionsLoading  } = useFetch('/action-queue');
  const { data: confidenceData } = useFetch(brand?.id ? `/brands/${brand.id}/confidence` : null);
  const { data: revenueData } = useFetch('/analytics/revenue?days=7');
  const [lowStockAlertsEnabled] = useLocalPref('notif_lowstock', true);
  const [lowStockThresh] = useLocalPref('notif_threshold', 5);
  const [inventoryAlertsEnabled] = useLocalPref('notif_inventory', true);
  const [deadStockAlertsEnabled] = useLocalPref('notif_deadstock', true);
  const { data: lowStockData } = useFetch(
    lowStockAlertsEnabled ? `/sales-intelligence/low-stock?threshold=${lowStockThresh}` : null
  );
  const [dismissedAlerts, setDismissedAlerts] = useState({});
  const dismissAlert = (key) => setDismissedAlerts(d => ({ ...d, [key]: true }));

  const products     = (rawProducts || []).map(mapProduct);
  const actionTasks  = actionData?.tasks || [];
  const topActions   = actionTasks.slice(0, 4);
  const confidence   = confidenceData?.score ?? null;

  const atRisk         = products.filter(p => p.missingDetails.length > 0 || p.status !== 'verified').length;
  const deadStockItems = products.filter(p => p.isDeadStock);
  const deadStockValue = deadStockItems.filter(p => p.stuckValue).reduce((s, p) => s + p.stuckValue, 0);
  const deadStockCount = deadStockItems.length;
  const pendingActions = actionTasks.length;
  const verifiedCount  = products.filter(p => p.status === 'verified').length;
  const verifiedPct    = products.length > 0 ? Math.round(verifiedCount / products.length * 100) : null;

  const weekRevenue  = revenueData?.totalRevenue ?? null;
  const wowGrowth    = revenueData?.momGrowth ?? null;
  const topPlatform  = revenueData?.platforms?.[0]?.platform ?? null;
  const hasRevenue   = weekRevenue != null && weekRevenue > 0;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="page" style={{ animation: 'fadeIn 0.25s ease' }}>
      {/* Header */}
      <div style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)', lineHeight: 1.2 }}>
            {greeting}, <span style={{ color: 'var(--accent)' }}>{brand?.name || user?.email?.split('@')[0] || 'there'}</span>
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {productsLoading ? 'Loading…' : `${products.length} product${products.length !== 1 ? 's' : ''}`}
            </p>
            {confidence !== null && <ConfidenceBadge score={confidence} />}
          </div>
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

      {/* Revenue Pulse Strip */}
      {hasRevenue && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 0,
          marginBottom: 20,
          background: 'var(--surface1)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '14px 24px 14px 28px',
          boxShadow: 'var(--shadow-sm)',
          overflow: 'hidden',
          position: 'relative',
        }}>
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: 'var(--accent)', borderRadius: '4px 0 0 4px' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 32, flex: 1, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3, fontWeight: 500 }}>This Week</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', lineHeight: 1 }}>{fmt(weekRevenue)}</div>
            </div>
            {wowGrowth !== null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '4px 10px', borderRadius: 100,
                  background: wowGrowth >= 0 ? 'var(--success-dim)' : 'var(--danger-dim)',
                  border: `1px solid ${wowGrowth >= 0 ? 'rgba(52,211,153,0.25)' : 'rgba(248,113,113,0.25)'}`,
                }}>
                  {wowGrowth >= 0
                    ? <TrendingUp size={12} color="var(--success)" />
                    : <TrendingDown size={12} color="var(--danger)" />}
                  <span style={{ fontSize: 13, fontWeight: 600, color: wowGrowth >= 0 ? 'var(--success)' : 'var(--danger)', fontVariantNumeric: 'tabular-nums' }}>
                    {wowGrowth >= 0 ? '+' : ''}{wowGrowth}%
                  </span>
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>vs last week</span>
              </div>
            )}
            {topPlatform && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 1, height: 28, background: 'var(--border)' }} />
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3, fontWeight: 500 }}>Top Platform</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{topPlatform}</div>
                </div>
              </div>
            )}
          </div>
          <button
            onClick={() => onNavigate('sales')}
            style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 500, cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, whiteSpace: 'nowrap' }}
          >
            See sales <ArrowRight size={12} />
          </button>
        </div>
      )}


      {/* Low-stock alert strip — Settings > Notifications > "Low stock alerts" */}
      {!dismissedAlerts.lowstock && lowStockData?.items?.length > 0 && (
        <AlertBanner
          icon={AlertTriangle} iconColor="var(--warning)"
          borderColor="rgba(251,191,36,0.3)" background="var(--warning-dim)"
          message={`${lowStockData.items.length} product${lowStockData.items.length !== 1 ? 's' : ''} running low`}
          detail={`${lowStockData.items.slice(0, 2).map(i => i.productName || i.sku).join(', ')}${lowStockData.items.length > 2 ? ` +${lowStockData.items.length - 2} more` : ''}`}
          ctaLabel="View" onCta={() => onNavigate('inventory')}
          onDismiss={() => dismissAlert('lowstock')} dismissLabel="Dismiss low stock alert"
        />
      )}

      {/* Inventory-quality alert strip — Settings > Notifications > "Inventory alerts" */}
      {inventoryAlertsEnabled && !dismissedAlerts.atrisk && !productsLoading && atRisk > 0 && (
        <AlertBanner
          icon={Package} iconColor="var(--danger)"
          borderColor="rgba(248,113,113,0.3)" background="var(--danger-dim)"
          message={`${atRisk} product${atRisk !== 1 ? 's' : ''} need${atRisk === 1 ? 's' : ''} attention`}
          detail="missing details or unverified stock"
          ctaLabel="View" onCta={() => onNavigate('inventory')}
          onDismiss={() => dismissAlert('atrisk')} dismissLabel="Dismiss inventory alert"
        />
      )}

      {/* Dead-stock alert strip — Settings > Notifications > "Dead stock alerts" */}
      {deadStockAlertsEnabled && !dismissedAlerts.deadstock && !productsLoading && deadStockCount > 0 && (
        <AlertBanner
          icon={TrendingDown} iconColor="var(--warning)"
          borderColor="rgba(251,191,36,0.3)" background="var(--warning-dim)"
          message={`${deadStockCount} product${deadStockCount !== 1 ? 's' : ''} sitting as dead stock`}
          detail={deadStockValue > 0 ? `${fmt(deadStockValue)} recoverable` : 'no sales in 90+ days'}
          ctaLabel="Recover" onCta={() => onNavigate('actions')}
          onDismiss={() => dismissAlert('deadstock')} dismissLabel="Dismiss dead stock alert"
        />
      )}

      {/* Metric cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14, marginBottom: 24 }}>
        <MetricCard
          icon={AlertTriangle} theme="danger"
          label="Inventory At Risk" value={atRisk}
          sub={atRisk === 0 ? 'All products ready to sell' : `${atRisk} need attention`}
          onClick={() => onNavigate('inventory')}
        />
        <MetricCard
          icon={TrendingDown} theme="warning"
          label="Dead Stock" value={deadStockCount}
          sub={deadStockValue > 0 ? `${fmt(deadStockValue)} recoverable` : 'No cost price set'}
          onClick={() => onNavigate('actions')}
        />
        <MetricCard
          icon={TrendingUp} theme="success"
          label="Verified Inventory" value={verifiedPct != null ? `${verifiedPct}%` : '—'}
          sub={`${verifiedCount} of ${products.length} products`}
          onClick={() => onNavigate('inventory')}
        />
        <MetricCard
          icon={ClipboardList} theme="accent"
          label="Action Center" value={pendingActions}
          sub={actionsLoading ? 'Loading…' : 'Pending tasks'}
          onClick={() => onNavigate('actions')}
        />
      </div>

      {/* Two columns: Action Center preview + Dead Stock preview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14, marginBottom: 14 }}>
        {/* Action Center preview */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ClipboardList size={15} color="var(--accent)" />
              <span style={{ fontWeight: 600, fontSize: 14 }}>Action Center</span>
              {pendingActions > 0 && (
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 100,
                  background: 'var(--accent)', color: '#fff', minWidth: 18, textAlign: 'center'
                }}>{pendingActions}</span>
              )}
            </div>
            <button
              onClick={() => onNavigate('actions')}
              style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 500, cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'var(--font-body)' }}
            >
              View all →
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {actionsLoading && <div className="skeleton" style={{ height: 48, borderRadius: 'var(--radius)' }} />}
            {!actionsLoading && topActions.length === 0 && (
              <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                No pending actions — well done!
              </div>
            )}
            {topActions.map(t => (
              <div
                key={t.id}
                role="button"
                tabIndex={0}
                aria-label={`${t.label}, priority ${t.priority}`}
                onClick={() => onNavigate('actions')}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate('actions'); }
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
                  background: 'var(--surface2)', borderRadius: 'var(--radius)',
                  cursor: 'pointer', transition: 'background 0.1s ease'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface3)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--surface2)'}
                onFocus={e => e.currentTarget.style.background = 'var(--surface3)'}
                onBlur={e => e.currentTarget.style.background = 'var(--surface2)'}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.label}</div>
                </div>
                <span style={{
                  fontSize: 10, padding: '1px 6px', borderRadius: 100, fontWeight: 600, flexShrink: 0,
                  color: t.priority <= 2 ? 'var(--danger)' : t.priority === 3 ? 'var(--warning)' : 'var(--text-muted)',
                  background: t.priority <= 2 ? 'var(--danger-dim)' : t.priority === 3 ? 'var(--warning-dim)' : 'var(--surface3)',
                }}>P{t.priority}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Dead Stock preview */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <TrendingDown size={15} color="var(--warning)" />
              <span style={{ fontWeight: 600, fontSize: 14 }}>Dead Stock</span>
            </div>
            <button
              onClick={() => onNavigate('inventory')}
              style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 500, cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'var(--font-body)' }}
            >
              View all →
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {productsLoading && <div className="skeleton" style={{ height: 48, borderRadius: 'var(--radius)' }} />}
            {!productsLoading && deadStockItems.length === 0 && (
              <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                No dead stock detected
              </div>
            )}
            {deadStockItems.slice(0, 4).map(p => (
              <div
                key={p.id}
                role="button"
                tabIndex={0}
                aria-label={`${p.name}, quantity ${p.quantity ?? 'unknown'}${p.stuckValue ? `, ${fmt(p.stuckValue)} recoverable` : ''}`}
                onClick={() => onNavigate('inventory')}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate('inventory'); }
                }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '9px 12px',
                  background: 'var(--surface2)', borderRadius: 'var(--radius)',
                  cursor: 'pointer', transition: 'background 0.1s ease'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface3)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--surface2)'}
                onFocus={e => e.currentTarget.style.background = 'var(--surface3)'}
                onBlur={e => e.currentTarget.style.background = 'var(--surface2)'}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-primary)' }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>qty {p.quantity ?? '?'}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {p.stuckValue
                    ? <div style={{ fontSize: 12, color: 'var(--warning)', fontWeight: 600 }}>{fmt(p.stuckValue)}</div>
                    : <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>price missing</div>
                  }
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Products needing attention */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Package size={15} color="var(--danger)" />
            <span style={{ fontWeight: 600, fontSize: 14 }}>Products Needing Attention</span>
          </div>
          <button
            onClick={() => onNavigate('inventory')}
            style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 500, cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'var(--font-body)' }}
          >
            View all →
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
          {productsLoading && [1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 68, borderRadius: 'var(--radius)' }} />)}
          {!productsLoading && products.filter(p => p.missingDetails.length > 0 || p.status !== 'verified').length === 0 && (
            <div style={{ padding: '16px', color: 'var(--text-muted)', fontSize: 13, gridColumn: '1/-1' }}>
              All products look good!
            </div>
          )}
          {products.filter(p => p.missingDetails.length > 0 || p.status !== 'verified').slice(0, 6).map(p => (
            <div
              key={p.id}
              role="button"
              tabIndex={0}
              aria-label={`${p.name || 'Unnamed product'}, ${p.status}${p.missingDetails.length > 0 ? `, missing ${p.missingDetails.join(', ')}` : ', needs verification'}`}
              onClick={() => onNavigate('inventory')}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate('inventory'); }
              }}
              style={{
                padding: '12px', background: 'var(--surface2)', borderRadius: 'var(--radius)',
                border: '1px solid var(--border)', cursor: 'pointer',
                transition: 'border-color 0.1s ease, background 0.1s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.background = 'var(--surface3)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surface2)'; }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.background = 'var(--surface3)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surface2)'; }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{p.name || 'Unnamed product'}</span>
                <span className={`tag tag-${p.status}`}>{p.status}</span>
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {p.missingDetails.map(d => (
                  <span key={d} style={{
                    fontSize: 10, padding: '1px 7px', background: 'var(--danger-dim)', color: 'var(--danger)',
                    borderRadius: 100, border: '1px solid rgba(220,38,38,0.2)'
                  }}>
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
