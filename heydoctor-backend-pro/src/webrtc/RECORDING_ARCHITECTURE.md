# WebRTC recording — arquitectura futura (HeyDoctor)

Estado actual: los endpoints `POST /api/webrtc/recording/start` y `POST /api/webrtc/recording/stop` son **stubs** (solo validación de acceso a consulta, registro en logs y respuesta `202 Accepted`). **No se almacena ni retransmite media.**

## Objetivos de producción

1. **Cumplimiento clínico y privacidad**: consentimiento explícito, retención acotada, trazabilidad sin exponer PHI en logs de aplicación.
2. **Seguridad en tránsito y en reposo**: TLS de extremo a extremo en la tubería; en reposo cifrado (p. ej. SSE-KMS en S3 o equivalente).
3. **Separación de responsabilidades**: el browser no sube credenciales de bucket; usa URLs firmadas de corta duración o tokens emitidos por el backend tras verificar rol y consentimiento.

## Flujo propuesto (alto nivel)

```text
Cliente                     API Nest                    Worker / almacén
  |                            |                              |
  |-- recording/start -------->| verifica JWT + consulta +   |
  |                            | consentimiento               |
  |<-- sessionId + upload URL -| (pre-signed PUT o WebSocket |
  |                            |  token hacia MediaSoup /    |
  |                            |  LiveKit u ortc servidor)    |
  |-- chunks / SFU ---------->|------------------------------>| S3 (cifrado)
  |-- recording/stop -------->| cierra sesión, checksum,     |
  |                            | metadatos mínimos en DB     |
```

## Datos que **no** deben guardarse en la misma tabla que metadatos

- SDP completo, ICE candidates crudos con IPs sensibles en logs permanentes.
- Contenido clínico derivado del audio/vídeo (eso va a sistemas clínicos explícitos, no a métricas).

## Módulos sugeridos

- **Session service**: crea `recording_session_id`, estado (`pending` | `active` | `finalized` | `failed`), `consultation_id`, `user_id`, `consent_asserted_at`.
- **Storage adapter**: S3-compatible (bucket dedicado, lifecycle policy, bloqueo de acceso público).
- **Procesamiento asíncrono** (opcional): transcoding, thumbnails solo si política lo permite; por defecto almacenar tal cual MP4/WebM con cifrado.

## Relación con métricas

Las métricas en `webrtc_call_metrics` son **solo números de calidad** (RTT, jitter, bitrate, etc.). La grabación usará tablas y buckets distintos cuando se implemente.

## Cifrado en reposo (futuro)

- **Objetivo**: objeto de grabación cifrado antes de abandonar el proceso que lo generó (o cifrado del lado del servidor con CMK/KMS).
- **Enfoque típico**: AES-256-GCM por archivo o por sesión; clave de datos (DEK) aleatoria; DEK cifrada con clave gestionada (KMS: AWS KMS, GCP Cloud KMS, Vault).
- **Integridad**: checksum (SHA-256) del objeto final almacenado en metadatos firmados o en registro de auditoría.
- **Rotación**: política de rotación de claves y re-cifrado acotado según riesgo; logs sin contenido clínico.

## Almacenamiento (futuro S3 u objeto compatible)

- Bucket **dedicado**, sin listado público, política de bucket deny-by-default, acceso solo vía rol de servicio o pre-signed URLs de corta duración.
- **Versionado** opcional para recuperación ante borrado accidental.
- **Lifecycle**: retención mínima/máxima según normativa y consentimiento; transición a almacenamiento frío si aplica.
- **Regiones**: preferir la misma región jurídica que el paciente/consulta cuando la ley lo exija; documentar ubicación en política de privacidad.

## Cumplimiento y gobernanza (notas)

- **Consentimiento**: el API stub propaga `userConsent` y `consentRequired` en logs y respuesta; la implementación real debe persistir `consent_asserted_at`, versión de texto legal y actor (userId) sin almacenar PHI en logs de aplicación.
- **Trazabilidad**: vínculo `recording_session_id` ↔ `consultation_id` ↔ `user_id` en tablas segregadas; acceso vía roles y auditoría (quién consultó o exportó).
- **Minimización**: no guardar SDP, credenciales TURN ni dumps de señalización junto a la grabación.
- **HIPAA-like**: controles de acceso, registro de accesos a datos sensibles, BAA con proveedores cloud cuando corresponda; este documento no constituye asesoría legal.

## Endpoints actuales (estructura, sin media)

`POST /api/webrtc/recording/start` y `stop` validan JWT, consulta y participación; devuelven `consultationId`, `userId` (sub), `consentRequired`, `userConsentAsserted`. **No** se almacena vídeo hasta que exista el pipeline seguro anterior.
