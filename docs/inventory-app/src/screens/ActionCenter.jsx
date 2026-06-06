import React, { useState } from 'react';
import { ClipboardList, Check, DollarSign, Package, AlertTriangle, TrendingDown, Users, ChevronRight } from 'lucide-react';

const actionIcons = {
  price: DollarSign,
  quantity: Package,
  deadstock: TrendingDown,
  detail: AlertTriangle,
  verify: Check
};

const actionColors = {
  price: 'var(--success)',
  quantity: 'var(--warning)',
  deadstock: 'var(--danger)',
  detail: 'var(--info)',
  verify: 'var(--accent)'
};

const fmt = (n) => n == null ? '—' : `₹${n.toLocaleString('en-IN')}`;

export default function ActionCenter({ onNavigate }) {
  const [done, setDone] = useState([]);
  const [expanded, setExpanded] = useState(null);

  // Actions will be populated from the API in Phase 2 (confidence score jobs + action queue)
  const actions   = [];
  const allProducts = [];

  const pending   = actions.filter(a => !done.includes(a.id));
  const completed = actions.filter(a => done.includes(a.id));

  return (
    <div style={{ padding: '28px 24px', maxWidth: 800, margin: '0 auto', animation: 'fadeIn 0.3s ease' }}>
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>
          Action Center
        </p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32 }}>Your next steps</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: 6 }}>
          {pending.length} action{pending.length !== 1 ? 's' : ''} pending · {completed.length} completed
        </p>
      </div>

      {/* Progress */}
      <div style={{ marginBottom: 28, padding: '16px 20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>Completion</span>
          <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{completed.length}/{actions.length}</span>
        </div>
        <div style={{ height: 6, background: 'var(--surface2)', borderRadius: 100, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 100, background: 'var(--accent)',
            width: `${actions.length ? (completed.length / actions.length) * 100 : 0}%`,
            transition: 'width 0.4s ease'
          }} />
        </div>
      </div>

      {/* Pending */}
      {pending.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <h3 style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 12 }}>
            Pending
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pending.map((action, i) => {
              const Icon = actionIcons[action.type] || ClipboardList;
              const color = actionColors[action.type];
              const isExpanded = expanded === action.id;
              const relatedProducts = allProducts.filter(p => action.productIds?.includes(p.id));

              return (
                <div
                  key={action.id}
                  style={{
                    background: 'var(--surface)', border: `1px solid ${isExpanded ? color + '40' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-lg)', overflow: 'hidden', transition: 'border 0.2s ease',
                    animation: `fadeIn 0.2s ease ${i * 0.05}s both`
                  }}
                >
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px', cursor: 'pointer' }}
                    onClick={() => setExpanded(isExpanded ? null : action.id)}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                      background: `${color}18`, border: `1px solid ${color}30`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <Icon size={16} color={color} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500, fontSize: 14 }}>{action.label}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                        {action.productIds.length} product{action.productIds.length !== 1 ? 's' : ''} affected
                      </div>
                    </div>
                    <span className={`tag tag-${action.priority}`}>{action.priority}</span>
                    <ChevronRight size={14} color="var(--text-muted)" style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s ease' }} />
                  </div>

                  {isExpanded && (
                    <div style={{ borderTop: '1px solid var(--border)', padding: '14px 18px', animation: 'fadeIn 0.2s ease' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                        {relatedProducts.map(p => (
                          <div key={p.id} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px',
                            background: 'var(--surface2)', borderRadius: 'var(--radius)'
                          }}>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 500 }}>{p.name}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                {p.sku ? `SKU: ${p.sku}` : 'No SKU'} · Qty: {p.quantity ?? '?'}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              {p.price ? <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{fmt(p.price)}</div> : <div style={{ fontSize: 11, color: 'var(--warning)' }}>No price</div>}
                              {p.isDeadStock && p.stuckValue && <div style={{ fontSize: 10, color: 'var(--danger)', fontFamily: 'var(--font-mono)' }}>{fmt(p.stuckValue)} stuck</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          className="btn btn-primary"
                          style={{ fontSize: 12, padding: '8px 16px' }}
                          onClick={() => { setDone(d => [...d, action.id]); setExpanded(null); }}
                        >
                          <Check size={13} /> Mark done
                        </button>
                        <button className="btn btn-ghost" style={{ fontSize: 12, padding: '8px 16px' }} onClick={() => onNavigate('inventory')}>
                          View products
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <div>
          <h3 style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 12 }}>
            Completed
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {completed.map(action => (
              <div key={action.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                opacity: 0.5, animation: 'fadeIn 0.2s ease'
              }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--success-dim)', border: '1px solid rgba(93,190,138,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Check size={12} color="var(--success)" />
                </div>
                <span style={{ fontSize: 13, textDecoration: 'line-through', color: 'var(--text-muted)' }}>{action.label}</span>
                <button
                  onClick={() => setDone(d => d.filter(id => id !== action.id))}
                  style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer', background: 'none', border: 'none' }}
                >
                  Undo
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {pending.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 0', animation: 'slideUp 0.4s ease' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--success-dim)', border: '1px solid rgba(93,190,138,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Check size={28} color="var(--success)" />
          </div>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 24, marginBottom: 8 }}>All caught up!</h3>
          <p style={{ color: 'var(--text-muted)' }}>Check back after adding new inventory.</p>
        </div>
      )}
    </div>
  );
}
