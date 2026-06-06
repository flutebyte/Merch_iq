import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, ArrowRight, FileSpreadsheet, Loader } from 'lucide-react';
import { useApiRequest } from '../hooks/useApi';

const MOCK_PREVIEW = [
  { name: 'Summer Floral Dress', sku: 'SFD-001', qty: '12', price: '2400', category: 'Dresses', status: 'ok' },
  { name: 'Wide Leg Jeans', sku: 'WLJ-004', qty: '', price: '3200', category: 'Bottoms', status: 'warning' },
  { name: 'Crop Blazer', sku: 'CB-009', qty: '8', price: '', category: 'Outerwear', status: 'warning' },
  { name: 'Ruched Mini Skirt', sku: '', qty: '20', price: '1800', category: 'Bottoms', status: 'warning' },
  { name: 'Oversized Tee', sku: 'OT-014', qty: '35', price: '950', category: 'Tops', status: 'ok' },
];

const COLUMNS = ['Product Name', 'SKU', 'Quantity', 'Price', 'Category'];

export default function ImportWizard({ onComplete }) {
  const [step, setStep]         = useState(0);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState(null);
  const [mapping, setMapping]   = useState({
    'Product Name': 'name', 'SKU': 'sku', 'Quantity': 'qty', 'Price': 'price', 'Category': 'category'
  });
  const { post } = useApiRequest();

  const warnings = MOCK_PREVIEW.filter(r => r.status === 'warning').length;
  const ok       = MOCK_PREVIEW.filter(r => r.status === 'ok').length;

  const handleImport = async () => {
    setImporting(true);
    setImportError(null);
    try {
      for (const row of MOCK_PREVIEW) {
        const product = await post('/products', {
          name: row.name || null,
          sku: row.sku || null,
          category: row.category || null,
          sellingPrice: row.price ? parseFloat(row.price) : null,
        });
        await post('/stock-lots', {
          productId: product.id,
          quantity: row.qty ? parseInt(row.qty, 10) : null,
          quantityCertainty: row.qty ? 'approximate' : 'unknown',
          source: 'import',
          confidenceState: 'imported_unverified',
        });
      }
      onComplete();
    } catch (err) {
      setImportError(err.message || 'Import failed. Please try again.');
      setImporting(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) { setFileName(f.name); setStep(1); }
  };

  const handleFileInput = (e) => {
    const f = e.target.files[0];
    if (f) { setFileName(f.name); setStep(1); }
  };

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '40px 24px', animation: 'fadeIn 0.3s ease' }}>
      {/* Steps */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 40 }}>
        {['Upload File', 'Map Columns', 'Preview & Import'].map((s, i) => (
          <React.Fragment key={s}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: i <= step ? 'var(--accent)' : 'var(--surface2)',
                color: i <= step ? '#0D0D0B' : 'var(--text-muted)',
                fontSize: 12, fontWeight: 700, border: `2px solid ${i <= step ? 'var(--accent)' : 'var(--border)'}`,
                transition: 'all 0.2s ease'
              }}>{i < step ? '✓' : i + 1}</div>
              <span style={{ fontSize: 12, color: i === step ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: i === step ? 600 : 400 }}>{s}</span>
            </div>
            {i < 2 && <div style={{ flex: 1, height: 1, background: i < step ? 'var(--accent)' : 'var(--border)', margin: '0 12px', transition: 'background 0.3s ease' }} />}
          </React.Fragment>
        ))}
      </div>

      {/* Step 0: Upload */}
      {step === 0 && (
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, marginBottom: 8 }}>Upload your inventory file</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 32 }}>CSV or Excel files accepted. Partial data is fine — we'll flag gaps.</p>

          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            style={{
              border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border2)'}`,
              borderRadius: 'var(--radius-xl)', padding: '60px 40px', textAlign: 'center',
              background: dragging ? 'var(--accent-dim)' : 'var(--surface)',
              transition: 'all 0.2s ease', cursor: 'pointer'
            }}
          >
            <FileSpreadsheet size={40} color={dragging ? 'var(--accent)' : 'var(--text-muted)'} style={{ marginBottom: 16 }} />
            <p style={{ color: 'var(--text-primary)', fontWeight: 500, marginBottom: 8 }}>Drop your file here</p>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>CSV or XLSX — up to 50,000 rows</p>
            <label style={{ cursor: 'pointer' }}>
              <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileInput} style={{ display: 'none' }} />
              <span className="btn btn-ghost">Browse files</span>
            </label>
          </div>
          <button
            onClick={() => { setFileName('demo_inventory.xlsx'); setStep(1); }}
            style={{ marginTop: 16, color: 'var(--text-muted)', fontSize: 13, textDecoration: 'underline', cursor: 'pointer', background: 'none', border: 'none' }}
          >
            Use demo file instead →
          </button>
        </div>
      )}

      {/* Step 1: Map */}
      {step === 1 && (
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <FileSpreadsheet size={18} color="var(--accent)" />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>{fileName}</span>
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, marginBottom: 8 }}>Map your columns</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 32 }}>Match your file's columns to our fields. Unmatched columns will be skipped.</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>
            {COLUMNS.map(col => (
              <div key={col} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 18px', background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)'
              }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{col}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>→</span>
                  <select
                    value={mapping[col] || ''}
                    onChange={e => setMapping(m => ({ ...m, [col]: e.target.value }))}
                    style={{
                      background: 'var(--surface2)', border: '1px solid var(--border2)', color: 'var(--text-primary)',
                      borderRadius: 6, padding: '6px 10px', fontSize: 12, fontFamily: 'var(--font-mono)'
                    }}
                  >
                    <option value="">-- skip --</option>
                    <option value="name">name</option>
                    <option value="sku">sku</option>
                    <option value="qty">quantity</option>
                    <option value="price">price</option>
                    <option value="category">category</option>
                    <option value="size">size</option>
                    <option value="color">color</option>
                  </select>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-ghost" onClick={() => setStep(0)}>Back</button>
            <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setStep(2)}>
              Preview import <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Preview */}
      {step === 2 && (
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, marginBottom: 8 }}>Preview your import</h2>

          {/* Stats */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
            <div style={{ flex: 1, padding: '12px 16px', background: 'var(--success-dim)', border: '1px solid rgba(93,190,138,0.2)', borderRadius: 'var(--radius)' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--success)', fontFamily: 'var(--font-mono)' }}>{ok}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Complete records</div>
            </div>
            <div style={{ flex: 1, padding: '12px 16px', background: 'var(--warning-dim)', border: '1px solid rgba(232,169,79,0.2)', borderRadius: 'var(--radius)' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--warning)', fontFamily: 'var(--font-mono)' }}>{warnings}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Records with gaps</div>
            </div>
            <div style={{ flex: 1, padding: '12px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{MOCK_PREVIEW.length}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total rows</div>
            </div>
          </div>

          <div style={{ borderRadius: 'var(--radius)', overflow: 'hidden', border: '1px solid var(--border)', marginBottom: 24 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface2)' }}>
                  {['Name', 'SKU', 'Qty', 'Price', 'Status'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MOCK_PREVIEW.map((row, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--surface)' }}>
                    <td style={{ padding: '10px 14px', fontSize: 13 }}>{row.name}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, fontFamily: 'var(--font-mono)', color: row.sku ? 'var(--text-secondary)' : 'var(--danger)' }}>
                      {row.sku || '—'}
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 12, fontFamily: 'var(--font-mono)', color: row.qty ? 'var(--text-secondary)' : 'var(--warning)' }}>
                      {row.qty || '?'}
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 12, fontFamily: 'var(--font-mono)', color: row.price ? 'var(--text-secondary)' : 'var(--warning)' }}>
                      {row.price ? `₹${row.price}` : '?'}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      {row.status === 'ok'
                        ? <CheckCircle size={14} color="var(--success)" />
                        : <AlertTriangle size={14} color="var(--warning)" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ padding: '12px 16px', background: 'var(--accent-dim)', border: '1px solid var(--accent-border)', borderRadius: 'var(--radius)', marginBottom: 24 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <AlertTriangle size={14} color="var(--accent)" style={{ marginTop: 2, flexShrink: 0 }} />
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Records with gaps will be imported as <strong style={{ color: 'var(--text-primary)' }}>draft inventory</strong> and flagged in the Action Center for completion.
              </p>
            </div>
          </div>

          {importError && (
            <div style={{ marginBottom: 16, padding: '10px 14px', background: 'var(--danger-dim)', border: '1px solid rgba(232,90,79,0.25)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--danger)' }}>
              {importError}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-ghost" onClick={() => setStep(1)} disabled={importing}>Back</button>
            <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={handleImport} disabled={importing}>
              {importing
                ? <><Loader size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> Importing…</>
                : <>Import all {MOCK_PREVIEW.length} records <ArrowRight size={14} /></>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
