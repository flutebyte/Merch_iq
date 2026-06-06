import React, { useState } from 'react';
import { ArrowRight, Upload, Camera, BookOpen, Sparkles, Link } from 'lucide-react';

const options = [
  {
    id: 'organized',
    icon: BookOpen,
    label: 'I have organized inventory',
    sub: 'Ready to import a CSV or Excel file',
    action: 'import',
    color: 'var(--success)'
  },
  {
    id: 'partial',
    icon: Sparkles,
    label: 'I have partial data',
    sub: 'Some records, but gaps and missing info',
    action: 'import',
    color: 'var(--accent)'
  },
  {
    id: 'photos',
    icon: Camera,
    label: 'No file — I have products to photograph',
    sub: 'Build inventory from photos, one by one',
    action: 'photo',
    color: 'var(--warning)'
  },
  {
    id: 'scratch',
    icon: Upload,
    label: 'Starting completely fresh',
    sub: 'Enter inventory manually as you go',
    action: 'photo',
    color: 'var(--info)'
  },
  {
    id: 'erp',
    icon: Link,
    label: 'I use an ERP or accounting system',
    sub: 'Connect Tally, Zoho Inventory, or export from ERP',
    action: 'erp',
    color: 'var(--text-secondary)'
  }
];

export default function Onboarding({ onComplete }) {
  const [selected, setSelected] = useState(null);
  const [hovering, setHovering] = useState(null);

  const chosen = options.find(o => o.id === selected);

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: '24px',
      backgroundImage: 'radial-gradient(ellipse at 20% 50%, rgba(232,197,71,0.04) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(93,190,138,0.04) 0%, transparent 50%)'
    }}>
      <div style={{ width: '100%', maxWidth: 580, animation: 'fadeIn 0.5s ease' }}>
        {/* Header */}
        <div style={{ marginBottom: 48, textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px',
            background: 'var(--accent-dim)', border: '1px solid var(--accent-border)',
            borderRadius: 100, marginBottom: 24
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', animation: 'pulse 2s infinite' }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Adaptive Inventory Recovery
            </span>
          </div>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontSize: 42, lineHeight: 1.1,
            color: 'var(--text-primary)', marginBottom: 12
          }}>
            Where is your<br /><em style={{ color: 'var(--accent)' }}>inventory today?</em>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 15, lineHeight: 1.6 }}>
            We work with whatever you have — no perfect data needed.
          </p>
        </div>

        {/* Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>
          {options.map((opt, i) => {
            const Icon = opt.icon;
            const isSelected = selected === opt.id;
            const isHovered = hovering === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => setSelected(opt.id)}
                onMouseEnter={() => setHovering(opt.id)}
                onMouseLeave={() => setHovering(null)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 16, padding: '18px 20px',
                  background: isSelected ? 'var(--surface2)' : (isHovered ? 'var(--surface)' : 'transparent'),
                  border: `1px solid ${isSelected ? opt.color : (isHovered ? 'var(--border2)' : 'var(--border)')}`,
                  borderRadius: 'var(--radius-lg)', cursor: 'pointer', textAlign: 'left',
                  transition: 'all 0.15s ease',
                  animation: `fadeIn 0.3s ease ${i * 0.07}s both`,
                  boxShadow: isSelected ? `0 0 0 1px ${opt.color}22, inset 0 0 20px ${opt.color}06` : 'none'
                }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                  background: isSelected ? `${opt.color}18` : 'var(--surface2)',
                  border: `1px solid ${isSelected ? opt.color + '40' : 'var(--border)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s ease'
                }}>
                  <Icon size={18} color={isSelected ? opt.color : 'var(--text-muted)'} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)', marginBottom: 2 }}>
                    {opt.label}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{opt.sub}</div>
                </div>
                <div style={{
                  width: 20, height: 20, borderRadius: '50%',
                  border: `2px solid ${isSelected ? opt.color : 'var(--border2)'}`,
                  background: isSelected ? opt.color : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s ease', flexShrink: 0
                }}>
                  {isSelected && <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#0D0D0B' }} />}
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
            opacity: selected ? 1 : 0.3, transition: 'opacity 0.2s ease',
            borderRadius: 'var(--radius-lg)'
          }}
        >
          Continue <ArrowRight size={16} />
        </button>

        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: 'var(--text-muted)' }}>
          You can always add more data later
        </p>
      </div>
    </div>
  );
}
