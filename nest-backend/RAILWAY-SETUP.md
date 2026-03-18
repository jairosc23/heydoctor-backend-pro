# Configuración Railway - heydoctor-backend

## Error: Healthcheck failed / ECONNREFUSED

Si el deploy falla con **"Healthcheck failed"** o **"Unable to connect to the database"**, falta configurar PostgreSQL.

## Pasos obligatorios

### 1. Añadir PostgreSQL al proyecto

1. En Railway, abre tu proyecto **HeyDoctor**
2. Click en **"+ New"** → **"Database"** → **"Add PostgreSQL"**
3. Railway creará el servicio y expondrá variables automáticamente

### 2. Conectar la base de datos a heydoctor-backend

1. Entra al servicio **heydoctor-backend**
2. Pestaña **Variables**
3. Click **"+ New Variable"** → **"Add Reference"**
4. Selecciona el servicio **PostgreSQL**
5. Elige la variable **`DATABASE_URL`** (o `DATABASE_PRIVATE_URL` en DBs antiguos)
6. Railway la inyectará como `DATABASE_URL` en tu app

### 3. Variables requeridas

| Variable        | Obligatorio | Descripción                          |
|----------------|------------|--------------------------------------|
| `DATABASE_URL` | Sí         | Referencia al Postgres (paso 2)      |
| `JWT_SECRET`   | Sí         | Clave secreta para JWT (ej: 32 chars) |
| `OPENAI_API_KEY` | No       | Para features de IA (opcional)       |

### 4. Root Directory

En **Settings** → **Build** del servicio heydoctor-backend:
- **Root Directory**: `nest-backend` (si el repo es monorepo)  
  O vacío si el repo solo contiene el backend Nest.

## Verificación

Tras redeploy, el healthcheck en `/api/health` debería responder 200.
