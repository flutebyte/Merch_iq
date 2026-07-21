import React, { useState, useEffect, useRef } from 'react';
import {
  Palette, Bell, User, Shield, Sliders, Download, Plug, Info,
  Sun, Moon, Monitor, Check, AlertTriangle, Eye, EyeOff, Loader,
} from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { useBrand } from '../contexts/BrandContext';
import { useAuth } from '../contexts/AuthContext';
import { useApiRequest, useFetch } from '../hooks/useApi';
import { useLocalPref } from '../hooks/useLocalPref';
import { api } from '../api/client';

// ── Shared utilities ──────────────────────────────────────────────────────────

function Toggle({ checked, onChange }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      style={{
        width: 42, height: 24, borderRadius: 100, cursor: 'pointer', flexShrink: 0,
        background: checked ? 'var(--accent)' : 'var(--surface3)',
        border: `2px solid ${checked ? 'var(--accent)' : 'var(--border2)'}`,
        position: 'relative', transition: 'background 0.2s, border-color 0.2s',
        fontFamily: 'var(--font-body)',
      }}
    >
      <div style={{
        position: 'absolute', top: 2, left: checked ? 18 : 2,
        width: 16, height: 16, borderRadius: '50%', background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.35)', transition: 'left 0.2s ease',
      }} />
    </button>
  );
}

function Row({ label, desc, children, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 16, padding: '13px 0',
      borderBottom: last ? 'none' : '1px solid var(--border)',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{label}</div>
        {desc && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{desc}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

function Card({ title, desc, children }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)', padding: '20px 24px',
      boxShadow: 'var(--shadow-sm)',
    }}>
      {(title || desc) && (
        <div style={{ marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
          {title && <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</div>}
          {desc  && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{desc}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

function Label({ children }) {
  return (
    <label style={{
      display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
      textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6,
    }}>
      {children}
    </label>
  );
}

function ErrorBanner({ msg }) {
  if (!msg) return null;
  return (
    <div style={{
      marginBottom: 14, padding: '10px 14px',
      background: 'var(--danger-dim)', border: '1px solid rgba(220,38,38,0.2)',
      borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--danger)',
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <AlertTriangle size={13} /> {msg}
    </div>
  );
}

function SaveBar({ saving, saved, onSave, label = 'Save changes' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
      <button className="btn btn-primary" onClick={onSave} disabled={saving}>
        {saving
          ? <Loader size={13} style={{ animation: 'spin 0.8s linear infinite' }} />
          : saved ? <><Check size={13} /> Saved!</>
          : label}
      </button>
      {saved && <span style={{ fontSize: 12, color: 'var(--success)' }}>Changes saved successfully.</span>}
    </div>
  );
}

// ── Appearance ────────────────────────────────────────────────────────────────
function AppearancePane() {
  const { theme, setTheme } = useTheme();
  const themes = [
    { id: 'light',  Icon: Sun,     label: 'Light',  desc: 'Clean & bright' },
    { id: 'dark',   Icon: Moon,    label: 'Dark',   desc: 'Easy on the eyes' },
    { id: 'system', Icon: Monitor, label: 'System', desc: 'Follows OS setting' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card title="Theme" desc="Choose how the interface looks. Your preference is saved locally.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {themes.map(({ id, Icon, label, desc }) => (
            <button
              key={id}
              onClick={() => setTheme(id)}
              style={{
                padding: '16px 12px', borderRadius: 'var(--radius-lg)', cursor: 'pointer',
                border: `2px solid ${theme === id ? 'var(--accent)' : 'var(--border)'}`,
                background: theme === id ? 'var(--accent-dim)' : 'var(--surface2)',
                textAlign: 'left', transition: 'all 0.15s ease', fontFamily: 'var(--font-body)',
              }}
            >
              <Icon size={18} color={theme === id ? 'var(--accent)' : 'var(--text-muted)'} style={{ marginBottom: 10, display: 'block' }} />
              <div style={{ fontSize: 13, fontWeight: 600, color: theme === id ? 'var(--accent)' : 'var(--text-primary)' }}>{label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{desc}</div>
              {theme === id && (
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--accent)' }}>
                  <Check size={11} /> Active
                </div>
              )}
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ── Notifications ─────────────────────────────────────────────────────────────
function NotificationsPane() {
  const [emailNotifs,     setEmailNotifs]     = useLocalPref('notif_email', true);
  const [inAppNotifs,     setInAppNotifs]     = useLocalPref('notif_inapp', true);
  const [inventoryAlerts, setInventoryAlerts] = useLocalPref('notif_inventory', true);
  const [lowStockAlerts,  setLowStockAlerts]  = useLocalPref('notif_lowstock', true);
  const [lowStockThresh,  setLowStockThresh]  = useLocalPref('notif_threshold', 5);
  const [deadStockAlerts, setDeadStockAlerts] = useLocalPref('notif_deadstock', true);
  const [systemUpdates,   setSystemUpdates]   = useLocalPref('notif_system', false);
  const [saved, setSaved] = useState(false);

  const handleSave = () => { setSaved(true); setTimeout(() => setSaved(false), 2500); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card title="Email Notifications" desc="Control what gets sent to your registered email.">
        <Row label="Email notifications" desc="Receive updates and alerts by email">
          <Toggle checked={emailNotifs} onChange={setEmailNotifs} />
        </Row>
        <Row label="System updates" desc="Platform changes, new features and announcements" last>
          <Toggle checked={systemUpdates} onChange={setSystemUpdates} />
        </Row>
      </Card>

      <Card title="In-App Alerts" desc="Notifications shown directly inside the dashboard.">
        <Row label="In-app notifications" desc="Show alert banners and badge counts">
          <Toggle checked={inAppNotifs} onChange={setInAppNotifs} />
        </Row>
        <Row label="Inventory alerts" desc="Prompt actions needed for inventory quality">
          <Toggle checked={inventoryAlerts} onChange={setInventoryAlerts} />
        </Row>
        <Row label="Low stock alerts" desc="Warn when product quantity falls below threshold">
          <Toggle checked={lowStockAlerts} onChange={setLowStockAlerts} />
        </Row>
        {lowStockAlerts && (
          <Row label="Low stock threshold" desc={`Alert when any product has fewer than ${lowStockThresh} units`}>
            <input
              type="number"
              min={1}
              value={lowStockThresh}
              onChange={e => setLowStockThresh(Math.max(1, parseInt(e.target.value, 10) || 1))}
              style={{
                width: 72, padding: '6px 10px', textAlign: 'center',
                background: 'var(--surface2)', border: '1px solid var(--border2)',
                borderRadius: 'var(--radius)', color: 'var(--text-primary)',
                fontSize: 13, fontFamily: 'var(--font-mono)', outline: 'none',
              }}
            />
          </Row>
        )}
        <Row label="Dead stock alerts" desc="Flag products with no sales in 90+ days" last>
          <Toggle checked={deadStockAlerts} onChange={setDeadStockAlerts} />
        </Row>
      </Card>

      <SaveBar saving={false} saved={saved} onSave={handleSave} label="Save notification preferences" />
    </div>
  );
}

// ── Profile ───────────────────────────────────────────────────────────────────
function ProfilePane() {
  const { user }  = useAuth();
  const { brand } = useBrand();
  const { patch } = useApiRequest();
  const [phone,     setPhone]     = useLocalPref('profile_phone', '');
  const [city,      setCity]      = useLocalPref('profile_city', '');
  const [bizType,   setBizType]   = useLocalPref('profile_biztype', 'retail');
  const [brandName, setBrandName] = useState(brand?.name || '');
  const [saving, setSaving] = useState(false);
  const [saved,   setSaved]  = useState(false);
  const [error,   setError]  = useState('');

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      if (brand?.id && brandName.trim() && brandName.trim() !== brand?.name) {
        await patch(`/brands/${brand.id}`, { name: brandName.trim() });
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e.message || 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ErrorBanner msg={error} />

      <Card title="Business Information" desc="Your brand details visible across the app.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <Label>Brand / Business Name</Label>
            <input className="input" value={brandName} onChange={e => setBrandName(e.target.value)} placeholder="Enter business name" />
          </div>
          <div>
            <Label>Business Type</Label>
            <select
              value={bizType}
              onChange={e => setBizType(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', fontFamily: 'var(--font-body)' }}
            >
              {[
                ['retail', 'Retail Store'],
                ['wholesale', 'Wholesale'],
                ['boutique', 'Boutique / Designer'],
                ['online-only', 'Online Only'],
                ['manufacturer', 'Manufacturer / Brand Owner'],
              ].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <Label>City</Label>
            <input className="input" value={city} onChange={e => setCity(e.target.value)} placeholder="e.g. Mumbai, Delhi, Bengaluru…" />
          </div>
        </div>
      </Card>

      <Card title="Contact Details" desc="Your account email and phone number.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <Label>Email Address</Label>
            <input className="input" value={user?.email || ''} readOnly disabled style={{ opacity: 0.55, cursor: 'not-allowed' }} />
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>
              Email cannot be changed here. Contact support to update.
            </p>
          </div>
          <div>
            <Label>Phone Number</Label>
            <input className="input" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 98765 43210" />
          </div>
        </div>
      </Card>

      <SaveBar saving={saving} saved={saved} onSave={handleSave} />
    </div>
  );
}

// ── Security ──────────────────────────────────────────────────────────────────
function SecurityPane() {
  const { post } = useApiRequest();
  const [form, setForm]         = useState({ current: '', newPass: '', confirm: '' });
  const [showCurrent, setShowC] = useState(false);
  const [showNew,     setShowN] = useState(false);
  const [saving,  setSaving]    = useState(false);
  const [success, setSuccess]   = useState(false);
  const [error,   setError]     = useState('');

  const handleChange = async () => {
    setError('');
    if (!form.current || !form.newPass || !form.confirm) { setError('All fields are required.'); return; }
    if (form.newPass.length < 8)              { setError('New password must be at least 8 characters.'); return; }
    if (form.newPass !== form.confirm)         { setError('New passwords do not match.'); return; }
    setSaving(true);
    try {
      await post('/auth/change-password', { currentPassword: form.current, newPassword: form.newPass });
      setSuccess(true);
      setForm({ current: '', newPass: '', confirm: '' });
      setTimeout(() => setSuccess(false), 3500);
    } catch (e) {
      setError(e.message || 'Failed to change password. Check your current password and try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card title="Change Password" desc="Use a strong, unique password to protect your account.">
        <ErrorBanner msg={error} />
        {success && (
          <div style={{ marginBottom: 14, padding: '10px 14px', background: 'var(--success-dim)', border: '1px solid rgba(22,163,74,0.2)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--success)', display: 'flex', gap: 8 }}>
            <Check size={13} /> Password updated successfully.
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[
            { label: 'Current Password', key: 'current', show: showCurrent, toggle: () => setShowC(v => !v), placeholder: 'Enter current password' },
            { label: 'New Password',     key: 'newPass', show: showNew,     toggle: () => setShowN(v => !v), placeholder: 'Minimum 8 characters' },
            { label: 'Confirm New Password', key: 'confirm', show: false, toggle: null, placeholder: 'Re-enter new password', isConfirm: true },
          ].map(({ label, key, show, toggle, placeholder, isConfirm }) => (
            <div key={key}>
              <Label>{label}</Label>
              <div style={{ position: 'relative' }}>
                <input
                  className="input"
                  type={show ? 'text' : 'password'}
                  value={form[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  style={{ paddingRight: toggle ? 42 : undefined }}
                  onKeyDown={e => e.key === 'Enter' && handleChange()}
                />
                {toggle && (
                  <button
                    onClick={toggle}
                    style={{
                      position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--text-muted)', padding: 4, fontFamily: 'var(--font-body)',
                    }}
                  >
                    {show ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 18 }}>
          <button className="btn btn-primary" onClick={handleChange} disabled={saving}>
            {saving
              ? <Loader size={13} style={{ animation: 'spin 0.8s linear infinite' }} />
              : 'Update password'}
          </button>
        </div>
      </Card>

      <Card title="Active Sessions" desc="Devices where you are currently signed in.">
        <Row label="Current session" desc="This browser · Active now" last>
          <span style={{ fontSize: 11, padding: '2px 8px', background: 'var(--success-dim)', color: 'var(--success)', borderRadius: 100, border: '1px solid rgba(22,163,74,0.2)' }}>
            Active
          </span>
        </Row>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10 }}>
          Tokens expire after 7 days. Signing out immediately revokes access on this device.
        </p>
      </Card>
    </div>
  );
}

// ── Preferences ───────────────────────────────────────────────────────────────
function PreferencesPane() {
  const [currency,   setCurrency]  = useLocalPref('pref_currency', 'INR');
  const [dateFormat, setDateFmt]   = useLocalPref('pref_dateformat', 'DD/MM/YYYY');
  const [invView,    setInvView]   = useLocalPref('pref_invview', 'list');
  const [saved, setSaved] = useState(false);

  const handleSave = () => { setSaved(true); setTimeout(() => setSaved(false), 2500); };

  const Sel = ({ value, onChange, options }) => (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{ padding: '7px 10px', background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', fontFamily: 'var(--font-body)' }}
    >
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card title="Regional" desc="Currency and date formats used throughout the app.">
        <Row label="Currency" desc="Applied to prices, totals, and revenue displays">
          <Sel value={currency} onChange={setCurrency} options={[
            ['INR', '₹ INR — Indian Rupee'],
            ['USD', '$ USD — US Dollar'],
            ['EUR', '€ EUR — Euro'],
            ['GBP', '£ GBP — British Pound'],
          ]} />
        </Row>
        <Row label="Date format" desc="How dates are displayed across the app" last>
          <Sel value={dateFormat} onChange={setDateFmt} options={[
            ['DD/MM/YYYY', 'DD/MM/YYYY'],
            ['MM/DD/YYYY', 'MM/DD/YYYY'],
            ['YYYY-MM-DD', 'YYYY-MM-DD (ISO)'],
          ]} />
        </Row>
      </Card>

      <Card title="Inventory View" desc="Default layout when browsing your products.">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { id: 'list',    label: 'List view',    desc: 'Full table with all columns' },
            { id: 'compact', label: 'Compact view', desc: 'Smaller rows, more visible' },
          ].map(({ id, label, desc }) => (
            <button
              key={id}
              onClick={() => setInvView(id)}
              style={{
                padding: '14px 12px', borderRadius: 'var(--radius)', cursor: 'pointer', textAlign: 'left',
                border: `2px solid ${invView === id ? 'var(--accent)' : 'var(--border)'}`,
                background: invView === id ? 'var(--accent-dim)' : 'var(--surface2)',
                transition: 'all 0.15s ease', fontFamily: 'var(--font-body)',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: invView === id ? 'var(--accent)' : 'var(--text-primary)' }}>{label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{desc}</div>
            </button>
          ))}
        </div>
      </Card>

      <SaveBar saving={false} saved={saved} onSave={handleSave} label="Save preferences" />
    </div>
  );
}

// ── Data & Export ─────────────────────────────────────────────────────────────
function DataPane() {
  const { token }          = useAuth();
  const [exporting, setEx] = useState(false);
  const [cleared,   setCl] = useState(false);

  const handleExport = async () => {
    setEx(true);
    try {
      const data = await api.get('/products', token);
      if (!Array.isArray(data)) throw new Error('Unexpected response');
      const headers = ['id', 'name', 'sku', 'category', 'color', 'size', 'sellingPrice', 'costPrice'];
      const rows = data.map(p => headers.map(h => `"${String(p[h] ?? '').replace(/"/g, '""')}"`).join(','));
      const csv = [headers.join(','), ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = `inventory-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Export failed: ' + e.message);
    } finally {
      setEx(false);
    }
  };

  const handleClearPrefs = () => {
    Object.keys(localStorage).filter(k => k.startsWith('inv_pref_')).forEach(k => localStorage.removeItem(k));
    setCl(true);
    setTimeout(() => setCl(false), 2500);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card title="Export Data" desc="Download your inventory data as a CSV file for use in spreadsheets.">
        <Row label="Export all products" desc="Downloads product catalogue including prices, SKUs, and categories" last>
          <button className="btn btn-ghost btn-sm" onClick={handleExport} disabled={exporting}>
            {exporting
              ? <Loader size={12} style={{ animation: 'spin 0.8s linear infinite' }} />
              : <><Download size={12} /> Export CSV</>}
          </button>
        </Row>
      </Card>

      <Card title="App Preferences" desc="Locally stored settings and preferences.">
        <Row label="Clear saved preferences" desc="Resets all notification settings, regional preferences, and profile data stored in this browser. Your inventory data is not affected." last>
          <button className="btn btn-ghost btn-sm" onClick={handleClearPrefs}>
            {cleared ? <><Check size={12} /> Cleared</> : 'Clear preferences'}
          </button>
        </Row>
      </Card>

      <Card title="Account Deletion" desc="Permanently delete your account and all associated data.">
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
          This action is permanent and cannot be undone. All products, inventory records, and sales data will be deleted.
        </p>
        <button
          className="btn btn-danger btn-sm"
          onClick={() => alert('To delete your account, contact support. This action cannot be reversed.')}
        >
          <AlertTriangle size={12} /> Request account deletion
        </button>
      </Card>
    </div>
  );
}

// ── Integrations ──────────────────────────────────────────────────────────────
const PLATFORM_COLORS = {
  shopify: '#96BF48', amazon: '#FF9900', flipkart: '#2874F0',
  myntra: '#FF3F6C', meesho: '#F43397', ajio: '#E91E63',
  citymall: '#FF6B35',
  etsy: '#F56400', woocommerce: '#7F54B3',
  whatsapp: '#25D366', pos: '#6366F1', tally: '#0EA5E9',
};

const PLATFORM_SETUP = {
  shopify:     {
    needs: 'SHOPIFY_API_KEY · SHOPIFY_API_SECRET',
    where: 'partners.shopify.com → Apps → Create app',
    steps: ['Create a Partner account, then create a Custom App', 'Copy API Key + Secret into your server .env file', 'Restart the server, then click Connect and enter your shop domain'],
  },
  amazon:      {
    needs: 'AMAZON_CLIENT_ID · AMAZON_CLIENT_SECRET',
    where: 'sellercentral.amazon.in → Apps & Services → SP-API',
    steps: ['Register as SP-API developer, create an application', 'Copy LWA Client ID + Client Secret into .env', 'Restart server, click Connect to authorise via Amazon'],
  },
  flipkart:    {
    needs: 'FLIPKART_CLIENT_ID · FLIPKART_CLIENT_SECRET',
    where: 'seller.flipkart.com → Settings → API',
    steps: ['Apply for API access from your Seller account', 'Copy Client ID + Secret into .env after approval', 'Restart server, click Connect to authorise'],
  },
  myntra:      {
    needs: 'MYNTRA_CLIENT_ID · MYNTRA_CLIENT_SECRET',
    where: 'mmip.myntrainfo.com/developer — requires MMIP partner approval',
    steps: ['Apply at mmip.myntrainfo.com for Developer Centre access (Myntra partner approval required)', 'Copy Client ID + Secret from the MMIP portal into .env', 'Restart server, click Connect to authorise'],
  },
  etsy:        {
    needs: 'ETSY_CLIENT_ID · ETSY_CLIENT_SECRET',
    where: 'etsy.com/developers → Manage Apps → Create app',
    steps: ['Create an Etsy app at the developer portal', 'Copy Client ID + Client Secret into .env', 'Restart server, click Connect to authorise via Etsy OAuth'],
  },
  woocommerce: {
    needs: 'Consumer Key · Consumer Secret (from WooCommerce REST API settings)',
    where: 'Your WooCommerce site → WooCommerce → Settings → Advanced → REST API',
    steps: ['Go to WooCommerce → Settings → Advanced → REST API', 'Click Add Key, set permissions to Read', 'Enter your site URL + Consumer Key + Secret in the connection form'],
  },
  meesho:      {
    needs: 'No credentials needed',
    where: 'CSV-based — no API access required',
    steps: ['Click Connect to set up the integration', 'Export your orders from Meesho Seller Hub → Reports', 'Drag and drop the CSV file onto the upload zone that appears'],
  },
  ajio:        {
    needs: 'No credentials needed',
    where: 'CSV-based — no API access required',
    steps: ['Click Connect to set up the integration', 'Export your orders from Ajio Seller Portal → Reports → Order Report', 'Drag and drop the CSV file onto the upload zone that appears'],
  },
  citymall:    {
    needs: 'No credentials needed',
    where: 'CSV-based — CityMall Seller App → Reports',
    steps: ['Click Connect to set up the integration', 'Open CityMall Seller App → My Orders → Export', 'Drag and drop the exported CSV file onto the upload zone that appears'],
  },
  whatsapp:    {
    needs: 'WHATSAPP_APP_ID · WHATSAPP_APP_SECRET',
    where: 'developers.facebook.com → Create app → WhatsApp',
    steps: ['Create a Meta Business app with WhatsApp product', 'Copy App ID + App Secret into .env', 'Restart server, click Connect, then Export Catalog with your Catalog ID from Meta Business Suite'],
  },
  pos:         {
    needs: 'No credentials needed',
    where: 'Webhook-based — works with Petpooja, Posist, and custom POS',
    steps: ['Click Connect to generate a unique webhook URL', 'Configure your POS to POST sales data to that URL', 'Each sale auto-appears in your dashboard'],
  },
  tally:       {
    needs: 'No credentials needed',
    where: 'File export — compatible with Tally 9, Prime, and ERP 9',
    steps: ['Click Export XML to download a Tally-ready file', 'Import via Gateway of Tally → Import Data → Vouchers'],
  },
};

function formatUploadAge(isoString) {
  if (!isoString) return null;
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function MeeshoReportStatus({ metadata }) {
  const uploads = metadata?.uploads || {};
  const rows = [
    { key: 'orders',   label: 'Payment Statement (orders)' },
    { key: 'payments', label: 'GSTR Tax Invoice' },
  ];
  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
        Report upload status
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {rows.map(({ key, label }) => {
          const entry = uploads[key];
          const age = formatUploadAge(entry?.lastAt);
          return (
            <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
              <span style={{ color: age ? 'var(--success)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                {age ? `${age} · ${entry.insertedCount ?? entry.rowCount} rows` : 'Never uploaded'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Column signatures (mirrors server-side csvParser.js PLATFORM_SIGNATURES)
const CSV_PLATFORM_SIGNATURES = {
  meesho: ['Sub Order No', 'Reason for Credit Entry', 'SKU', 'Supplier Discounted Price (Incl GST and Commision)'],
  meesho_payment: ['sub_order_num', 'gstin', 'gst_rate', 'total_invoice_value'],
  ajio: ['Order Reference ID', 'Item Code', 'Selling Price INR'],
  citymall: ['Order ID', 'Product Name', 'Selling Price', 'Order Status'],
};

// Display column specs: labels shown in preview, keys are actual CSV column names
const PLATFORM_PREVIEW_COLUMNS = {
  meesho:         { labels: ['Order Date', 'Status', 'Product', 'Amount'],    keys: ['Order Date', 'Reason for Credit Entry', 'Product Name', 'Supplier Discounted Price (Incl GST and Commision)'] },
  meesho_payment: { labels: ['Order Date', 'Type', 'Order No', 'Amount'],     keys: ['order_date', 'transaction_type', 'sub_order_num', 'total_invoice_value'] },
  ajio:           { labels: ['Order Date', 'Status', 'Product', 'Sale Price'], keys: ['Order Date', 'Order Status', 'Product Name', 'Selling Price INR'] },
  citymall:       { labels: ['Order Date', 'Status', 'Item', 'Price'],        keys: ['Order Date', 'Order Status', 'Product Name', 'Selling Price'] },
};

// RFC 4180-aware CSV head parser with BOM stripping
function parseCsvHead(text, maxRows = 5) {
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
  const rows = lines.slice(1, 1 + maxRows).map(parseRow);
  return { headers, rows };
}

function detectPlatformFromHeaders(headers) {
  for (const [p, required] of Object.entries(CSV_PLATFORM_SIGNATURES)) {
    if (required.every(c => headers.includes(c))) return p;
  }
  return null;
}

function CsvUploadZone({ platformId, onUploadDone }) {
  const { token } = useAuth();
  const [dragging, setDragging] = useState(false);
  // state: idle | preview_loading | preview_ok | preview_empty | preview_error | xlsx_confirm | uploading | result_ok | result_error
  const [uploadState, setUploadState] = useState('idle');
  const [preview, setPreview] = useState(null); // { headers, rows, platform }
  const [selectedFile, setSelectedFile] = useState(null);
  const [resultText, setResultText] = useState('');
  const timerRef = useRef(null);
  const BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001';
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const scheduleReset = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { setUploadState('idle'); setResultText(''); }, 6000);
  };

  const handleFileSelected = (file) => {
    if (!file) return;
    if (!file.name.match(/\.(csv|xlsx|xls|txt)$/i)) {
      setResultText('Please upload a CSV or Excel file');
      setUploadState('result_error');
      scheduleReset();
      return;
    }
    setSelectedFile(file);
    if (file.name.match(/\.(xlsx|xls)$/i)) {
      setUploadState('xlsx_confirm');
      return;
    }
    setUploadState('preview_loading');
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const { headers, rows } = parseCsvHead(e.target.result, 5);
        const platform = detectPlatformFromHeaders(headers);
        if (rows.length === 0) { setPreview(null); setUploadState('preview_empty'); return; }
        setPreview({ headers, rows, platform });
        setUploadState('preview_ok');
      } catch {
        setResultText('Could not read the file. Try saving it as CSV first.');
        setUploadState('preview_error');
      }
    };
    reader.onerror = () => { setResultText('Could not read the file.'); setUploadState('preview_error'); };
    reader.readAsText(file);
  };

  const handleConfirmUpload = async () => {
    if (!selectedFile || uploadState === 'uploading') return;
    setUploadState('uploading');
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      const res = await fetch(`${BASE}/integrations/${encodeURIComponent(platformId)}/import`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      const label = data.reportType === 'payments' ? 'payment records' : 'order records';
      setResultText(`${data.inserted} ${label} imported (${data.skipped} already in your account)`);
      setUploadState('result_ok');
      window.dispatchEvent(new Event('inv:mutation'));
      if (onUploadDone) onUploadDone();
    } catch (err) {
      setResultText(err.message);
      setUploadState('result_error');
    } finally {
      scheduleReset();
    }
  };

  const handleCancel = () => { setUploadState('idle'); setSelectedFile(null); setPreview(null); };

  const exportHint = platformId === 'meesho'
    ? 'Drop any Meesho report — Payment Statement or GSTR Tax Invoice'
    : platformId === 'ajio' ? 'Ajio Seller Portal → Reports → Order Report'
    : 'Drop your order export CSV here';

  const renderPreview = () => {
    if (!preview) return null;
    const spec = preview.platform ? PLATFORM_PREVIEW_COLUMNS[preview.platform] : null;
    const labels = spec ? spec.labels : preview.headers.slice(0, 4);
    const indices = spec ? spec.keys.map(k => preview.headers.indexOf(k)) : [0, 1, 2, 3];
    const cell = (row, i) => (indices[i] >= 0 ? row[indices[i]] : null) || '—';
    const platformName = preview.platform === 'meesho_payment' ? 'Meesho GSTR' : preview.platform === 'meesho' ? 'Meesho' : preview.platform === 'ajio' ? 'Ajio' : preview.platform === 'citymall' ? 'CityMall' : null;

    return (
      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
          {platformName
            ? `Looks good — showing the first ${preview.rows.length} orders from your ${platformName} report`
            : `Showing first ${preview.rows.length} rows — platform not detected, but you can still import`}
        </div>
        {isMobile ? (
          // Card layout for mobile (<640px) — matches Meesho app pattern
          <div>
            {preview.rows.slice(0, 3).map((row, ri) => (
              <div key={ri} style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '8px 10px', marginBottom: 6, fontSize: 11, border: '1px solid var(--border)' }}>
                {labels.slice(0, 3).map((label, ci) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{label}</span>
                    <span style={{ color: 'var(--text-secondary)', maxWidth: '58%', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cell(row, ci)}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          // Table layout for desktop
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, color: 'var(--text-secondary)' }}>
              <thead>
                <tr>{labels.map(l => <th key={l} style={{ textAlign: 'left', padding: '4px 6px', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{l}</th>)}</tr>
              </thead>
              <tbody>
                {preview.rows.map((row, ri) => (
                  <tr key={ri}>
                    {labels.map((_, ci) => <td key={ci} style={{ padding: '3px 6px', borderBottom: '1px solid var(--border)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cell(row, ci)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
        Import via CSV / Excel
      </div>

      {uploadState === 'idle' && (
        <label
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); handleFileSelected(e.dataTransfer.files[0]); }}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 6, padding: '16px 12px', borderRadius: 'var(--radius)',
            border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border2)'}`,
            background: dragging ? 'var(--accent-dim)' : 'var(--surface2)',
            cursor: 'pointer', transition: 'all 0.15s ease',
          }}
        >
          <input type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }} onChange={e => handleFileSelected(e.target.files[0])} />
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Drop CSV/Excel here or click to browse</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{exportHint}</span>
        </label>
      )}

      {uploadState === 'preview_loading' && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '12px 0' }}>Reading your file…</div>
      )}

      {(uploadState === 'preview_ok' || uploadState === 'preview_empty' || uploadState === 'preview_error') && (
        <div>
          {uploadState === 'preview_ok' && renderPreview()}
          {uploadState === 'preview_empty' && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>No orders found in this file. Check that it contains data rows.</div>
          )}
          {uploadState === 'preview_error' && (
            <div style={{ fontSize: 12, color: 'var(--danger)', padding: '8px 0' }}>{resultText || 'Could not read the file.'}</div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button
              onClick={handleConfirmUpload}
              disabled={uploadState === 'preview_error' || uploadState === 'preview_empty'}
              style={{ flex: 1, padding: '7px 12px', borderRadius: 'var(--radius)', background: 'var(--accent)', color: '#fff', border: 'none', cursor: (uploadState === 'preview_error' || uploadState === 'preview_empty') ? 'default' : 'pointer', fontSize: 12, fontWeight: 600, opacity: (uploadState === 'preview_error' || uploadState === 'preview_empty') ? 0.5 : 1 }}
            >
              Import these orders
            </button>
            <button onClick={handleCancel} style={{ padding: '7px 12px', borderRadius: 'var(--radius)', background: 'var(--surface2)', color: 'var(--text-secondary)', border: '1px solid var(--border)', cursor: 'pointer', fontSize: 12 }}>
              Choose a different file
            </button>
          </div>
        </div>
      )}

      {uploadState === 'xlsx_confirm' && (
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '8px 0' }}>
            <strong>{selectedFile?.name}</strong> — Excel file ready to import.
            <br /><span style={{ color: 'var(--text-muted)' }}>Your orders will be added to your dashboard.</span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button onClick={handleConfirmUpload} style={{ flex: 1, padding: '7px 12px', borderRadius: 'var(--radius)', background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
              Import this file
            </button>
            <button onClick={handleCancel} style={{ padding: '7px 12px', borderRadius: 'var(--radius)', background: 'var(--surface2)', color: 'var(--text-secondary)', border: '1px solid var(--border)', cursor: 'pointer', fontSize: 12 }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {uploadState === 'uploading' && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '12px 0' }}>Uploading and processing your orders…</div>
      )}

      {(uploadState === 'result_ok' || uploadState === 'result_error') && (
        <div style={{ marginTop: 8, fontSize: 12, color: uploadState === 'result_ok' ? 'var(--success)' : 'var(--danger)' }}>{resultText}</div>
      )}
    </div>
  );
}

function IntegrationsPane() {
  const { post, patch, loading: apiLoading } = useApiRequest();
  const { token } = useAuth();
  const { data, loading, error, refetch } = useFetch('/integrations');
  const integrations = data?.integrations || [];

  const [busy, setBusy]             = useState({});
  const [shopDomain, setShopDomain] = useState('');
  const [shopModal, setShopModal]   = useState(false);
  const [posInfo, setPosInfo]       = useState(null);
  const [flash, setFlash]           = useState({});
  const [whatsappCatalog, setWhatsappCatalog] = useState('');
  const [waCatalogModal, setWaCatalogModal]   = useState(false);
  const [wooModal, setWooModal]   = useState(false);
  const [wooForm, setWooForm]     = useState({ siteUrl: '', consumerKey: '', consumerSecret: '' });

  // Handle OAuth redirect-back (Shopify/Amazon/etc redirect to /settings?integration=X&status=Y)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const integration = params.get('integration');
    const status = params.get('status');
    const msg = params.get('msg');
    if (integration && status) {
      window.history.replaceState({}, '', window.location.pathname);
      if (status === 'connected') {
        setFlash(f => ({ ...f, [integration]: { ok: true, text: 'Connected successfully' } }));
        refetch();
      } else {
        setFlash(f => ({ ...f, [integration]: { ok: false, text: msg ? decodeURIComponent(msg) : 'Connection failed' } }));
      }
      setTimeout(() => setFlash(f => { const n = { ...f }; delete n[integration]; return n; }), 5000);
    }
  }, []); // eslint-disable-line

  const startOAuth = async (id, extraParams = '') => {
    setBusy(b => ({ ...b, [id]: true }));
    try {
      const data = await api.get(`/integrations/${id}/auth${extraParams}`, token);
      window.location.href = data.authUrl;
    } catch (err) {
      setFlash(f => ({ ...f, [id]: { ok: false, text: err.message || 'Failed to start OAuth' } }));
      setTimeout(() => setFlash(f => { const n = { ...f }; delete n[id]; return n; }), 4000);
      setBusy(b => ({ ...b, [id]: false }));
    }
  };

  const handleConnect = async (id) => {
    if (id === 'shopify') { setShopModal(true); return; }
    if (id === 'woocommerce') { setWooModal(true); return; }
    if (id === 'meesho' || id === 'ajio') {
      setBusy(b => ({ ...b, [id]: true }));
      try {
        await post(`/integrations/${id}/connect`, {});
        setFlash(f => ({ ...f, [id]: { ok: true, text: 'Ready — upload your CSV export to import orders' } }));
        refetch();
      } catch (err) {
        setFlash(f => ({ ...f, [id]: { ok: false, text: err.message } }));
      } finally {
        setBusy(b => ({ ...b, [id]: false }));
        setTimeout(() => setFlash(f => { const n = { ...f }; delete n[id]; return n; }), 4000);
      }
      return;
    }
    if (id === 'tally') {
      setBusy(b => ({ ...b, tally: true }));
      try { await downloadBlob('/integrations/tally/export', `inventory-tally-${Date.now()}.xml`); refetch(); }
      catch (err) { setFlash(f => ({ ...f, tally: { ok: false, text: err.message } })); setTimeout(() => setFlash(f => { const n = { ...f }; delete n.tally; return n; }), 4000); }
      finally { setBusy(b => ({ ...b, tally: false })); }
      return;
    }
    if (id === 'pos') {
      setBusy(b => ({ ...b, pos: true }));
      try {
        const data = await api.get('/integrations/pos/webhook-url', token);
        setPosInfo(data);
        refetch();
      } catch (err) {
        setFlash(f => ({ ...f, pos: { ok: false, text: err.message } }));
        setTimeout(() => setFlash(f => { const n = { ...f }; delete n.pos; return n; }), 4000);
      } finally {
        setBusy(b => ({ ...b, pos: false }));
      }
      return;
    }
    startOAuth(id);
  };

  const handleShopifyConnect = () => {
    if (!shopDomain.trim()) return;
    const shop = shopDomain.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
    setShopModal(false);
    setShopDomain('');
    startOAuth('shopify', `?shop=${encodeURIComponent(shop)}`);
  };

  const handleWooConnect = async () => {
    if (!wooForm.siteUrl.trim() || !wooForm.consumerKey.trim() || !wooForm.consumerSecret.trim()) return;
    setWooModal(false);
    setBusy(b => ({ ...b, woocommerce: true }));
    try {
      await post('/integrations/woocommerce/connect', wooForm);
      setFlash(f => ({ ...f, woocommerce: { ok: true, text: 'WooCommerce connected — click Sync Now to import orders' } }));
      refetch();
    } catch (err) {
      setFlash(f => ({ ...f, woocommerce: { ok: false, text: err.message } }));
    } finally {
      setBusy(b => ({ ...b, woocommerce: false }));
      setTimeout(() => setFlash(f => { const n = { ...f }; delete n.woocommerce; return n; }), 5000);
    }
    setWooForm({ siteUrl: '', consumerKey: '', consumerSecret: '' });
  };

  const downloadBlob = async (path, filename) => {
    const BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001';
    const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const handleSync = async (id) => {
    setBusy(b => ({ ...b, [id]: 'sync' }));
    try {
      if (id === 'tally') {
        await downloadBlob('/integrations/tally/export', `inventory-tally-${Date.now()}.xml`);
        refetch();
        return;
      }
      if (id === 'meesho') {
        // Report Status is shown inline — nothing to do on button click
        return;
      }
      if (id === 'pos') {
        const data = await api.get('/integrations/pos/webhook-url', token);
        setPosInfo(data);
        return;
      }
      if (id === 'whatsapp') {
        setWaCatalogModal(true);
        return;
      }
      const result = await post(`/integrations/${id}/sync`, {});
      const synced = result.products?.total || result.listings?.synced || 0;
      const imported = result.orders?.imported || 0;
      setFlash(f => ({ ...f, [id]: { ok: true, text: `Synced ${synced} products · ${imported} orders imported` } }));
      refetch();
    } catch (err) {
      setFlash(f => ({ ...f, [id]: { ok: false, text: err.message || 'Sync failed' } }));
    } finally {
      setBusy(b => ({ ...b, [id]: false }));
      setTimeout(() => setFlash(f => { const n = { ...f }; delete n[id]; return n; }), 5000);
    }
  };

  const handleWhatsAppSync = async () => {
    setWaCatalogModal(false);
    if (whatsappCatalog.trim()) {
      await patch('/integrations/whatsapp/config', { catalogId: whatsappCatalog.trim() }).catch(() => {});
    }
    setBusy(b => ({ ...b, whatsapp: 'sync' }));
    try {
      const result = await post('/integrations/whatsapp/sync', {});
      setFlash(f => ({ ...f, whatsapp: { ok: true, text: `Exported ${result.exported} products to WhatsApp catalog` } }));
      refetch();
    } catch (err) {
      setFlash(f => ({ ...f, whatsapp: { ok: false, text: err.message } }));
    } finally {
      setBusy(b => ({ ...b, whatsapp: false }));
      setTimeout(() => setFlash(f => { const n = { ...f }; delete n.whatsapp; return n; }), 5000);
    }
  };

  const handleDisconnect = async (id) => {
    if (!window.confirm(`Disconnect ${id}? Synced data will not be deleted.`)) return;
    setBusy(b => ({ ...b, [id]: true }));
    try {
      await api.delete(`/integrations/${id}/disconnect`, token);
      refetch();
    } catch (_) {} finally {
      setBusy(b => ({ ...b, [id]: false }));
    }
  };

  if (loading) return <div className="skeleton" style={{ height: 300, borderRadius: 'var(--radius)' }} />;

  if (error) return (
    <div className="empty-state" style={{ padding: '48px 24px' }}>
      <AlertTriangle size={28} color="var(--danger)" style={{ opacity: 0.7 }} />
      <h3>Couldn&apos;t load integrations</h3>
      <p>We couldn&apos;t reach the server. Check your connection and try again.</p>
      <button className="btn btn-ghost btn-sm" onClick={refetch} style={{ marginTop: 14 }}>Retry</button>
    </div>
  );

  if (!integrations.length) return (
    <div className="empty-state" style={{ padding: '48px 24px' }}>
      <Plug size={28} style={{ opacity: 0.4 }} />
      <h3>No sales channels connected yet</h3>
      <p>Connect Meesho, Amazon, Shopify and more to sync orders and update inventory automatically.</p>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Shopify domain modal */}
      {shopModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ width: 340, padding: 24 }}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 12 }}>Connect Shopify</div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Your shop domain</label>
            <input
              autoFocus value={shopDomain} onChange={e => setShopDomain(e.target.value)}
              placeholder="yourstore.myshopify.com"
              onKeyDown={e => { if (e.key === 'Enter') handleShopifyConnect(); if (e.key === 'Escape') setShopModal(false); }}
              style={{ width: '100%', padding: '9px 12px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 14 }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setShopModal(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={handleShopifyConnect} disabled={!shopDomain.trim()}>Authorize →</button>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp catalog ID modal */}
      {waCatalogModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ width: 360, padding: 24 }}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8 }}>WhatsApp Catalog Sync</div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>Enter your Meta Commerce Catalog ID (from Meta Business Suite → Commerce Manager).</p>
            <input
              autoFocus value={whatsappCatalog} onChange={e => setWhatsappCatalog(e.target.value)}
              placeholder="e.g. 123456789012345"
              style={{ width: '100%', padding: '9px 12px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 14 }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setWaCatalogModal(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={handleWhatsAppSync}>Export catalog</button>
            </div>
          </div>
        </div>
      )}

      {/* WooCommerce credential modal */}
      {wooModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ width: 380, padding: 24 }}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Connect WooCommerce</div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
              Go to WooCommerce → Settings → Advanced → REST API to generate a key.
            </p>
            {[
              { label: 'Site URL', key: 'siteUrl', placeholder: 'https://yourstore.com' },
              { label: 'Consumer Key', key: 'consumerKey', placeholder: 'ck_...' },
              { label: 'Consumer Secret', key: 'consumerSecret', placeholder: 'cs_...' },
            ].map(({ label, key, placeholder }) => (
              <div key={key} style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>{label}</label>
                <input
                  value={wooForm[key]}
                  onChange={e => setWooForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  style={{ width: '100%', padding: '8px 10px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setWooModal(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={handleWooConnect} disabled={!wooForm.siteUrl.trim()}>Connect →</button>
            </div>
          </div>
        </div>
      )}

      {/* POS webhook info */}
      {posInfo && (
        <div style={{ padding: '14px 16px', background: 'var(--accent-dim)', border: '1px solid var(--accent-border)', borderRadius: 'var(--radius)', fontSize: 13 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>POS Webhook URL</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)', wordBreak: 'break-all', marginBottom: 8 }}>{posInfo.webhookUrl}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>POST JSON with: <code style={{ fontFamily: 'var(--font-mono)' }}>{'{ orderId, saleDate, items: [{ sku, quantity, price }] }'}</code></div>
          <button className="btn btn-ghost" style={{ marginTop: 8, fontSize: 11, padding: '4px 10px' }} onClick={() => { navigator.clipboard.writeText(posInfo.webhookUrl); }}>Copy URL</button>
        </div>
      )}

      {integrations.map(p => {
        const color = PLATFORM_COLORS[p.id] || 'var(--accent)';
        const isBusy = !!busy[p.id];
        const isSyncing = busy[p.id] === 'sync';
        const flashMsg = flash[p.id];
        const isCsvPlatform = p.id === 'meesho' || p.id === 'ajio';
        const syncLabel = p.id === 'tally' ? 'Export XML' : p.id === 'meesho' ? null : isCsvPlatform ? 'View Stats' : p.id === 'whatsapp' ? 'Export Catalog' : 'Sync Now';

        const isError = p.status === 'error';
        return (
          <div key={p.id} style={{
            padding: '14px 18px', background: 'var(--surface)',
            border: `1px solid ${isError ? 'rgba(248,113,113,0.3)' : p.connected ? 'rgba(93,190,138,0.3)' : 'var(--border)'}`,
            borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)',
            transition: 'border-color 0.2s',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: isError ? 'var(--danger)' : p.connected ? 'var(--success)' : color, flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: flashMsg ? (flashMsg.ok ? 'var(--success)' : 'var(--danger)') : isError ? 'var(--danger)' : 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {flashMsg?.text || (isError
                      ? (p.metadata?.lastSyncError ? `Sync failed: ${p.metadata.lastSyncError}` : 'Last sync failed — will retry in 1h')
                      : p.connected && p.lastSyncAt
                      ? `Last synced ${new Date(p.lastSyncAt).toLocaleString()}`
                      : p.connected ? 'Connected · ready to sync'
                      : p.desc)}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                {p.connected ? (
                  <>
                    {syncLabel && (
                      <button
                        onClick={() => handleSync(p.id)}
                        disabled={isBusy}
                        className="btn btn-primary"
                        style={{ fontSize: 12, padding: '5px 12px' }}
                      >
                        {isSyncing ? <><Loader size={11} style={{ animation: 'spin 0.8s linear infinite' }} /> Syncing…</> : syncLabel}
                      </button>
                    )}
                    <button
                      onClick={() => handleDisconnect(p.id)}
                      disabled={isBusy}
                      className="btn btn-ghost"
                      style={{ fontSize: 12, padding: '5px 12px', color: 'var(--danger)' }}
                    >
                      Disconnect
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleConnect(p.id)}
                    disabled={isBusy}
                    className="btn btn-ghost"
                    style={{ fontSize: 12, padding: '5px 12px' }}
                  >
                    {isBusy ? <Loader size={12} style={{ animation: 'spin 0.8s linear infinite' }} /> : p.id === 'tally' ? 'Export XML' : 'Connect'}
                  </button>
                )}
              </div>
            </div>

            {p.connected && p.id === 'shopify' && p.shopDomain && (
              <div style={{ marginTop: 6, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', paddingLeft: 22 }}>{p.shopDomain}</div>
            )}
            {p.status === 'syncing' && (
              <div style={{ marginTop: 6, fontSize: 11, color: 'var(--accent)', paddingLeft: 22, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Loader size={10} style={{ animation: 'spin 0.8s linear infinite' }} /> Syncing in background…
              </div>
            )}
            {p.connected && isCsvPlatform && (
              <CsvUploadZone platformId={p.id} onUploadDone={refetch} />
            )}
            {p.connected && p.id === 'meesho' && (
              <MeeshoReportStatus metadata={p.metadata} />
            )}
            {!p.connected && PLATFORM_SETUP[p.id] && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)', paddingLeft: 22 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Setup</div>
                <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {PLATFORM_SETUP[p.id].steps.map((step, i) => (
                    <li key={i} style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{step}</li>
                  ))}
                </ol>
                {PLATFORM_SETUP[p.id].needs !== 'No credentials needed' && (
                  <div style={{ marginTop: 8, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', background: 'var(--surface2)', padding: '4px 8px', borderRadius: 4, display: 'inline-block' }}>
                    .env: {PLATFORM_SETUP[p.id].needs}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── System ────────────────────────────────────────────────────────────────────
function SystemPane() {
  const handleResetAll = () => {
    if (!window.confirm('Clear all locally stored preferences? Your account, inventory, and sales data will not be affected.')) return;
    Object.keys(localStorage).filter(k => k.startsWith('inv_pref_') || k === 'inv_theme').forEach(k => localStorage.removeItem(k));
    window.location.reload();
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card title="App Information">
        <Row label="Version" desc="Adaptive Inventory BI">
          <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>v0.9.0</span>
        </Row>
        <Row label="API" desc="Backend service">
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>localhost:3001</span>
        </Row>
        <Row label="Environment" last>
          <span style={{ fontSize: 11, padding: '2px 8px', background: 'var(--warning-dim)', color: 'var(--warning)', borderRadius: 100, border: '1px solid rgba(251,191,36,0.2)' }}>
            Development
          </span>
        </Row>
      </Card>
      <Card title="Local Data" desc="Browser-stored settings and cached state.">
        <Row label="Reset all preferences" desc="Clears theme, notification settings, and all local preferences. You stay signed in." last>
          <button className="btn btn-danger btn-sm" onClick={handleResetAll}>
            <AlertTriangle size={12} /> Reset all
          </button>
        </Row>
      </Card>
    </div>
  );
}

// ── Main Settings page ────────────────────────────────────────────────────────
const SECTIONS = [
  { id: 'appearance',    label: 'Appearance',    icon: Palette },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'profile',       label: 'Account',       icon: User },
  { id: 'security',      label: 'Security',      icon: Shield },
  { id: 'preferences',   label: 'Preferences',   icon: Sliders },
  { id: 'data',          label: 'Data & Export',  icon: Download },
  { id: 'integrations',  label: 'Integrations',  icon: Plug },
  { id: 'system',        label: 'System',        icon: Info },
];

const PANES = {
  appearance: AppearancePane,
  notifications: NotificationsPane,
  profile: ProfilePane,
  security: SecurityPane,
  preferences: PreferencesPane,
  data: DataPane,
  integrations: IntegrationsPane,
  system: SystemPane,
};

export default function Settings({ initialTab }) {
  const [active, setActive] = useState(initialTab || 'appearance');
  const ActivePane = PANES[active] || AppearancePane;

  return (
    <div style={{ padding: '28px 24px', maxWidth: 1000, margin: '0 auto', animation: 'fadeIn 0.3s ease' }}>
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>
          Settings
        </p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32 }}>Settings</h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>
          Manage your account, preferences, and app configuration.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '196px 1fr', gap: 24, alignItems: 'start' }}>
        {/* Section nav */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', overflow: 'hidden',
          boxShadow: 'var(--shadow-sm)', position: 'sticky', top: 24,
        }}>
          {SECTIONS.map(({ id, label, icon: Icon }, i) => (
            <button
              key={id}
              onClick={() => setActive(id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 9, width: '100%',
                padding: '11px 14px', cursor: 'pointer', textAlign: 'left',
                background: active === id ? 'var(--accent-dim)' : 'transparent',
                color: active === id ? 'var(--accent)' : 'var(--text-secondary)',
                borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                border: 'none', fontFamily: 'var(--font-body)',
                transition: 'all 0.1s ease',
              }}
              onMouseEnter={e => { if (active !== id) { e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.color = 'var(--text-primary)'; } }}
              onMouseLeave={e => { if (active !== id) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; } }}
            >
              <Icon size={14} />
              <span style={{ fontSize: 13, fontWeight: active === id ? 600 : 400 }}>{label}</span>
            </button>
          ))}
        </div>

        {/* Active pane */}
        <div key={active} style={{ animation: 'fadeIn 0.18s ease', minWidth: 0 }}>
          <ActivePane />
        </div>
      </div>

      {/* Mobile: show all sections stacked */}
      <style>{`
        @media (max-width: 768px) {
          .settings-grid { grid-template-columns: 1fr !important; }
          .settings-nav  { display: none !important; }
        }
      `}</style>
    </div>
  );
}
