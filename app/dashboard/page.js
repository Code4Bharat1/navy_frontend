'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, getUser } from '../../lib/api';
import AppShell from '../../components/AppShell';

export default function DashboardPage() {
  const router = useRouter();
  const [wallet, setWallet] = useState(null);
  const [recharges, setRecharges] = useState([]);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [walletData, historyData] = await Promise.all([
        apiFetch('/wallet/me'),
        apiFetch('/wallet/me/recharges'),
      ]);
      setWallet(walletData);
      setRecharges(historyData.recharges);
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
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AppShell title="My Wallet" subtitle="Track your card balance and recharge history" narrow>
      {error && <div className="banner banner-error">{error}</div>}

      {!wallet ? (
        <div className="card">Loading…</div>
      ) : (
        <>
          <div className="balance-hero">
            <div className="balance-hero-label">Wallet balance</div>
            <div className="balance-hero-amount">₹{wallet.walletBalance.toFixed(2)}</div>
            <div className="balance-hero-foot">
              <span className={`badge ${wallet.cardStatus === 'active' ? 'badge-success' : 'badge-danger'}`}>
                {wallet.cardStatus === 'active' ? '● Card active' : `● Card ${wallet.cardStatus}`}
              </span>
            </div>
          </div>

          <div className="card">
            <div className="card-title">Need a recharge?</div>
            <p className="muted" style={{ fontSize: 14, margin: 0 }}>
              Hand cash to the recharge counter or your unit admin — they&apos;ll credit it to your card
              directly. There&apos;s no online recharge step in this system.
            </p>
          </div>

          <div className="card">
            <div className="card-title">Recharge history</div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Receipt No.</th>
                  </tr>
                </thead>
                <tbody>
                  {recharges.map((r) => (
                    <tr key={r._id}>
                      <td>{new Date(r.createdAt).toLocaleString()}</td>
                      <td>₹{r.amount.toFixed(2)}</td>
                      <td>{r.paymentRef || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {recharges.length === 0 && <div className="empty-state">No recharges yet.</div>}
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
