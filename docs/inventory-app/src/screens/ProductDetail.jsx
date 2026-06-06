import React, { useState } from 'react';
import { ArrowLeft, Check, AlertTriangle, TrendingDown, Zap, Edit2 } from 'lucide-react';

const fmt = (n) => n == null ? '—' : `₹${n.toLocaleString('en-IN')}`;

const deadStockActions = [
  { id: 'discount', label: 'Discount', sub: 'Run a limited-time sale', color: 'var(--success)' },
  { id: 'bundle', label: 'Bundle', sub: 'Pair with moving products', color: 'var(--accent)' },
  { id: 'relist', label: 'Relist', sub: 'New photos & description', color: 'var(--info)' },
  { id: 'wholesale', label: 'Wholesale', sub: 'Sell to another retailer', color: 'var(--warning)' },
  { id: 'liquidate', label: 'Liquidate', sub: 'Clear at cost', color: 'var(--danger)' },
];

export default function ProductDetail({ product, onBack }) {
  const [editing, setEditing] = useState(null);
  const [values, setValues] = useState({
    name: product.name, sku: product.sku || '', price: product.price || '', quantity: product.quantity || ''
  });
  const [verified, setVerified] = useState(product.status === 'verified');
  const [chosenAction, setChosenAction] = useState(null);

  const maxSales = Math.max(...(product.sales?.map(s => s.qty) || [1])) || 1;

  return (
    <div style={{ padding: '28px 24px', maxWidth: 800, margin: '0 auto', animation: 'fadeIn 0.3s ease' }}>
      <button className="btn btn-ghost" style={{ marginBottom: 20, padding: '6px 12px' }} onClick={onBack}>
        <ArrowLeft size={14} /> Back
      </button>

      {/* Product header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className={`tag tag-${product.status}`}>{product.status}</span>
            {product.isDeadStock && <span className="tag tag-dead">Dead stock</span>}
            {product.missingDetails.map(d => (
              <span key={d} style={{ fontSize: 10, padding: '2px 8px', background: 'var(--danger-dim)', color: 'var(--danger)', borderRadius: 100, border: '1px solid rgba(232,90,79,0.2)' }}>
                missing {d}
              </span>
            ))}
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, lineHeight: 1.1 }}>{product.name}</h1>
          {product.sku && <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>SKU: {product.sku}</p>}
        </div>
        {!verified && (
          <button className="btn btn-primary" onClick={() => setVerified(true)}>
            <Check size={14} /> Mark verified
          </button>
        )}
        {verified && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', color: 'var(--success)', fontSize: 12 }}>
            <Check size={14} /> Verified
          </div>
        )}
      </div>

      {/* Details grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Price', key: 'price', value: fmt(product.price), mono: true, prefix: '₹' },
          { label: 'Quantity', key: 'quantity', value: product.quantity ?? '?', mono: true },
          { label: 'Category', key: 'category', value: product.category },
          { label: 'Days unmoved', key: null, value: product.daysUnmoved + ' days', mono: true },
        ].map(field => (
          <div key={field.label} className="card" style={{ padding: '16px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 6 }}>{field.label}</div>
            {editing === field.key ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  autoFocus
                  value={values[field.key]}
                  onChange={e => setValues(v => ({ ...v, [field.key]: e.target.value }))}
                  style={{
                    flex: 1, padding: '6px 10px', background: 'var(--surface2)', border: '1px solid var(--accent)',
                    borderRadius: 6, color: 'var(--text-primary)', fontSize: 14, fontFamily: field.mono ? 'var(--font-mono)' : 'inherit', outline: 'none'
                  }}
                />
                <button className="btn btn-primary" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => setEditing(null)}>Save</button>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 18, fontWeight: 600, fontFamily: field.mono ? 'var(--font-mono)' : 'inherit', color: field.value === '?' || field.value === '—' ? 'var(--warning)' : 'var(--text-primary)' }}>
                  {field.key ? values[field.key] || field.value : field.value}
                </span>
                {field.key && (
                  <button onClick={() => setEditing(field.key)} style={{ color: 'var(--text-muted)', cursor: 'pointer', padding: 4, background: 'none', border: 'none' }}>
                    <Edit2 size={13} />
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Sizes & Colors */}
      {(product.sizes?.length > 0 || product.colors?.length > 0) && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', gap: 32 }}>
            {product.sizes?.length > 0 && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 8 }}>Sizes</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {product.sizes.map(s => (
                    <span key={s} style={{ padding: '4px 12px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, fontWeight: 500 }}>{s}</span>
                  ))}
                </div>
              </div>
            )}
            {product.colors?.length > 0 && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 8 }}>Colors</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {product.colors.map(c => (
                    <span key={c} style={{ padding: '4px 12px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}>{c}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sales history */}
      {product.sales && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 16 }}>Sales History</div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', height: 80 }}>
            {product.sales.map(s => (
              <div key={s.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{s.qty}</div>
                <div style={{
                  width: '100%', borderRadius: 4,
                  height: `${Math.max((s.qty / maxSales) * 52, s.qty > 0 ? 8 : 3)}px`,
                  background: s.qty === 0 ? 'var(--border2)' : 'var(--accent)',
                  opacity: s.qty === 0 ? 0.5 : 1,
                  transition: 'height 0.3s ease'
                }} />
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{s.month}</div>
              </div>
            ))}
          </div>
          {product.isDeadStock && (
            <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', color: 'var(--danger)', fontSize: 12 }}>
              <TrendingDown size={13} /> No sales in {product.daysUnmoved}+ days
            </div>
          )}
        </div>
      )}

      {/* Dead Stock recommendations */}
      {product.isDeadStock && (
        <div className="card" style={{ border: '1px solid var(--warning)' + '40' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
            <Zap size={15} color="var(--warning)" />
            <span style={{ fontWeight: 600, fontSize: 14 }}>Recovery Recommendations</span>
          </div>
          {product.stuckValue && (
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Estimated stuck value: <strong style={{ color: 'var(--warning)', fontFamily: 'var(--font-mono)' }}>₹{product.stuckValue.toLocaleString('en-IN')}</strong>
            </p>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
            {deadStockActions.map(a => (
              <button
                key={a.id}
                onClick={() => setChosenAction(a.id)}
                style={{
                  padding: '12px', borderRadius: 'var(--radius)', border: `1px solid ${chosenAction === a.id ? a.color : 'var(--border)'}`,
                  background: chosenAction === a.id ? `${a.color}18` : 'var(--surface2)',
                  textAlign: 'left', cursor: 'pointer', transition: 'all 0.15s ease'
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: chosenAction === a.id ? a.color : 'var(--text-primary)', marginBottom: 2 }}>{a.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.sub}</div>
              </button>
            ))}
          </div>
          {chosenAction && (
            <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--success-dim)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--success)', animation: 'fadeIn 0.2s ease' }}>
              <Check size={12} style={{ marginRight: 6, verticalAlign: 'middle' }} />
              Action "{deadStockActions.find(a => a.id === chosenAction)?.label}" noted. This will appear in your Action Center.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
