// Minimal RFC 4180-compliant CSV serialization for client-side exports.
function escapeCsvField(value) {
  const str = value == null ? '' : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function toCsv(columns, rows) {
  const header = columns.map(c => escapeCsvField(c.label)).join(',');
  const lines = rows.map(row =>
    columns.map(c => escapeCsvField(c.value(row))).join(',')
  );
  return [header, ...lines].join('\r\n');
}

export function downloadCsv(filename, csvString) {
  // Prepend a UTF-8 BOM so Excel renders non-ASCII characters (e.g. ₹) correctly.
  const blob = new Blob(['﻿' + csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
