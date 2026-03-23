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

## Autenticación

- **Registro:** `POST /api/auth/register` — `{ "email", "password" }` (mín. 6 caracteres). Rol por defecto: `doctor`. En cada registro se crea una **clínica** y el usuario queda asociado (`clinic_id`); el nombre de la clínica usa el email (máx. 200 caracteres).
- **Login:** `POST /api/auth/login` — `{ "email", "password" }`.
- Respuesta: `{ "access_token": "...", "user": { "id", "email", "role" } }`. El hash de contraseña **nunca** se devuelve.
- JWT: expiración **7d**, secreto `JWT_SECRET`. Payload: `{ sub, email, role }`.

Rutas protegidas (`GET|POST /api/patients`, `GET /api/consultations`, etc.): cabecera  
`Authorization: Bearer <access_token>`.

En desarrollo, con `NODE_ENV !== production`, TypeORM **sincroniza** el esquema automáticamente. En **producción** usa migraciones (`synchronize` está desactivado).

## Arranque

```bash
npm install
npm run start:dev
```

- API: `http://localhost:3001/api`
- Salud: `GET /api/health`
- Pacientes (**JWT**): `GET|POST /api/patients` — body `POST`: `{ "name", "email" }`
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

- `src/clinic` — entidad `Clinic`, `ClinicService` (fase multi-tenant)
- `src/auth` — registro, login, JWT, `JwtAuthGuard`, `JwtStrategy`
- `src/users` — entidad `User` (email, hash, rol, clínica)
- `src/patients` — pacientes persistidos en PostgreSQL vía TypeORM
- `src/consultations` — consultas (listado inicial)
