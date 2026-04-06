# Runbook: seguridad y operaciones (HeyDoctor)

## JWT y secretos

- **Rotación**: al cambiar `JWT_SECRET`, todas las sesiones existentes quedan inválidas; planificar ventana y aviso. Mantener el secreto en gestor de secretos (Railway/ vault), no en git.
- **TTL**: `JWT_ACCESS_TTL` (acceso) y `JWT_REFRESH_TTL` (cookie + fila `refresh_tokens`) en `env.config`. Ajustar según riesgo (acceso corto, refresh acotado).
- **Refresh reuse**: en `auth.service`, si llega un refresh ya revocado se revocan todas las sesiones del usuario y se audita `TOKEN_REUSE_DETECTED`; respuesta 401 con mensaje explícito. Confirmar que esta política es la deseada en producto.

## Multi-tenant

- Ejecutar revisión periódica: `./scripts/check-clinic-scope.sh` y corregir consultas que filtren solo por `id` sin `clinicId` (o capa de autorización equivalente).
- Tests de integración “usuario A no accede a recurso de clínica B” cuando existan fixtures de dos clínicas.

## Errores HTTP (Nest)

- `GlobalExceptionFilter` unifica JSON `statusCode`, `message`, `path`, y `requestId` cuando existe. En producción, errores no HTTP devuelven mensaje genérico sin stack ni detalle interno.

## CSP y dominios (API / front / WebRTC / TURN)

- Documentar en el despliegue del frontend cada origen que llama a la API (`CORS_ORIGIN` en backend).
- Al cambiar TURN/WebRTC: actualizar `Permissions-Policy`, CSP del front (si aplica) y lista de STUN/TURN en cliente; probar llamada en red restringida.
- Si se reduce `unsafe-inline` en CSP, valorar **nonces** o hashes para scripts inline.

## Telemedicina

- **Reconexión**: procedimiento—reenviar enlace/join room, refrescar token de sala si expira, soporte revisa `consultations` + logs con `requestId`.
- **Calidad**: monitorizar bitrate/packet loss desde cliente (métricas de WebRTC) y correlacionar con incidencias.
- **Consentimiento**: confirmar consentimiento informado por sesión según política legal vigente (registro en módulo de consentimientos).

## Payku

- Webhooks idempotentes con bloqueo pesimista y transiciones de estado validadas; auditoría en `audit_logs`.
- Alertas operativas: buscar en logs el prefijo `[PAYKU_ALERT]` (transición inválida, importe faltante, discrepancia de monto).

## IA clínica

- Prompt del modelo acota rol de **asistencia** a profesionales; no sustituye juicio clínico.
- **Logging**: sin PHI en logs; en dev y sin `HIPAA_MODE`, solo depuración agregada (`model`, tamaño de respuesta), no prompts ni notas clínicas.

## CIE-10 / diagnóstico

- Validación de **forma** del prefijo al inicio del texto (no valida existencia en catálogo).
- Cierre clínico (`COMPLETED` / `SIGNED` / `LOCKED`): diagnóstico no vacío; con `REQUIRE_CIE10_PREFIX_FOR_COMPLETION=true` se exige prefijo con forma de código al inicio.

## `audit_logs`

- Índice BRIN en `created_at` para rangos temporales; retención, partición y archivo siguen siendo decisiones de operaciones/cumplimiento.

## UX clínica (piloto)

- Recorrer con un médico el flujo paciente → consulta → diagnóstico → plan → cierre; recoger “must-have” (notas, adjuntos, recetas) fuera de este repositorio si aplica.

## Frontend: depuración JWT

- No registrar tokens en consola. Si hiciera falta depuración excepcional, usar una variable explícita (p. ej. `NEXT_PUBLIC_JWT_DEBUG=true`) y limitar a prefijo de 8 caracteres en entornos no productivos.

## Backlog sugerido por prioridad

| Prioridad | Tema | Acción |
|-----------|------|--------|
| P0 | Multi-tenant | `./scripts/check-clinic-scope.sh` + revisión; tests e2e A/B cuando haya datos semilla |
| P0 | JWT / secretos | Rotación documentada; TTL revisados; política reuse en `auth.service` |
| P1 | Errores Nest | `GlobalExceptionFilter` + `requestId` |
| P1 | Logs token (front) | Sin logs por defecto; flag estricta si se depura |
| P1 | CSP / dominios | Procedimiento al cambiar API/WebRTC/TURN |
| P1 | Telemedicina | Runbook reconexión + métricas + consentimiento por sesión |
| P1 | Payku | `[PAYKU_ALERT]` + auditoría existente |
| P1 | IA | Disclaimer en UI; logs sin PHI (`HIPAA_MODE`, prod) |
| P2 | CIE-10 | Validación de forma + cierre con diagnóstico; catálogo opcional |
| P2 | `audit_logs` | BRIN + política de retención/archivo |
| P2 | UX clínica | Piloto médico y lista must-have |
