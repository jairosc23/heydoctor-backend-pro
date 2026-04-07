'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  fetchPlatformGlobalMetrics,
  type PlatformGlobalMetrics,
} from '../lib/fetch-platform-global';

export type PlatformAdminDashboardProps = {
  backendOrigin: string;
  accessToken: string;
  windowDays?: number;
};

/**
 * Admin-only operations view — requires JWT with role admin.
 */
export function PlatformAdminDashboard({
  backendOrigin,
  accessToken,
  windowDays = 7,
}: PlatformAdminDashboardProps) {
  const [data, setData] = useState<PlatformGlobalMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const m = await fetchPlatformGlobalMetrics({
        backendOrigin,
        accessToken,
        windowDays,
      });
      setData(m);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [backendOrigin, accessToken, windowDays]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <p style={{ padding: 16 }}>Cargando métricas globales…</p>;
  }
  if (error) {
    return (
      <div style={{ padding: 16, color: '#b42318' }}>
        <p>{error}</p>
        <button type="button" onClick={() => void load()}>
          Reintentar
        </button>
      </div>
    );
  }
  if (!data) return null;

  const t = data.totals;
  const poorPct = t.poorCallSamplePct;

  return (
    <div style={{ padding: 16, fontFamily: 'system-ui, sans-serif', maxWidth: 1100 }}>
      <h1 style={{ fontSize: '1.35rem' }}>Dashboard plataforma</h1>
      <p style={{ color: '#666', fontSize: '0.9rem' }}>
        Ventana {data.windowDays} días · generado {new Date(data.generatedAt).toLocaleString()}
      </p>

      {data.alerts.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: '1.05rem' }}>Alertas</h2>
          <ul style={{ paddingLeft: 20 }}>
            {data.alerts.map((a) => (
              <li key={`${a.type}-${a.message}`} style={{ marginBottom: 8 }}>
                <strong>[{a.severity}]</strong> {a.message}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 12,
          marginBottom: 24,
        }}
      >
        <StatCard title="Consultas (total)" value={String(t.totalConsultations)} />
        <StatCard
          title="Llamadas activas (~)"
          value={String(t.activeCallsApprox)}
          hint="Basado en métricas WebRTC recientes"
        />
        <StatCard
          title="Grabaciones activas"
          value={String(t.activeRecordingSessions)}
        />
        <StatCard title="Muestras métricas" value={String(t.totalMetricSamples)} />
        <StatCard title="Calidad media" value={t.averageQualityLabel} />
        <StatCard
          title="% muestras malas"
          value={poorPct != null ? `${poorPct.toFixed(1)}%` : '—'}
          warn={poorPct != null && poorPct > 30}
        />
        <StatCard
          title="RTT medio"
          value={t.avgRttMs != null ? `${Math.round(t.avgRttMs)} ms` : '—'}
        />
        <StatCard
          title="Uso TURN (relay)"
          value={
            t.turnUsage.relayPct != null ? `${t.turnUsage.relayPct.toFixed(1)}%` : '—'
          }
        />
        <StatCard
          title="Directo (host/srflx)"
          value={
            t.turnUsage.directPct != null ? `${t.turnUsage.directPct.toFixed(1)}%` : '—'
          }
        />
      </section>

      <section>
        <h2 style={{ fontSize: '1.05rem' }}>Por clínica</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                <th style={{ padding: 8 }}>Clínica</th>
                <th style={{ padding: 8 }}>Consultas (ventana)</th>
                <th style={{ padding: 8 }}>Total consultas</th>
                <th style={{ padding: 8 }}>Muestras</th>
                <th style={{ padding: 8 }}>% malas</th>
                <th style={{ padding: 8 }}>Calidad</th>
                <th style={{ padding: 8 }}>% relay</th>
              </tr>
            </thead>
            <tbody>
              {data.byClinic.map((c) => (
                <tr key={c.clinicId} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: 8 }}>{c.clinicName}</td>
                  <td style={{ padding: 8 }}>{c.consultationsInWindow}</td>
                  <td style={{ padding: 8 }}>{c.totalConsultations}</td>
                  <td style={{ padding: 8 }}>{c.metricSamples}</td>
                  <td
                    style={{
                      padding: 8,
                      color:
                        c.poorSamplePct != null && c.poorSamplePct > 30
                          ? '#b42318'
                          : undefined,
                    }}
                  >
                    {c.poorSamplePct != null ? `${c.poorSamplePct.toFixed(1)}%` : '—'}
                  </td>
                  <td style={{ padding: 8 }}>{c.averageQualityLabel}</td>
                  <td style={{ padding: 8 }}>
                    {c.relayPct != null ? `${c.relayPct.toFixed(1)}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StatCard(props: {
  title: string;
  value: string;
  hint?: string;
  warn?: boolean;
}) {
  return (
    <div
      style={{
        border: '1px solid #e2e4e8',
        borderRadius: 8,
        padding: 12,
        background: props.warn ? '#fff5f5' : '#fafbfc',
      }}
    >
      <div style={{ fontSize: '0.8rem', color: '#555' }}>{props.title}</div>
      <div style={{ fontSize: '1.25rem', fontWeight: 600, marginTop: 4 }}>
        {props.value}
      </div>
      {props.hint && (
        <div style={{ fontSize: '0.72rem', color: '#888', marginTop: 6 }}>{props.hint}</div>
      )}
    </div>
  );
}
