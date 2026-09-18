'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, getUser } from '../../../lib/api';
import AppShell from '../../../components/AppShell';

const emptyShopForm = { name: '', location: '' };
const emptyOperatorForm = { name: '', email: '', password: '' };

export default function AdminShopsPage() {
  const router = useRouter();
  const [shops, setShops] = useState([]);
  const [shopForm, setShopForm] = useState(emptyShopForm);
  const [operatorForms, setOperatorForms] = useState({});
  const [openOperatorFor, setOpenOperatorFor] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [settlingShopId, setSettlingShopId] = useState(null);

  const loadShops = useCallback(async () => {
    try {
      const data = await apiFetch('/shops');
      setShops(data.shops);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    const user = getUser();
    if (!user) {
      router.replace('/login');
      return;
    }
    if (user.role !== 'super_admin') {
      router.replace('/dashboard');
      return;
    }
    loadShops();
  }, [router, loadShops]);

  async function handleCreateShop(e) {
    e.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    try {
      await apiFetch('/shops', { method: 'POST', body: shopForm });
      setShopForm(emptyShopForm);
      setNotice('Shop created.');
      await loadShops();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateOperator(e, shopId) {
    e.preventDefault();
    setError('');
    setNotice('');
    const form = operatorForms[shopId] || emptyOperatorForm;
    try {
      await apiFetch(`/shops/${shopId}/operators`, { method: 'POST', body: form });
      setOperatorForms((prev) => ({ ...prev, [shopId]: emptyOperatorForm }));
      setOpenOperatorFor(null);
      setNotice('Shop operator login created.');
      await loadShops();
    } catch (err) {
      setError(err.message);
    }
  }

  function updateOperatorForm(shopId, field, value) {
    setOperatorForms((prev) => ({
      ...prev,
      [shopId]: { ...(prev[shopId] || emptyOperatorForm), [field]: value },
    }));
  }

  async function handleSettleShop(shop) {
    if (!window.confirm(`Mark ${shop.name}'s account as settled? Only use this once you've actually paid them.`)) return;
    setSettlingShopId(shop._id);
    setError('');
    setNotice('');
    try {
      const data = await apiFetch(`/settlements/run/${shop._id}`, { method: 'POST' });
      if (data.result.skipped) {
        setNotice(`${shop.name}: ${data.result.reason}.`);
      } else {
        setNotice(`${shop.name} settled — ₹${data.result.netPaid.toFixed(2)} recorded as paid.`);
      }
      await loadShops();
    } catch (err) {
      setError(err.message);
    } finally {
      setSettlingShopId(null);
    }
  }

  return (
    <AppShell title="Shops" subtitle="Register camp shops and issue their operator logins">
      {error && <div className="banner banner-error">{error}</div>}
      {notice && <div className="banner banner-success">{notice}</div>}

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Registered shops</div>
          <div className="stat-value">{shops.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total receivable</div>
          <div className="stat-value stat-gold">
            ₹{shops.reduce((sum, s) => sum + (s.receivableBalance || 0), 0).toFixed(2)}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Register a new shop</div>
        <form onSubmit={handleCreateShop}>
          <label>Shop name</label>
          <input value={shopForm.name} onChange={(e) => setShopForm({ ...shopForm, name: e.target.value })} required />

          <label>Location</label>
          <input value={shopForm.location} onChange={(e) => setShopForm({ ...shopForm, location: e.target.value })} placeholder="e.g. Block C, Shop 4" />

          <button className="btn" type="submit" disabled={busy}>
            {busy ? 'Creating…' : 'Register shop'}
          </button>
        </form>
      </div>

      <div className="card-title" style={{ marginLeft: 4 }}>All shops</div>
      {shops.map((shop) => (
        <div className="card" key={shop._id}>
          <div className="flex-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{shop.name}</div>
              <div className="muted" style={{ fontSize: 13 }}>{shop.location || 'No location set'}</div>
            </div>
            <div className="flex-row" style={{ gap: 24 }}>
              <div style={{ textAlign: 'right' }}>
                <div className="muted" style={{ fontSize: 12 }}>Receivable (pending)</div>
                <div style={{ fontWeight: 700, color: shop.receivableBalance > 0 ? 'var(--gold)' : 'var(--navy)' }}>
                  ₹{shop.receivableBalance.toFixed(2)}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="muted" style={{ fontSize: 12 }}>Total earned</div>
                <div style={{ fontWeight: 700, color: 'var(--success)' }}>₹{shop.totalEarned.toFixed(2)}</div>
              </div>
            </div>
          </div>

          <div className="flex-row" style={{ marginTop: 14 }}>
            <span className="badge badge-muted">
              {shop.operatorCount} operator{shop.operatorCount === 1 ? '' : 's'}
            </span>
            <button
              className="btn btn-secondary"
              onClick={() => setOpenOperatorFor(openOperatorFor === shop._id ? null : shop._id)}
            >
              {openOperatorFor === shop._id ? 'Cancel' : '+ Add operator login'}
            </button>
            <button
              className="btn"
              disabled={settlingShopId === shop._id || shop.receivableBalance <= 0}
              onClick={() => handleSettleShop(shop)}
            >
              {settlingShopId === shop._id ? 'Settling…' : 'Account Settled'}
            </button>
          </div>

          {openOperatorFor === shop._id && (
            <form onSubmit={(e) => handleCreateOperator(e, shop._id)} style={{ marginTop: 16, maxWidth: 380 }}>
              <label>Operator name</label>
              <input
                value={operatorForms[shop._id]?.name || ''}
                onChange={(e) => updateOperatorForm(shop._id, 'name', e.target.value)}
                required
              />
              <label>Email (login)</label>
              <input
                type="email"
                value={operatorForms[shop._id]?.email || ''}
                onChange={(e) => updateOperatorForm(shop._id, 'email', e.target.value)}
                required
              />
              <label>Temporary password</label>
              <input
                type="text"
                value={operatorForms[shop._id]?.password || ''}
                onChange={(e) => updateOperatorForm(shop._id, 'password', e.target.value)}
                required
              />
              <button className="btn" type="submit">Create login</button>
            </form>
          )}
        </div>
      ))}
      {shops.length === 0 && <div className="card empty-state">No shops registered yet.</div>}
    </AppShell>
  );
}
