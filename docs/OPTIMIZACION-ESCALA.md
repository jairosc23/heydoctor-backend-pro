# Optimización y Escala - HeyDoctor Backend

Documento que describe las mejoras de performance y escalabilidad implementadas para soportar alto volumen de consultas médicas.

## Stack

- Strapi, PostgreSQL, Redis, BullMQ
- Multi-tenant basado en `clinic`
- Compatible con Railway

---

## 1. Índices PostgreSQL

**Migración:** `database/migrations/20250315000000_add_performance_indexes.js`

Se ejecuta automáticamente en bootstrap. Usa `CREATE INDEX IF NOT EXISTS` para no fallar si el índice ya existe.

### Tabla `appointments`

| Índice | Columnas | Uso |
|--------|----------|-----|
| `idx_appointments_clinic_created` | (clinic_id, created_at DESC) | Listados por clínica ordenados por fecha |
| `idx_appointments_doctor_date` | (doctor_id, date) | Citas por doctor y fecha |
| `idx_appointments_patient_created` | (patient_id, created_at DESC) | Historial por paciente |
| `idx_appointments_status` | (status) | Filtros por estado |

### Tabla `messages`

| Índice | Columnas | Uso |
|--------|----------|-----|
| `idx_messages_appointment_created` | (appointment_id, created_at DESC) | Mensajes por consulta |

### Tabla `clinical_records`

| Índice | Columnas | Uso |
|--------|----------|-----|
| `idx_clinical_records_clinic_created` | (clinic_id, created_at DESC) | Registros por clínica |
| `idx_clinical_records_patient` | (patient_id) | Registro por paciente |

### Tabla `patients`

| Índice | Columnas | Uso |
|--------|----------|-----|
| `idx_patients_clinic_created` | (clinic_id, created_at DESC) | Pacientes por clínica |

### Tabla `doctors`

| Índice | Columnas | Uso |
|--------|----------|-----|
| `idx_doctors_user` | (user_id) | Lookup por usuario (auth) |

---

## 2. Estrategia de Cache

**Módulo:** `config/functions/redis-cache.js`

### Helper `getOrSetCache(key, ttl, queryFn)`

- Si Redis está disponible: cachea el resultado de `queryFn()` con TTL.
- Si `REDIS_URL` no está definido: ejecuta `queryFn()` y retorna datos frescos (fallback automático).

### Endpoints cacheados

| Endpoint | TTL | Clave |
|----------|-----|-------|
| Listado de doctores | 5 min | `doctors:list:{query}` |
| Perfil de doctor | 10 min | `doctor:profile:{id}` |
| Especialidades | 30 min | `specialties:list:{query}` |
| Consultas recientes (appointments) | 2 min | `appointments:list:{clinicId}:{query}` |

### Invalidación

- Cache por clave incluye `clinicId` en appointments para respetar multi-tenant.
- TTL corto en appointments (2 min) para balancear frescura y carga.

---

## 3. Monitoreo de Queries Lentas

**Módulo:** `modules/observability/db-monitor.js`

### Configuración

- Variable de entorno: `SLOW_QUERY_THRESHOLD_MS` (default: 500).
- Se registra en bootstrap de Strapi.

### Log estructurado

```json
{
  "type": "slow_query",
  "table": "appointments",
  "duration_ms": 650,
  "timestamp": "...",
  "level": "warn"
}
```

- No se registran datos sensibles (solo tabla y duración).
- Integra con el módulo de observabilidad (logs JSON, Sentry si está configurado).

---

## 4. Rate Limit Mejorado

**Middleware:** `src/middlewares/rate-limit.js`

### Límites por tipo de endpoint

| Tipo | Paths | Límite |
|------|-------|--------|
| Auth | `/api/auth/local`, `/api/custom-auth/login`, `/api/custom-auth/register` | 20 req/min |
| Consultas médicas | `/api/consultation`, `/api/appointments`, `/api/messages` | 40 req/min |
| API general | Resto de `/api/*` | 100 req/min |

### Excepciones

- `/_health`, `/uploads`, `/admin` no aplican rate limit.

### Fallback

- Con Redis: límites compartidos entre instancias (escalable horizontalmente).
- Sin Redis: fallback a memoria (por proceso).

### Headers de respuesta

- `X-RateLimit-Limit`: límite aplicado.
- `X-RateLimit-Remaining`: solicitudes restantes en la ventana.
- `Retry-After`: segundos hasta poder reintentar (cuando 429).

---

## 5. Validación

```bash
npm run build
npm start
```

- **Build**: debe completar sin errores.
- **Start**: requiere PostgreSQL. Redis opcional.
- **Health**: `GET /_health` → 200.
- **Multi-tenant**: el filtro por `clinic` sigue aplicándose en appointments y demás entidades.
