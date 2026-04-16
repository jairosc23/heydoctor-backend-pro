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

function FunnelVisualization({
  funnel,
}: {
  funnel: AdminBusinessDashboard['funnel'];
}) {
  const steps = [
    { key: 'visits', label: 'Visitas (proxy)', value: funnel.visits ?? 0 },
    { key: 'created', label: 'Consultas creadas', value: funnel.created },
    { key: 'paid', label: 'Pagadas', value: funnel.paid },
    { key: 'completed', label: 'Completadas', value: funnel.completed },
  ];
  const max = Math.max(1, ...steps.map((s) => s.value));

  return (
    <section
      style={{
        padding: 20,
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        background: '#fff',
        marginBottom: 28,
      }}
    >
      <h2 style={{ fontSize: '1.05rem', margin: '0 0 6px', color: '#111' }}>
        Embudo del día (UTC)
      </h2>
      <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 16px' }}>
        {funnel.visitsSource}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {steps.map((s, i) => {
          const pct = Math.round((1000 * s.value) / max) / 10;
          const drop =
            i > 0
              ? steps[i - 1].value > 0
                ? Math.round(
                    (10000 * s.value) / Math.max(1, steps[i - 1].value),
                  ) / 100
                : 0
              : null;
          return (
            <div key={s.key}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  marginBottom: 4,
                }}
              >
                <span style={{ fontSize: 14, color: '#374151' }}>{s.label}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>
                  {s.value.toLocaleString('es-CL')}
                  {drop != null && i > 0 ? (
                    <span style={{ fontWeight: 400, color: '#6b7280' }}>
                      {' '}
                      ({drop.toFixed(1)} % vs anterior)
                    </span>
                  ) : null}
                </span>
              </div>
              <div
                style={{
                  height: 28,
                  background: '#f3f4f6',
                  borderRadius: 6,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${pct}%`,
                    height: '100%',
                    background:
                      i === 0
                        ? '#94a3b8'
                        : i === 1
                          ? '#3b82f6'
                          : i === 2
                            ? '#8b5cf6'
                            : '#059669',
                    borderRadius: 6,
                    transition: 'width 0.2s ease',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function DoctorPerformanceTable({
  rows,
  currency,
}: {
  rows: AdminBusinessDashboard['doctorPerformance'];
  currency: string;
}) {
  if (!rows.length) {
    return (
      <section
        style={{
          padding: 20,
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          background: '#fafafa',
        }}
      >
        <h2 style={{ fontSize: '1.05rem', margin: 0, color: '#111' }}>
          Rendimiento por médico (hoy)
        </h2>
        <p style={{ color: '#6b7280', fontSize: 14, margin: '12px 0 0' }}>
          Sin ingresos registrados hoy.
        </p>
      </section>
    );
  }

  return (
    <section
      style={{
        padding: 20,
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        background: '#fff',
        overflowX: 'auto',
      }}
    >
      <h2 style={{ fontSize: '1.05rem', margin: '0 0 16px', color: '#111' }}>
        Rendimiento por médico (hoy)
      </h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
            <th style={{ padding: '10px 8px', color: '#6b7280' }}>Médico</th>
            <th style={{ padding: '10px 8px', color: '#6b7280' }}>
              Consultas con ingreso
            </th>
            <th style={{ padding: '10px 8px', color: '#6b7280' }}>Ingresos</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.doctorId} style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td style={{ padding: '10px 8px', color: '#111' }}>
                {r.displayName}
              </td>
              <td style={{ padding: '10px 8px' }}>{r.consultationsWithRevenue}</td>
              <td style={{ padding: '10px 8px', fontWeight: 500 }}>
                {formatClp(r.revenue, currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
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

  const funnel = data.funnel ?? {
    visits: null,
    visitsSource: '',
    created: data.consultationsCreated,
    paid: 0,
    completed: data.consultationsCompleted,
  };

  const doctorPerformance = data.doctorPerformance ?? [];

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
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 16,
          marginBottom: 16,
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
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 16,
          marginBottom: 28,
        }}
      >
        <KpiCard
          label="Conversión (pagadas / creadas)"
          value={`${(data.conversionRate ?? 0).toFixed(1)} %`}
          hint="Hoy · consultas distintas con pago"
        />
        <KpiCard
          label="Pacientes recurrentes"
          value={String(data.repeatUsers ?? 0)}
          hint="2+ consultas en 30 días (UTC)"
        />
        <KpiCard
          label="Tiempo medio consulta"
          value={
            data.avgConsultationTimeMinutes != null
              ? `${data.avgConsultationTimeMinutes.toFixed(1)} min`
              : '—'
          }
          hint="Creación → cierre (cerradas hoy)"
        />
        <KpiCard
          label="Ingreso / médico (hoy)"
          value={formatClp(data.revenuePerDoctor ?? 0, data.currency)}
          hint="Entre médicos con ingreso hoy"
        />
      </div>

      <FunnelVisualization funnel={funnel} />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 20,
          marginBottom: 28,
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

      <DoctorPerformanceTable rows={doctorPerformance} currency={data.currency} />
    </div>
  );
}
