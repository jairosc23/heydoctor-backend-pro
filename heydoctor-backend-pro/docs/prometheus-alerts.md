# Umbrales sugeridos y alertas (operación)

Valores orientativos; ajustar por entorno y SLO. Las expresiones asumen métricas expuestas en `/metrics` (ver `docs/observability-dashboards.md`).

## Latencia HTTP p95

| Severidad | Condición sugerida | Ventana |
|-----------|-------------------|---------|
| warning | p95 > **1.2 s** en rutas críticas (`route=~"/api/consultations.*"`) | 10m |
| critical | p95 > **3 s** global | 5m |

Ejemplo (Prometheus `alerting`):

```yaml
groups:
  - name: heydoctor_http
    rules:
      - alert: HttpP95High
        expr: |
          histogram_quantile(0.95,
            sum by (le) (rate(http_request_duration_seconds_bucket[5m]))
          ) > 3
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "p95 HTTP latency above 3s"
```

## Tasa de error HTTP

| Severidad | Condición | Ventana |
|-----------|-----------|---------|
| warning | ratio 5xx > **1%** | 10m |
| critical | ratio 5xx > **5%** | 5m |

```promql
sum(rate(http_request_duration_seconds_count{status_code=~"5.."}[5m]))
/
sum(rate(http_request_duration_seconds_count[5m]))
> 0.05
```

## RPS y load shedding

| Severidad | Condición |
|-----------|-----------|
| warning | QPS sostenido cercano al límite de rate limit (ajustar por despliegue) |
| info | Respuestas **503** con cuerpo `Service temporarily overloaded` → revisar `LOAD_SHED_QPS` (default 300) |

## Colas BullMQ (`bullmq_queue_jobs`)

| Métrica | Warning | Critical |
|---------|---------|----------|
| `state="failed"` | > 0 durante **15m** | > **10** acumulado o crecimiento sostenido |
| `state="waiting"` | cola **pdf** waiting > **500** y `active` ≈ 0 durante **10m** | idem con waiting > **2000** |

```yaml
      - alert: BullmqFailedJobs
        expr: sum(bullmq_queue_jobs{state="failed"}) > 0
        for: 15m
        labels:
          severity: warning
```

## Réplica de lectura

Monitorear lag de réplica en Postgres (fuera de la app): si el lag supera el SLA, desactivar temporalmente `DATABASE_READ_REPLICA_URL` o escalar réplica.
