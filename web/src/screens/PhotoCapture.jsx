import React, { useState, useRef } from 'react';
import { Camera, Plus, Check, AlertCircle, Loader, AlertTriangle, RotateCw } from 'lucide-react';
import { useApiRequest } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api/client';
import { uploadImage } from '../utils/imageUpload';

function Field({ label, optional, value, onChange, placeholder, type = 'text', mono = false, min }) {
  return (
    <div>
      <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, display: 'block', marginBottom: 6 }}>
        {label} {optional && <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span>}
      </label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        type={type}
        min={min}
        style={{
          width: '100%', padding: '10px 14px',
          background: 'var(--surface2)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', color: 'var(--text-primary)',
          fontSize: 14, fontFamily: mono ? 'var(--font-mono)' : 'inherit',
          outline: 'none', boxSizing: 'border-box',
        }}
      />
    </div>
  );
}

export default function PhotoCapture({ onComplete }) {
  const [captured, setCaptured]   = useState([]);
  const [current, setCurrent]     = useState({ name: '', sku: '', quantity: '', color: '' });
  const [variant, setVariant]     = useState({ color: '', quantity: '' });
  const [variants, setVariants]   = useState([]);
  const [imageFile, setImageFile] = useState(null);
  const [preview, setPreview]     = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError]         = useState(null);
  const [conflict, setConflict]   = useState(null);
  const [retrying, setRetrying]   = useState({});
  const { post, patch, loading }  = useApiRequest();
  const { token }                 = useAuth();
  const previewUrlRef             = useRef(null);

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const url = URL.createObjectURL(f);
    previewUrlRef.current = url;
    setImageFile(f);
    setPreview(url);
  };

  const handleAddVariant = () => {
    const color = variant.color.trim();
    const qty = parseInt(variant.quantity, 10);
    if (!color) {
      setError('Enter a color to add.');
      return;
    }
    if (!variant.quantity || Number.isNaN(qty) || qty <= 0) {
      setError('Enter a valid quantity for this color.');
      return;
    }

    setVariants(prev => [...prev, { color, quantity: qty }]);
    setVariant({ color: '', quantity: '' });
    setError(null);
  };

  const buildStockItems = ({ quantity, color, variants }) => {
    if (variants.length > 0) {
      return variants.map(v => ({
        quantity: v.quantity,
        notes: `Color: ${v.color}`,
      }));
    }

    return [{
      quantity: quantity != null ? parseInt(quantity, 10) : null,
      notes: color ? `Color: ${color}` : null,
    }];
  };

  const doCapture = async (opts = {}) => {
    setError(null);
    setConflict(null);
    try {
      const productPayload = {
        name: current.name.trim() || null,
        sku:  opts.skipSku ? null : (current.sku.trim() || null),
        color: current.color.trim() || (variants[0]?.color ?? null),
      };

      let product;
      try {
        product = await post('/products', { ...productPayload, forceCreate: opts.forceCreate });
      } catch (err) {
        if (err.status === 409 && err.data) { setConflict(err.data); return; }
        throw err;
      }

      let finalPreview = null;
      let photoFile = null;
      let photoFailed = false;
      if (imageFile) {
        setUploading(true);
        try {
          const imageUrl = await uploadImage(imageFile, token);
          await patch(`/products/${product.id}`, { images: [imageUrl] });
          finalPreview = imageUrl;
        } catch (_) {
          // Upload failed — don't block the capture, but keep the file so the
          // user can retry, and don't reuse the local blob URL as `finalPreview`
          // since it gets revoked below.
          photoFailed = true;
          photoFile = imageFile;
        } finally {
          setUploading(false);
        }
      }

      const items = buildStockItems({ quantity: current.quantity, color: current.color.trim() || null, variants });
      for (const item of items) {
        await post('/stock-lots', {
          productId: product.id,
          quantity: item.quantity,
          quantityCertainty: item.quantity != null ? 'approximate' : 'unknown',
          source: 'photo',
          confidenceState: current.name && item.quantity != null ? 'manually_entered' : current.name ? 'draft_photo' : 'photo_only',
          notes: item.notes || null,
        });
      }

      window.dispatchEvent(new CustomEvent('inv:mutation'));

      setCaptured(prev => [{
        id: product.id,
        name: current.name || `Draft Item ${prev.length + 1}`,
        quantity: variants.length > 0 ? variants.map(v => `${v.color}: ${v.quantity}`).join(', ') : (current.quantity || 'Unknown'),
        preview: finalPreview,
        photoFailed,
        photoFile,
        timestamp: new Date().toLocaleTimeString(),
      }, ...prev]);

      setCurrent({ name: '', sku: '', quantity: '', color: '' });
      setVariant({ color: '', quantity: '' });
      setVariants([]);
      setImageFile(null);
      setPreview(null);
      if (previewUrlRef.current) { URL.revokeObjectURL(previewUrlRef.current); previewUrlRef.current = null; }
    } catch (err) {
      setError(err.message || 'Failed to save. Please try again.');
    }
  };

  const handleMerge = async () => {
    if (!conflict?.existingProduct) return;
    setError(null);
    setConflict(null);

    try {
      const existingId = conflict.existingProduct.id;
      let finalPreview = null;
      let photoFile = null;
      let photoFailed = false;
      if (imageFile) {
        setUploading(true);
        try {
          const imageUrl = await uploadImage(imageFile, token);
          await patch(`/products/${existingId}`, { images: [imageUrl], color: current.color.trim() || conflict.existingProduct.color || null });
          finalPreview = imageUrl;
        } catch (_) {
          // Upload failed — keep the file so the user can retry from the
          // captured list instead of silently losing the photo.
          photoFailed = true;
          photoFile = imageFile;
        } finally {
          setUploading(false);
        }
      }

      if (!imageFile && current.color.trim() && !conflict.existingProduct.color) {
        await patch(`/products/${existingId}`, { color: current.color.trim() });
      }

      const items = buildStockItems({ quantity: current.quantity, color: current.color.trim() || null, variants });
      for (const item of items) {
        await post('/stock-lots', {
          productId: existingId,
          quantity: item.quantity,
          quantityCertainty: item.quantity != null ? 'approximate' : 'unknown',
          source: 'photo',
          confidenceState: current.name && item.quantity != null ? 'manually_entered' : current.name ? 'draft_photo' : 'photo_only',
          notes: item.notes || null,
        });
      }

      window.dispatchEvent(new CustomEvent('inv:mutation'));
      setCaptured(prev => [{
        id: existingId,
        name: conflict.existingProduct.name,
        quantity: variants.length > 0 ? variants.map(v => `${v.color}: ${v.quantity}`).join(', ') : (current.quantity || 'Unknown'),
        preview: finalPreview,
        photoFailed,
        photoFile,
        timestamp: new Date().toLocaleTimeString(),
      }, ...prev]);

      setCurrent({ name: '', sku: '', quantity: '', color: '' });
      setVariant({ color: '', quantity: '' });
      setVariants([]);
      setImageFile(null);
      setPreview(null);
      if (previewUrlRef.current) { URL.revokeObjectURL(previewUrlRef.current); previewUrlRef.current = null; }
    } catch (err) {
      setError(err.message || 'Failed to merge with existing product.');
    }
  };

  const handleCapture      = () => doCapture();
  const handleForceCreate  = () => { setConflict(null); doCapture({ skipSku: conflict?.error === 'sku_conflict', forceCreate: true }); };

  const retryPhotoUpload = async (item) => {
    if (!item.photoFile || retrying[item.id]) return;
    setRetrying(prev => ({ ...prev, [item.id]: true }));
    try {
      const imageUrl = await uploadImage(item.photoFile, token);
      await api.patch(`/products/${item.id}`, { images: [imageUrl] }, token);
      setCaptured(prev => prev.map(c => c.id === item.id
        ? { ...c, preview: imageUrl, photoFailed: false, photoFile: null }
        : c));
    } catch (_) {
      // Still failed — leave photoFailed set so the retry option stays visible.
    } finally {
      setRetrying(prev => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
    }
  };

  const isLoading = loading || uploading;

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '40px 24px', animation: 'fadeIn 0.3s ease' }}>
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 32, marginBottom: 8 }}>Capture inventory</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Take a photo, add what you know. All fields are optional.</p>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <label style={{
          display: 'block', cursor: 'pointer', marginBottom: 20,
          borderRadius: 'var(--radius)', overflow: 'hidden',
          border: `2px dashed ${preview ? 'transparent' : 'var(--border2)'}`,
        }}>
          <input type="file" accept="image/*" capture="environment" onChange={handleFileChange} style={{ display: 'none' }} />
          {preview ? (
            <img src={preview} alt="Preview" style={{ width: '100%', height: 200, objectFit: 'cover', display: 'block', borderRadius: 'var(--radius)' }} />
          ) : (
            <div style={{ height: 180, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, background: 'var(--surface2)' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--surface3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Camera size={24} color="var(--text-muted)" />
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Tap to add photo</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Or skip — everything is optional</p>
              </div>
            </div>
          )}
        </label>

        <div style={{ display: 'grid', gap: 12 }}>
          <Field label="Product name" optional value={current.name} onChange={v => setCurrent(c => ({ ...c, name: v }))} placeholder="e.g. Blue Floral Dress" />
          <Field label="SKU" optional mono value={current.sku} onChange={v => setCurrent(c => ({ ...c, sku: v }))} placeholder="e.g. BFD-S-001" />
          <Field label="Color" optional value={current.color} onChange={v => setCurrent(c => ({ ...c, color: v }))} placeholder="e.g. Navy" />
          <Field label="Quantity" optional type="number" min="0" value={current.quantity} onChange={v => setCurrent(c => ({ ...c, quantity: v }))} placeholder="Leave blank if unknown" />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'end' }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, display: 'block', marginBottom: 6 }}>More color variants</label>
              <input
                value={variant.color}
                onChange={e => setVariant(v => ({ ...v, color: e.target.value }))}
                placeholder="Color"
                style={{ width: '100%', padding: '10px 14px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, display: 'block', marginBottom: 6 }}>Qty</label>
              <input
                type="number"
                min="1"
                value={variant.quantity}
                onChange={e => setVariant(v => ({ ...v, quantity: e.target.value }))}
                placeholder="Qty"
                style={{ width: '100%', padding: '10px 14px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <button type="button" className="btn btn-primary" onClick={handleAddVariant} style={{ height: 42, padding: '0 16px' }}>
              Add
            </button>
          </div>

          {variants.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '12px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
              {variants.map((v, index) => (
                <div key={`${v.color}-${index}`} style={{ padding: '6px 10px', borderRadius: '999px', background: 'var(--surface2)', display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{v.color}: {v.quantity}</span>
                  <button type="button" onClick={() => setVariants(prev => prev.filter((_, i) => i !== index))} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 12 }}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {conflict && (
          <div style={{ marginTop: 12, padding: '12px 14px', background: 'var(--warning-dim)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 'var(--radius)' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 10 }}>
              <AlertTriangle size={14} color="var(--warning)" style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                <strong>{conflict.message}</strong>
                {conflict.existingProduct?.name && (
                  <div style={{ fontWeight: 400, color: 'var(--text-secondary)', marginTop: 2 }}>
                    Existing: {conflict.existingProduct.name}
                    {conflict.existingProduct.sku ? ` · SKU ${conflict.existingProduct.sku}` : ''}
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => setConflict(null)} className="btn btn-ghost" style={{ fontSize: 12, padding: '5px 12px' }}>Cancel</button>
              {conflict.error === 'duplicate_name' ? (
                <>
                  <button onClick={handleMerge} className="btn btn-primary" style={{ fontSize: 12, padding: '5px 12px' }}>
                    Merge with existing
                  </button>
                  <button onClick={handleForceCreate} className="btn btn-warning" style={{ fontSize: 12, padding: '5px 12px', background: 'var(--warning)', borderColor: 'var(--warning)', color: '#000' }}>
                    Keep separate
                  </button>
                </>
              ) : (
                <button onClick={handleForceCreate} className="btn btn-primary" style={{ fontSize: 12, padding: '5px 12px', background: 'var(--warning)', borderColor: 'var(--warning)', color: '#000' }}>
                  {conflict.error === 'sku_conflict' ? 'Create without SKU' : 'Create anyway'}
                </button>
              )}
            </div>
          </div>
        )}

        {error && !conflict && (
          <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--danger-dim)', border: '1px solid rgba(232,90,79,0.25)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--danger)' }}>
            {error}
          </div>
        )}

        <div style={{ marginTop: 16, padding: '10px 14px', background: 'var(--accent-dim)', border: '1px solid var(--accent-border)', borderRadius: 'var(--radius)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <AlertCircle size={13} color="var(--accent)" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Saved as a <strong style={{ color: 'var(--text-primary)' }}>draft item</strong>. Action Center will remind you to complete it later.
          </p>
        </div>

        <button
          onClick={handleCapture}
          disabled={isLoading}
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center', marginTop: 16, padding: '12px' }}
        >
          {uploading
            ? <><Loader size={15} style={{ animation: 'spin 0.8s linear infinite' }} /> Uploading photo…</>
            : loading
            ? <><Loader size={15} style={{ animation: 'spin 0.8s linear infinite' }} /> Saving…</>
            : <><Plus size={16} /> Add to inventory</>}
        </button>
      </div>

      {captured.length > 0 && (
        <div style={{ animation: 'slideUp 0.3s ease' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Captured this session ({captured.length})
            </h3>
            <button className="btn btn-primary" style={{ padding: '6px 14px', fontSize: 12 }} onClick={onComplete}>
              Done → Go to dashboard
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {captured.map(item => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', animation: 'fadeIn 0.2s ease' }}>
                {item.preview ? (
                  <img src={item.preview} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6 }} />
                ) : (
                  <div style={{ width: 40, height: 40, background: 'var(--surface2)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Camera size={14} color="var(--text-muted)" />
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, fontSize: 13 }}>{item.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Qty: {item.quantity} · {item.timestamp}</div>
                  {item.photoFailed && (
                    <div style={{ fontSize: 11, color: 'var(--warning)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <AlertTriangle size={11} />
                      Photo didn't upload — item saved without it
                      <button
                        type="button"
                        onClick={() => retryPhotoUpload(item)}
                        disabled={!!retrying[item.id]}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: 'none', border: 'none', color: 'var(--accent)', fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: 0, marginLeft: 4 }}
                      >
                        <RotateCw size={11} style={retrying[item.id] ? { animation: 'spin 0.8s linear infinite' } : undefined} />
                        {retrying[item.id] ? 'Retrying…' : 'Retry'}
                      </button>
                    </div>
                  )}
                </div>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                  background: item.photoFailed ? 'var(--warning-dim)' : 'var(--success-dim)',
                  border: item.photoFailed ? '1px solid rgba(251,191,36,0.3)' : '1px solid rgba(93,190,138,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {item.photoFailed
                    ? <AlertTriangle size={12} color="var(--warning)" />
                    : <Check size={12} color="var(--success)" />}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {captured.length === 0 && (
        <div style={{ textAlign: 'center', paddingTop: 20 }}>
          <button onClick={onComplete} style={{ color: 'var(--text-muted)', fontSize: 13, textDecoration: 'underline', cursor: 'pointer', background: 'none', border: 'none' }}>
            Skip for now → Go to dashboard
          </button>
        </div>
      )}
    </div>
  );
}
