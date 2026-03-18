# Deploy HeyDoctor Backend

## Railway

1. Conectar el repo a Railway
2. Añadir PostgreSQL (Railway inyecta `DATABASE_URL`)
3. Variables de entorno:
   - `JWT_SECRET` (obligatorio)
   - `OPENAI_API_KEY` (opcional, para AI)
4. Deploy automático con Dockerfile

## Subir a GitHub (heydoctor-backend)

Si el backend está en una subcarpeta y quieres un repo separado:

```bash
cd nest-backend
git init
git add .
git commit -m "HeyDoctor NestJS backend - production ready"
git branch -M main
git remote add origin https://github.com/SAVAC-HeyDoctor/heydoctor-backend.git
git push -u origin main
```

O desde el repo padre, push solo nest-backend:

```bash
git subtree push --prefix=nest-backend origin main
# (requiere que origin apunte a heydoctor-backend)
```

## Verificación

- Health: `GET /api/health`
- Con JWT: `GET /api/clinics/me`
