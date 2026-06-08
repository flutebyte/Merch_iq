import React, { useState, useEffect } from 'react';
import { ArrowRight, Upload, Camera, BookOpen, Sparkles, Link, Package, TrendingUp, Zap, BarChart2, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useBrand } from '../contexts/BrandContext';

const setupOptions = [
  {
    id: 'organized',
    icon: BookOpen,
    label: 'I have a file ready',
    sub: 'Import a CSV or Excel sheet',
    action: 'import',
    color: 'var(--success)',
  },
  {
    id: 'partial',
    icon: Sparkles,
    label: 'I have partial data',
    sub: 'Some records, gaps are okay',
    action: 'import',
    color: 'var(--accent)',
  },
  {
    id: 'photos',
    icon: Camera,
    label: 'I\'ll photograph products',
    sub: 'Build inventory from photos, one by one',
    action: 'photo',
    color: 'var(--warning)',
  },
  {
    id: 'scratch',
    icon: Upload,
    label: 'Starting completely fresh',
    sub: 'Enter inventory manually as you go',
    action: 'photo',
    color: 'var(--info)',
  },
  {
    id: 'erp',
    icon: Link,
    label: 'I use an ERP or accounting system',
    sub: 'Connect Tally, Zoho, or export from ERP',
    action: 'erp',
    color: 'var(--text-secondary)',
  },
];

const features = [
  { icon: Package,     label: 'Smart inventory tracking',  sub: 'Always know what you have'         },
  { icon: TrendingUp,  label: 'Dead stock detection',      sub: 'Find slow-moving items early'      },
  { icon: BarChart2,   label: 'Sales intelligence',        sub: 'Know what sells and what doesn\'t' },
  { icon: ShieldCheck, label: 'Confidence scoring',        sub: 'Trust your numbers again'          },
];

export default function Onboarding({ onComplete }) {
  const { user }  = useAuth();
  const { brand } = useBrand();

  const [step, setStep]         = useState('welcome'); // 'welcome' | 'setup'
  const [selected, setSelected] = useState(null);
  const [hovering, setHovering] = useState(null);
  const [featIdx, setFeatIdx]   = useState(0);

  // Cycle the feature highlight every 2.5s on the welcome screen
  useEffect(() => {
    if (step !== 'welcome') return;
    const t = setInterval(() => setFeatIdx(i => (i + 1) % features.length), 2500);
    return () => clearInterval(t);
  }, [step]);

  const displayName = brand?.name
    || user?.email?.split('@')[0]?.replace(/[._-]/g, ' ')?.replace(/\b\w/g, c => c.toUpperCase())
    || 'there';

  const chosen = setupOptions.find(o => o.id === selected);

  // ── Welcome screen ─────────────────────────────────────────────────────────
  if (step === 'welcome') {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg)', padding: '24px',
        backgroundImage: [
          'radial-gradient(ellipse at 15% 40%, rgba(99,102,241,0.08) 0%, transparent 55%)',
          'radial-gradient(ellipse at 85% 20%, rgba(52,211,153,0.05) 0%, transparent 50%)',
          'radial-gradient(ellipse at 60% 85%, rgba(251,191,36,0.04) 0%, transparent 50%)',
        ].join(', '),
      }}>
        <div style={{ width: '100%', maxWidth: 620, animation: 'fadeIn 0.6s ease' }}>

          {/* Logo mark */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 40 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16,
              background: 'linear-gradient(135deg, var(--accent) 0%, #8B5CF6 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 40px rgba(99,102,241,0.35), 0 0 0 1px rgba(99,102,241,0.2)',
            }}>
              <Zap size={26} color="#fff" fill="#fff" />
            </div>
          </div>

          {/* Greeting */}
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 14px',
              background: 'var(--success-dim)', border: '1px solid rgba(52,211,153,0.2)',
              borderRadius: 100, marginBottom: 20,
            }}>
              <span style={{ fontSize: 14 }}>👋</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--success)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Welcome aboard
              </span>
            </div>

            <h1 style={{
              fontFamily: 'var(--font-display)', fontSize: 'clamp(36px, 6vw, 52px)',
              lineHeight: 1.1, color: 'var(--text-primary)', marginBottom: 16, letterSpacing: '-0.02em',
            }}>
              Hey {displayName},<br />
              <span style={{
                background: 'linear-gradient(135deg, var(--accent) 0%, #8B5CF6 60%, #EC4899 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              }}>
                great to have you.
              </span>
            </h1>

            <p style={{
              color: 'var(--text-secondary)', fontSize: 16, lineHeight: 1.7,
              maxWidth: 480, margin: '0 auto',
            }}>
              Your inventory command center is ready. We'll help you go from chaos to clarity — 
              no perfect data needed, no steep learning curve.
            </p>
          </div>

          {/* Feature cards */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 44,
          }}>
            {features.map((f, i) => {
              const Icon = f.icon;
              const isActive = featIdx === i;
              return (
                <div
                  key={f.label}
                  style={{
                    padding: '16px 18px', borderRadius: 'var(--radius-lg)',
                    background: isActive ? 'var(--surface2)' : 'var(--surface)',
                    border: `1px solid ${isActive ? 'var(--accent-border)' : 'var(--border)'}`,
                    transition: 'all 0.4s ease',
                    boxShadow: isActive ? '0 0 0 1px var(--accent-border), 0 4px 20px rgba(99,102,241,0.08)' : 'none',
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                  }}
                >
                  <div style={{
                    width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                    background: isActive ? 'var(--accent-dim)' : 'var(--surface2)',
                    border: `1px solid ${isActive ? 'var(--accent-border)' : 'var(--border)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.4s ease',
                  }}>
                    <Icon size={15} color={isActive ? 'var(--accent)' : 'var(--text-muted)'} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)', marginBottom: 2, transition: 'color 0.3s' }}>
                      {f.label}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>{f.sub}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* CTA */}
          <button
            className="btn btn-primary"
            onClick={() => setStep('setup')}
            style={{
              width: '100%', justifyContent: 'center', padding: '15px', fontSize: 15,
              borderRadius: 'var(--radius-lg)',
              background: 'linear-gradient(135deg, var(--accent) 0%, #7C3AED 100%)',
              border: 'none',
              boxShadow: '0 4px 24px rgba(99,102,241,0.35)',
            }}
          >
            Let's set up your inventory <ArrowRight size={16} />
          </button>

          <p style={{ textAlign: 'center', marginTop: 14, fontSize: 12, color: 'var(--text-muted)' }}>
            Takes under 2 minutes &nbsp;·&nbsp; No credit card required
          </p>
        </div>
      </div>
    );
  }

  // ── Setup screen ───────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: '24px',
      backgroundImage: 'radial-gradient(ellipse at 20% 50%, rgba(99,102,241,0.06) 0%, transparent 60%)',
    }}>
      <div style={{ width: '100%', maxWidth: 580, animation: 'slideUp 0.4s ease' }}>

        {/* Back + step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 36 }}>
          <button
            onClick={() => setStep('welcome')}
            style={{ color: 'var(--text-muted)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            ← Back
          </button>
          <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
            <div style={{ width: 20, height: 3, borderRadius: 2, background: 'var(--accent)' }} />
            <div style={{ width: 20, height: 3, borderRadius: 2, background: 'var(--accent)' }} />
          </div>
        </div>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 30, lineHeight: 1.2, color: 'var(--text-primary)', marginBottom: 8 }}>
            Where is your inventory today?
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>
            We work with whatever you have — no perfect data needed.
          </p>
        </div>

        {/* Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28 }}>
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
                  display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px',
                  background: isSelected ? 'var(--surface2)' : (isHovered ? 'var(--surface)' : 'transparent'),
                  border: `1px solid ${isSelected ? opt.color : (isHovered ? 'var(--border2)' : 'var(--border)')}`,
                  borderRadius: 'var(--radius-lg)', cursor: 'pointer', textAlign: 'left',
                  transition: 'all 0.15s ease',
                  animation: `fadeIn 0.3s ease ${i * 0.06}s both`,
                  boxShadow: isSelected ? `0 0 0 1px ${opt.color}22, inset 0 0 24px ${opt.color}06` : 'none',
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                  background: isSelected ? `${opt.color}18` : 'var(--surface2)',
                  border: `1px solid ${isSelected ? opt.color + '40' : 'var(--border)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s ease',
                }}>
                  <Icon size={17} color={isSelected ? opt.color : 'var(--text-muted)'} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, fontSize: 13, color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)', marginBottom: 2 }}>
                    {opt.label}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{opt.sub}</div>
                </div>
                <div style={{
                  width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                  border: `2px solid ${isSelected ? opt.color : 'var(--border2)'}`,
                  background: isSelected ? opt.color : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s ease',
                }}>
                  {isSelected && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#0D0D0B' }} />}
                </div>
              </button>
            );
          })}
        </div>

        {/* CTA */}
        <button
          className="btn btn-primary"
          disabled={!selected}
          onClick={() => chosen && onComplete(chosen.action)}
          style={{
            width: '100%', justifyContent: 'center', padding: '14px', fontSize: 15,
            opacity: selected ? 1 : 0.35, transition: 'opacity 0.2s ease',
            borderRadius: 'var(--radius-lg)',
          }}
        >
          Continue <ArrowRight size={16} />
        </button>

        <p style={{ textAlign: 'center', marginTop: 14, fontSize: 12, color: 'var(--text-muted)' }}>
          You can always add more data later
        </p>
      </div>
    </div>
  );
}
