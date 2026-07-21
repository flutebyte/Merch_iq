import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, ArrowRight, FileSpreadsheet, Loader } from 'lucide-react';
import { useApiRequest } from '../hooks/useApi';

const DEMO_ROWS = [
  { name: 'Summer Floral Dress', sku: 'SFD-001', qty: '12', price: '2400', category: 'Dresses' },
  { name: 'Wide Leg Jeans', sku: 'WLJ-004', qty: '', price: '3200', category: 'Bottoms' },
  { name: 'Crop Blazer', sku: 'CB-009', qty: '8', price: '', category: 'Outerwear' },
  { name: 'Ruched Mini Skirt', sku: '', qty: '20', price: '1800', category: 'Bottoms' },
  { name: 'Oversized Tee', sku: 'OT-014', qty: '35', price: '950', category: 'Tops' },
];

const FIELDS = ['name', 'sku', 'qty', 'price', 'category', 'size', 'color'];
// Keywords used to auto-guess which uploaded column maps to which field.
const FIELD_GUESSES = {
  name: ['name', 'product', 'title', 'item'],
  sku: ['sku', 'code', 'style'],
  qty: ['qty', 'quantity', 'stock', 'units'],
  price: ['price', 'mrp', 'rate', 'amount'],
  category: ['category', 'type'],
  size: ['size'],
  color: ['color', 'colour'],
};
const MAX_IMPORT_ROWS = 500;

// RFC 4180-aware CSV parser with BOM stripping (mirrors Settings.jsx's parseCsvHead, unbounded).
function parseCsv(text) {
  const stripped = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
  const lines = stripped.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 1) return { headers: [], rows: [] };

  function parseRow(line) {
    const fields = [];
    let i = 0;
    while (i <= line.length) {
      if (i === line.length) { fields.push(''); break; }
      if (line[i] === '"') {
        let j = i + 1, value = '';
        while (j < line.length) {
          if (line[j] === '"' && line[j + 1] === '"') { value += '"'; j += 2; }
          else if (line[j] === '"') { j++; break; }
          else { value += line[j++]; }
        }
        fields.push(value.trim());
        i = j;
        if (i < line.length && line[i] === ',') i++;
        else break;
      } else {
        const end = line.indexOf(',', i);
        if (end === -1) { fields.push(line.slice(i).trim()); break; }
        fields.push(line.slice(i, end).trim());
        i = end + 1;
      }
    }
    return fields;
  }

  const headers = parseRow(lines[0]);
  const rows = lines.slice(1).map(parseRow);
  return { headers, rows };
}

function guessMapping(headers) {
  const mapping = {};
  headers.forEach(h => {
    const lower = h.toLowerCase();
    const field = FIELDS.find(f => FIELD_GUESSES[f].some(kw => lower.includes(kw)));
    mapping[h] = field || '';
  });
  return mapping;
}

// Turns parsed { headers, rows } + a header->field mapping into row objects the preview/import steps use.
function applyMapping(headers, rows, mapping) {
  const fieldIndex = {};
  headers.forEach((h, i) => { if (mapping[h]) fieldIndex[mapping[h]] = i; });

  return rows
    .map(cells => ({
      name: fieldIndex.name !== undefined ? cells[fieldIndex.name] : '',
      sku: fieldIndex.sku !== undefined ? cells[fieldIndex.sku] : '',
      qty: fieldIndex.qty !== undefined ? cells[fieldIndex.qty] : '',
      price: fieldIndex.price !== undefined ? cells[fieldIndex.price] : '',
      category: fieldIndex.category !== undefined ? cells[fieldIndex.category] : '',
    }))
    .filter(r => (r.name || '').trim() || (r.sku || '').trim());
}

export default function ImportWizard({ onComplete }) {
  const [step, setStep] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [isDemo, setIsDemo] = useState(false);
  const [parsed, setParsed] = useState(null); // { headers, rows } — raw CSV data
  const [mapping, setMapping] = useState({});
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState(null);
  const { post } = useApiRequest();

  const columns = isDemo ? ['Product Name', 'SKU', 'Quantity', 'Price', 'Category'] : (parsed?.headers || []);
  const previewRows = isDemo ? DEMO_ROWS : applyMapping(parsed?.headers || [], parsed?.rows || [], mapping);
  const truncated = previewRows.length > MAX_IMPORT_ROWS;
  const importRows = truncated ? previewRows.slice(0, MAX_IMPORT_ROWS) : previewRows;
  const rowStatus = (r) => (r.name && r.sku && r.qty && r.price) ? 'ok' : 'warning';
  const warnings = importRows.filter(r => rowStatus(r) === 'warning').length;
  const ok = importRows.length - warnings;

  const loadCsvFile = (file) => {
    setFileError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const { headers, rows } = parseCsv(e.target.result);
        if (headers.length === 0 || rows.length === 0) {
          setFileError('That file looks empty. Check that it has a header row and at least one data row.');
          return;
        }
        setParsed({ headers, rows });
        setMapping(guessMapping(headers));
        setIsDemo(false);
        setFileName(file.name);
        setStep(1);
      } catch {
        setFileError('Could not read that file. Make sure it’s a plain CSV export.');
      }
    };
    reader.onerror = () => setFileError('Could not read that file.');
    reader.readAsText(file);
  };

  const handleFile = (file) => {
    if (!file) return;
    if (file.name.match(/\.(xlsx|xls)$/i)) {
      setFileError('Excel files aren’t supported yet — in Excel or Google Sheets, use "Save As / Export" and choose CSV, then upload that instead.');
      return;
    }
    if (!file.name.match(/\.(csv|txt)$/i)) {
      setFileError('Please upload a CSV file.');
      return;
    }
    loadCsvFile(file);
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const handleFileInput = (e) => handleFile(e.target.files[0]);

  const useDemoFile = () => {
    setFileError(null);
    setIsDemo(true);
    setParsed(null);
    setFileName('demo_inventory.csv (sample data)');
    setStep(1);
  };

  const handleImport = async () => {
    setImporting(true);
    setImportError(null);
    let created = 0;
    const failures = [];
    for (const row of importRows) {
      try {
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
        created++;
      } catch (err) {
        failures.push({ row: row.name || row.sku || '(unnamed row)', message: err.data?.message || err.message || 'Failed' });
      }
    }
    setImporting(false);
    if (failures.length > 0) {
      const extra = failures.length > 3 ? ` and ${failures.length - 3} more` : '';
      setImportError(
        `Imported ${created} of ${importRows.length} rows. Skipped: ${failures.slice(0, 3).map(f => `${f.row} (${f.message})`).join('; ')}${extra}.`
      );
      if (created === 0) return;
    }
    onComplete();
  };

  const inputStyle = {
    background: 'var(--surface2)', border: '1px solid var(--border2)', color: 'var(--text-primary)',
    borderRadius: 6, padding: '6px 10px', fontSize: 12, fontFamily: 'var(--font-mono)',
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
                color: i <= step ? '#fff' : 'var(--text-muted)',
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
          <p style={{ color: 'var(--text-secondary)', marginBottom: 32 }}>CSV files accepted, up to {MAX_IMPORT_ROWS} rows. Partial data is fine — we'll flag gaps.</p>

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
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>CSV — up to {MAX_IMPORT_ROWS} rows (Excel not yet supported)</p>
            <label style={{ cursor: 'pointer' }}>
              <input type="file" accept=".csv,.txt,.xlsx,.xls" onChange={handleFileInput} style={{ display: 'none' }} />
              <span className="btn btn-ghost">Browse files</span>
            </label>
          </div>

          {fileError && (
            <div style={{
              marginTop: 16, padding: '12px 16px', background: 'var(--danger-dim)', border: '1px solid rgba(232,90,79,0.25)',
              borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--danger)',
            }}>
              {fileError}
            </div>
          )}

          <button
            onClick={useDemoFile}
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
          <p style={{ color: 'var(--text-secondary)', marginBottom: 32 }}>
            {isDemo
              ? 'Match your file’s columns to our fields. Unmatched columns will be skipped.'
              : `We matched what we could from your file's headers — check them and adjust anything wrong. Unmatched columns will be skipped.`}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>
            {columns.map(col => (
              <div key={col} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 18px', background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)'
              }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{col}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>→</span>
                  {isDemo ? (
                    <select
                      defaultValue={{ 'Product Name': 'name', SKU: 'sku', Quantity: 'qty', Price: 'price', Category: 'category' }[col] || ''}
                      disabled
                      style={inputStyle}
                    >
                      <option value="">-- skip --</option>
                      {FIELDS.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  ) : (
                    <select
                      value={mapping[col] || ''}
                      onChange={e => setMapping(m => ({ ...m, [col]: e.target.value }))}
                      style={inputStyle}
                    >
                      <option value="">-- skip --</option>
                      {FIELDS.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-ghost" onClick={() => setStep(0)}>Back</button>
            <button
              className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}
              onClick={() => setStep(2)}
              disabled={!isDemo && !Object.values(mapping).includes('name') && !Object.values(mapping).includes('sku')}
            >
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
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{importRows.length}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total rows</div>
            </div>
          </div>

          {truncated && (
            <div style={{ padding: '10px 14px', background: 'var(--warning-dim)', border: '1px solid rgba(232,169,79,0.2)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Your file has {previewRows.length} rows — only the first {MAX_IMPORT_ROWS} will be imported. Split larger catalogs into multiple files.
            </div>
          )}

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
                {importRows.slice(0, 20).map((row, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--surface)' }}>
                    <td style={{ padding: '10px 14px', fontSize: 13 }}>{row.name || <span style={{ color: 'var(--danger)' }}>—</span>}</td>
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
                      {rowStatus(row) === 'ok'
                        ? <CheckCircle size={14} color="var(--success)" />
                        : <AlertTriangle size={14} color="var(--warning)" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {importRows.length > 20 && (
              <div style={{ padding: '8px 14px', fontSize: 11, color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
                Showing first 20 of {importRows.length} rows.
              </div>
            )}
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
            <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={handleImport} disabled={importing || importRows.length === 0}>
              {importing
                ? <><Loader size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> Importing…</>
                : <>Import all {importRows.length} records <ArrowRight size={14} /></>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
