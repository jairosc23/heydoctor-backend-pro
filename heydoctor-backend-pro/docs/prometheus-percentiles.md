# Consultas Prometheus: p50 / p95 / p99 de latencia HTTP

Histograma: `http_request_duration_seconds` (segundos), etiquetas `method`, `route`, `status_code`.

## PromQL (ejemplo ventana 5m)

Sustituye `your_route` por el valor normalizado de `route` (p. ej. `/api/patients/:id`).

### p50

```promql
histogram_quantile(
  0.50,
  sum by (le) (
    rate(http_request_duration_seconds_bucket{route="your_route"}[5m])
  )
)
```

### p95

```promql
histogram_quantile(
  0.95,
  sum by (le) (
    rate(http_request_duration_seconds_bucket{route="your_route"}[5m])
  )
)
```

### p99

```promql
histogram_quantile(
  0.99,
  sum by (le) (
    rate(http_request_duration_seconds_bucket{route="your_route"}[5m])
  )
)
```

## Por ruta (todas las rutas en una query)

```promql
histogram_quantile(
  0.95,
  sum by (le, route) (
    rate(http_request_duration_seconds_bucket[5m])
  )
)
```

Nota: los buckets definidos en código limitan la precisión de los cuantiles en colas extremas; para SLIs muy ajustados valora añadir buckets más finos en el histograma (cambio de aplicación).
