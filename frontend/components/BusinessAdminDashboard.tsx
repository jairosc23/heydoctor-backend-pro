'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  heydoctorApi,
  type AdminBusinessDashboard,
} from '../lib/heydoctor-api';

function formatClp(n: number, currency: string): string {
  if (currency === 'CLP') {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0,
    }).format(n);
  }
  return `${n} ${currency}`;
}

function MiniBarChart({
  title,
  labels,
  values,
  valueFormatter,
  color,
}: {
  title: string;
  labels: string[];
  values: number[];
  valueFormatter: (n: number) => string;
  color: string;
}) {
  const max = Math.max(1, ...values);
  return (
    <section
      style={{
        padding: 16,
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        background: '#fff',
      }}
    >
      <h2 style={{ fontSize: '1rem', margin: '0 0 12px', color: '#111' }}>
        {title}
      </h2>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 8,
          height: 160,
          paddingBottom: 4,
          borderBottom: '1px solid #eee',
        }}
      >
        {values.map((v, i) => {
          const h = Math.round((v / max) * 130);
          return (
            <div
              key={labels[i]}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-end',
                minWidth: 0,
              }}
              title={`${labels[i]}: ${valueFormatter(v)}`}
            >
              <span
                style={{
                  fontSize: 10,
                  color: '#6b7280',
                  marginBottom: 4,
                  whiteSpace: 'nowrap',
                }}
              >
                {valueFormatter(v)}
              </span>
              <div
                style={{
                  width: '75%',
                  height: Math.max(v > 0 ? 6 : 0, h),
                  background: color,
                  borderRadius: 4,
                }}
              />
              <span
                style={{
                  fontSize: 11,
                  color: '#9ca3af',
                  marginTop: 8,
                }}
              >
                {labels[i].slice(8)}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div
      style={{
        padding: 16,
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        background: '#fafafa',
      }}
    >
      <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 600, color: '#111' }}>
        {value}
      </div>
      {hint ? (
        <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 6 }}>{hint}</div>
      ) : null}
    </div>
  );
}

/**
 * Dashboard de negocio (no técnico): consultas, ingresos, abandono.
 * Datos vía {@link heydoctorApi.admin.getBusinessDashboard}.
 */
export function BusinessAdminDashboard() {
  const [data, setData] = useState<AdminBusinessDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await heydoctorApi.admin.getBusinessDashboard();
      setData(d);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const chartData = useMemo(() => {
    if (!data?.byDay?.length) {
      return { labels: [] as string[], consults: [] as number[], revenue: [] as number[] };
    }
    return {
      labels: data.byDay.map((r) => r.date),
      consults: data.byDay.map((r) => r.consultations),
      revenue: data.byDay.map((r) => r.revenue),
    };
  }, [data]);

  if (loading) {
    return (
      <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
        Cargando indicadores…
      </div>
    );
  }
  if (error) {
    return (
      <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
        <p style={{ color: '#b42318' }}>{error}</p>
        <button type="button" onClick={() => void load()}>
          Reintentar
        </button>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div
      style={{
        padding: 24,
        fontFamily: 'system-ui, sans-serif',
        maxWidth: 1100,
        margin: '0 auto',
      }}
    >
      <h1 style={{ fontSize: '1.5rem', margin: '0 0 8px', color: '#111' }}>
        Panel de negocio
      </h1>
      <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 24 }}>
        Actualizado {new Date(data.asOf).toLocaleString('es-CL', { timeZone: 'UTC' })}{' '}
        UTC · ingresos en {data.currency}
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 16,
          marginBottom: 28,
        }}
      >
        <KpiCard
          label="Consultas creadas (hoy)"
          value={String(data.consultationsCreated)}
        />
        <KpiCard
          label="Consultas completadas (hoy)"
          value={String(data.consultationsCompleted)}
          hint="Incluye firmadas y cerradas"
        />
        <KpiCard
          label="Ingresos (hoy)"
          value={formatClp(data.totalRevenue, data.currency)}
        />
        <KpiCard
          label="Abandono (embudo hoy)"
          value={`${data.abandonmentRate.toFixed(1)} %`}
          hint="Creadas hoy que siguen en borrador o en curso"
        />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 20,
        }}
      >
        <MiniBarChart
          title="Consultas por día (7 días)"
          labels={chartData.labels}
          values={chartData.consults}
          valueFormatter={(n) => String(n)}
          color="#2563eb"
        />
        <MiniBarChart
          title="Ingresos por día (7 días)"
          labels={chartData.labels}
          values={chartData.revenue}
          valueFormatter={(n) => formatClp(n, data.currency)}
          color="#059669"
        />
      </div>
    </div>
  );
}
