'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, getUser } from '../../../lib/api';
import AppShell from '../../../components/AppShell';
import { enqueuePurchase, syncQueue, getQueue, getQueueErrors, dismissQueueError, makeIdempotencyKey } from '../../../lib/offlineQueue';

// amount -> scanning -> success | queued | error -> back to scanning (same amount) or amount
const STAGE = { AMOUNT: 'amount', SCANNING: 'scanning', SUCCESS: 'success', QUEUED: 'queued', ERROR: 'error' };

export default function ShopPosPage() {
  const router = useRouter();
  const [stage, setStage] = useState(STAGE.AMOUNT);
  const [amount, setAmount] = useState('');
  const [scanValue, setScanValue] = useState('');
  const [result, setResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [recent, setRecent] = useState([]);
  const [queueCount, setQueueCount] = useState(0);
  const [queueErrors, setQueueErrors] = useState([]);
  const scanInputRef = useRef(null);

  useEffect(() => {
    const user = getUser();
    if (!user) {
      router.replace('/login');
      return;
    }
    if (user.role !== 'shop_operator') {
      router.replace('/dashboard');
    }
  }, [router]);

  useEffect(() => {
    if (stage === STAGE.SCANNING && scanInputRef.current) {
      scanInputRef.current.focus();
    }
  }, [stage]);

  const loadRecent = useCallback(async () => {
    try {
      const data = await apiFetch('/shops/me/transactions');
      setRecent(data.transactions.slice(0, 6));
    } catch {
      // non-critical for this screen
    }
  }, []);

  useEffect(() => {
    loadRecent();
  }, [loadRecent]);

  // Retry anything queued while offline: on mount, whenever the browser comes back
  // online, and as a periodic fallback in case the 'online' event doesn't fire reliably.
  useEffect(() => {
    let cancelled = false;

    async function trySync() {
      const outcome = await syncQueue(apiFetch);
      if (cancelled) return;
      setQueueCount(getQueue().length);
      setQueueErrors(getQueueErrors());
      if (outcome.synced > 0) loadRecent();
    }

    trySync();
    setQueueCount(getQueue().length);
    setQueueErrors(getQueueErrors());

    window.addEventListener('online', trySync);
    const interval = setInterval(trySync, 30000);
    return () => {
      cancelled = true;
      window.removeEventListener('online', trySync);
      clearInterval(interval);
    };
  }, [loadRecent]);

  function startScanning(e) {
    e.preventDefault();
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) return;
    setStage(STAGE.SCANNING);
  }

  function resetSoon() {
    setTimeout(() => {
      setAmount('');
      setStage(STAGE.AMOUNT);
    }, 2200);
  }

  async function submitScan(cardUid) {
    const payload = { cardUid, amount: Number(amount), idempotencyKey: makeIdempotencyKey() };
    try {
      const data = await apiFetch('/purchase', { method: 'POST', body: payload });
      setResult(data);
      setStage(STAGE.SUCCESS);
      loadRecent();
      resetSoon();
    } catch (err) {
      if (err.isNetworkError) {
        enqueuePurchase({ ...payload, queuedAt: new Date().toISOString() });
        setQueueCount(getQueue().length);
        setStage(STAGE.QUEUED);
        resetSoon();
        return;
      }
      setErrorMessage(err.message);
      setStage(STAGE.ERROR);
      setTimeout(() => setStage(STAGE.SCANNING), 2200);
    }
  }

  function handleScanKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const uid = scanValue.trim();
      setScanValue('');
      if (uid) submitScan(uid);
    }
  }

  function cancelScanning() {
    setStage(STAGE.AMOUNT);
    setScanValue('');
  }

  function handleDismissError(key) {
    dismissQueueError(key);
    setQueueErrors(getQueueErrors());
  }

  return (
    <AppShell title="Scan & Pay" subtitle="Enter an amount, then have the customer tap their card on the reader" narrow>
      {queueCount > 0 && (
        <div className="banner" style={{ background: 'var(--warning-bg)', color: 'var(--warning)', border: '1px solid #fcd9a8' }}>
          📥 {queueCount} sale{queueCount === 1 ? '' : 's'} queued offline — will sync automatically once back online.
        </div>
      )}

      {queueErrors.length > 0 && (
        <div className="banner banner-error" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
          <div>⚠️ {queueErrors.length} queued sale{queueErrors.length === 1 ? '' : 's'} could not be completed:</div>
          {queueErrors.map((e) => (
            <div key={e.idempotencyKey} className="flex-row" style={{ justifyContent: 'space-between', fontWeight: 400, fontSize: 13 }}>
              <span>Card {e.cardUid} · ₹{Number(e.amount).toFixed(2)} — {e.error}</span>
              <button className="link-btn" style={{ color: 'var(--danger)' }} onClick={() => handleDismissError(e.idempotencyKey)}>
                Dismiss
              </button>
            </div>
          ))}
        </div>
      )}

      {stage === STAGE.AMOUNT && (
        <div className="card">
          <div className="card-title">New sale</div>
          <form onSubmit={startScanning}>
            <label htmlFor="amount">Amount to charge (₹)</label>
            <input
              id="amount"
              type="number"
              min="1"
              autoFocus
              placeholder="e.g. 150"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <button className="btn btn-block btn-lg" type="submit" disabled={!Number(amount) || Number(amount) <= 0}>
              Ready to scan →
            </button>
          </form>
        </div>
      )}

      {(stage === STAGE.SCANNING || stage === STAGE.SUCCESS || stage === STAGE.QUEUED || stage === STAGE.ERROR) && (
        <div
          className={`scan-stage ${stage === STAGE.SUCCESS || stage === STAGE.QUEUED ? 'state-success' : ''} ${
            stage === STAGE.ERROR ? 'state-error' : ''
          }`}
        >
          <div className="scan-ring">
            <span className="scan-icon">
              {stage === STAGE.SCANNING && '📡'}
              {stage === STAGE.SUCCESS && '✅'}
              {stage === STAGE.QUEUED && '📥'}
              {stage === STAGE.ERROR && '⚠️'}
            </span>
          </div>

          {stage === STAGE.SCANNING && (
            <>
              <div className="scan-title">Tap card on the reader</div>
              <div className="scan-amount">₹{Number(amount).toFixed(2)}</div>
              <div className="scan-hint">Waiting for RFID scan…</div>
            </>
          )}

          {stage === STAGE.SUCCESS && result && (
            <>
              <div className="scan-title">Payment received</div>
              <div className="scan-amount">₹{Number(amount).toFixed(2)}</div>
              <div className="scan-hint">from {result.staffName}</div>
            </>
          )}

          {stage === STAGE.QUEUED && (
            <>
              <div className="scan-title">Saved — offline</div>
              <div className="scan-amount">₹{Number(amount).toFixed(2)}</div>
              <div className="scan-hint">No connection right now. This sale will sync automatically once you&apos;re back online.</div>
            </>
          )}

          {stage === STAGE.ERROR && (
            <>
              <div className="scan-title">Payment failed</div>
              <div className="scan-hint" style={{ marginTop: 6 }}>{errorMessage}</div>
            </>
          )}

          <input
            ref={scanInputRef}
            className="scan-hidden-input"
            value={scanValue}
            onChange={(e) => setScanValue(e.target.value)}
            onKeyDown={handleScanKeyDown}
            onBlur={() => {
              if (stage === STAGE.SCANNING) {
                setTimeout(() => scanInputRef.current?.focus(), 10);
              }
            }}
            autoComplete="off"
          />

          {stage === STAGE.SCANNING && (
            <button className="btn btn-ghost" style={{ marginTop: 22, color: '#c4cdec', borderColor: 'rgba(255,255,255,0.25)' }} onClick={cancelScanning}>
              Cancel
            </button>
          )}
        </div>
      )}

      <div className="card" style={{ marginTop: 22 }}>
        <div className="card-title">Recent sales</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Card holder</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((t) => (
                <tr key={t._id}>
                  <td>{new Date(t.createdAt).toLocaleTimeString()}</td>
                  <td>{t.staff?.name || '—'}</td>
                  <td>₹{t.amount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {recent.length === 0 && <div className="empty-state">No sales yet.</div>}
        </div>
      </div>
    </AppShell>
  );
}
