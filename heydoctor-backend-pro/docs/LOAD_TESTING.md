# Load testing (HeyDoctor API)

Stateless HTTP paths scale horizontally behind a load balancer when:

- JWT validation uses the shared database (or distributed cache) — already the case.
- Throttling uses Redis when `REDIS_URL` is set (recommended for soak tests).
- WebRTC **signaling** uses Socket.IO: for multiple Nest instances you need the
  [Redis adapter](https://socket.io/docs/v4/redis-adapter/) and **sticky sessions**
  per browser/WebSocket (see `docs/WEBRTC_SCALING.md`).

## Expected rough limits (single small Railway instance, indicative only)

| Workload | Order of magnitude |
|----------|-------------------|
| `POST /api/webrtc/metrics` | Hundreds to low thousands RPS if DB and CPU allow; Postgres write rate is usually the limiter. |
| `GET /api/health` | Very high (no ORM). |
| `POST /api/auth/login` | Bounded by bcrypt + throttler (`loginEmail` limiter). |
| Socket.IO join/offer | Limited by CPU + single-node fan-out; scale out with Redis + sticky LB. |

Bottlenecks to watch: PostgreSQL connections, TypeORM query latency, and Socket.IO single-process throughput.

## k6 — metrics burst

```bash
export API_BASE=https://your-api.up.railway.app/api
export JWT='eyJ...'
k6 run scripts/load-test-k6-metrics.js
```

Tune `VUS` and `DURATION` in the script. Use a valid `consultationId` visible to the JWT.

## Node — quick concurrent probe

```bash
node scripts/load-test-node-metrics.mjs https://your-api.up.railway.app eyJ... <consultationId>
```

## Scaling considerations

1. **API tier**: add instances; share `DATABASE_URL`, optional Redis for throttler + Socket.IO.
2. **Postgres**: connection pool size per instance, read replicas only for read-heavy paths (not yet split here).
3. **WebRTC metrics**: batching on the client reduces write volume; indexes on `(consultation_id, recorded_at)` support aggregation.
4. **Platform dashboard** (`GET /api/platform/metrics/global`): admin-only; cache responses 30–60s if traffic grows.
