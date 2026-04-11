# Origen del frontend en Vercel vs este monorepo

## Hallazgo (confirmación)

La carpeta [`frontend/`](../frontend/) en **api-backend-heydoctor** es una **biblioteca de componentes y clientes HTTP** (TypeScript + React). **No** incluye `package.json` ni App Router de Next.js: **no es un proyecto desplegable por sí solo** en Vercel.

El informe [`FRONTEND-APP-AUDIT-REPORT.md`](FRONTEND-APP-AUDIT-REPORT.md) describe la app **jairosc23/heydoctor-frontend** (Next.js App Router) como proyecto **independiente** que consume APIs del backend Nest.

## Implicación

- Si el proyecto de Vercel **“heydoctor-frontend”** apunta al repo **heydoctor-frontend**, las rutas Server Actions / `fetch` / axios a auditar están **en ese repositorio**, no solo en `frontend/` de este monorepo.
- Si en el futuro Vercel construyera **este** monorepo, haría falta un `package.json` y configuración de **Root Directory** (p. ej. subcarpeta de una app Next) que hoy **no existen** en `frontend/`.

## Cookies cross-site (recordatorio)

Toda petición del navegador al API en otro origen (Vercel → Railway) que dependa de cookies HttpOnly debe usar **`credentials: 'include'`** (fetch) o **`withCredentials: true`** (axios). En este monorepo el patrón central es [`frontend/lib/api-credentials.ts`](../frontend/lib/api-credentials.ts).

## Server Actions / Route Handlers

En **`frontend/` de este monorepo** no hay archivos `app/**/route.ts` ni `"use server"`. Si el login o el CSRF pasan por el servidor de Next en **heydoctor-frontend**, hay que revisar allí el reenvío de cookies hacia el API.
