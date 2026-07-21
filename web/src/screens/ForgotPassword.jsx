import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Loader, CheckCircle } from 'lucide-react';
import { authApi } from '../api/auth';

export default function ForgotPassword() {
  const [email, setEmail]     = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authApi.forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: '24px',
      backgroundImage: 'radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.14) 0%, transparent 55%), radial-gradient(ellipse at 80% 100%, rgba(99,102,241,0.06) 0%, transparent 50%)',
    }}>
      <div style={{ width: '100%', maxWidth: 400, animation: 'fadeIn 0.4s ease' }}>
        <div style={{ marginBottom: 40, textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px',
            background: 'var(--accent-dim)', border: '1px solid var(--accent-border)',
            borderRadius: 100, marginBottom: 20,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Adaptive Inventory
            </span>
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 36, lineHeight: 1.1, marginBottom: 8 }}>
            Reset password
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            {sent ? 'Check your inbox for a reset link' : "Enter your email and we'll send you a reset link"}
          </p>
        </div>

        {sent ? (
          <div style={{
            padding: '16px', background: 'var(--accent-dim)', border: '1px solid var(--accent-border)',
            borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--text-primary)',
            display: 'flex', gap: 10, alignItems: 'flex-start',
          }}>
            <CheckCircle size={18} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 1 }} />
            <span>
              If an account exists for <strong>{email}</strong>, we've sent a password reset link. It expires in 1 hour.
            </span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {error && (
              <div style={{
                padding: '12px 16px', background: 'var(--danger-dim)', border: '1px solid rgba(232,90,79,0.25)',
                borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--danger)',
              }}>
                {error}
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500, marginBottom: 6 }}>
                Email
              </label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)} required
                placeholder="you@brand.com" autoComplete="email" autoFocus
                style={{
                  width: '100%', padding: '11px 14px', background: 'var(--surface)',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                  color: 'var(--text-primary)', fontSize: 14, outline: 'none',
                  transition: 'border-color 0.15s ease', boxSizing: 'border-box',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--border2)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
            </div>

            <button
              type="submit" disabled={loading || !email}
              className="btn btn-primary"
              style={{ justifyContent: 'center', padding: '13px', fontSize: 14, marginTop: 4, opacity: loading ? 0.7 : 1 }}
            >
              {loading ? <Loader size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> : <>Send reset link <ArrowRight size={15} /></>}
            </button>
          </form>
        )}

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: 'var(--text-muted)' }}>
          <Link to="/login" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
