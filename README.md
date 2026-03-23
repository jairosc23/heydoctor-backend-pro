# HeyDoctor Backend (NestJS)

API clínica core para HeyDoctor: **PostgreSQL**, **TypeORM**, **JWT**, **ConfigModule**.

## Requisitos

- Node.js 20+
- PostgreSQL accesible vía `DATABASE_URL`

## Configuración

```bash
cp .env.example .env
# Edita DATABASE_URL, JWT_SECRET y PORT (por defecto 3001)
```

## Usuario inicial (login)

No hay endpoint público de registro. Crea el primer usuario en base de datos:

1. Genera un hash bcrypt (cost 12) de tu contraseña, por ejemplo con Node:

   ```bash
   node -e "require('bcrypt').hash('TuPasswordSeguro123', 12).then(console.log)"
   ```

2. Inserta en PostgreSQL (ajusta el hash):

   ```sql
   INSERT INTO users (id, email, password_hash, created_at)
   VALUES (gen_random_uuid(), 'admin@heydoctor.local', '<PEGAR_HASH_AQUI>', NOW());
   ```

En desarrollo, con `NODE_ENV !== production`, TypeORM **sincroniza** el esquema automáticamente. En **producción** usa migraciones (`synchronize` está desactivado).

## Arranque

```bash
npm install
npm run start:dev
```

- API: `http://localhost:3001/api`
- Salud: `GET /api/health`
- Login: `POST /api/auth/login` — body JSON `{ "email", "password" }`
- Pacientes (PostgreSQL / TypeORM, sin JWT): `GET|POST /api/patients` — body `POST`: `{ "name", "email" }`
- Consultas (JWT): `GET /api/consultations`

## Variables de entorno

| Variable        | Descripción                          |
|----------------|--------------------------------------|
| `DATABASE_URL` | URL PostgreSQL                       |
| `JWT_SECRET`   | Secreto para firmar tokens           |
| `PORT`         | Puerto HTTP (default 3001)           |
| `NODE_ENV`     | `production` desactiva `synchronize`   |
| `CORS_ORIGIN`  | Opcional: lista separada por comas   |

## Estructura

- `src/auth` — login JWT
- `src/users` — usuarios (credenciales)
- `src/patients` — pacientes persistidos en PostgreSQL vía TypeORM
- `src/consultations` — consultas (listado inicial)
