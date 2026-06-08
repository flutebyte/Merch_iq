import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight, Loader } from 'lucide-react';
import { authApi } from '../api/auth';
import { useAuth } from '../contexts/AuthContext';
import { useBrand } from '../contexts/BrandContext';

export default function Signup() {
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [brandName, setBrandName] = useState('');
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);

  const { login }    = useAuth();
  const { setBrand } = useBrand();
  const navigate     = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      const { token, user, brand } = await authApi.signup(email, password, brandName);
      login(token, user, brand);
      setBrand(brand);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.data?.error || 'Sign up failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '11px 14px', background: 'var(--surface)',
    border: '1px solid var(--border)', borderRadius: 'var(--radius)',
    color: 'var(--text-primary)', fontSize: 14, outline: 'none',
    transition: 'border-color 0.15s ease', boxSizing: 'border-box',
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: '24px',
      backgroundImage: 'radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.14) 0%, transparent 55%), radial-gradient(ellipse at 20% 100%, rgba(99,102,241,0.06) 0%, transparent 50%)',
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
            Get started
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Create your brand's inventory workspace</p>
        </div>

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
              Brand name
            </label>
            <input
              type="text" value={brandName} onChange={e => setBrandName(e.target.value)} required
              placeholder="e.g. Studio Priya" autoComplete="organization"
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = 'var(--border2)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500, marginBottom: 6 }}>
              Email
            </label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)} required
              placeholder="you@brand.com" autoComplete="email"
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = 'var(--border2)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500, marginBottom: 6 }}>
              Password <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(8+ characters)</span>
            </label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)} required
              placeholder="••••••••" autoComplete="new-password"
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = 'var(--border2)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
          </div>

          <button
            type="submit" disabled={loading || !email || !password || !brandName}
            className="btn btn-primary"
            style={{ justifyContent: 'center', padding: '13px', fontSize: 14, marginTop: 4, opacity: loading ? 0.7 : 1 }}
          >
            {loading ? <Loader size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> : <>Create workspace <ArrowRight size={15} /></>}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: 'var(--text-muted)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
