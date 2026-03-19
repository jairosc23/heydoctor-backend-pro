# Verificación Deploy Railway - POST /api/auth/login

## Diagnóstico

Railway desplegaba commit `f5829c54` (repo **heydoctor**) que NO tenía el endpoint `/api/auth/login`.

Hay **dos backends** posibles:

| Repo | Backend | Login | Health |
|------|---------|-------|--------|
| **heydoctor** (jairosc23/heydoctor) | Express | `/auth/login` | `/health` |
| **heydoctor-backend** (SAVAC-HeyDoctor/heydoctor-backend) | Nest | `/api/auth/login` | `/api/health` |

## Solución aplicada

### Si Railway usa repo **heydoctor** (Express)

Se añadieron rutas en `heydoctor/backend/server.js`:

- `GET /api/health` → `{ status: "ok", timestamp }`
- `app.use("/api/auth", authRouter)` → `POST /api/auth/login`

Y en `auth.js`: respuesta incluye `jwt: token` para compatibilidad con frontend.

**Commit:** `3caddb2` en jairosc23/heydoctor

### Si Railway usa repo **heydoctor-backend** (Nest)

El endpoint ya existe en `AppController`:

- `POST /api/auth/login` en `nest-backend/src/app.controller.ts`

**Commit:** `2624e45` en SAVAC-HeyDoctor/heydoctor-backend

## Verificar en Railway

1. **Settings → Build**: ¿Root Directory? 
   - Si es `backend` → repo heydoctor (Express)
   - Si es `nest-backend` → repo heydoctor-backend (Nest)

2. **Settings → Repo**: ¿Cuál repo está conectado?

3. **Redeploy**: Deployments → ⋮ → Redeploy

## Probar

```bash
# Health
curl https://heydoctor-backend-production.up.railway.app/api/health

# Login (debe devolver 200/401, NO 404)
curl -X POST https://heydoctor-backend-production.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123"}'
```
