'use client';

import { Fragment, useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, getUser } from '../../../lib/api';
import AppShell from '../../../components/AppShell';
import ScanCardInput from '../../../components/ScanCardInput';

const emptyForm = { name: '', email: '', password: '', serviceNumber: '', cardUid: '' };

export default function AdminStaffPage() {
  const router = useRouter();
  const [staff, setStaff] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [cashAmounts, setCashAmounts] = useState({});
  const [replaceCardTarget, setReplaceCardTarget] = useState(null);
  const [newCardUid, setNewCardUid] = useState('');

  const loadStaff = useCallback(async () => {
    try {
      const data = await apiFetch('/staff');
      setStaff(data.staff);
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
    loadStaff();
  }, [router, loadStaff]);

  const stats = useMemo(() => {
    const activeCount = staff.filter((s) => s.cardStatus === 'active').length;
    const totalFloat = staff.reduce((sum, s) => sum + (s.walletBalance || 0), 0);
    return { total: staff.length, activeCount, totalFloat };
  }, [staff]);

  async function handleEnroll(e) {
    e.preventDefault();
    setError('');
    setNotice('');
    if (!form.cardUid) {
      setError('Scan or enter the RFID card UID before enrolling');
      return;
    }
    setBusy(true);
    try {
      await apiFetch('/staff', { method: 'POST', body: form });
      setForm(emptyForm);
      setNotice('Staff enrolled with a zero-balance wallet.');
      await loadStaff();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleCardAction(staffId, action) {
    setError('');
    setNotice('');
    try {
      if (action === 'deactivate') await apiFetch(`/staff/${staffId}/deactivate`, { method: 'PATCH' });
      if (action === 'reactivate') await apiFetch(`/staff/${staffId}/reactivate`, { method: 'PATCH' });
      if (action === 'report-lost') await apiFetch(`/staff/${staffId}/report-lost`, { method: 'PATCH' });
      await loadStaff();
    } catch (err) {
      setError(err.message);
    }
  }

  function openReplaceCard(staffId) {
    setReplaceCardTarget(replaceCardTarget === staffId ? null : staffId);
    setNewCardUid('');
    setError('');
  }

  async function submitReplaceCard(staffId) {
    if (!newCardUid) {
      setError('Scan or enter the new RFID card UID first');
      return;
    }
    setError('');
    try {
      await apiFetch(`/staff/${staffId}/replace-card`, { method: 'POST', body: { newCardUid } });
      setNotice('Card replaced. Wallet balance carried over.');
      setReplaceCardTarget(null);
      setNewCardUid('');
      await loadStaff();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCashRecharge(staffId) {
    const amount = Number(cashAmounts[staffId]);
    if (!amount || amount <= 0) {
      setError('Enter a valid cash amount first');
      return;
    }
    const receiptNumber = window.prompt('Enter the cash receipt number:');
    if (!receiptNumber) return;

    setError('');
    setNotice('');
    try {
      await apiFetch('/recharge/cash', { method: 'POST', body: { staffId, amount, receiptNumber } });
      setNotice('Cash recharge recorded.');
      setCashAmounts((prev) => ({ ...prev, [staffId]: '' }));
      await loadStaff();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <AppShell title="Staff & Card Management" subtitle="Enroll staff, issue cards, and manage the card lifecycle">
      {error && <div className="banner banner-error">{error}</div>}
      {notice && <div className="banner banner-success">{notice}</div>}

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Total staff</div>
          <div className="stat-value">{stats.total}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active cards</div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>{stats.activeCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total wallet float</div>
          <div className="stat-value stat-gold">₹{stats.totalFloat.toFixed(2)}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Enroll new staff</div>
        <form onSubmit={handleEnroll}>
          <label>Full name</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />

          <label>Email (login)</label>
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />

          <label>Temporary password</label>
          <input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />

          <label>Service number</label>
          <input value={form.serviceNumber} onChange={(e) => setForm({ ...form, serviceNumber: e.target.value })} required />

          <label>RFID card UID</label>
          <ScanCardInput value={form.cardUid} onChange={(cardUid) => setForm({ ...form, cardUid })} />

          <button className="btn" type="submit" disabled={busy}>
            {busy ? 'Enrolling…' : 'Enroll staff'}
          </button>
        </form>
      </div>

      <div className="card">
        <div className="card-title">All staff ({staff.length})</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Service No.</th>
                <th>Card UID</th>
                <th>Balance</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <Fragment key={s._id}>
                  <tr>
                    <td>{s.name}</td>
                    <td>{s.serviceNumber}</td>
                    <td>{s.cardUid}</td>
                    <td>₹{s.walletBalance.toFixed(2)}</td>
                    <td>
                      <span className={`badge ${s.cardStatus === 'active' ? 'badge-success' : 'badge-danger'}`}>
                        {s.cardStatus}
                      </span>
                    </td>
                    <td>
                      <div className="flex-row">
                        {s.cardStatus === 'active' ? (
                          <button className="btn btn-secondary" onClick={() => handleCardAction(s._id, 'deactivate')}>
                            Deactivate
                          </button>
                        ) : (
                          <button className="btn btn-secondary" onClick={() => handleCardAction(s._id, 'reactivate')}>
                            Reactivate
                          </button>
                        )}
                        <button className="btn btn-secondary" onClick={() => handleCardAction(s._id, 'report-lost')}>
                          Report lost
                        </button>
                        <button className="btn btn-secondary" onClick={() => openReplaceCard(s._id)}>
                          {replaceCardTarget === s._id ? 'Cancel' : 'Replace card'}
                        </button>
                        <input
                          type="number"
                          placeholder="₹ cash"
                          style={{ width: 90, margin: 0 }}
                          value={cashAmounts[s._id] || ''}
                          onChange={(e) => setCashAmounts((prev) => ({ ...prev, [s._id]: e.target.value }))}
                        />
                        <button className="btn" onClick={() => handleCashRecharge(s._id)}>
                          Cash recharge
                        </button>
                      </div>
                    </td>
                  </tr>
                  {replaceCardTarget === s._id && (
                    <tr>
                      <td colSpan="6" style={{ background: 'var(--surface-alt)' }}>
                        <div style={{ maxWidth: 420, padding: '6px 0' }}>
                          <label>New RFID card UID for {s.name}</label>
                          <ScanCardInput value={newCardUid} onChange={setNewCardUid} />
                          <button className="btn" onClick={() => submitReplaceCard(s._id)}>
                            Confirm replacement
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
          {staff.length === 0 && <div className="empty-state">No staff enrolled yet.</div>}
        </div>
      </div>
    </AppShell>
  );
}
