import React, { useState } from 'react';
import { ArrowLeft, Check, AlertTriangle, TrendingDown, Zap, Edit2, Loader, Plus, X, Trash2 } from 'lucide-react';
import { useApiRequest } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';
import { uploadImage } from '../utils/imageUpload';

const fmt = (n) => n == null ? '—' : `₹${n.toLocaleString('en-IN')}`;

const deadStockActions = [
  { id: 'discount',  label: 'Discount',  sub: 'Run a limited-time sale',   color: 'var(--success)' },
  { id: 'bundle',    label: 'Bundle',    sub: 'Pair with moving products', color: 'var(--accent)' },
  { id: 'relist',    label: 'Relist',    sub: 'New photos & description',  color: 'var(--info)' },
  { id: 'wholesale', label: 'Wholesale', sub: 'Sell to another retailer',  color: 'var(--warning)' },
  { id: 'liquidate', label: 'Liquidate', sub: 'Clear at cost',             color: 'var(--danger)' },
];

function parseLotColor(notes) {
  if (!notes) return null;
  const m = notes.match(/^Color:\s*(.+)/i);
  return m ? m[1].trim() : null;
}

export default function ProductDetail({ product, onBack, onUpdate }) {
  const { patch, post, del } = useApiRequest();
  const { token } = useAuth();

  const [editing, setEditing]     = useState('');
  const [saving, setSaving]       = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [values, setValues]       = useState({
    name:     product.name     || '',
    sku:      product.sku      || '',
    price:    product.price    != null ? String(product.price) : '',
    category: product.category || '',
  });
  const [verified, setVerified]         = useState(product.status === 'verified');
  const [verifying, setVerifying]       = useState(false);
  const [chosenAction, setChosenAction] = useState(null);
  const [localMissing, setLocalMissing] = useState(product.missingDetails || []);

  const [currentImage, setCurrentImage]     = useState(product.images?.[0] || null);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError]         = useState(null);

  // Lot editing
  const [editingLotId, setEditingLotId]   = useState(null);
  const [lotEditValues, setLotEditValues] = useState({});
  const [savingLot, setSavingLot]         = useState(false);
  const [deletingLotId, setDeletingLotId] = useState(null);

  // Add variant
  const [addingLot, setAddingLot]             = useState(false);
  const [newLot, setNewLot]                   = useState({ color: '', quantity: '' });
  const [addingLotSaving, setAddingLotSaving] = useState(false);

  // Local lots so UI updates instantly without waiting for re-fetch
  const [localLots, setLocalLots] = useState(product.stockLots || []);

  const totalQty = localLots.reduce((sum, l) => sum + (l.quantity || 0), 0);
  const maxSales = Math.max(...(product.sales?.map(s => s.qty) || [1])) || 1;

  // ── Image ────────────────────────────────────────────────────────────────────
  const handleImageReplace = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setImageUploading(true);
    setImageError(null);
    try {
      const url = await uploadImage(f, token);
      await patch(`/products/${product.id}`, { images: [url] });
      setCurrentImage(url);
      window.dispatchEvent(new CustomEvent('inv:mutation'));
    } catch (err) {
      setImageError(err.message || 'Image upload failed');
    } finally {
      setImageUploading(false);
    }
  };

  const handleImageRemove = async () => {
    setImageUploading(true);
    setImageError(null);
    try {
      await patch(`/products/${product.id}`, { images: [] });
      setCurrentImage(null);
      window.dispatchEvent(new CustomEvent('inv:mutation'));
    } catch (err) {
      setImageError(err.message || 'Failed to remove image');
    } finally {
      setImageUploading(false);
    }
  };

  // ── Field saves ───────────────────────────────────────────────────────────────
  const handleSave = async (key) => {
    if (!key) { setEditing(''); return; }
    setSaving(true);
    setSaveError(null);
    try {
      if (key === 'price') {
        const sp = values.price ? parseFloat(values.price) : null;
        await patch(`/products/${product.id}`, { sellingPrice: sp });
        setLocalMissing(prev => sp ? prev.filter(d => d !== 'price') : prev);
      } else if (key === 'name') {
        const name = values.name.trim() || null;
        await patch(`/products/${product.id}`, { name });
        setLocalMissing(prev => name ? prev.filter(d => d !== 'name') : prev);
      } else if (key === 'category') {
        const category = values.category.trim() || null;
        await patch(`/products/${product.id}`, { category });
      }
      setEditing('');
      window.dispatchEvent(new CustomEvent('inv:mutation'));
      if (onUpdate) onUpdate();
    } catch (err) {
      setSaveError(err.message || 'Save failed — please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── Lot save (color + qty) ────────────────────────────────────────────────────
  const startEditLot = (lot) => {
    setEditingLotId(lot.id);
    setLotEditValues(v => ({
      ...v,
      [lot.id]: { qty: String(lot.quantity ?? ''), color: parseLotColor(lot.notes) || '' },
    }));
  };

  const handleLotSave = async (lotId) => {
    setSavingLot(true);
    setSaveError(null);
    try {
      const ev  = lotEditValues[lotId] || {};
      const qty = ev.qty !== '' ? parseInt(ev.qty, 10) : null;
      const col = ev.color.trim();
      const notes = col ? `Color: ${col}` : null;
      await patch(`/stock-lots/${lotId}`, { quantity: isNaN(qty) ? null : qty, notes });
      setLocalLots(prev => prev.map(l => l.id === lotId ? { ...l, quantity: isNaN(qty) ? null : qty, notes } : l));
      setEditingLotId(null);
      window.dispatchEvent(new CustomEvent('inv:mutation'));
      if (onUpdate) onUpdate();
    } catch (err) {
      setSaveError(err.message || 'Save failed.');
    } finally {
      setSavingLot(false);
    }
  };

  // ── Lot delete ────────────────────────────────────────────────────────────────
  const handleLotDelete = async (lotId) => {
    if (!window.confirm('Delete this variant? This cannot be undone.')) return;
    setDeletingLotId(lotId);
    setSaveError(null);
    try {
      await del(`/stock-lots/${lotId}`);
      setLocalLots(prev => prev.filter(l => l.id !== lotId));
      window.dispatchEvent(new CustomEvent('inv:mutation'));
      if (onUpdate) onUpdate();
    } catch (err) {
      setSaveError(err.message || 'Delete failed.');
    } finally {
      setDeletingLotId(null);
    }
  };

  // ── Add lot ───────────────────────────────────────────────────────────────────
  const handleAddLot = async () => {
    const color = newLot.color.trim();
    const qty   = newLot.quantity !== '' ? parseInt(newLot.quantity, 10) : null;
    if (!color) { setSaveError('Enter a color name.'); return; }
    if (qty === null || isNaN(qty) || qty < 0) { setSaveError('Enter a valid quantity.'); return; }
    setAddingLotSaving(true);
    setSaveError(null);
    try {
      const created = await post('/stock-lots', {
        productId: product.id, quantity: qty, source: 'manual_entry', notes: `Color: ${color}`,
      });
      setLocalLots(prev => [...prev, created]);
      setAddingLot(false);
      setNewLot({ color: '', quantity: '' });
      window.dispatchEvent(new CustomEvent('inv:mutation'));
      if (onUpdate) onUpdate();
    } catch (err) {
      setSaveError(err.message || 'Failed to add variant.');
    } finally {
      setAddingLotSaving(false);
    }
  };

  // ── Mark verified ─────────────────────────────────────────────────────────────
  const handleMarkVerified = async () => {
    setVerifying(true);
    setSaveError(null);
    try {
      for (const lot of localLots) {
        await patch(`/stock-lots/${lot.id}`, { trigger: 'COUNT_RECORDED', version: lot.version });
      }
      setVerified(true);
      window.dispatchEvent(new CustomEvent('inv:mutation'));
      if (onUpdate) onUpdate();
    } catch (_) {
      setVerified(true);
    } finally {
      setVerifying(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '28px 24px', maxWidth: 800, margin: '0 auto', animation: 'fadeIn 0.3s ease' }}>
      <button className="btn btn-ghost" style={{ marginBottom: 20, padding: '6px 12px' }} onClick={onBack}>
        <ArrowLeft size={14} /> Back
      </button>

      {/* Error banner */}
      {saveError && (
        <div style={{ marginBottom: 16, padding: '10px 14px', background: 'var(--danger-dim)', border: '1px solid rgba(248,113,113,0.20)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={13} /> {saveError}
          <button onClick={() => setSaveError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 0 }}><X size={13} /></button>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className={`tag tag-${product.status}`}>{product.status}</span>
            {product.isDeadStock && <span className="tag tag-dead">Dead stock</span>}
            {localMissing.map(d => (
              <span key={d} style={{ fontSize: 10, padding: '2px 8px', background: 'var(--danger-dim)', color: 'var(--danger)', borderRadius: 100, border: '1px solid rgba(248,113,113,0.20)' }}>missing {d}</span>
            ))}
          </div>
          {editing === 'name' ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
              <input autoFocus value={values.name} onChange={e => setValues(v => ({ ...v, name: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') handleSave('name'); if (e.key === 'Escape') { setEditing(''); setSaveError(null); } }}
                style={{ fontSize: 24, fontFamily: 'var(--font-display)', fontWeight: 700, padding: '4px 10px', background: 'var(--surface2)', border: '1px solid var(--accent)', borderRadius: 8, color: 'var(--text-primary)', outline: 'none', boxShadow: '0 0 0 3px var(--accent-dim)' }}
              />
              <button className="btn btn-primary" style={S.saveBtn} disabled={saving} onClick={() => handleSave('name')}>
                {saving ? <Loader size={12} style={S.spin} /> : 'Save'}
              </button>
              <button className="btn btn-ghost" style={S.cancelBtn} onClick={() => { setEditing(''); setSaveError(null); }}>✕</button>
            </div>
          ) : (
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, lineHeight: 1.1, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}
              onClick={() => { setEditing('name'); setSaveError(null); }}>
              {values.name || 'Unnamed product'}
              <Edit2 size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
            </h1>
          )}
          {(values.sku || product.sku) && (
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>SKU: {values.sku || product.sku}</p>
          )}
        </div>
        {!verified ? (
          <button className="btn btn-primary" onClick={handleMarkVerified} disabled={verifying}>
            {verifying ? <Loader size={14} style={S.spin} /> : <Check size={14} />} Mark verified
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', color: 'var(--success)', fontSize: 12, fontWeight: 500 }}>
            <Check size={14} /> Verified
          </div>
        )}
      </div>

      {/* Product Image */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={S.label}>Product Image</div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          {/* <img> tag is used intentionally — avoids CSP issues that block CSS background-image for cross-origin URLs */}
          <div style={{ width: 80, height: 80, borderRadius: 10, flexShrink: 0, border: '1px solid var(--border)', overflow: 'hidden', background: 'var(--surface2)', position: 'relative' }}>
            {currentImage ? (
              <img src={currentImage} alt={product.name || 'Product'}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                onError={e => { e.target.style.display = 'none'; }}
              />
            ) : (
              <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 700, color: 'var(--text-muted)' }}>
                {(product.name || '?').charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ cursor: imageUploading ? 'not-allowed' : 'pointer' }}>
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageReplace} disabled={imageUploading} />
              <span className="btn btn-ghost" style={{ fontSize: 12, padding: '6px 14px', cursor: imageUploading ? 'not-allowed' : 'pointer', opacity: imageUploading ? 0.6 : 1 }}>
                {imageUploading ? <><Loader size={12} style={S.spin} /> Uploading…</> : currentImage ? 'Replace image' : 'Upload image'}
              </span>
            </label>
            {currentImage && !imageUploading && (
              <button onClick={handleImageRemove} className="btn btn-ghost" style={{ fontSize: 12, padding: '6px 14px', color: 'var(--danger)' }}>Remove image</button>
            )}
          </div>
        </div>
        {imageError && <div style={{ marginTop: 8, fontSize: 12, color: 'var(--danger)' }}>{imageError}</div>}
      </div>

      {/* Details grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>

        {/* Selling Price */}
        <div className="card" style={{ padding: 16 }}>
          <div style={S.label}>Selling Price</div>
          {editing === 'price' ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <input autoFocus value={values.price} onChange={e => setValues(v => ({ ...v, price: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') handleSave('price'); if (e.key === 'Escape') { setEditing(''); setSaveError(null); } }}
                placeholder="0" type="number" style={S.input} />
              <button className="btn btn-primary" style={S.saveBtn} disabled={saving} onClick={() => handleSave('price')}>
                {saving ? <Loader size={12} style={S.spin} /> : 'Save'}
              </button>
              <button className="btn btn-ghost" style={S.cancelBtn} disabled={saving} onClick={() => { setEditing(''); setSaveError(null); }}>✕</button>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 18, fontWeight: 600, fontFamily: 'var(--font-mono)', color: values.price ? 'var(--text-primary)' : 'var(--warning)' }}>
                {values.price ? fmt(parseFloat(values.price)) : '—'}
              </span>
              <button onClick={() => { setEditing('price'); setSaveError(null); }} style={S.editBtn}><Edit2 size={13} /></button>
            </div>
          )}
        </div>

        {/* Total Quantity */}
        <div className="card" style={{ padding: 16 }}>
          <div style={S.label}>Total Quantity</div>
          <div style={{ fontSize: 18, fontWeight: 600, fontFamily: 'var(--font-mono)', color: totalQty > 0 ? 'var(--text-primary)' : 'var(--warning)' }}>
            {totalQty || '—'}
          </div>
          {localLots.length > 1 && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{localLots.length} variants · edit below</div>
          )}
        </div>

        {/* Category */}
        <div className="card" style={{ padding: 16 }}>
          <div style={S.label}>Category</div>
          {editing === 'category' ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <input autoFocus value={values.category} onChange={e => setValues(v => ({ ...v, category: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') handleSave('category'); if (e.key === 'Escape') { setEditing(''); setSaveError(null); } }}
                placeholder="e.g. T-Shirts" style={S.input} />
              <button className="btn btn-primary" style={S.saveBtn} disabled={saving} onClick={() => handleSave('category')}>
                {saving ? <Loader size={12} style={S.spin} /> : 'Save'}
              </button>
              <button className="btn btn-ghost" style={S.cancelBtn} disabled={saving} onClick={() => { setEditing(''); setSaveError(null); }}>✕</button>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>
                {values.category || 'Uncategorized'}
              </span>
              <button onClick={() => { setEditing('category'); setSaveError(null); }} style={S.editBtn}><Edit2 size={13} /></button>
            </div>
          )}
        </div>

        {/* Days unmoved — computed from sales records, not directly editable */}
        <div className="card" style={{ padding: 16 }}>
          <div style={S.label}>
            Days Unmoved{' '}
            <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 10, opacity: 0.55 }}>(auto-computed)</span>
          </div>
          <span style={{ fontSize: 18, fontWeight: 600, fontFamily: 'var(--font-mono)', color: product.daysUnmoved != null ? (product.daysUnmoved > 30 ? 'var(--warning)' : 'var(--text-primary)') : 'var(--text-muted)' }}>
            {product.daysUnmoved != null ? `${product.daysUnmoved}d` : 'Never sold'}
          </span>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>Updates when a sale is recorded</div>
        </div>
      </div>

      {/* Stock Variants */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={S.label}>Stock Variants</div>
          <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => { setAddingLot(true); setSaveError(null); }}>
            <Plus size={12} /> Add variant
          </button>
        </div>

        {localLots.length === 0 && !addingLot && (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>No variants yet.</div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {localLots.map(lot => {
            const color     = parseLotColor(lot.notes);
            const isEditing = editingLotId === lot.id;
            const isDeleting = deletingLotId === lot.id;
            const ev        = lotEditValues[lot.id] || {};

            return (
              <div key={lot.id} style={{ padding: '10px 12px', background: 'var(--surface2)', borderRadius: 8, border: '1px solid var(--border)' }}>
                {isEditing ? (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <input autoFocus value={ev.color ?? color ?? ''} onChange={e => setLotEditValues(v => ({ ...v, [lot.id]: { ...v[lot.id], color: e.target.value } }))}
                      placeholder="Color" style={{ ...S.input, flex: 2, minWidth: 100 }} />
                    <input type="number" value={ev.qty ?? String(lot.quantity ?? '')} onChange={e => setLotEditValues(v => ({ ...v, [lot.id]: { ...v[lot.id], qty: e.target.value } }))}
                      onKeyDown={e => { if (e.key === 'Enter') handleLotSave(lot.id); if (e.key === 'Escape') setEditingLotId(null); }}
                      placeholder="Qty" style={{ ...S.input, flex: 1, minWidth: 70 }} />
                    <button className="btn btn-primary" style={S.saveBtn} disabled={savingLot} onClick={() => handleLotSave(lot.id)}>
                      {savingLot ? <Loader size={11} style={S.spin} /> : 'Save'}
                    </button>
                    <button className="btn btn-ghost" style={S.cancelBtn} onClick={() => setEditingLotId(null)}>✕</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {color && (
                      <div style={{ width: 14, height: 14, borderRadius: '50%', flexShrink: 0, background: CSS.supports('color', color) ? color : 'var(--accent)', border: '1px solid var(--border)' }} />
                    )}
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', flex: 1 }}>{color || 'Default'}</span>
                    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 100, background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--accent-border)', fontFamily: 'var(--font-mono)' }}>
                      {lot.confidenceState?.replace(/_/g, ' ')}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-mono)', color: lot.quantity != null ? 'var(--text-primary)' : 'var(--warning)', minWidth: 28, textAlign: 'right' }}>
                      {lot.quantity ?? '—'}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>pcs</span>
                    <button onClick={() => startEditLot(lot)} style={S.editBtn} title="Edit"><Edit2 size={12} /></button>
                    <button onClick={() => handleLotDelete(lot.id)} disabled={isDeleting} style={{ ...S.editBtn, color: 'var(--danger)' }} title="Delete">
                      {isDeleting ? <Loader size={12} style={S.spin} /> : <Trash2 size={12} />}
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {/* Add variant form */}
          {addingLot && (
            <div style={{ padding: '12px', background: 'var(--surface2)', borderRadius: 8, border: '1px dashed var(--accent-border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>New variant</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input autoFocus value={newLot.color} onChange={e => setNewLot(v => ({ ...v, color: e.target.value }))}
                  placeholder="Color (e.g. Red)" style={{ ...S.input, flex: 2, minWidth: 100 }} />
                <input value={newLot.quantity} onChange={e => setNewLot(v => ({ ...v, quantity: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddLot(); if (e.key === 'Escape') { setAddingLot(false); setSaveError(null); } }}
                  placeholder="Qty" type="number" style={{ ...S.input, flex: 1, minWidth: 70 }} />
                <button className="btn btn-primary" style={S.saveBtn} disabled={addingLotSaving} onClick={handleAddLot}>
                  {addingLotSaving ? <Loader size={12} style={S.spin} /> : 'Add'}
                </button>
                <button className="btn btn-ghost" style={S.cancelBtn} onClick={() => { setAddingLot(false); setSaveError(null); }}>✕</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sales history */}
      {product.sales && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ ...S.label, marginBottom: 16 }}>Sales History</div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', height: 80 }}>
            {product.sales.map(s => (
              <div key={s.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{s.qty}</div>
                <div style={{ width: '100%', borderRadius: 4, height: `${Math.max((s.qty / maxSales) * 52, s.qty > 0 ? 8 : 3)}px`, background: s.qty === 0 ? 'var(--border2)' : 'var(--accent)', opacity: s.qty === 0 ? 0.4 : 1, transition: 'height 0.3s ease' }} />
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

      {/* Dead Stock */}
      {product.isDeadStock && (
        <div className="card" style={{ border: '1px solid rgba(251,191,36,0.22)' }}>
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
              <button key={a.id} onClick={() => setChosenAction(a.id)} style={{
                padding: '12px', borderRadius: 'var(--radius)', cursor: 'pointer',
                border: `1px solid ${chosenAction === a.id ? a.color : 'var(--border)'}`,
                background: chosenAction === a.id ? `${a.color}18` : 'var(--surface2)',
                textAlign: 'left', transition: 'all 0.15s ease',
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: chosenAction === a.id ? a.color : 'var(--text-primary)', marginBottom: 2 }}>{a.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.sub}</div>
              </button>
            ))}
          </div>
          {chosenAction && (
            <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--success-dim)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--success)', animation: 'fadeIn 0.2s ease' }}>
              <Check size={12} style={{ marginRight: 6, verticalAlign: 'middle' }} />
              Action "{deadStockActions.find(a => a.id === chosenAction)?.label}" noted.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  label:     { fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 6 },
  input:     { flex: 1, padding: '6px 10px', background: 'var(--surface2)', border: '1px solid var(--accent)', borderRadius: 6, color: 'var(--text-primary)', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxShadow: '0 0 0 3px var(--accent-dim)' },
  editBtn:   { color: 'var(--text-muted)', cursor: 'pointer', padding: 4, background: 'none', border: 'none' },
  saveBtn:   { padding: '6px 10px', fontSize: 12, flexShrink: 0 },
  cancelBtn: { padding: '6px 10px', fontSize: 12, flexShrink: 0 },
  spin:      { animation: 'spin 0.8s linear infinite' },
};
