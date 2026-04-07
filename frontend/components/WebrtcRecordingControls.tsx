'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  fetchRecordingStatus,
  requestRecordingStart,
  requestRecordingStop,
  type RecordingStartResult,
} from '../lib/webrtc-recording-api';

export type WebrtcRecordingControlsProps = {
  backendOrigin: string;
  accessToken: string;
  consultationId: string;
  callId: string | null;
  pollIntervalMs?: number;
};

/**
 * Requires explicit consent before starting recording — aligns with backend validation.
 */
export function WebrtcRecordingControls({
  backendOrigin,
  accessToken,
  consultationId,
  callId,
  pollIntervalMs = 12_000,
}: WebrtcRecordingControlsProps) {
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusText, setStatusText] = useState<string>('Sin grabación activa (consulta estado…)');
  const [lastStart, setLastStart] = useState<RecordingStartResult | null>(null);

  const refreshStatus = useCallback(async () => {
    if (!callId) {
      setStatusText('Inicie la llamada para obtener callId de correlación.');
      return;
    }
    try {
      const s = await fetchRecordingStatus({
        backendOrigin,
        accessToken,
        consultationId,
        callId,
      });
      if (!s.active || !s.recording) {
        setStatusText('Grabación inactiva');
        return;
      }
      setStatusText(
        `Grabando (sessión ${s.recording.recordingId.slice(0, 8)}…) — consentimiento requerido: ${s.recording.consentRequired ? 'sí' : 'no'}`,
      );
    } catch {
      setStatusText('No se pudo leer el estado de grabación');
    }
  }, [backendOrigin, accessToken, consultationId, callId]);

  useEffect(() => {
    void refreshStatus();
    if (!callId || pollIntervalMs <= 0) return undefined;
    const t = window.setInterval(() => void refreshStatus(), pollIntervalMs);
    return () => clearInterval(t);
  }, [refreshStatus, callId, pollIntervalMs]);

  async function start() {
    if (!callId) {
      setError('Falta callId');
      return;
    }
    if (!consent) {
      setError('Confirme el consentimiento para grabar');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await requestRecordingStart({
        backendOrigin,
        accessToken,
        consultationId,
        callId,
        userConsent: true,
      });
      setLastStart(r);
      setStatusText(`Grabación iniciada (${r.recordingId.slice(0, 8)}…)`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function stop() {
    if (!callId) return;
    if (!consent) {
      setError('Confirme el consentimiento para detener (política de auditoría)');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await requestRecordingStop({
        backendOrigin,
        accessToken,
        consultationId,
        callId,
        userConsent: true,
      });
      setLastStart(null);
      setStatusText('Grabación finalizada');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: 12, fontFamily: 'system-ui, sans-serif', maxWidth: 420 }}>
      <h3 style={{ fontSize: '1rem' }}>Grabación (metadatos)</h3>
      <p style={{ fontSize: '0.82rem', color: '#555' }}>{statusText}</p>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />
        Confirmo consentimiento informado para esta sesión de grabación
      </label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" disabled={busy || !callId} onClick={() => void start()}>
          Iniciar grabación
        </button>
        <button type="button" disabled={busy || !callId} onClick={() => void stop()}>
          Detener grabación
        </button>
        <button type="button" onClick={() => void refreshStatus()}>
          Actualizar estado
        </button>
      </div>
      {error && (
        <p style={{ color: '#b42318', fontSize: '0.88rem', marginTop: 8 }}>{error}</p>
      )}
      {lastStart?.storagePath && (
        <p style={{ fontSize: '0.75rem', color: '#666', marginTop: 8, wordBreak: 'break-all' }}>
          Ruta almacenamiento (stub): {lastStart.storagePath}
        </p>
      )}
    </div>
  );
}
