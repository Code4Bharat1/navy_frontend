'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, getUser } from '../../../lib/api';
import AppShell from '../../../components/AppShell';

export default function AdminOverviewPage() {
  const router = useRouter();
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    try {
      const overviewData = await apiFetch('/platform/overview');
      setOverview(overviewData);
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
    loadData();
  }, [router, loadData]);

  const ledger = overview?.ledger;

  return (
    <AppShell title="Platform Overview" subtitle="Today's activity and points ledger integrity">
      {error && <div className="banner banner-error">{error}</div>}

      {overview && (
        <>
          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-label">Today&apos;s platform sales</div>
              <div className="stat-value">₹{overview.todaySales.toFixed(2)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Today&apos;s transactions</div>
              <div className="stat-value stat-accent">{overview.todayTransactionCount}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Active shops</div>
              <div className="stat-value">{overview.shopCount}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Open disputes</div>
              <div className="stat-value" style={{ color: overview.disputedCount > 0 ? 'var(--danger)' : 'var(--success)' }}>
                {overview.disputedCount}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-title">Points ledger integrity</div>
            <div className="stat-grid" style={{ marginBottom: 0 }}>
              <div className="stat-card">
                <div className="stat-label">Total recharged (money in)</div>
                <div className="stat-value">₹{ledger.totalRecharged.toFixed(2)}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">In staff wallets</div>
                <div className="stat-value">₹{ledger.totalWalletBalances.toFixed(2)}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Owed to shops (unsettled)</div>
                <div className="stat-value stat-gold">₹{ledger.totalReceivables.toFixed(2)}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Paid out to shops</div>
                <div className="stat-value">₹{ledger.totalPaidOut.toFixed(2)}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Commission earned</div>
                <div className="stat-value">₹{ledger.totalCommission.toFixed(2)}</div>
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              {ledger.healthy ? (
                <span className="badge badge-success">✅ Ledger balanced — every rupee accounted for</span>
              ) : (
                <span className="badge badge-danger">
                  ⚠️ Discrepancy of ₹{ledger.discrepancy.toFixed(2)} — investigate before settling further
                </span>
              )}
            </div>
          </div>

          <p className="muted" style={{ fontSize: 13 }}>
            To settle a shop&apos;s account, go to <strong>Shops</strong> and click &ldquo;Account Settled&rdquo;
            on that shop.
          </p>
        </>
      )}
    </AppShell>
  );
}
