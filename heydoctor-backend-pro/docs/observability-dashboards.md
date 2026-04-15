# Paneles estándar (Prometheus / Grafana)

Métricas HTTP: histograma `http_request_duration_seconds` (`method`, `route`, `status_code`).  
Colas: `bullmq_queue_jobs` (`queue`, `state` ∈ `waiting` | `active` | `failed`).

## Latencia p95

```promql
histogram_quantile(
  0.95,
  sum by (le, route) (
    rate(http_request_duration_seconds_bucket[5m])
  )
)
```

## Tasa de error HTTP (4xx+5xx / total)

Basada en contadores del histograma (`_count`):

```promql
sum(rate(http_request_duration_seconds_count{status_code=~"4..|5.."}[5m]))
/
sum(rate(http_request_duration_seconds_count[5m]))
```

Solo 5xx (errores servidor):

```promql
sum(rate(http_request_duration_seconds_count{status_code=~"5.."}[5m]))
/
sum(rate(http_request_duration_seconds_count[5m]))
```

## RPS (solicitudes por segundo)

```promql
sum(rate(http_request_duration_seconds_count[5m]))
```

Por ruta:

```promql
sum by (route) (rate(http_request_duration_seconds_count[5m]))
```

## Colas: trabajos en espera / activos / fallidos

```promql
bullmq_queue_jobs
```

Alertas típicas:

- `bullmq_queue_jobs{state="failed"}` > 0 sostenido
- `bullmq_queue_jobs{state="waiting"}` creciendo sin consumo (`active` ≈ 0)

## Referencia

Ver también `docs/prometheus-percentiles.md` para p50/p99 y matices de buckets.
