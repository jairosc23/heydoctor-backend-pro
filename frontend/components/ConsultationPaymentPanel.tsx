'use client';

import { useState } from 'react';
import { createPaymentSession } from '../lib/api-payments';
import { trackConsultationPaid } from '../lib/analytics';

export type ConsultationPaymentPanelProps = {
  backendOrigin: string;
  consultationId: string;
  defaultAmount?: number;
  defaultCurrency?: string;
};

export function ConsultationPaymentPanel({
  backendOrigin,
  consultationId,
  defaultAmount = 35_000,
  defaultCurrency = 'CLP',
}: ConsultationPaymentPanelProps) {
  const [amount, setAmount] = useState(defaultAmount);
  const [currency, setCurrency] = useState(defaultCurrency);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function pay() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await createPaymentSession(backendOrigin, {
        consultationId,
        amount,
        currency,
      });
      void trackConsultationPaid(consultationId, {
        amount,
        currency,
        paymentSessionId: r.sessionId,
        status: r.status,
      });
      setResult(
        `Estado: ${r.status} · Sesión mock ${r.sessionId} · ${r.currency} ${r.amount} — ${r.message}`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: 12, fontFamily: 'system-ui, sans-serif', maxWidth: 400 }}>
      <h3 style={{ fontSize: '1rem' }}>Pago de consulta (demo)</h3>
      <p style={{ fontSize: '0.82rem', color: '#666' }}>
        Integración real pendiente; respuesta simulada en backend.
      </p>
      <label style={{ display: 'block', marginBottom: 8, fontSize: '0.88rem' }}>
        Monto
        <input
          type="number"
          min={0}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          style={{ display: 'block', width: '100%', marginTop: 4, padding: 8 }}
        />
      </label>
      <label style={{ display: 'block', marginBottom: 12, fontSize: '0.88rem' }}>
        Moneda
        <input
          value={currency}
          onChange={(e) => setCurrency(e.target.value.toUpperCase().slice(0, 8))}
          style={{ display: 'block', width: '100%', marginTop: 4, padding: 8 }}
        />
      </label>
      <button type="button" onClick={() => void pay()} disabled={busy}>
        {busy ? 'Procesando…' : 'Pagar consulta'}
      </button>
      {error && (
        <p style={{ color: '#b42318', fontSize: '0.9rem', marginTop: 8 }}>{error}</p>
      )}
      {result && (
        <p style={{ color: '#0d3b66', fontSize: '0.9rem', marginTop: 8 }}>{result}</p>
      )}
    </div>
  );
}
