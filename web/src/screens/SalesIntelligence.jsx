import React, { useState } from 'react';
import {
  TrendingUp, TrendingDown, Package, BarChart2, Activity,
  AlertTriangle, RefreshCw, RotateCcw, Target, Plus, Loader,
} from 'lucide-react';
import { useFetch, useApiRequest } from '../hooks/useApi';

const fmt = (n) => {
  if (n == null) return '—';
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000)   return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000)     return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${Math.round(parseFloat(n)).toLocaleString('en-IN')}`;
};

const fmtPct = (n) => n == null ? '—' : `${n}%`;

const PLATFORM_COLORS = {
  shopify:     '#96bf48',
  amazon:      '#ff9900',
  flipkart:    '#2874f0',
  myntra:      '#ff3f6c',
  meesho:      '#f43397',
  ajio:        '#e91e63',
  citymall:    '#ff6b35',
  etsy:        '#f56400',
  woocommerce: '#7f54b3',
  whatsapp:    '#25d366',
  pos:         '#6366f1',
};

const TABS = [
  { id: 'overview',  label: 'Overview',  icon: BarChart2 },
  { id: 'channels',  label: 'Channels',  icon: Activity },
  { id: 'products',  label: 'Products',  icon: Package },
  { id: 'returns',   label: 'Returns',   icon: RotateCcw },
  { id: 'forecast',  label: 'Forecast',  icon: Target },
];

function MetricCard({ label, value, sub, accent, note }) {
  return (
    <div className="card" style={{ padding: '14px 16px' }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: accent || 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
      {note && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, opacity: 0.7 }}>{note}</div>}
    </div>
  );
}

function EmptyState({ icon: Icon, title, desc }) {
  return (
    <div className="empty-state">
      <Icon size={28} style={{ opacity: 0.3 }} />
      <h3>{title}</h3>
      <p>{desc}</p>
    </div>
  );
}

function ErrorMsg({ onRetry }) {
  return (
    <div style={{ padding: 20, color: 'var(--danger)', fontSize: 13 }}>
      Failed to load.{' '}
      <button onClick={onRetry} style={{ textDecoration: 'underline', cursor: 'pointer', background: 'none', border: 'none', color: 'var(--danger)', fontSize: 13, fontFamily: 'var(--font-body)' }}>
        Retry
      </button>
    </div>
  );
}

function SkeletonList({ count = 4, height = 64 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height, borderRadius: 'var(--radius)' }} />
      ))}
    </div>
  );
}

// ── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab({ period, onNavigate }) {
  const { data: rev, loading: rl, error: re, refetch: rr } = useFetch(`/analytics/revenue?days=${period}`);
  const { data: anom } = useFetch('/analytics/anomalies');
  const { data: demand } = useFetch('/analytics/demand');

  if (rl) return <SkeletonList count={3} height={90} />;
  if (re) return <ErrorMsg onRetry={rr} />;

  const hasData = rev && (rev.totalOrders > 0);

  if (!hasData) return (
    <div>
      <EmptyState
        icon={BarChart2}
        title="No marketplace orders synced"
        desc="Connect a marketplace in Integrations and run a sync to see business intelligence."
      />
      <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => onNavigate('integrations')}>
        Go to Integrations
      </button>
    </div>
  );

  const momColor = rev.momGrowth > 0 ? 'var(--success)' : rev.momGrowth < 0 ? 'var(--danger)' : 'var(--text-muted)';
  const momLabel = rev.momGrowth != null ? `${rev.momGrowth > 0 ? '+' : ''}${rev.momGrowth}% vs prev ${period}d` : null;

  const restockAlerts = demand?.restockAlerts || [];
  const anomalies = anom?.anomalies || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        <MetricCard label="Revenue" value={fmt(rev.totalRevenue)} sub={momLabel} accent={momColor} />
        <MetricCard label="Orders" value={rev.totalOrders.toLocaleString('en-IN')} sub={`last ${period} days`} />
        <MetricCard label="Net Revenue" value={fmt(rev.totalNetRevenue)} note="Platform-reported fees" />
        <MetricCard label="Platforms" value={rev.platforms?.length || 0} sub="connected channels" />
      </div>

      {/* Platform share bars */}
      {rev.platforms?.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 10 }}>
            Revenue by Platform
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rev.platforms.map(p => (
              <div key={p.platform} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 72, fontSize: 12, color: 'var(--text-secondary)', textTransform: 'capitalize', flexShrink: 0 }}>{p.platform}</div>
                <div style={{ flex: 1, height: 6, background: 'var(--surface2)', borderRadius: 100, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 100, transition: 'width 0.6s ease',
                    background: PLATFORM_COLORS[p.platform] || 'var(--accent)',
                    width: `${p.share}%`,
                  }} />
                </div>
                <div style={{ width: 44, fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{p.share}%</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Anomaly alerts */}
      {anomalies.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 10 }}>
            Alerts
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {anomalies.slice(0, 3).map((a, i) => {
              const c = a.severity === 'high' ? 'var(--danger)' : 'var(--warning)';
              return (
                <div key={i} style={{
                  padding: '10px 14px', background: 'var(--surface)',
                  border: `1px solid ${c}33`, borderLeft: `3px solid ${c}`,
                  borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--text-secondary)',
                }}>
                  <AlertTriangle size={12} style={{ marginRight: 6, color: c, verticalAlign: 'middle' }} />
                  {a.message}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Restock alerts */}
      {restockAlerts.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 10 }}>
            Restock Needed
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {restockAlerts.slice(0, 3).map((s, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{s.name || s.sku}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.stock} units · {s.soldLast30} sold last 30d</div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--danger)' }}>
                  {s.daysRemaining != null ? `${s.daysRemaining}d left` : 'low stock'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Revenue trend sparkline */}
      {rev.trend?.length > 3 && (
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 10 }}>
            Daily Revenue Trend
          </div>
          <MiniSparkline data={rev.trend} valueKey="revenue" />
        </div>
      )}
    </div>
  );
}

function MiniSparkline({ data, valueKey }) {
  const max = Math.max(...data.map(d => d[valueKey] || 0), 1);
  return (
    <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 60 }}>
      {data.map((d, i) => (
        <div key={i} style={{
          flex: 1, borderRadius: '2px 2px 0 0',
          background: i === data.length - 1 ? 'var(--accent)' : 'var(--accent-dim)',
          height: `${Math.max(3, Math.round((d[valueKey] / max) * 56))}px`,
          title: `${d.date}: ${fmt(d[valueKey])}`,
          cursor: 'default',
          minWidth: 2,
        }} title={`${d.date}: ${fmt(d[valueKey])}`} />
      ))}
    </div>
  );
}

// ── Channels Tab ──────────────────────────────────────────────────────────────

function ChannelsTab({ period }) {
  const { data: rev, loading, error, refetch } = useFetch(`/analytics/revenue?days=${period}`);
  const { data: returns } = useFetch(`/analytics/returns?days=${period}`);

  if (loading) return <SkeletonList />;
  if (error) return <ErrorMsg onRetry={refetch} />;
  if (!rev?.platforms?.length) return (
    <EmptyState icon={Activity} title="No channel data" desc="Connect a marketplace and sync orders to see per-channel analytics." />
  );

  const returnByPlatform = {};
  for (const p of (returns?.platforms || [])) {
    returnByPlatform[p.platform] = p;
  }

  const totalRevenue = rev.totalRevenue || 1;
  const hhi = rev.platforms.reduce((s, p) => s + Math.pow(p.share / 100, 2), 0);
  const concentration = hhi > 0.5 ? 'high' : hhi > 0.25 ? 'moderate' : 'diversified';
  const cColor = hhi > 0.5 ? 'var(--danger)' : hhi > 0.25 ? 'var(--warning)' : 'var(--success)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--surface)', borderRadius: 'var(--radius)', border: `1px solid ${cColor}33` }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: cColor, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{concentration} concentration</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>· HHI {hhi.toFixed(2)} (0 = diverse, 1 = single channel)</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rev.platforms.map((p, i) => {
          const ret = returnByPlatform[p.platform];
          const platColor = PLATFORM_COLORS[p.platform] || 'var(--accent)';
          return (
            <div key={p.platform} style={{
              padding: '14px 16px', background: 'var(--surface)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
              animation: `fadeIn 0.2s ease ${i * 0.04}s both`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: platColor, flexShrink: 0 }} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{p.platform}</span>
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{fmt(p.revenue)}</span>
              </div>
              <div style={{ display: 'flex', gap: 20, marginBottom: 10, flexWrap: 'wrap' }}>
                <div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Orders </span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{p.orders}</span>
                </div>
                <div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Net revenue </span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{fmt(p.netRevenue)}</span>
                </div>
                {ret && (
                  <div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Return rate </span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: ret.returnRate > 10 ? 'var(--danger)' : 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{fmtPct(ret.returnRate)}</span>
                  </div>
                )}
              </div>
              <div style={{ height: 4, background: 'var(--surface2)', borderRadius: 100, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 100, background: platColor, width: `${p.share}%`, transition: 'width 0.6s ease' }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Not-in-inventory inline form ─────────────────────────────────────────────

function NotInInventorySection({ items, onSaved }) {
  const { patch, post } = useApiRequest();
  const [expanded, setExpanded] = useState(null); // sku of open row
  const [forms, setForms] = useState({});          // sku → { name, price, qty }
  const [saving, setSaving] = useState(null);
  const [saved, setSaved]   = useState(null);

  const getForm = (s) => forms[s.sku] || { name: s.name || '', price: '', qty: '' };

  const setField = (sku, key, val) =>
    setForms(f => ({ ...f, [sku]: { ...getForm({ sku, name: '' }), ...f[sku], [key]: val } }));

  const toggle = (s) => {
    if (expanded === s.sku) { setExpanded(null); return; }
    if (!forms[s.sku]) setForms(f => ({ ...f, [s.sku]: { name: s.name || '', price: '', qty: '' } }));
    setExpanded(s.sku);
  };

  const handleSave = async (s) => {
    const f = getForm(s);
    if (!f.qty || +f.qty <= 0) return;
    setSaving(s.sku);
    try {
      // Update product name + selling price if provided
      if (s.productId) {
        const updates = {};
        if (f.name && f.name !== s.name) updates.name = f.name;
        if (f.price) updates.sellingPrice = parseFloat(f.price);
        if (Object.keys(updates).length > 0) {
          await patch(`/products/${s.productId}`, updates);
        }
        // Add stock lot
        await post('/stock-lots', {
          productId: s.productId,
          quantity: parseInt(f.qty, 10),
          quantityCertainty: 'approximate',
          inventoryStatus: 'main_stock',
          source: 'manual_count',
        });
      }
      setSaved(s.sku);
      setExpanded(null);
      window.dispatchEvent(new Event('inv:mutation'));
      setTimeout(() => { setSaved(null); onSaved(); }, 1200);
    } catch (e) {
      // keep form open so user can retry
    } finally {
      setSaving(null);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: 'var(--warning)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
          Seen in orders — not in inventory
        </div>
        <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 100, background: 'rgba(251,191,36,0.15)', color: 'var(--warning)', fontWeight: 700 }}>
          {items.length}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· tap a row to add stock</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map((s, i) => {
          const isOpen   = expanded === s.sku;
          const isSaving = saving === s.sku;
          const isDone   = saved  === s.sku;
          const f        = getForm(s);
          return (
            <div key={s.sku || i} style={{
              background: isOpen ? 'var(--surface)' : 'var(--surface)',
              border: `1px solid ${isOpen ? 'var(--accent-border)' : 'rgba(251,191,36,0.25)'}`,
              borderRadius: 'var(--radius)', overflow: 'hidden',
              animation: `fadeIn 0.15s ease ${i * 0.03}s both`,
              transition: 'border-color 0.15s',
            }}>
              {/* Row header — always visible */}
              <div
                onClick={() => toggle(s)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', cursor: 'pointer' }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {isDone ? `✓ ${s.name || s.sku} added` : (s.name || s.sku)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 1 }}>{s.sku}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: isDone ? 'var(--success)' : 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                    {s.soldLast30} sold
                  </div>
                  <div style={{ fontSize: 11, color: isOpen ? 'var(--accent)' : 'var(--warning)', marginTop: 1 }}>
                    {isOpen ? 'cancel ↑' : 'add stock →'}
                  </div>
                </div>
              </div>

              {/* Inline form — only when expanded */}
              {isOpen && (
                <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid var(--border)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, paddingTop: 10 }}>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Product name</div>
                      <input
                        value={f.name}
                        onChange={e => setField(s.sku, 'name', e.target.value)}
                        placeholder={s.name || s.sku}
                        style={{ width: '100%', padding: '7px 10px', background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Selling price (₹)</div>
                      <input
                        type="number" min="0" step="1"
                        value={f.price}
                        onChange={e => setField(s.sku, 'price', e.target.value)}
                        placeholder="e.g. 599"
                        style={{ width: '100%', padding: '7px 10px', background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Stock qty <span style={{ color: 'var(--danger)' }}>*</span></div>
                      <input
                        type="number" min="1"
                        value={f.qty}
                        onChange={e => setField(s.sku, 'qty', e.target.value)}
                        placeholder="e.g. 20"
                        style={{ width: '100%', padding: '7px 10px', background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => handleSave(s)}
                      disabled={isSaving || !f.qty}
                      className="btn btn-primary"
                      style={{ fontSize: 12, padding: '6px 16px' }}
                    >
                      {isSaving ? <Loader size={12} style={{ animation: 'spin 0.8s linear infinite' }} /> : 'Save to inventory'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Products Tab ──────────────────────────────────────────────────────────────

function ProductsTab({ onNavigate }) {
  const { data, loading, error, refetch } = useFetch('/analytics/demand');

  if (loading) return <SkeletonList />;
  if (error) return <ErrorMsg onRetry={refetch} />;

  const signals      = data?.signals       || [];
  const deadStock    = data?.deadStock      || [];
  const notInInv     = data?.notInInventory || [];
  const bestSellers  = signals.filter(s => s.soldLast30 > 0 && s.inInventory).slice(0, 10);
  const maxSold      = Math.max(...signals.map(s => s.soldLast30), 1);

  if (signals.length === 0) return (
    <EmptyState icon={Package} title="No product data" desc="Import your Meesho order report — products will appear here automatically." />
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Products seen in orders but not yet in inventory */}
      {notInInv.length > 0 && (
        <NotInInventorySection items={notInInv} onSaved={refetch} />
      )}

      {/* Top sellers (in inventory) */}
      {bestSellers.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 10 }}>
            Top Sellers — Last 30 Days
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {bestSellers.map((s, i) => (
              <div key={s.sku || i} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)', animation: `fadeIn 0.2s ease ${i * 0.04}s both`,
              }}>
                <div style={{ width: 28, textAlign: 'center', fontSize: 12, fontWeight: 700, color: i === 0 ? 'var(--accent)' : 'var(--text-muted)', flexShrink: 0 }}>#{i + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.name || s.sku}
                  </div>
                  <div style={{ height: 3, background: 'var(--surface2)', borderRadius: 100, marginTop: 6, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 100, background: i === 0 ? 'var(--accent)' : 'var(--success)', width: `${Math.round((s.soldLast30 / maxSold) * 100)}%` }} />
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{s.soldLast30} sold</div>
                  <div style={{ fontSize: 11, color: s.daysRemaining != null && s.daysRemaining < 14 ? 'var(--danger)' : 'var(--text-muted)' }}>
                    {s.daysRemaining != null ? `${s.daysRemaining}d stock` : `${s.stock} units`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {deadStock.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 10 }}>
            Dead Stock — No Sales Last 30 Days
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {deadStock.slice(0, 8).map((s, i) => (
              <div key={s.sku || i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 14px', background: 'var(--surface)',
                border: '1px solid rgba(251,191,36,0.18)', borderRadius: 'var(--radius)',
                animation: `fadeIn 0.2s ease ${i * 0.04}s both`,
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{s.name || s.sku}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.stock} units in stock</div>
                </div>
                <TrendingDown size={16} color="var(--warning)" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Returns Tab ───────────────────────────────────────────────────────────────

function ReturnsTab({ period }) {
  const { data, loading, error, refetch } = useFetch(`/analytics/returns?days=${period}`);

  if (loading) return <SkeletonList />;
  if (error) return <ErrorMsg onRetry={refetch} />;
  if (!data || data.totalOrders === 0) return (
    <EmptyState icon={RotateCcw} title="No return data" desc="Sync marketplace orders to see return and cancellation analysis." />
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        <MetricCard label="Return Rate" value={fmtPct(data.overallReturnRate)} accent={data.overallReturnRate > 10 ? 'var(--danger)' : undefined} />
        <MetricCard label="Cancel Rate" value={fmtPct(data.overallCancellationRate)} accent={data.overallCancellationRate > 10 ? 'var(--danger)' : undefined} />
        <MetricCard label="Total Returns" value={data.totalReturns} />
        <MetricCard label="Cancellations" value={data.totalCancellations} />
      </div>

      {data.platforms?.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 10 }}>
            By Platform
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.platforms.sort((a, b) => b.returnRate - a.returnRate).map((p, i) => (
              <div key={p.platform} style={{
                padding: '12px 14px', background: 'var(--surface)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                animation: `fadeIn 0.2s ease ${i * 0.04}s both`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, textTransform: 'capitalize', color: 'var(--text-primary)' }}>{p.platform}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: p.returnRate > 10 ? 'var(--danger)' : 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                    {fmtPct(p.returnRate)} returns
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-muted)' }}>
                  <span>{p.totalOrders} orders</span>
                  <span>{p.returns} returns</span>
                  <span>{p.cancellations} cancellations</span>
                </div>
                {p.topReturnReasons?.length > 0 && (
                  <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                    Top reason: {p.topReturnReasons[0].reason} ({p.topReturnReasons[0].count}×)
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {data.topReturnedSkus?.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 10 }}>
            Most Returned Products
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.topReturnedSkus.slice(0, 5).map((s, i) => (
              <div key={s.sku || i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{s.name || s.sku}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>SKU: {s.sku || '—'}</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--danger)', fontVariantNumeric: 'tabular-nums' }}>{s.returns} returns</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Forecast Tab ──────────────────────────────────────────────────────────────

function ForecastTab() {
  const { data, loading, error, refetch } = useFetch('/analytics/forecast');
  const { data: demand } = useFetch('/analytics/demand');

  if (loading) return <SkeletonList count={5} height={72} />;
  if (error) return <ErrorMsg onRetry={refetch} />;
  if (!data?.forecasts?.length) return (
    <EmptyState icon={Target} title="No forecast data" desc="Need at least 2 weeks of order history per SKU to generate demand forecasts." />
  );

  const restockAlerts = demand?.restockAlerts || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {data.seasonalNote && (
        <div style={{ padding: '10px 14px', background: 'var(--accent-dim)', border: '1px solid var(--accent-border)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--accent)' }}>
          {data.seasonalNote}
        </div>
      )}

      {restockAlerts.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 10 }}>
            Restock Alerts
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {restockAlerts.map((s, i) => (
              <div key={s.sku || i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--surface)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius)' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{s.name || s.sku}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.stock} units · {s.dailyVelocity}/day velocity</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--danger)', fontVariantNumeric: 'tabular-nums' }}>
                  {s.daysRemaining != null ? `${s.daysRemaining}d` : 'low'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 10 }}>
          Demand Forecasts
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.forecasts.slice(0, 15).map((f, i) => (
            <div key={f.sku || i} style={{
              padding: '12px 14px', background: 'var(--surface)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius)',
              animation: `fadeIn 0.2s ease ${i * 0.04}s both`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{f.name || f.sku}</div>
                  {f.lowConfidence && (
                    <div style={{ fontSize: 10, color: 'var(--warning)', marginTop: 2 }}>Low confidence — only {f.weeksSeen} weeks of data</div>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 16 }}>
                {[
                  { label: '30d', value: f.forecast30d },
                  { label: '60d', value: f.forecast60d },
                  { label: '90d', value: f.forecast90d },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{label}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
                  </div>
                ))}
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>weekly</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>{f.weeklyForecast}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function SalesIntelligence({ onNavigate }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [period, setPeriod] = useState(30);

  return (
    <div className="page" style={{ maxWidth: 800 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="page-title">Intelligence Hub</h1>
            <p className="page-subtitle">Cross-platform analytics and business insights</p>
          </div>
          {(activeTab === 'overview' || activeTab === 'channels' || activeTab === 'returns') && (
            <select
              value={period}
              onChange={e => setPeriod(Number(e.target.value))}
              style={{ padding: '6px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer' }}
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--surface2)', padding: 4, borderRadius: 'var(--radius-lg)', overflowX: 'auto' }}>
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                borderRadius: 'var(--radius)', border: 'none', cursor: 'pointer',
                background: isActive ? 'var(--surface)' : 'transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                fontWeight: isActive ? 600 : 400, fontSize: 13,
                boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
                transition: 'all 0.15s ease', fontFamily: 'var(--font-body)',
                flexShrink: 0,
              }}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div style={{ animation: 'fadeIn 0.2s ease' }} key={`${activeTab}-${period}`}>
        {activeTab === 'overview'  && <OverviewTab period={period} onNavigate={onNavigate} />}
        {activeTab === 'channels'  && <ChannelsTab period={period} />}
        {activeTab === 'products'  && <ProductsTab onNavigate={onNavigate} />}
        {activeTab === 'returns'   && <ReturnsTab period={period} />}
        {activeTab === 'forecast'  && <ForecastTab />}
      </div>
    </div>
  );
}
