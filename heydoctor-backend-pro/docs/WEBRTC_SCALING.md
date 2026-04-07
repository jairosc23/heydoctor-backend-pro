# WebRTC signaling — escalado horizontal (HeyDoctor)

## Múltiples instancias Nest + Socket.IO

Sin adaptador compartido, cada instancia mantiene salas en memoria: dos usuarios unidos a pods distintos **no** se verán entre sí.

### Redis adapter (recomendado en producción)

1. Provisionar Redis (misma región que la API).
2. Añadir dependencia `@socket.io/redis-adapter` y cliente Redis compatible.
3. Tras crear el servidor de Socket.IO, adjuntar `createAdapter(pubClient, subClient)` con la misma `REDIS_URL` en todas las réplicas.

4. **Sticky sessions** en el balanceador cuando corresponda al transporte WebSocket.

## Idempotencia de señalización

- El servidor solo **reenvía** `offer`, `answer`, `ice-candidate`; no persiste SDP.
- Los clientes deben ignorar candidatos u ofertas obsoletas según el estado local del peer (comportamiento estándar WebRTC).

## TURN multi-región

`GET /api/webrtc/ice-servers` ordena relays según sondas TCP recientes (`WebrtcTurnHealthService`). Complementar con monitorización externa en producción.
