# Deploy HeyDoctor Backend

## Railway

1. Conectar el repo a Railway
2. **Root Directory**: `nest-backend` (si monorepo) o vacío
3. **Añadir PostgreSQL** (obligatorio):
   - "+ New" → Database → Add PostgreSQL
   - En heydoctor-backend → Variables → Add Reference → Postgres → `DATABASE_URL`
4. Variables obligatorias:
   - `DATABASE_URL` (referencia al Postgres)
   - `JWT_SECRET` (clave para JWT)
   - `OPENAI_API_KEY` (opcional)
5. Ver [RAILWAY-SETUP.md](./RAILWAY-SETUP.md) si falla el healthcheck

## Repo GitHub

- **heydoctor-backend**: https://github.com/SAVAC-HeyDoctor/heydoctor-backend
- El backend NestJS está en la carpeta `nest-backend/`

## Verificación

- Health: `GET /api/health`
- Con JWT: `GET /api/clinics/me`
