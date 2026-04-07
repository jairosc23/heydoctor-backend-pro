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
