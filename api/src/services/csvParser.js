const { parse } = require('csv-parse/sync');

// Column signatures for platform detection (require ALL listed columns to be present)
const PLATFORM_SIGNATURES = {
  // Meesho Payment Statement (Reports → Payment Statement)
  meesho: ['Sub Order No', 'Reason for Credit Entry', 'SKU', 'Supplier Discounted Price (Incl GST and Commision)'],
  // Meesho GSTR / Tax Invoice Report (Reports → GSTR Invoice)
  meesho_payment: ['sub_order_num', 'gstin', 'gst_rate', 'total_invoice_value'],
  // Ajio Order Report
  ajio: ['Order Reference ID', 'Item Code', 'Selling Price INR'],
  // CityMall Seller App order export
  citymall: ['Order ID', 'Product Name', 'Selling Price', 'Order Status'],
};

function detectPlatform(headers) {
  for (const [platform, required] of Object.entries(PLATFORM_SIGNATURES)) {
    if (required.every(col => headers.includes(col))) return platform;
  }
  return null;
}

// Meesho Payment Statement status values (column: "Reason for Credit Entry")
const MEESHO_STATUS_MAP = {
  'DELIVERED':  'delivered',
  'SHIPPED':    'shipped',
  'CANCELLED':  'cancelled',
  'RTO_LOCKED': 'returned',
  'RETURN':     'returned',
  'RETURNED':   'returned',
};

// Meesho GSTR Invoice transaction_type values
const MEESHO_PAYMENT_STATUS_MAP = {
  'SALE':       'delivered',
  'RETURN':     'returned',
  'RETURNED':   'returned',
  'CANCELLED':  'cancelled',
  'FORWARD':    'delivered',
  'RTO':        'returned',
};

const AJIO_STATUS_MAP = {
  'Return':    'returned',
  'Cancelled': 'cancelled',
  'Delivered': 'delivered',
  'Shipped':   'shipped',
};

function parseMeeshoRow(row) {
  const status = MEESHO_STATUS_MAP[(row['Reason for Credit Entry'] || '').toUpperCase()] || 'delivered';
  return {
    platformOrderId: row['Sub Order No'],
    orderDate: row['Order Date'],
    grossAmount: parseFloat(row['Supplier Discounted Price (Incl GST and Commision)'] || 0),
    platformFee: null, // Commission is baked into Supplier Price; extracted via GSTR report
    status,
    returnReason: status === 'returned' ? 'RTO_LOCKED' : null,
    cancellationReason: status === 'cancelled' ? row['Reason for Credit Entry'] : null,
    customerState: row['Customer State'] || null,
    currency: 'INR',
    source: 'csv_import',
    metadata: {
      catalogId: row['Catalog ID'] || null,
      orderSource: row['Order source'] || null,
      packetId: row['Packet Id'] || null,
      size: row['Size'] || null,
    },
    items: [{
      sku: row['SKU'] || null,
      name: row['Product Name'] || null,
      qty: parseInt(row['Quantity'] || 1, 10),
      unitPrice: parseFloat(row['Supplier Discounted Price (Incl GST and Commision)'] || 0),
    }],
  };
}

function parseMeeshoPaymentRow(row) {
  const txType = (row['transaction_type'] || '').toUpperCase();
  const status = MEESHO_PAYMENT_STATUS_MAP[txType] || 'delivered';
  return {
    platformOrderId: row['sub_order_num'],
    orderDate: row['order_date'] || row['manifest_date'],
    grossAmount: parseFloat(row['total_invoice_value'] || 0),
    netRevenue: parseFloat(row['total_taxable_sale_value'] || 0),
    shippingCost: parseFloat(row['taxable_shipping'] || 0) || null,
    status,
    currency: 'INR',
    source: 'csv_import',
    metadata: {
      gst: {
        rate: parseFloat(row['gst_rate'] || 0),
        taxAmount: parseFloat(row['tax_amount'] || 0),
        hsnCode: row['hsn_code'] || null,
        endCustomerState: row['end_customer_state_new'] || null,
        ecoTcsGstin: row['eco_tcs_gstin'] || null,
        financialYear: row['financial_year'] || null,
        monthNumber: row['month_number'] || null,
      },
      gstin: row['gstin'] || null,
      enrollmentNo: row['enrollment_no'] || null,
      identifier: row['identifier'] || null,
      supplierId: row['supplier_id'] || null,
    },
  };
}

function parseAjioRow(row) {
  return {
    platformOrderId: row['Order Reference ID'],
    orderDate: row['Order Date'] || row['Created Date'],
    grossAmount: parseFloat(row['Selling Price INR'] || 0),
    platformFee: row['Commission'] ? parseFloat(row['Commission']) : null,
    status: AJIO_STATUS_MAP[row['Order Status']] || 'delivered',
    returnReason: row['Return Reason'] || null,
    cancellationReason: row['Cancellation Reason'] || null,
    customerCity: row['Customer City'] || null,
    customerState: row['Customer State'] || null,
    currency: 'INR',
    source: 'csv_import',
    items: [{
      sku: row['Item Code'] || null,
      name: row['Product Name'] || row['Item Name'] || null,
      qty: parseInt(row['Quantity'] || 1, 10),
      unitPrice: parseFloat(row['Selling Price INR'] || 0),
    }],
  };
}

const CITYMALL_STATUS_MAP = {
  'DELIVERED':  'delivered',
  'SHIPPED':    'shipped',
  'CANCELLED':  'cancelled',
  'RETURNED':   'returned',
  'RTO':        'returned',
  'PENDING':    'shipped',
};

function parseCitymallRow(row) {
  const rawStatus = (row['Order Status'] || '').toUpperCase();
  const status = CITYMALL_STATUS_MAP[rawStatus] || 'delivered';
  return {
    platformOrderId: row['Order ID'],
    orderDate: row['Order Date'] || row['Created At'] || null,
    grossAmount: parseFloat(row['Selling Price'] || row['Order Value'] || 0),
    platformFee: row['Commission'] ? parseFloat(row['Commission']) : null,
    status,
    returnReason: status === 'returned' ? (row['Return Reason'] || null) : null,
    cancellationReason: status === 'cancelled' ? (row['Cancellation Reason'] || null) : null,
    customerCity: row['Customer City'] || null,
    customerState: row['Customer State'] || null,
    currency: 'INR',
    source: 'csv_import',
    items: [{
      sku: row['SKU'] || row['Product Code'] || null,
      name: row['Product Name'] || null,
      qty: parseInt(row['Quantity'] || 1, 10),
      unitPrice: parseFloat(row['Selling Price'] || 0),
    }],
  };
}

const PARSERS = { meesho: parseMeeshoRow, meesho_payment: parseMeeshoPaymentRow, ajio: parseAjioRow, citymall: parseCitymallRow };

function parseCSV(csvContent) {
  const firstLine = csvContent.split('\n')[0] || '';
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  const delimiter = tabCount > commaCount ? '\t' : ',';

  const rows = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    delimiter,
  });

  if (rows.length === 0) throw new Error('CSV file is empty');

  const headers = Object.keys(rows[0]);
  const platform = detectPlatform(headers);
  if (!platform) {
    throw new Error(
      `Unrecognized file format. Expected Meesho Payment Statement, Meesho GSTR Invoice, ` +
      `Ajio Order Report, or CityMall Order Export. Got columns: ${headers.slice(0, 5).join(', ')}`
    );
  }

  const parseRow = PARSERS[platform];
  const orders = rows.map(parseRow).filter(o => o.platformOrderId);

  return { platform, orders, rowCount: rows.length, parsedCount: orders.length };
}

module.exports = { parseCSV, detectPlatform };
