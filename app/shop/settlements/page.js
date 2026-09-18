'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, getUser } from '../../../lib/api';
import AppShell from '../../../components/AppShell';

export default function ShopSettlementsPage() {
  const router = useRouter();
  const [settlements, setSettlements] = useState([]);
  const [error, setError] = useState('');

  const loadSettlements = useCallback(async () => {
    try {
      const data = await apiFetch('/settlements/me');
      setSettlements(data.settlements);
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
    loadSettlements();
  }, [router, loadSettlements]);

  const totalPaid = settlements.filter((s) => s.status === 'paid').reduce((sum, s) => sum + s.netPaid, 0);

  return (
    <AppShell title="Settlements" subtitle="Reconciliation history — what's been paid to your bank account">
      {error && <div className="banner banner-error">{error}</div>}

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Total paid out</div>
          <div className="stat-value">₹{totalPaid.toFixed(2)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Settlement cycles</div>
          <div className="stat-value stat-accent">{settlements.length}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Cycle history</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Cycle</th>
                <th>Transactions</th>
                <th>Gross</th>
                <th>Commission</th>
                <th>Net paid</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {settlements.map((s) => (
                <tr key={s._id}>
                  <td>
                    {new Date(s.cycleStart).toLocaleDateString()} – {new Date(s.cycleEnd).toLocaleDateString()}
                  </td>
                  <td>{s.transactionCount}</td>
                  <td>₹{s.grossAmount.toFixed(2)}</td>
                  <td>₹{s.commission.toFixed(2)}</td>
                  <td style={{ fontWeight: 700 }}>₹{s.netPaid.toFixed(2)}</td>
                  <td style={{ maxWidth: 260 }}>
                    <span className={`badge ${s.status === 'paid' ? 'badge-success' : s.status === 'failed' ? 'badge-danger' : 'badge-muted'}`}>
                      {s.status}
                    </span>
                    {s.status === 'failed' && s.failureReason && (
                      <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{s.failureReason}</div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {settlements.length === 0 && <div className="empty-state">No settlements yet — they run automatically, or the admin can trigger one manually.</div>}
        </div>
      </div>
    </AppShell>
  );
}
