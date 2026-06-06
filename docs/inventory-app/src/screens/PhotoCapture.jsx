import React, { useState } from 'react';
import { Camera, Plus, Check, AlertCircle, Loader } from 'lucide-react';
import { useApiRequest } from '../hooks/useApi';

export default function PhotoCapture({ onComplete }) {
  const [captured, setCaptured]   = useState([]);
  const [current, setCurrent]     = useState({ name: '', quantity: '' });
  const [preview, setPreview]     = useState(null);
  const [error, setError]         = useState(null);
  const { post, loading }         = useApiRequest();

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (f) setPreview(URL.createObjectURL(f));
  };

  const handleCapture = async () => {
    setError(null);
    try {
      // Create a product first (all fields optional)
      const product = await post('/products', {
        name: current.name || null,
        category: null,
      });

      // Create a stock lot linked to that product
      const qty = current.quantity ? parseInt(current.quantity, 10) : null;
      await post('/stock-lots', {
        productId: product.id,
        quantity: qty,
        quantityCertainty: qty != null ? 'approximate' : 'unknown',
        source: 'photo',
        confidenceState: current.name && qty != null
          ? 'manually_entered'
          : current.name
          ? 'draft_photo'
          : 'photo_only',
      });

      setCaptured(prev => [{
        id: product.id,
        name: current.name || `Draft Item ${prev.length + 1}`,
        quantity: current.quantity || 'Unknown',
        preview,
        timestamp: new Date().toLocaleTimeString(),
      }, ...prev]);
      setCurrent({ name: '', quantity: '' });
      setPreview(null);
    } catch (err) {
      setError(err.message || 'Failed to save. Please try again.');
    }
  };

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '40px 24px', animation: 'fadeIn 0.3s ease' }}>
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 32, marginBottom: 8 }}>
          Capture inventory
        </h2>
        <p style={{ color: 'var(--text-secondary)' }}>
          Take a photo, add what you know. Name and quantity are optional.
        </p>
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, display: 'block', marginBottom: 6 }}>
              Product name <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span>
            </label>
            <input
              value={current.name}
              onChange={e => setCurrent(c => ({ ...c, name: e.target.value }))}
              placeholder="e.g. Blue Floral Dress"
              style={{ width: '100%', padding: '10px 14px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, display: 'block', marginBottom: 6 }}>
              Quantity <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span>
            </label>
            <input
              value={current.quantity}
              onChange={e => setCurrent(c => ({ ...c, quantity: e.target.value }))}
              placeholder="Leave blank if unknown"
              type="number"
              style={{ width: '100%', padding: '10px 14px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        {error && (
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
          disabled={loading}
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center', marginTop: 16, padding: '12px' }}
        >
          {loading
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
                </div>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--success-dim)', border: '1px solid rgba(93,190,138,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Check size={12} color="var(--success)" />
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
