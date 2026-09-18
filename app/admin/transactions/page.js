'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, getUser } from '../../../lib/api';
import AppShell from '../../../components/AppShell';

const STATUS_FILTERS = [
  { value: '', label: 'All statuses' },
  { value: 'completed', label: 'Completed' },
  { value: 'disputed', label: 'Disputed' },
  { value: 'refunded', label: 'Refunded' },
];

export default function AdminTransactionsPage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState([]);
  const [cardUidFilter, setCardUidFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState(null);

  const loadTransactions = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (cardUidFilter) params.set('staffCardUid', cardUidFilter);
      if (statusFilter) params.set('status', statusFilter);
      const query = params.toString();
      const data = await apiFetch(`/transactions${query ? `?${query}` : ''}`);
      setTransactions(data.transactions);
    } catch (err) {
      setError(err.message);
    }
  }, [cardUidFilter, statusFilter]);

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
    loadTransactions();
  }, [router, loadTransactions]);

  async function handleDispute(id) {
    const reason = window.prompt('Reason for disputing this transaction:');
    if (!reason) return;
    setBusyId(id);
    setError('');
    setNotice('');
    try {
      await apiFetch(`/transactions/${id}/dispute`, { method: 'POST', body: { reason } });
      setNotice('Transaction disputed and held from settlement.');
      await loadTransactions();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleRefund(id) {
    if (!window.confirm('Refund this transaction? The customer wallet will be credited back and the shop receivable reversed.')) return;
    setBusyId(id);
    setError('');
    setNotice('');
    try {
      await apiFetch(`/transactions/${id}/refund`, { method: 'POST' });
      setNotice('Transaction refunded.');
      await loadTransactions();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleClear(id) {
    setBusyId(id);
    setError('');
    setNotice('');
    try {
      await apiFetch(`/transactions/${id}/clear`, { method: 'POST' });
      setNotice('Dispute cleared — transaction re-enters the settlement pool.');
      await loadTransactions();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AppShell title="Transactions" subtitle="Search purchases across every shop, and resolve disputes">
      {error && <div className="banner banner-error">{error}</div>}
      {notice && <div className="banner banner-success">{notice}</div>}

      <div className="card">
        <div className="flex-row">
          <div style={{ flex: 1, minWidth: 200 }}>
            <label>Filter by card UID</label>
            <input
              value={cardUidFilter}
              onChange={(e) => setCardUidFilter(e.target.value)}
              placeholder="e.g. 04A3B2C1"
            />
          </div>
          <div style={{ minWidth: 180 }}>
            <label>Status</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              {STATUS_FILTERS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <button className="btn btn-secondary" style={{ marginBottom: 16 }} onClick={loadTransactions}>
            Search
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Transactions ({transactions.length})</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Card holder</th>
                <th>Shop</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t._id}>
                  <td>{new Date(t.createdAt).toLocaleString()}</td>
                  <td>{t.staff?.name || '—'}</td>
                  <td>{t.shop?.name || '—'}</td>
                  <td style={{ textTransform: 'capitalize' }}>{t.type}</td>
                  <td>₹{t.amount.toFixed(2)}</td>
                  <td>
                    <span
                      className={`badge ${
                        t.status === 'completed' ? 'badge-success' : t.status === 'disputed' ? 'badge-warning' : 'badge-muted'
                      }`}
                    >
                      {t.status}
                    </span>
                  </td>
                  <td>
                    <div className="flex-row">
                      {t.type === 'purchase' && t.status === 'completed' && (
                        <button className="btn btn-secondary" disabled={busyId === t._id} onClick={() => handleDispute(t._id)}>
                          Dispute
                        </button>
                      )}
                      {t.type === 'purchase' && (t.status === 'completed' || t.status === 'disputed') && (
                        <button className="btn btn-secondary" disabled={busyId === t._id} onClick={() => handleRefund(t._id)}>
                          Refund
                        </button>
                      )}
                      {t.status === 'disputed' && (
                        <button className="btn" disabled={busyId === t._id} onClick={() => handleClear(t._id)}>
                          Clear dispute
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {transactions.length === 0 && <div className="empty-state">No transactions found.</div>}
        </div>
      </div>
    </AppShell>
  );
}
