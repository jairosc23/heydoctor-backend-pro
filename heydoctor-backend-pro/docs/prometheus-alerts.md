# Umbrales sugeridos y alertas (operación)

Valores orientativos; ajustar por entorno y SLO. Las expresiones asumen métricas expuestas en `/metrics` (ver `docs/observability-dashboards.md`).

## Histéresis (activar vs recuperar)

Para reducir *flapping* en Alertmanager/Prometheus, usar **umbrales distintos** para disparo y para resolución:

| Patrón | Disparo (fire) | Resolución (recover) | Notas |
|--------|----------------|----------------------|--------|
| Latencia p95 | p95 > **3 s** durante 5m | p95 < **2.2 s** durante 10m | Recuperación más estricta y ventana más larga evita alertas intermitentes. |
| Ratio 5xx | > **5%** durante 5m | < **3%** durante 15m | El tráfico residual puede mantener un pico breve tras mitigar. |
| Cola BullMQ `waiting` | pdf waiting > **2000** y active ≈ 0 durante 10m | waiting < **1200** durante 15m | Histéresis ~40% respecto al umbral crítico documentado arriba. |

En reglas YAML, expresar la resolución como condición explícita en `for:` o mediante dos reglas (`alert_firing` vs `alert_recovered`) según el sistema de notificaciones.

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

Monitorear lag de réplica en Postgres (fuera de la app): si el lag supera el SLA, desactivar temporalmente `DATABASE_READ_REPLICA_URL` o escalar réplica. Las lecturas de listados reintentan automáticamente en el primario si la réplica falla. En runtime, un **circuit breaker** deja de consultar la réplica durante un cooldown tras fallos consecutivos (`READ_REPLICA_CIRCUIT_OPEN_MS`, `READ_REPLICA_CIRCUIT_FAILURES`).

## Mitigación automática (hooks)

La app acumula **refuerzo de TTL soft de caché** cuando el load shedding detecta presión (`MitigationHooksService.notifyLoadPressure`). Para acciones operadas por alertas:

| Acción | Mecanismo |
|--------|-----------|
| Más margen de caché | Llamar en runtime `MitigationHooksService.applyAlertMitigation({ cacheFreshBoostMs: 30000 })` (p. ej. desde un webhook interno tras alerta de saturación). |
| Pausar colas | `applyAlertMitigation({ pauseQueues: true })` solo tiene efecto si `MITIGATION_ALERT_PAUSE_QUEUES=true` en el entorno (pausa `email`, `pdf`, `webhook` y espera a drenar jobs `active` hasta `QUEUE_PAUSE_ACTIVE_DRAIN_MS`). **Reanudar** con `queue.resume()` en Redis/CLI o despliegue. |

**Runbook Alertmanager (ejemplo):** receptor `webhook_configs` → servicio interno que traduzca el payload y invoque el método anterior (o escale réplicas en lugar de pausar colas en producción clínica).

## Tráfico sospechoso

Logs estructurados `security_suspicious_traffic` cuando una IP supera ~**800** hits en ventana **60 s** (throttle de log ~45 s por IP). La misma detección aplica un **ban temporal** en la app (`SUSPICIOUS_TRAFFIC_BAN_MS`, default 15 min) con respuesta **403** y `Retry-After`. Revisar WAF / bloqueo upstream para capas adicionales.
