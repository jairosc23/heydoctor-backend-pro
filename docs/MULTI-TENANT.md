# Multi-tenant SaaS - HeyDoctor

## Resumen

HeyDoctor soporta múltiples clínicas en la misma instancia. Cada clínica tiene sus datos aislados.

## Tablas

### `clinics`
- id, name, slug, logo_url, contact_email, created_at

### `clinic_users`
- id, clinic_id, user_id, role, created_at
- Roles: owner, admin, doctor, assistant

### Tablas con `clinic_id`
- patients
- appointments (consultations)
- clinical_records
- diagnostics
- videocalls
- payments

## Flujo

1. **Onboarding**: `POST /api/clinics` crea una clínica y asigna al creador como `owner` en `clinic_users`.
2. **Autenticación**: El policy `tenant-resolver` obtiene `clinic_id` del usuario autenticado vía `clinic_users`.
3. **Aislamiento**: Todas las consultas filtran por `clinic_id` cuando el usuario tiene clínica asignada.

## Compatibilidad

- Usuarios sin registro en `clinic_users`: `clinicId` es null, se permite acceso completo (compatibilidad con instalaciones existentes).
- Usuarios con `clinic_users`: se aplica filtrado por clínica.

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | /api/clinics | Crear clínica (asigna creator como owner) |
| GET | /api/clinic/me | Obtener clínica del usuario actual |
| GET | /api/clinic/patients | Pacientes de la clínica |
| GET | /api/clinic/consultations | Citas de la clínica |
| GET | /api/clinic/documents | Registros clínicos de la clínica |

## Migración de datos existentes

Tras añadir `clinic_id` a las tablas, los registros existentes tendrán `clinic_id = null`. Para migrar:

1. Crear una clínica por defecto.
2. Asociar usuarios existentes a esa clínica en `clinic_users`.
3. Actualizar registros existentes con `clinic_id` de la clínica por defecto.

## Frontend

Usar `ClinicProvider` y `useClinic()`:

```tsx
import { ClinicProvider, useClinic } from './context';

// En el layout
<ClinicProvider>
  <App />
</ClinicProvider>

// En componentes
const { clinic, clinicId, clinicName } = useClinic();
```
