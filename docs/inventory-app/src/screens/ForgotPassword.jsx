import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Loader, CheckCircle2 } from 'lucide-react';
import { authApi } from '../api/auth';

export default function ForgotPassword() {
  const [email, setEmail]     = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);
  const [devResetUrl, setDevResetUrl] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authApi.forgotPassword(email);
      setSent(true);
      setDevResetUrl(res?.devResetUrl || null);
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
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 36, lineHeight: 1.1, marginBottom: 8 }}>
            Reset your password
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            Enter the email on your account and we'll send you a reset link.
          </p>
        </div>

        {sent ? (
          <div style={{
            padding: '16px', background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--text-primary)',
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <CheckCircle2 size={16} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 1 }} />
              <span>If an account exists for <strong>{email}</strong>, a password reset link has been sent. Check your inbox (and spam folder).</span>
            </div>
            {devResetUrl && (
              <div style={{ paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                  Dev mode — email sending isn't configured yet, so here's your link:
                </p>
                <a href={devResetUrl} style={{ fontSize: 12, color: 'var(--accent)', wordBreak: 'break-all' }}>
                  {devResetUrl}
                </a>
              </div>
            )}
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
