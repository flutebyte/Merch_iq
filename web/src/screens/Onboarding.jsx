import React, { useState, useEffect } from 'react';
import { ArrowRight, Upload, Camera, BookOpen, Sparkles, Link, Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useBrand } from '../contexts/BrandContext';
import { useApiRequest } from '../hooks/useApi';

const setupOptions = [
  {
    id: 'organized',
    icon: BookOpen,
    label: 'I have a spreadsheet ready',
    sub: 'Import CSV or Excel — takes under a minute',
    action: 'import',
  },
  {
    id: 'partial',
    icon: Sparkles,
    label: 'I have partial records',
    sub: 'Some data is fine, we fill the gaps as you sell',
    action: 'import',
  },
  {
    id: 'photos',
    icon: Camera,
    label: "I'll photograph my stock",
    sub: 'Point, shoot, done — build inventory with your phone',
    action: 'photo',
  },
  {
    id: 'scratch',
    icon: Upload,
    label: 'Starting from zero',
    sub: 'Add products manually as you go',
    action: 'photo',
  },
  {
    id: 'erp',
    icon: Link,
    label: 'I use Tally or an ERP',
    sub: 'Connect Tally, Zoho, or export from any ERP',
    action: 'erp',
  },
];

const proofPoints = [
  'Know exactly what you have — in real time',
  'Catch dead stock before it kills your cash flow',
  'See which products sell and which ones sit',
  'Built for Indian sellers — Meesho, Flipkart, Amazon',
];

const MOBILE_STYLE = `
  @media (max-width: 768px) {
    .onboarding-left {
      width: 100% !important;
      min-height: auto !important;
      border-right: none !important;
      border-bottom: 1px solid var(--border);
      padding: 32px 24px !important;
    }
    .onboarding-right {
      min-height: auto !important;
      padding: 32px 24px !important;
    }
  }
`;

export default function Onboarding({ onComplete }) {
  const { user }  = useAuth();
  const { brand, setBrand } = useBrand();
  const { patch, loading: saving } = useApiRequest();

  // 'brand' → 'setup'
  const [step, setStep]           = useState('brand');
  const [brandInput, setBrandInput] = useState('');
  const [selected, setSelected]   = useState(null);
  const [hovering, setHovering]   = useState(null);

  // Skip brand step if brand already has a custom name
  useEffect(() => {
    if (brand?.name && step === 'brand') {
      setStep('setup');
    }
  }, [brand, step]);

  const displayName = brand?.name || brandInput
    || user?.email?.split('@')[0]?.replace(/[._-]/g, ' ')?.replace(/\b\w/g, c => c.toUpperCase())
    || null;

  const chosen = setupOptions.find(o => o.id === selected);

  async function handleBrandContinue() {
    const trimmed = brandInput.trim();
    if (trimmed && brand?.id) {
      try {
        const updated = await patch(`/brands/${brand.id}`, { name: trimmed });
        if (updated) setBrand(updated);
      } catch {
        // Non-blocking — user can rename later in Settings
      }
    }
    setStep('setup');
  }

  // ── Shared left panel ──────────────────────────────────────────────────────
  const leftPanel = (
    <div className="onboarding-left" style={{
      width: '45%',
      minHeight: '100vh',
      background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '48px 52px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Subtle background shape */}
      <div style={{
        position: 'absolute',
        bottom: -120,
        left: -80,
        width: 400,
        height: 400,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(99,102,241,0.07) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Top — wordmark */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 64 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="2" width="5" height="5" rx="1" fill="white" />
              <rect x="9" y="2" width="5" height="5" rx="1" fill="white" fillOpacity="0.5" />
              <rect x="2" y="9" width="5" height="5" rx="1" fill="white" fillOpacity="0.5" />
              <rect x="9" y="9" width="5" height="5" rx="1" fill="white" />
            </svg>
          </div>
          <span style={{
            fontSize: 15, fontWeight: 700, color: 'var(--text-primary)',
            letterSpacing: '-0.01em',
          }}>
            Inventory OS
          </span>
        </div>

        {/* Headline */}
        <div style={{ marginBottom: 40 }}>
          <div style={{
            fontSize: 11, fontWeight: 600, color: 'var(--accent)',
            letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16,
          }}>
            {displayName ? `Welcome, ${displayName}` : 'Built for sellers'}
          </div>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 38,
            lineHeight: 1.15,
            letterSpacing: '-0.03em',
            color: 'var(--text-primary)',
            fontWeight: 700,
            marginBottom: 20,
          }}>
            Your inventory,<br />finally under<br />control.
          </h1>
          <p style={{
            fontSize: 15,
            color: 'var(--text-secondary)',
            lineHeight: 1.65,
            maxWidth: 340,
          }}>
            Stop guessing what you have in stock.
            Start making decisions backed by real numbers.
          </p>
        </div>

        {/* Proof points */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {proofPoints.map((point, i) => (
            <div
              key={i}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                animation: `fadeIn 0.4s ease ${i * 0.08 + 0.2}s both`,
              }}
            >
              <div style={{
                width: 18, height: 18, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                background: 'var(--accent-dim)',
                border: '1px solid var(--accent-border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Check size={10} color="var(--accent)" strokeWidth={2.5} />
              </div>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {point}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom — social proof */}
      <div style={{
        paddingTop: 32,
        borderTop: '1px solid var(--border)',
      }}>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          "Finally stopped losing money to dead stock. The confidence scoring alone saved us ₹2L in one quarter."
        </p>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, fontWeight: 500 }}>
          — Priya M., boutique owner, Surat
        </p>
      </div>
    </div>
  );

  // ── Brand name step ────────────────────────────────────────────────────────
  if (step === 'brand') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexWrap: 'wrap', background: 'var(--bg)' }}>
        <style>{MOBILE_STYLE}</style>
        {leftPanel}

        <div className="onboarding-right" style={{
          flex: 1,
          minWidth: 300,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 52px',
          animation: 'fadeIn 0.5s ease',
        }}>
          <div style={{ width: '100%', maxWidth: 420 }}>
            <div style={{ marginBottom: 40 }}>
              <h2 style={{
                fontFamily: 'var(--font-display)',
                fontSize: 26,
                fontWeight: 700,
                color: 'var(--text-primary)',
                letterSpacing: '-0.02em',
                marginBottom: 8,
              }}>
                What's your brand called?
              </h2>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                We'll use this across your dashboard, reports, and exports.
              </p>
            </div>

            <input
              type="text"
              value={brandInput}
              onChange={e => setBrandInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleBrandContinue()}
              placeholder="e.g. Cherish, Studio Meera, The Label Co."
              autoFocus
              style={{
                width: '100%',
                padding: '13px 16px',
                background: 'var(--surface)',
                border: '1px solid var(--border2)',
                borderRadius: 'var(--radius-lg)',
                color: 'var(--text-primary)',
                fontSize: 15,
                outline: 'none',
                marginBottom: 16,
                boxSizing: 'border-box',
                transition: 'border-color 0.12s ease',
              }}
              onFocus={e => { e.target.style.borderColor = 'var(--accent)'; }}
              onBlur={e => { e.target.style.borderColor = 'var(--border2)'; }}
            />

            <button
              className="btn btn-primary"
              onClick={handleBrandContinue}
              disabled={saving}
              style={{
                width: '100%',
                justifyContent: 'center',
                padding: '13px 20px',
                fontSize: 14,
                fontWeight: 600,
                borderRadius: 'var(--radius-lg)',
                letterSpacing: '-0.01em',
                marginBottom: 12,
              }}
            >
              {saving ? 'Saving…' : 'Continue'} {!saving && <ArrowRight size={15} />}
            </button>

            <button
              onClick={() => setStep('setup')}
              style={{
                width: '100%',
                padding: '10px 20px',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: 13,
                cursor: 'pointer',
                textAlign: 'center',
              }}
            >
              Skip for now
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Setup options step ─────────────────────────────────────────────────────
  if (step === 'setup') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexWrap: 'wrap', background: 'var(--bg)' }}>
        <style>{MOBILE_STYLE}</style>
        {leftPanel}

        <div className="onboarding-right" style={{
          flex: 1,
          minWidth: 300,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 52px',
          animation: 'fadeIn 0.5s ease',
        }}>
          <div style={{ width: '100%', maxWidth: 420 }}>

            <div style={{ marginBottom: 40 }}>
              <h2 style={{
                fontFamily: 'var(--font-display)',
                fontSize: 26,
                fontWeight: 700,
                color: 'var(--text-primary)',
                letterSpacing: '-0.02em',
                marginBottom: 8,
              }}>
                Let's get you set up
              </h2>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                How would you like to start? You can always change this later.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 32 }}>
              {setupOptions.map((opt, i) => {
                const Icon = opt.icon;
                const isSelected = selected === opt.id;
                const isHovered  = hovering === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => setSelected(opt.id)}
                    onMouseEnter={() => setHovering(opt.id)}
                    onMouseLeave={() => setHovering(null)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: '14px 16px',
                      background: isSelected ? 'var(--accent-dim)' : isHovered ? 'var(--surface2)' : 'var(--surface)',
                      border: `1px solid ${isSelected ? 'var(--accent-border)' : isHovered ? 'var(--border2)' : 'var(--border)'}`,
                      borderRadius: 'var(--radius-lg)',
                      cursor: 'pointer', textAlign: 'left',
                      transition: 'all 0.12s ease',
                      animation: `fadeIn 0.3s ease ${i * 0.05}s both`,
                      outline: 'none',
                      width: '100%',
                    }}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                      background: isSelected ? 'rgba(99,102,241,0.15)' : 'var(--surface2)',
                      border: `1px solid ${isSelected ? 'var(--accent-border)' : 'var(--border)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.12s ease',
                    }}>
                      <Icon size={15} color={isSelected ? 'var(--accent)' : 'var(--text-muted)'} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 13, fontWeight: 600,
                        color: isSelected ? 'var(--accent)' : 'var(--text-primary)',
                        marginBottom: 2, transition: 'color 0.12s',
                      }}>
                        {opt.label}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                        {opt.sub}
                      </div>
                    </div>
                    <div style={{
                      width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                      border: `2px solid ${isSelected ? 'var(--accent)' : 'var(--border2)'}`,
                      background: isSelected ? 'var(--accent)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.12s ease',
                    }}>
                      {isSelected && (
                        <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#fff' }} />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              className="btn btn-primary"
              disabled={!selected}
              onClick={() => chosen && onComplete(chosen.action)}
              style={{
                width: '100%',
                justifyContent: 'center',
                padding: '13px 20px',
                fontSize: 14,
                fontWeight: 600,
                borderRadius: 'var(--radius-lg)',
                opacity: selected ? 1 : 0.4,
                transition: 'opacity 0.15s ease',
                letterSpacing: '-0.01em',
              }}
            >
              Continue <ArrowRight size={15} />
            </button>

            <p style={{
              textAlign: 'center', marginTop: 16,
              fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5,
            }}>
              No credit card · Free to start · Add more data any time
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
