import React, { useState } from 'react';
import { Plus, Loader, RefreshCw, ChevronDown, TrendingUp } from 'lucide-react';
import { useFetch, useApiRequest } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';

const fmt = (n) => {
  if (n == null) return '—';
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000)   return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${Math.round(parseFloat(n)).toLocaleString('en-IN')}`;
};

const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

// ── SVG Line Graph ────────────────────────────────────────────────────────────

function RevenueLineGraph({ trend }) {
  if (!trend || trend.length < 2) return null;

  const W = 600, H = 72, PAD = 4;
  const values = trend.map(d => d.revenue);
  const max = Math.max(...values, 1);
  const pts = trend.map((d, i) => {
    const x = PAD + (i / (trend.length - 1)) * (W - PAD * 2);
    const y = H - PAD - ((d.revenue / max) * (H - PAD * 2));
    return [x, y];
  });

  const linePath = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const fillPath = `${linePath} L ${pts[pts.length - 1][0].toFixed(1)} ${H} L ${pts[0][0].toFixed(1)} ${H} Z`;

  const nonZeroDays = values.filter(v => v > 0).length;
  const avgRevenue  = nonZeroDays > 0 ? values.reduce((s, v) => s + v, 0) / nonZeroDays : 0;

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
          Daily Revenue
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          avg {fmt(avgRevenue)}/day · {nonZeroDays} active days
        </span>
      </div>
      <div style={{ background: 'var(--surface2)', borderRadius: 'var(--radius)', padding: '8px 0 0', overflow: 'hidden', border: '1px solid var(--border)' }}>
        <svg
          width="100%" height={H}
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          style={{ display: 'block' }}
        >
          <defs>
            <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <path d={fillPath} fill="url(#salesFill)" />
          <path d={linePath} fill="none" stroke="#7c3aed" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          {pts.map(([x, y], i) => values[i] === max && (
            <circle key={i} cx={x} cy={y} r="3" fill="#7c3aed" />
          ))}
        </svg>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', fontSize: 10, color: 'var(--text-muted)' }}>
          <span>{trend[0]?.date ? new Date(trend[0].date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}</span>
          <span>{trend[trend.length - 1]?.date ? new Date(trend[trend.length - 1].date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}</span>
        </div>
      </div>
    </div>
  );
}

// ── Manual Sale Modal ─────────────────────────────────────────────────────────

function AddSaleModal({ products, onClose, onSuccess }) {
  const { post, loading } = useApiRequest();
  const [form, setForm] = useState({
    productId: '', quantity: '', price: '', date: new Date().toISOString().slice(0, 10),
    channel: 'direct', notes: '',
  });
  const [error, setError] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.productId) { setError('Select a product'); return; }
    if (!form.quantity || +form.quantity <= 0) { setError('Enter a valid quantity'); return; }
    try {
      await post('/sales-records', {
        productId: form.productId,
        quantity: parseInt(form.quantity, 10),
        price: form.price ? parseFloat(form.price) : null,
        date: form.date,
        channel: form.channel || null,
        notes: form.notes || null,
      });
      window.dispatchEvent(new Event('inv:mutation'));
      onSuccess();
    } catch (err) {
      setError(err.message || 'Failed to record sale');
    }
  };

  const inputStyle = {
    width: '100%', padding: '9px 12px', background: 'var(--surface)',
    border: '1px solid var(--border2)', borderRadius: 'var(--radius)',
    color: 'var(--text-primary)', fontSize: 14, outline: 'none',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: 480, boxShadow: 'var(--shadow-lg)', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Record Manual Sale</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5 }}>Product</label>
            <div style={{ position: 'relative' }}>
              <select value={form.productId} onChange={e => set('productId', e.target.value)} required style={{ ...inputStyle, appearance: 'none', paddingRight: 32 }}>
                <option value="">Select product…</option>
                {(Array.isArray(products) ? products : []).map(p => (
                  <option key={p.id} value={p.id}>{p.name || p.sku || p.id}</option>
                ))}
              </select>
              <ChevronDown size={14} color="var(--text-muted)" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5 }}>Quantity</label>
              <input type="number" min="1" value={form.quantity} onChange={e => set('quantity', e.target.value)} required placeholder="e.g. 3" style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5 }}>Sale Price (₹)</label>
              <input type="number" min="0" step="0.01" value={form.price} onChange={e => set('price', e.target.value)} placeholder="Optional" style={inputStyle} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5 }}>Date</label>
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5 }}>Channel</label>
              <div style={{ position: 'relative' }}>
                <select value={form.channel} onChange={e => set('channel', e.target.value)} style={{ ...inputStyle, appearance: 'none', paddingRight: 32 }}>
                  <option value="direct">Direct</option>
                  <option value="instagram">Instagram</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="website">Website</option>
                  <option value="marketplace">Marketplace</option>
                  <option value="other">Other</option>
                </select>
                <ChevronDown size={14} color="var(--text-muted)" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              </div>
            </div>
          </div>
          {error && <div style={{ fontSize: 12, color: 'var(--danger)' }}>{error}</div>}
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose} style={{ flex: 1, justifyContent: 'center' }}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 2, justifyContent: 'center' }}>
              {loading ? <Loader size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> : 'Record Sale'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

const PERIOD_OPTIONS = [
  { label: '7d',  value: 7 },
  { label: '30d', value: 30 },
  { label: '90d', value: 90 },
];

export default function SalesScreen({ onNavigate }) {
  const [period, setPeriod]       = useState(30);
  const [showModal, setShowModal] = useState(false);

  const { data: productsData } = useFetch('/products');
  const { data, loading, error, refetch } = useFetch(`/analytics/order-sales?days=${period}`);

  const orders   = data?.orders   || [];
  const trend    = data?.trend    || [];
  const products = productsData   || [];

  const PLATFORM_COLOR = { meesho: '#F43397', ajio: '#E91E63' };

  return (
    <div className="page" style={{ animation: 'fadeIn 0.25s ease' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title">Sales</h1>
          <p className="page-subtitle">Delivered & shipped orders from all platforms</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Period selector */}
          <div style={{ display: 'flex', background: 'var(--surface2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden' }}>
            {PERIOD_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setPeriod(opt.value)}
                style={{
                  padding: '5px 12px', fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer',
                  background: period === opt.value ? 'var(--accent)' : 'transparent',
                  color: period === opt.value ? '#fff' : 'var(--text-secondary)',
                  transition: 'all 0.15s',
                }}
              >{opt.label}</button>
            ))}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={refetch} disabled={loading}>
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={14} /> Manual Sale
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="skeleton" style={{ height: 100 }} />
          <div className="skeleton" style={{ height: 56 }} />
          <div className="skeleton" style={{ height: 56 }} />
          <div className="skeleton" style={{ height: 56 }} />
        </div>
      ) : error ? (
        <div style={{ padding: 20, color: 'var(--danger)', fontSize: 13 }}>
          Failed to load sales.{' '}
          <button onClick={refetch} style={{ textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 13 }}>Retry</button>
        </div>
      ) : orders.length === 0 ? (
        <div className="empty-state">
          <TrendingUp size={32} style={{ opacity: 0.3 }} />
          <h3>No sales yet</h3>
          <p>Import your Meesho or Ajio order report in Settings → Integrations to see sales here.</p>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => onNavigate && onNavigate('settings')}>
            Go to Integrations
          </button>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Revenue',    value: fmt(data.totalRevenue), color: 'var(--success)' },
              { label: 'Orders',     value: (data.totalOrders || 0).toLocaleString('en-IN'), color: 'var(--accent)' },
              { label: 'Units Sold', value: (data.totalUnits  || 0).toLocaleString('en-IN'), color: 'var(--text-secondary)' },
            ].map(m => (
              <div key={m.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '14px 18px', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: m.color, fontVariantNumeric: 'tabular-nums' }}>{m.value}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{m.label}</div>
              </div>
            ))}
          </div>

          {/* Line graph */}
          <RevenueLineGraph trend={trend} />

          {/* Orders table */}
          <div className="card" style={{ padding: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
                  {['Order ID', 'Product / SKU', 'Qty', 'Revenue', 'Platform', 'Status', 'Date'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.slice(0, 200).map((o, i) => {
                  const items = Array.isArray(o.items) ? o.items : [];
                  const firstItem = items[0];
                  const totalQty = items.reduce((s, it) => s + (it.qty || 1), 0);
                  const platformColor = PLATFORM_COLOR[o.platform] || 'var(--accent)';
                  return (
                    <tr key={o.platformOrderId || i}
                      style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '10px 14px', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                        {(o.platformOrderId || '').slice(0, 14)}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 500 }}>
                        {firstItem?.name || firstItem?.sku || '—'}
                        {items.length > 1 && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>+{items.length - 1}</span>}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{totalQty}</td>
                      <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600, color: 'var(--success)', fontVariantNumeric: 'tabular-nums' }}>{fmt(o.grossAmount)}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 100, background: `${platformColor}22`, color: platformColor, fontWeight: 600, textTransform: 'capitalize' }}>
                          {o.platform}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 100, background: o.status === 'delivered' ? 'var(--success-dim)' : 'var(--accent-dim)', color: o.status === 'delivered' ? 'var(--success)' : 'var(--accent)', fontWeight: 500 }}>
                          {o.status}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)' }}>{fmtDate(o.orderDate)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {orders.length > 200 && (
              <div style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
                Showing first 200 of {orders.length} orders — narrow the date range to see more
              </div>
            )}
          </div>
        </>
      )}

      {showModal && (
        <AddSaleModal
          products={products}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); refetch(); }}
        />
      )}
    </div>
  );
}
