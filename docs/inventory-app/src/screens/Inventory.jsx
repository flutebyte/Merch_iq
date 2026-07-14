import React, { useState, useEffect } from 'react';
import { Search, Filter, Plus, Camera, ChevronRight, ChevronLeft, Package, Download } from 'lucide-react';
import { useFetch } from '../hooks/useApi';
import { useToast } from '../contexts/ToastContext';
import { toCsv, downloadCsv } from '../utils/csv';

const fmt = (n) => n == null ? '—' : `₹${n.toLocaleString('en-IN')}`;
const PAGE_SIZE = 50;

const EXPORT_COLUMNS = [
  { label: 'Name',          value: p => p.name },
  { label: 'SKU',           value: p => p.sku || '' },
  { label: 'Category',      value: p => p.category },
  { label: 'Size',          value: p => p.size || '' },
  { label: 'Color',         value: p => p.color || '' },
  { label: 'Quantity',      value: p => p.quantity ?? '' },
  { label: 'Price (INR)',   value: p => p.price ?? '' },
  { label: 'Status',        value: p => p.status },
  { label: 'Dead Stock',    value: p => p.isDeadStock ? 'Yes' : 'No' },
  { label: 'Days Unmoved',  value: p => p.daysUnmoved ?? '' },
];

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
  return {
    ...p,
    name: p.name || 'Unnamed product',
    category: p.category || 'Uncategorized',
    status,
    missingDetails,
    quantity: totalQty || null,
    price: p.sellingPrice ? parseFloat(p.sellingPrice) : null,
    isDeadStock,
    daysUnmoved: p.daysUnmoved ?? null,
  };
}

export default function Inventory({ onSelectProduct, onNavigate }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [page, setPage] = useState(1);
  const { showToast } = useToast();

  const { data: rawProducts, loading, error, refetch } = useFetch('/products');
  const allProducts = (rawProducts || []).map(mapProduct);

  const categories = ['all', ...new Set(allProducts.map(p => p.category))];
  const statuses = ['all', 'verified', 'unverified', 'draft'];

  const filtered = allProducts.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !search
      || (p.name || '').toLowerCase().includes(q)
      || (p.sku && p.sku.toLowerCase().includes(q))
      || (p.size && p.size.toLowerCase().includes(q))
      || (p.color && p.color.toLowerCase().includes(q));
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    const matchCat = categoryFilter === 'all' || p.category === categoryFilter;
    return matchSearch && matchStatus && matchCat;
  });

  // Reset to page 1 whenever the result set changes shape so users don't get
  // stranded on a now-empty page after narrowing a search/filter.
  useEffect(() => { setPage(1); }, [search, statusFilter, categoryFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const stats = {
    all:        allProducts.length,
    verified:   allProducts.filter(p => p.status === 'verified').length,
    unverified: allProducts.filter(p => p.status === 'unverified').length,
    draft:      allProducts.filter(p => p.status === 'draft').length,
  };

  const handleExport = () => {
    if (filtered.length === 0) {
      showToast('No products match the current filters to export.', { variant: 'error' });
      return;
    }
    const csv = toCsv(EXPORT_COLUMNS, filtered);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`inventory-${stamp}.csv`, csv);
    showToast(`Exported ${filtered.length} product${filtered.length !== 1 ? 's' : ''} to CSV.`, { variant: 'success' });
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
          <button
            className="btn btn-ghost"
            onClick={handleExport}
            disabled={loading || !!error}
            title="Export the currently filtered products to a CSV file"
          >
            <Download size={14} /> Export CSV
          </button>
          <button className="btn btn-ghost" onClick={() => onNavigate('photo')}>
            <Camera size={14} /> Add via photo
          </button>
          <button className="btn btn-primary" onClick={() => onNavigate('photo')}>
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
            {loading && [1, 2, 3, 4, 5].map(i => (
              <tr key={`sk-${i}`}>
                <td colSpan={8} style={{ padding: '10px 16px' }}>
                  <div className="skeleton" style={{ height: 24 }} />
                </td>
              </tr>
            ))}
            {!loading && error && (
              <tr>
                <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: 'var(--danger)' }}>
                  <div>Couldn&apos;t load products.{' '}
                    <button
                      onClick={refetch}
                      style={{ textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 13, fontFamily: 'var(--font-body)' }}
                    >
                      Retry
                    </button>
                  </div>
                </td>
              </tr>
            )}
            {!loading && !error && filtered.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Package size={32} style={{ marginBottom: 12, opacity: 0.3 }} />
                  <div>No products found</div>
                </td>
              </tr>
            )}
            {paged.map((p, i) => (
              <tr
                key={p.id}
                tabIndex={0}
                role="button"
                aria-label={`View ${p.name}`}
                style={{
                  borderTop: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.1s ease',
                  animation: `fadeIn 0.2s ease ${i * 0.03}s both`
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                onFocus={e => e.currentTarget.style.background = 'var(--surface2)'}
                onBlur={e => e.currentTarget.style.background = 'transparent'}
                onClick={() => onSelectProduct(p)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectProduct(p); }
                }}
              >
                <td style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: 7, flexShrink: 0,
                      border: '1px solid var(--border)', overflow: 'hidden',
                      background: 'var(--accent-dim)',
                      position: 'relative',
                    }}>
                      {p.images?.[0] ? (
                        <img
                          src={p.images[0]}
                          alt=""
                          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>
                          {(p.name || '?').charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{p.name}</div>
                      <div style={{ display: 'flex', gap: 4, marginTop: 3, flexWrap: 'wrap' }}>
                        {p.size && (
                          <span style={{ fontSize: 9, padding: '1px 6px', background: 'var(--accent-dim)', color: 'var(--accent)', borderRadius: 4, border: '1px solid var(--accent-border)', fontWeight: 600, letterSpacing: '0.03em' }}>{p.size}</span>
                        )}
                        {p.color && (
                          <span style={{ fontSize: 9, padding: '1px 6px', background: 'var(--surface2)', color: 'var(--text-secondary)', borderRadius: 4, border: '1px solid var(--border)', fontWeight: 500 }}>{p.color}</span>
                        )}
                        {p.missingDetails.length > 0 && (
                          <span style={{ fontSize: 9, color: 'var(--danger)' }}>missing {p.missingDetails.join(', ')}</span>
                        )}
                      </div>
                    </div>
                  </div>
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
                      {p.daysUnmoved != null && (
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>{p.daysUnmoved}d unmoved</div>
                      )}
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

      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {loading
            ? 'Loading…'
            : filtered.length === 0
              ? `0 of ${allProducts.length} products`
              : `Showing ${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, filtered.length)} of ${filtered.length} products`}
        </div>
        {!loading && pageCount > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              aria-label="Previous page"
            >
              <ChevronLeft size={14} /> Prev
            </button>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              Page {safePage} of {pageCount}
            </span>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setPage(p => Math.min(pageCount, p + 1))}
              disabled={safePage >= pageCount}
              aria-label="Next page"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
