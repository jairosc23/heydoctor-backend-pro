# HeyDoctor Strapi Backend - Setup Local

Configuración para ejecutar el backend Strapi localmente (api.backend.heydoctor.health).

## Requisitos

- Node.js 18–20
- PostgreSQL (o Docker)
- npm o yarn

## 1. Instalar dependencias

```bash
npm install
```

## 2. Configurar entorno

Crear `.env` desde el ejemplo (o copiar manualmente):

```bash
npm run setup
```

O copiar manualmente:

```bash
cp .env.example .env
```

Editar `.env` con valores mínimos para desarrollo local:

```env
HOST=0.0.0.0
PORT=1337
NODE_ENV=development

# Generar con: openssl rand -base64 32 (para cada uno)
APP_KEYS=key1,key2
API_TOKEN_SALT=randomSalt
ADMIN_JWT_SECRET=randomSecret
JWT_SECRET=randomSecret

# PostgreSQL local
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=heydoctor
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=tu_password
DATABASE_SSL=false
```

**Generar claves:**

```bash
# APP_KEYS (dos claves separadas por coma)
openssl rand -base64 32
openssl rand -base64 32

# API_TOKEN_SALT, ADMIN_JWT_SECRET, JWT_SECRET
openssl rand -base64 32
```

## 3. Base de datos PostgreSQL

Crear la base de datos:

```bash
createdb heydoctor
```

O con Docker:

```bash
docker run -d --name heydoctor-db \
  -e POSTGRES_DB=heydoctor \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  postgres:15
```

## 4. Iniciar Strapi

```bash
npm run develop
```

Strapi creará las tablas automáticamente en el primer arranque.

## 5. Crear usuario admin

1. Abrir http://localhost:1337/admin
2. Completar el formulario de registro (solo en el primer arranque)
3. Guardar credenciales

## 6. Migración clínica por defecto

Tras crear el admin y tener la base de datos con tablas:

```bash
npm run migrate:default-clinic
```

Esto:

- Crea la clínica "HeyDoctor Default Clinic"
- Asigna usuarios existentes a la clínica como doctors
- Actualiza registros existentes con `clinic_id`

## Scripts disponibles

| Script | Descripción |
|--------|-------------|
| `npm run develop` | Desarrollo con hot-reload |
| `npm run build` | Build de producción |
| `npm run start` | Iniciar en producción |
| `npm run migrate:default-clinic` | Migración clínica por defecto |

## Content types principales

- **clinics** – Clínicas multi-tenant
- **clinic-users** – Usuarios por clínica (roles)
- **audit-logs** – Auditoría de acceso
- **telemedicine-consents** – Consentimientos de telemedicina
- **clinical-documents** – Documentos clínicos
- **patients**, **appointments**, **clinical-records**, etc.

## Solución de problemas

**Error de conexión a base de datos**

- Comprobar que PostgreSQL está en marcha
- Revisar `DATABASE_*` en `.env`

**Puerto 1337 en uso**

- Cambiar `PORT` en `.env`

**Permisos en Admin**

- Settings → Users & Permissions → Roles
- Configurar permisos para cada API según el rol
