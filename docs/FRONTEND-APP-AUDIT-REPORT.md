# FRONTEND APP AUDIT REPORT

**Proyecto:** jairosc23/heydoctor-frontend (Next.js App Router)  
**Backend objetivo:** https://heydoctorbackend-production.up.railway.app/api (NestJS)  
**Fecha:** Marzo 2025  
**Objetivo:** Auditoría completa de la aplicación Next.js real (no la biblioteca de componentes)

---

## 1. Architecture Overview

### 1.1 Tipo de aplicación

**Aplicación Next.js completa** con App Router. No es una biblioteca de componentes; incluye rutas, layouts, pages y un shell funcional.

### 1.2 Stack detectado

| Tecnología | Estado |
|------------|--------|
| Next.js (App Router) | ✅ En uso (carpeta `.next`, estructura `app/`) |
| React | ✅ |
| TypeScript | ✅ (archivos `.tsx`) |
| package.json | ⚠️ Indica Vite en scripts; proyecto migrado a Next.js |

### 1.3 Estructura de rutas (`app/`)

```
app/
├── layout.tsx              # Root: metadata, fonts, body
├── page.tsx                # / → landing con link a login
├── globals.css
│
├── login/
│   └── page.tsx            # /login → formulario de acceso
│
├── dashboard/
│   └── page.tsx            # /dashboard → PanelLayout, métricas estáticas (0)
│
├── panel/
│   ├── layout.tsx          # Envuelve con PanelLayout (sidebar + header + auth check)
│   ├── page.tsx            # /panel → redirige a /dashboard
│   ├── pacientes/          # Placeholder "Gestión de pacientes"
│   ├── consultas/          # Placeholder "Gestión de consultas médicas"
│   ├── agenda/             # Placeholder "Calendario de citas"
│   ├── reportes/           # Placeholder "Reportes y estadísticas"
│   ├── facturacion/        # Placeholder "Gestión de facturación"
│   └── config/             # Placeholder "Ajustes del centro médico"
│
├── verify/
│   └── [id]/
│       └── page.tsx        # /verify/:id → verificación de documento médico (GET /verify/:id)
│
└── doctors/
    └── [id]/
        └── page.tsx        # /doctors/:id → perfil doctor (GET /doctor, ignora id)
```

### 1.4 Jerarquía de layouts

- **Root layout:** `app/layout.tsx` → metadata, fonts, `{children}`
- **Panel layout:** `app/panel/layout.tsx` → `PanelLayout` (sidebar, header, logout, auth check)
- **Dashboard:** usa `PanelLayout` directamente en la página (no está bajo `/panel`)

### 1.5 Componentes

| Componente | Ubicación | Función |
|------------|-----------|---------|
| `PanelLayout` | `components/PanelLayout.tsx` | Sidebar con menú, header con título, toggle tema, logout, verificación de auth (localStorage) |

### 1.6 Relación con la biblioteca de componentes (api-backend-heydoctor/frontend)

**No hay integración.** La app heydoctor-frontend **no importa** ningún componente de la biblioteca (`AiConsultationPanel`, `LabOrdersPanel`, `PrescriptionPanel`, `SmartDiagnosisPicker`, etc.). Son proyectos independientes.

---

## 2. API Calls and Services

### 2.1 Único módulo API: `lib/api.ts`

| Función | Endpoint | Método | Uso |
|---------|----------|--------|-----|
| `login(email, password)` | `${API_URL}/auth/login` | POST | Login |

### 2.2 Base URL

```ts
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
```

- Si el backend Nest es `https://heydoctorbackend-production.up.railway.app/api`, la variable debe ser:
  - `NEXT_PUBLIC_API_URL=https://heydoctorbackend-production.up.railway.app/api`
- Default `localhost:8080` sugiere un backend Express antiguo sin prefijo `/api`.

### 2.3 Llamadas directas en páginas (sin servicio centralizado)

| Página | Endpoint | Método | Auth |
|--------|----------|--------|------|
| `app/verify/[id]/page.tsx` | `${API_URL}/verify/${id}` | GET | No |
| `app/doctors/[id]/page.tsx` | `${API_URL}/doctor` | GET | No |

**Observaciones:**
- `/doctor` ignora el `id` de la URL; siempre llama sin parámetro.
- Nest **no tiene** endpoints `/verify` ni `/doctor`; tiene `/api/auth`, `/api/patients`, `/api/consultations`, etc.

### 2.4 Strapi vs Nest format

| Aspecto | heydoctor-frontend | Nest backend |
|---------|--------------------|--------------|
| Prefijo | Ninguno en API_URL (debe incluir `/api`) | `api` global |
| Login body | `{ email, password }` | ✅ Compatible |
| Login response | Espera `{ token, user: { id, email, name } }` | Devuelve `{ jwt, user: { id, email, firstName, lastName } }` |
| Auth header | No se envía en ninguna llamada protegida | Requiere `Authorization: Bearer <token>` |

**Conclusión:** El frontend no usa formato Strapi explícito; está diseñado para un backend Express/simple que devuelve `token` y `user.name`. Nest devuelve `jwt` y `firstName`/`lastName`, lo que causa **incompatibilidad directa**.

---

## 3. Authentication Flow

### 3.1 Flujo de login

1. Usuario envía email y password en `app/login/page.tsx`.
2. `login()` en `lib/api.ts` llama a `POST ${API_URL}/auth/login`.
3. Si ok: `localStorage.setItem("token", data.token)` — **falla con Nest** porque Nest devuelve `jwt`.
4. `localStorage.setItem("user", JSON.stringify(data.user))`, `("logged", "yes")`.
5. Redirect a `/dashboard`.

### 3.2 Protección de rutas

- **Sin middleware.ts:** no hay verificación server-side.
- `PanelLayout` hace check en `useEffect` (cliente):
  - Si `logged !== "yes"` o no hay `token` → `router.push("/login")`.
- Problemas: contenido protegido se renderiza antes del redirect; cualquiera puede simular `localStorage`.

### 3.3 Logout

- `handleLogout()` en `PanelLayout`: limpia `token`, `user`, `logged` y redirige a `/login`.

### 3.4 Uso del token

- **Ninguna llamada API envía `Authorization: Bearer`.** El token se guarda pero no se usa en requests. Las únicas llamadas API adicionales (`/verify`, `/doctor`) son públicas y sin auth.

---

## 4. State Management

- **Sin Redux, Zustand, React Query ni TanStack Query.**
- **Sin Context providers** (salvo implícito de Next.js).
- Solo estado local (`useState`) y `localStorage` para auth.
- Dashboard muestra valores hardcodeados (0) para todas las métricas.

---

## 5. Backend Integration Gaps

### 5.1 Endpoints Nest NO usados por el frontend

| Módulo Nest | Endpoints | Estado |
|-------------|-----------|--------|
| patients | `GET /api/patients`, `GET /api/patients/:id/medical-record` | ❌ No usado |
| consultations | `GET/POST /api/consultations` | ❌ No usado |
| diagnosis | `GET/POST /api/diagnosis` | ❌ No usado |
| prescriptions | `GET/POST /api/prescriptions` | ❌ No usado |
| lab-orders | `GET/POST /api/lab-orders` | ❌ No usado |
| ai-insights | `GET/POST /api/ai-insights/*` | ❌ No usado |
| appointments | `GET /api/appointments` | ❌ No usado |
| clinics | `GET /api/clinics/me` | ❌ No usado |
| search, cdss, templates, analytics, etc. | Múltiples | ❌ No usado |

### 5.2 Endpoints que el frontend usa pero Nest NO tiene

| Endpoint frontend | Nest equivalente |
|------------------|------------------|
| `GET /verify/:id` | ❌ No existe |
| `GET /doctor` | ❌ No existe (hay `Doctor` entity y search, pero no endpoint público `/doctor`) |

### 5.3 Incompatibilidades críticas (login)

| Campo | Frontend espera | Nest devuelve |
|-------|-----------------|---------------|
| Token | `data.token` | `data.jwt` |
| Nombre usuario | `data.user.name` | `data.user.firstName`, `data.user.lastName` |

**Consecuencia:** Si `NEXT_PUBLIC_API_URL` apunta a Nest, el login fallará al guardar el token (`data.token` es undefined).

---

## 6. Clinical Workflow Gaps

### 6.1 ¿Puede un médico completar el flujo clínico?

| Acción | ¿Disponible? | Evidencia |
|--------|---------------|-----------|
| Crear consulta | ❌ No | Sin UI ni API; página Consultas es placeholder |
| Añadir diagnóstico | ❌ No | Sin flujo |
| Crear prescripción | ❌ No | Sin flujo |
| Ordenar laboratorios | ❌ No | Sin flujo |
| Generar AI insights | ❌ No | Sin flujo |
| Listar pacientes | ❌ No | Página Pacientes es placeholder |
| Ver agenda/citas | ❌ No | Página Agenda es placeholder |
| Dashboard con datos reales | ❌ No | Valores hardcodeados (0) |

### 6.2 Conclusión del flujo clínico

**No es posible que un médico complete ninguna acción clínica** en el frontend actual. Las pantallas son placeholders sin lógica ni integración con el backend Nest.

---

## 7. Critical Issues

### 7.1 Bloqueadores de integración con Nest

| # | Problema | Impacto |
|---|----------|---------|
| 1 | Frontend espera `token`, Nest devuelve `jwt` | Login falla al persistir credenciales |
| 2 | Frontend espera `user.name`, Nest devuelve `firstName`/`lastName` | Posible error al mostrar usuario |
| 3 | API_URL debe incluir `/api` para Nest | Sin config correcta, 404 en login |
| 4 | Endpoints `/verify/:id` y `/doctor` no existen en Nest | Páginas Verify y Doctor devuelven 404 |

### 7.2 Arquitectura y seguridad

| # | Problema | Impacto |
|---|----------|---------|
| 5 | Sin `middleware.ts` para rutas protegidas | Contenido protegido accesible antes del redirect |
| 6 | Token en localStorage sin HttpOnly | Vulnerable a XSS |
| 7 | Ninguna llamada API envía `Authorization` | Imposible consumir endpoints protegidos de Nest |
| 8 | package.json con scripts de Vite | Inconsistencia; build puede confundir |

### 7.3 Funcionalidad

| # | Problema | Impacto |
|---|----------|---------|
| 9 | Dashboard con datos hardcodeados (0) | Sin valor real |
| 10 | Todas las páginas de panel son placeholders | Sin flujo clínico |
| 11 | Sin integración con biblioteca de componentes | No se reutilizan LabOrdersPanel, PrescriptionPanel, etc. |

---

## 8. What Must Be Fixed

### 8.1 Prioridad crítica (para que login funcione con Nest)

1. **Adaptar respuesta de login:** Usar `data.jwt ?? data.token` y construir `user.name` desde `firstName` + `lastName`.
2. **Configurar API_URL:** Asegurar `NEXT_PUBLIC_API_URL=https://heydoctorbackend-production.up.railway.app/api`.
3. **Implementar o eliminar Verify/Doctor:** Crear endpoints en Nest o eliminar/deshabilitar esas páginas.

### 8.2 Prioridad alta (flujo clínico mínimo)

4. Crear capa API para: patients, consultations, diagnosis, prescriptions, lab-orders.
5. Enviar `Authorization: Bearer <token>` en todas las llamadas protegidas.
6. Implementar páginas reales: Pacientes (listar), Consultas (crear/listar), Agenda (appointments).
7. Integrar o construir UI para: diagnóstico, prescripciones, lab orders (reusar biblioteca si es viable).

### 8.3 Prioridad media (calidad y seguridad)

8. Añadir `middleware.ts` para proteger rutas `/dashboard`, `/panel/*`.
9. Migrar data fetching a React Query para cache y manejo de errores.
10. Actualizar `package.json` (scripts de Next.js, quitar Vite si ya no se usa).

---

## 9. Refactor vs Rebuild

### 9.1 Opción A: Refactor (recomendada)

**Cuándo:** Se quiere conservar la estructura actual (rutas, layouts, diseño) y completar la integración.

**Esfuerzo:** Medio  
**Pasos principales:**
1. Corregir login para `jwt` y `firstName`/`lastName`.
2. Crear `lib/api-client.ts` con fetch base + header `Authorization`.
3. Crear servicios: `api-patients.ts`, `api-consultations.ts`, etc., alineados con Nest.
4. Sustituir placeholders por páginas funcionales.
5. Integrar componentes de la biblioteca (`api-backend-heydoctor/frontend`) o replicar su lógica corregida.
6. Decidir qué hacer con Verify/Doctor (crear en Nest o eliminar).

**Ventajas:** Mantiene la app actual, menor riesgo, avance incremental.  
**Desventajas:** La deuda técnica (auth en cliente, sin React Query) persiste hasta abordarla.

### 9.2 Opción B: Rebuild

**Cuándo:** Se prioriza una arquitectura nueva (capas bien definidas, React Query, auth robusta).

**Esfuerzo:** Alto  
**Pasos principales:**
1. Nuevo proyecto Next.js con estructura clara.
2. Capa API centralizada, middleware de auth, React Query.
3. Integrar biblioteca de componentes desde el inicio.
4. Migrar solo lo que aporte valor: branding, layouts, flujo de login (adaptado).

**Ventajas:** Base limpia, menos deuda.  
**Desventajas:** Tiempo y costo mayores; hay que reimplementar lo ya construido.

### 9.3 Recomendación

**Refactor** es la opción más pragmática porque:
- La app tiene una base usable (rutas, layouts, login, panel).
- La biblioteca de componentes ya tiene UI para flujos clínicos (con correcciones de formato).
- El trabajo principal es corregir integración API y sustituir placeholders, no reconstruir todo.

---

## 10. Summary Table

| Aspecto | Estado actual |
|---------|----------------|
| **App structure** | Next.js App Router completo con rutas definidas |
| **API layer** | Solo login; 2 llamadas directas (/verify, /doctor) |
| **Backend alignment** | Incompatible: token vs jwt, endpoints Verify/Doctor no existen en Nest |
| **Clinical workflow** | Inexistente; todas las páginas son placeholders |
| **Auth** | Client-side con localStorage; token no se envía en requests |
| **State** | Solo local; sin React Query ni estado global |
| **Component library** | No integrada |

---

*Fin del reporte*
