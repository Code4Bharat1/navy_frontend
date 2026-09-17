'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Captures an RFID card UID either by typing it or by an actual tap on the reader.
 * The reader behaves as a keyboard-wedge HID device — while scanning, a hidden input
 * stays focused and captures whatever it "types", submitting on the Enter it sends
 * after the tag ID. Falls back to plain typing when no reader is at hand.
 */
export default function ScanCardInput({ value, onChange, placeholder = 'e.g. 04A3B2C1' }) {
  const [scanning, setScanning] = useState(false);
  const [scanBuffer, setScanBuffer] = useState('');
  const scanRef = useRef(null);

  useEffect(() => {
    if (scanning && scanRef.current) {
      scanRef.current.focus();
    }
  }, [scanning]);

  function handleScanKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const uid = scanBuffer.trim();
      setScanBuffer('');
      if (uid) {
        onChange(uid);
        setScanning(false);
      }
    }
  }

  if (scanning) {
    return (
      <div className="scan-inline-wrap">
        <div className="scan-inline">
          <div className="scan-inline-pulse">📡</div>
          <div className="scan-inline-body">
            <div className="scan-inline-title">Waiting for card tap…</div>
            <div className="scan-inline-hint">Tap the card on the RFID reader now</div>
          </div>
          <button type="button" className="link-btn" onClick={() => setScanning(false)}>
            Type manually
          </button>
          <input
            ref={scanRef}
            className="scan-hidden-input"
            value={scanBuffer}
            onChange={(e) => setScanBuffer(e.target.value)}
            onKeyDown={handleScanKeyDown}
            onBlur={() => {
              if (scanning) setTimeout(() => scanRef.current?.focus(), 10);
            }}
            autoComplete="off"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="scan-inline-wrap">
      {value ? (
        <div className="scan-inline-captured">
          ✅ Card UID: {value}
          <button type="button" className="link-btn" style={{ color: 'var(--success)', marginLeft: 'auto' }} onClick={() => setScanning(true)}>
            Re-scan
          </button>
        </div>
      ) : (
        <div className="scan-inline-static">
          <input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
          <button type="button" className="btn btn-secondary" onClick={() => setScanning(true)}>
            📡 Scan card
          </button>
        </div>
      )}
    </div>
  );
}
