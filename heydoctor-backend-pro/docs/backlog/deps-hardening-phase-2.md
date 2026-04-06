# Deps hardening — fase 2 (backlog interno)

Seguimiento post-override de `lodash` y endurecimiento gradual sin romper producción.

## Tareas propuestas

1. **Dependencias de desarrollo** — Revisar cadena Jest, `@nestjs/cli`, `ajv`, `picomatch`, `brace-expansion`, `handlebars` (p. ej. vía `ts-jest`); priorizar alertas por severidad y superficie (CI vs runtime).
2. **`npm audit fix` controlado** — En rama dedicada, sin `--force`; revisar diff de `package-lock.json`, ejecutar build, tests y e2e con BD de prueba antes de fusionar.
3. **CSP y seguridad frontend** — Alinear cabeceras, orígenes y documentación operativa con el runbook de seguridad existente cuando el front despliegue cambios.
4. **Seguimiento NestJS** — Vigilar releases de parche en el ecosistema `@nestjs/*`; aplicar upgrades de patch tras validación (sin saltos major no planificados).

## Notas

- Mantener compatibilidad con multi-tenant, auditoría y flujo clínico al tocar dependencias.
- No usar `npm audit fix --force` en este proceso.
