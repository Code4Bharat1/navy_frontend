'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, getUser } from '../../../lib/api';
import AppShell from '../../../components/AppShell';

export default function ShopDashboardPage() {
  const router = useRouter();
  const [shop, setShop] = useState(null);
  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const [shopData, summaryData, txData] = await Promise.all([
        apiFetch('/shops/me'),
        apiFetch('/shops/me/summary'),
        apiFetch('/shops/me/transactions'),
      ]);
      setShop(shopData.shop);
      setSummary(summaryData);
      setTransactions(txData.transactions);
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
    if (user.role !== 'shop_operator') {
      router.replace('/dashboard');
      return;
    }
    loadData();
  }, [router, loadData]);

  async function handleDispute(id) {
    const reason = window.prompt('What happened with this sale? (e.g. wrong amount charged, card tapped twice)');
    if (!reason) return;
    setBusyId(id);
    setError('');
    setNotice('');
    try {
      await apiFetch(`/transactions/${id}/dispute`, { method: 'POST', body: { reason } });
      setNotice('Disputed — this sale is held from settlement until the admin resolves it.');
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  const statusBadge = { completed: 'badge-success', disputed: 'badge-warning', refunded: 'badge-muted' };

  return (
    <AppShell title={shop ? shop.name : 'Shop Dashboard'} subtitle={shop?.location || 'Sales overview'}>
      {error && <div className="banner banner-error">{error}</div>}
      {notice && <div className="banner banner-success">{notice}</div>}

      {summary && (
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-label">Today&apos;s sales</div>
            <div className="stat-value">₹{summary.todayTotal.toFixed(2)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Today&apos;s transactions</div>
            <div className="stat-value stat-accent">{summary.todayCount}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Pending settlement</div>
            <div className="stat-value stat-gold">₹{summary.receivableBalance.toFixed(2)}</div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-title">All transactions</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Card holder</th>
                <th>Service No.</th>
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
                  <td>{t.staff?.serviceNumber || '—'}</td>
                  <td>₹{t.amount.toFixed(2)}</td>
                  <td>
                    <span className={`badge ${statusBadge[t.status] || 'badge-muted'}`}>{t.status}</span>
                  </td>
                  <td>
                    {t.type === 'purchase' && t.status === 'completed' && (
                      <button className="btn btn-secondary" disabled={busyId === t._id} onClick={() => handleDispute(t._id)}>
                        Dispute
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {transactions.length === 0 && <div className="empty-state">No transactions yet.</div>}
        </div>
      </div>
    </AppShell>
  );
}
