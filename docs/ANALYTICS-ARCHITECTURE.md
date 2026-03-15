# Arquitectura de Analytics - HeyDoctor Backend

Capa de analytics y data warehouse para capturar eventos del sistema y almacenarlos en ClickHouse.

## Stack

- Strapi, PostgreSQL, Redis, BullMQ, EventBus, Meilisearch
- Multi-tenant basado en `clinic`
- ClickHouse (opcional)

---

## 1. Arquitectura

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  EventBus   │────▶│ analytics-   │────▶│   ClickHouse    │
│  (eventos)  │     │ worker       │     │   (events)      │
└─────────────┘     │ (BullMQ)     │     └─────────────────┘
       ▲            └──────────────┘
       │                    ▲
┌──────┴──────┐     ┌────────┴────────┐
│ Lifecycles  │     │ trackEvent()    │
│ Controllers │     │ trackLogin()    │
│ Services    │     │ trackSearch()   │
└─────────────┘     └─────────────────┘
```

- **EventBus**: eventos internos (consultation_started, appointment_created, etc.)
- **trackEvent/trackX**: funciones del módulo analytics que encolan en BullMQ
- **analytics-worker**: worker BullMQ que inserta en ClickHouse
- **ClickHouse**: tabla `events` para almacenamiento analítico

---

## 2. Event Tracking

### Funciones del módulo

| Función | Uso |
|---------|-----|
| `trackEvent(type, { clinicId, userId, entityId, metadata })` | Evento genérico |
| `trackConsultation(type, payload)` | Eventos de consulta |
| `trackAppointment(type, payload)` | Eventos de cita |
| `trackSearch({ clinicId, userId, query, type, resultCount, source })` | Búsquedas |
| `trackLogin({ userId, clinicId, success })` | Logins |

### Eventos capturados desde EventBus

| Evento | Origen |
|--------|--------|
| consultation_started | consultations.service (startConsultation) |
| consultation_joined | consultations.service (doctorJoin/patientJoin) |
| consultation_ended | consultations.service (transitionStatus → completed) |
| appointment_created | consultations.service (create) |
| appointment_cancelled | consultations.service (delete, transitionStatus → cancelled) |
| patient_created | patient lifecycle (afterCreate) |
| clinical_record_created | clinical-record lifecycle (afterCreate) |
| document_uploaded | appointment lifecycle (files) |
| search_performed | search controller |
| login | custom-auth (login) |

---

## 3. Estructura de eventos

```json
{
  "event_type": "consultation_started",
  "clinic_id": 1,
  "user_id": 42,
  "entity_id": 123,
  "timestamp": "2024-01-15T12:00:00.000Z",
  "metadata": {
    "consultationId": 123,
    "appointmentId": 123,
    "doctorId": 42,
    "patientId": 10
  }
}
```

---

## 4. Data Warehouse (ClickHouse)

### Tabla `events`

| Columna | Tipo | Descripción |
|---------|------|-------------|
| event_type | String | Tipo de evento |
| clinic_id | Nullable(UInt64) | ID de clínica (multi-tenant) |
| user_id | Nullable(UInt64) | ID de usuario |
| entity_id | Nullable(UInt64) | ID de entidad relacionada |
| timestamp | DateTime64(3) | Momento del evento |
| metadata | String | JSON con datos adicionales |

### Configuración

| Variable | Descripción |
|----------|-------------|
| `CLICKHOUSE_URL` | URL de ClickHouse (ej: `http://localhost:8123`). Sin definir = analytics desactivado |
| `CLICKHOUSE_DATABASE` | Base de datos (default: `heydoctor`) |

---

## 5. Worker BullMQ

- **Cola**: `analytics-worker`
- **Job**: `track` con payload del evento
- **Procesador**: inserta en ClickHouse
- Requiere `REDIS_URL` para BullMQ y `CLICKHOUSE_URL` para persistencia

---

## 6. Fallback

Si `CLICKHOUSE_URL` no está configurado:

- `analytics.isEnabled()` retorna `false`
- No se encolan eventos (enqueueAnalytics no-op cuando analytics desactivado)
- El worker procesa pero no inserta (skip)

---

## 7. Uso futuro para AI médica

La tabla `events` permite:

- **Análisis de patrones**: consultas por hora, duración, especialidad
- **Métricas de plataforma**: adopción, engagement por clínica
- **Datos para ML**: secuencias de eventos, predicción de no-show
- **Auditoría analítica**: trazabilidad sin datos sensibles en metadata

### Consultas ejemplo

```sql
-- Consultas por clínica en el último mes
SELECT clinic_id, event_type, count() 
FROM events 
WHERE event_type = 'consultation_started' 
  AND timestamp >= now() - INTERVAL 1 MONTH
GROUP BY clinic_id, event_type;

-- Búsquedas más frecuentes
SELECT JSONExtractString(metadata, 'query') as q, count()
FROM events 
WHERE event_type = 'search_performed'
GROUP BY q
ORDER BY count() DESC
LIMIT 20;
```
