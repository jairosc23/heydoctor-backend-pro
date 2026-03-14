# Integración Multi-Clinic - HeyDoctor

## 1. Tablas de base de datos

Strapi crea automáticamente las tablas al iniciar. Verificar:

```bash
npm run develop
# o
npm run build && npm run start
```

**clinics:**
- id, name, slug, logo_url, contact_email, created_at, updated_at

**clinic_users:**
- id, clinic_id, user_id, role, created_at, updated_at
- Roles: owner, admin, doctor, assistant

---

## 2. Permisos en Strapi Admin

1. Ir a **Settings → Users & Permissions → Roles**
2. Editar rol **Authenticated**
3. En **Clinic**:
   - ✅ create, find, findOne, update
   - ❌ delete (solo admin)
4. En **Clinic-user**:
   - ✅ create, find, findOne, update
   - ❌ delete (solo admin)

Para **Public** (si aplica): solo create en clinic para onboarding.

---

## 3. Migración de datos existentes

```bash
npm run migrate:default-clinic
```

O manualmente:
```bash
node scripts/migrateDefaultClinic.js
```

**Pasos del script:**
1. Crea clínica por defecto: "HeyDoctor Default Clinic" (slug: default-clinic)
2. Asigna todos los usuarios existentes como doctors
3. Actualiza patients, appointments, clinical_records, diagnostics, videocalls, payments con clinic_id

---

## 4. Frontend - ClinicProvider

**Ubicación:** `frontend/context/ClinicContext.tsx`

**API:** `GET /api/clinics/me` (requiere JWT)

**Uso:**
```tsx
const { clinicId, clinicName, clinicSlug } = useClinic();
```

---

## 5. Integrar en layout raíz

```tsx
// app/layout.tsx (Next.js App Router)
import { ClinicProvider } from '@/context';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <ClinicProvider>
          {children}
        </ClinicProvider>
      </body>
    </html>
  );
}
```

```tsx
// pages/_app.tsx (Next.js Pages Router)
import { ClinicProvider } from '@/context';

export default function App({ Component, pageProps }) {
  return (
    <ClinicProvider>
      <Component {...pageProps} />
    </ClinicProvider>
  );
}
```

---

## 6. Aislamiento por clínica en frontend

Incluir `clinic_id` en las peticiones cuando el backend lo requiera:

```ts
const { clinicId } = useClinic();

// GET /api/patients?filters[clinic][id][$eq]=${clinicId}
const res = await fetch(
  `${API_URL}/api/patients?filters[clinic][id][$eq]=${clinicId}`,
  { headers: { Authorization: `Bearer ${token}` } }
);
```

El backend ya aplica el filtro vía `tenant-resolver` policy cuando el usuario tiene clínica asignada.

---

## Variables de entorno

- `NEXT_PUBLIC_API_URL` - URL del backend (ej: https://api.heydoctor.health)
- `DATABASE_*` - Para el script de migración
