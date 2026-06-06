import React, { useState } from 'react';
import { Search, Filter, Plus, Camera, ChevronRight, Package } from 'lucide-react';
import { useFetch } from '../hooks/useApi';

const fmt = (n) => n == null ? '—' : `₹${n.toLocaleString('en-IN')}`;

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
  return {
    ...p,
    name: p.name || 'Unnamed product',
    category: p.category || 'Uncategorized',
    status,
    missingDetails,
    quantity: totalQty || null,
    price: p.sellingPrice ? parseFloat(p.sellingPrice) : null,
    isDeadStock: false,
  };
}

export default function Inventory({ onSelectProduct, onNavigate }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const { data: rawProducts, loading } = useFetch('/products');
  const allProducts = (rawProducts || []).map(mapProduct);

  const categories = ['all', ...new Set(allProducts.map(p => p.category))];
  const statuses = ['all', 'verified', 'unverified', 'draft'];

  const filtered = allProducts.filter(p => {
    const matchSearch = !search || (p.name || '').toLowerCase().includes(search.toLowerCase()) || (p.sku && p.sku.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    const matchCat = categoryFilter === 'all' || p.category === categoryFilter;
    return matchSearch && matchStatus && matchCat;
  });

  const stats = {
    all:        allProducts.length,
    verified:   allProducts.filter(p => p.status === 'verified').length,
    unverified: allProducts.filter(p => p.status === 'unverified').length,
    draft:      allProducts.filter(p => p.status === 'draft').length,
  };

  return (
    <div style={{ padding: '28px 24px', maxWidth: 1100, margin: '0 auto', animation: 'fadeIn 0.3s ease' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>Inventory</p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32 }}>All Products</h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={() => onNavigate('photo')}>
            <Camera size={14} /> Add via photo
          </button>
          <button className="btn btn-primary">
            <Plus size={14} /> Add product
          </button>
        </div>
      </div>

      {/* Status tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {statuses.map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            style={{
              padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s ease',
              background: statusFilter === s ? 'var(--surface2)' : 'transparent',
              color: statusFilter === s ? 'var(--text-primary)' : 'var(--text-muted)',
              border: statusFilter === s ? '1px solid var(--border2)' : '1px solid transparent',
            }}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
            <span style={{ marginLeft: 6, fontFamily: 'var(--font-mono)', fontSize: 10, opacity: 0.7 }}>{stats[s]}</span>
          </button>
        ))}
      </div>

      {/* Search & Filter */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or SKU…"
            style={{
              width: '100%', padding: '9px 12px 9px 34px',
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
              color: 'var(--text-primary)', fontSize: 13, outline: 'none'
            }}
          />
        </div>
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          style={{
            padding: '9px 12px', background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', color: 'var(--text-secondary)', fontSize: 13
          }}
        >
          {categories.map(c => <option key={c} value={c}>{c === 'all' ? 'All categories' : c}</option>)}
        </select>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--surface2)' }}>
              {['Product', 'SKU', 'Category', 'Qty', 'Price', 'Status', 'Dead Stock', ''].map(h => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Package size={32} style={{ marginBottom: 12, opacity: 0.3 }} />
                  <div>No products found</div>
                </td>
              </tr>
            )}
            {filtered.map((p, i) => (
              <tr
                key={p.id}
                style={{
                  borderTop: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.1s ease',
                  animation: `fadeIn 0.2s ease ${i * 0.03}s both`
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                onClick={() => onSelectProduct(p)}
              >
                <td style={{ padding: '14px 16px' }}>
                  <div style={{ fontWeight: 500, fontSize: 13 }}>{p.name}</div>
                  {p.missingDetails.length > 0 && (
                    <div style={{ fontSize: 10, color: 'var(--danger)', marginTop: 2 }}>
                      Missing: {p.missingDetails.join(', ')}
                    </div>
                  )}
                </td>
                <td style={{ padding: '14px 16px', fontFamily: 'var(--font-mono)', fontSize: 11, color: p.sku ? 'var(--text-secondary)' : 'var(--danger)' }}>
                  {p.sku || '—'}
                </td>
                <td style={{ padding: '14px 16px', fontSize: 12, color: 'var(--text-secondary)' }}>{p.category}</td>
                <td style={{ padding: '14px 16px', fontFamily: 'var(--font-mono)', fontSize: 12, color: p.quantity != null ? 'var(--text-primary)' : 'var(--warning)' }}>
                  {p.quantity ?? '?'}
                </td>
                <td style={{ padding: '14px 16px', fontFamily: 'var(--font-mono)', fontSize: 12, color: p.price != null ? 'var(--text-primary)' : 'var(--warning)' }}>
                  {fmt(p.price)}
                </td>
                <td style={{ padding: '14px 16px' }}>
                  <span className={`tag tag-${p.status}`}>{p.status}</span>
                </td>
                <td style={{ padding: '14px 16px' }}>
                  {p.isDeadStock && (
                    <div>
                      <span className="tag tag-dead">Dead</span>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>{p.daysUnmoved}d</div>
                    </div>
                  )}
                </td>
                <td style={{ padding: '14px 16px' }}>
                  <ChevronRight size={14} color="var(--text-muted)" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
        {loading ? 'Loading…' : `${filtered.length} of ${allProducts.length} products`}
      </div>
    </div>
  );
}
