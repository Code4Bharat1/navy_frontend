'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, getUser } from '../../../lib/api';
import AppShell from '../../../components/AppShell';

// amount -> scanning -> success | error -> back to scanning (same amount) or amount
const STAGE = { AMOUNT: 'amount', SCANNING: 'scanning', SUCCESS: 'success', ERROR: 'error' };

export default function ShopPosPage() {
  const router = useRouter();
  const [stage, setStage] = useState(STAGE.AMOUNT);
  const [amount, setAmount] = useState('');
  const [scanValue, setScanValue] = useState('');
  const [result, setResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [recent, setRecent] = useState([]);
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

  function startScanning(e) {
    e.preventDefault();
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) return;
    setStage(STAGE.SCANNING);
  }

  async function submitScan(cardUid) {
    try {
      const data = await apiFetch('/purchase', {
        method: 'POST',
        body: { cardUid, amount: Number(amount) },
      });
      setResult(data);
      setStage(STAGE.SUCCESS);
      loadRecent();
      setTimeout(() => {
        setAmount('');
        setStage(STAGE.AMOUNT);
      }, 2200);
    } catch (err) {
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

  return (
    <AppShell title="Scan & Pay" subtitle="Enter an amount, then have the customer tap their card on the reader" narrow>
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

      {(stage === STAGE.SCANNING || stage === STAGE.SUCCESS || stage === STAGE.ERROR) && (
        <div className={`scan-stage ${stage === STAGE.SUCCESS ? 'state-success' : ''} ${stage === STAGE.ERROR ? 'state-error' : ''}`}>
          <div className="scan-ring">
            <span className="scan-icon">
              {stage === STAGE.SCANNING && '📡'}
              {stage === STAGE.SUCCESS && '✅'}
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
