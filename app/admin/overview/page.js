'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, getUser } from '../../../lib/api';
import AppShell from '../../../components/AppShell';

export default function AdminOverviewPage() {
  const router = useRouter();
  const [overview, setOverview] = useState(null);
  const [config, setConfig] = useState(null);
  const [commissionInput, setCommissionInput] = useState('');
  const [disputeWindowInput, setDisputeWindowInput] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);
  const [runningSettlement, setRunningSettlement] = useState(false);
  const [settlementResults, setSettlementResults] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const [overviewData, configData] = await Promise.all([
        apiFetch('/platform/overview'),
        apiFetch('/platform/config'),
      ]);
      setOverview(overviewData);
      setConfig(configData.config);
      setCommissionInput(String(configData.config.commissionPercent));
      setDisputeWindowInput(String(configData.config.disputeWindowHours));
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

  async function saveConfig(e) {
    e.preventDefault();
    setError('');
    setNotice('');
    setSavingConfig(true);
    try {
      const data = await apiFetch('/platform/config', {
        method: 'PUT',
        body: { commissionPercent: Number(commissionInput), disputeWindowHours: Number(disputeWindowInput) },
      });
      setConfig(data.config);
      setNotice('Platform settings updated.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingConfig(false);
    }
  }

  async function runSettlement() {
    setError('');
    setNotice('');
    setRunningSettlement(true);
    setSettlementResults(null);
    try {
      const data = await apiFetch('/settlements/run', { method: 'POST' });
      setSettlementResults(data.results);
      const paid = data.results.filter((r) => r.status === 'paid').length;
      setNotice(`Settlement recorded — ${paid} shop${paid === 1 ? '' : 's'} settled.`);
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setRunningSettlement(false);
    }
  }

  const ledger = overview?.ledger;

  return (
    <AppShell title="Platform Overview" subtitle="Pooled float, ledger integrity, and settlement controls">
      {error && <div className="banner banner-error">{error}</div>}
      {notice && <div className="banner banner-success">{notice}</div>}

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

          <div className="card">
            <div className="card-title">Settlement engine</div>
            <p className="muted" style={{ fontSize: 13, marginTop: -8, marginBottom: 16 }}>
              There&apos;s no payment gateway or automated payout here — this records that you&apos;ve
              paid each shop offline (cash, bank transfer, however) and clears their receivable balance.
              Transactions inside the dispute window are held back automatically.
            </p>
            <button className="btn" onClick={runSettlement} disabled={runningSettlement}>
              {runningSettlement ? 'Recording…' : 'Record settlement now'}
            </button>

            {settlementResults && (
              <div className="table-wrap" style={{ marginTop: 16 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Shop</th>
                      <th>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {settlementResults.map((r, i) => (
                      <tr key={i}>
                        <td>{r.shopName}</td>
                        <td>
                          {r.skipped ? (
                            <span className="badge badge-muted">{r.reason}</span>
                          ) : (
                            <span className="badge badge-success">Settled ₹{r.netPaid.toFixed(2)}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card content-narrow" style={{ padding: 22 }}>
            <div className="card-title">Platform settings</div>
            <form onSubmit={saveConfig}>
              <label>Commission (%) taken from each settlement</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={commissionInput}
                onChange={(e) => setCommissionInput(e.target.value)}
              />

              <label>Dispute window (hours)</label>
              <input
                type="number"
                min="0"
                value={disputeWindowInput}
                onChange={(e) => setDisputeWindowInput(e.target.value)}
              />

              <button className="btn" type="submit" disabled={savingConfig}>
                {savingConfig ? 'Saving…' : 'Save settings'}
              </button>
            </form>
          </div>
        </>
      )}
    </AppShell>
  );
}
