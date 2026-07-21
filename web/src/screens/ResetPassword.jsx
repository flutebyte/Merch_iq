import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ArrowRight, Loader, CheckCircle } from 'lucide-react';
import { authApi } from '../api/auth';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword]               = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone]       = useState(false);
  const navigate = useNavigate();

  const inputStyle = {
    width: '100%', padding: '11px 14px', background: 'var(--surface)',
    border: '1px solid var(--border)', borderRadius: 'var(--radius)',
    color: 'var(--text-primary)', fontSize: 14, outline: 'none',
    transition: 'border-color 0.15s ease', boxSizing: 'border-box',
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    setLoading(true);
    try {
      await authApi.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(err.data?.error || 'Could not reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const wrapperStyle = {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'var(--bg)', padding: '24px',
    backgroundImage: 'radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.14) 0%, transparent 55%), radial-gradient(ellipse at 20% 100%, rgba(99,102,241,0.06) 0%, transparent 50%)',
  };

  if (!token) {
    return (
      <div style={wrapperStyle}>
        <div style={{ width: '100%', maxWidth: 400, textAlign: 'center', animation: 'fadeIn 0.4s ease' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, marginBottom: 12 }}>Invalid reset link</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>
            This link is missing its reset token. Request a new one below.
          </p>
          <Link to="/forgot-password" className="btn btn-primary" style={{ justifyContent: 'center', padding: '13px', fontSize: 14 }}>
            Request a new link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={wrapperStyle}>
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
            Set a new password
          </h1>
        </div>

        {done ? (
          <>
            <div style={{
              padding: '16px', background: 'var(--accent-dim)', border: '1px solid var(--accent-border)',
              borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--text-primary)',
              display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 20,
            }}>
              <CheckCircle size={18} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 1 }} />
              <span>Your password has been reset.</span>
            </div>
            <button
              onClick={() => navigate('/login', { replace: true })}
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '13px', fontSize: 14 }}
            >
              Sign in <ArrowRight size={15} />
            </button>
          </>
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
                New password <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(8+ characters)</span>
              </label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)} required
                placeholder="••••••••" autoComplete="new-password" autoFocus
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = 'var(--border2)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500, marginBottom: 6 }}>
                Confirm new password
              </label>
              <input
                type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required
                placeholder="••••••••" autoComplete="new-password"
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = 'var(--border2)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
            </div>

            <button
              type="submit" disabled={loading || !password || !confirmPassword}
              className="btn btn-primary"
              style={{ justifyContent: 'center', padding: '13px', fontSize: 14, marginTop: 4, opacity: loading ? 0.7 : 1 }}
            >
              {loading ? <Loader size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> : <>Reset password <ArrowRight size={15} /></>}
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
