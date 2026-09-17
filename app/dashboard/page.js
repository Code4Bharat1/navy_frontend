'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import { apiFetch, getUser } from '../../lib/api';
import AppShell from '../../components/AppShell';

export default function DashboardPage() {
  const router = useRouter();
  const [wallet, setWallet] = useState(null);
  const [recharges, setRecharges] = useState([]);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [checkoutReady, setCheckoutReady] = useState(false);

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
  }, [router, loadData]);

  async function startRecharge() {
    setError('');
    setNotice('');
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      setError('Enter a valid amount');
      return;
    }
    if (!checkoutReady || typeof window === 'undefined' || !window.Razorpay) {
      setError('Payment gateway is still loading, try again in a moment');
      return;
    }

    setBusy(true);
    let session;
    try {
      session = await apiFetch('/recharge/initiate', {
        method: 'POST',
        body: { amount: numericAmount },
      });
    } catch (err) {
      setError(err.message);
      setBusy(false);
      return;
    }
    setBusy(false);

    const user = getUser();
    const checkout = new window.Razorpay({
      key: session.keyId,
      order_id: session.orderId,
      amount: session.amount,
      currency: session.currency,
      name: 'Navy Cashless Card',
      description: 'Wallet recharge',
      theme: { color: '#3b5bdb' },
      prefill: { name: user?.name, email: user?.email },
      handler: async (response) => {
        try {
          await apiFetch('/recharge/verify', {
            method: 'POST',
            body: {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            },
          });
          setNotice('Recharge successful. Your wallet has been credited.');
          setAmount('');
          await loadData();
        } catch (err) {
          setError(err.message || 'Payment succeeded but could not be verified — contact the admin.');
        }
      },
      modal: {
        ondismiss: () => setError('Payment cancelled'),
      },
    });

    checkout.on('payment.failed', (response) => {
      setError(response.error?.description || 'Payment failed');
    });

    checkout.open();
  }

  return (
    <AppShell title="My Wallet" subtitle="Recharge your card and track your spending" narrow>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" onLoad={() => setCheckoutReady(true)} />

      {error && <div className="banner banner-error">{error}</div>}
      {notice && <div className="banner banner-success">{notice}</div>}

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
            <div className="card-title">Recharge my card</div>
            <label htmlFor="amount">Amount (₹)</label>
            <input
              id="amount"
              type="number"
              min="1"
              placeholder="e.g. 500"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <button className="btn btn-block" onClick={startRecharge} disabled={busy}>
              {busy ? 'Starting…' : 'Recharge with Razorpay'}
            </button>
          </div>

          <div className="card">
            <div className="card-title">Recharge history</div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>Status</th>
                    <th>Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {recharges.map((r) => (
                    <tr key={r._id}>
                      <td>{new Date(r.createdAt).toLocaleString()}</td>
                      <td>₹{r.amount.toFixed(2)}</td>
                      <td style={{ textTransform: 'capitalize' }}>{r.method}</td>
                      <td className={`status-${r.status}`}>{r.status}</td>
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
