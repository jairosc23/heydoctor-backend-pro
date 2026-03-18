# Integración Login Frontend ↔ Backend Nest (Railway)

## Backend (Nest) - Ya implementado

- **POST** `https://heydoctor-backend-production.up.railway.app/api/auth/login`
- Body: `{ "email": "...", "password": "..." }`
- Response: `{ "jwt": "...", "user": { "id", "email", "firstName", "lastName" } }`

## Frontend (Next.js) - Cómo integrar

### 1. Variable de entorno

```env
NEXT_PUBLIC_API_URL=https://heydoctor-backend-production.up.railway.app
```

### 2. Reemplazar llamadas internas

**Antes (incorrecto):**
```ts
fetch('/login', { ... })
fetch('/api/login', { ... })
axios.post('/api/auth/local', data)
```

**Después (correcto):**
```ts
import { login } from '@/lib/api-auth';

const res = await login({ email, password });
localStorage.setItem('jwt', res.jwt);
```

### 3. Archivo `frontend/lib/api-auth.ts`

Ya creado. Usa `NEXT_PUBLIC_API_URL` para todas las llamadas.

### 4. Verificar en DevTools

Al hacer login, en la pestaña **Network** debe aparecer:
- `POST https://heydoctor-backend-production.up.railway.app/api/auth/login`

### 5. Usuarios con contraseña

El backend Nest requiere la columna `passwordHash` en `users`. En producción ejecuta:

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS "passwordHash" varchar;
```

Para crear usuarios con contraseña, usa un script o añade un endpoint de registro.
