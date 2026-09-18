'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, checkHealth, setToken, setUser, roleHome } from '../../lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [health, setHealth] = useState(null);

  useEffect(() => {
    checkHealth().then(setHealth);
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await apiFetch('/auth/login', {
        method: 'POST',
        body: { email, password },
        auth: false,
      });
      setToken(data.token);
      setUser(data.user);
      router.push(roleHome(data.user.role));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-brand">
          <div className="brand-mark">⚓</div>
          <div>
            <h1 style={{ fontSize: 18 }}>Navy Cashless Card</h1>
            <p className="muted" style={{ fontSize: 13, margin: 0 }}>Sign in to your account</p>
          </div>
        </div>

        {health && health.status !== 'ok' && (
          <div className="banner banner-error">
            Cannot reach the server ({health.apiBaseUrl}). Please try again shortly or contact support.
          </div>
        )}

        {error && <div className="banner banner-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button className="btn btn-block btn-lg" type="submit" disabled={loading} style={{ marginTop: 6 }}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
