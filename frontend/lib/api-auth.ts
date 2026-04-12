/**
 * Auth API - Login contra el backend Nest (Railway).
 * Tras login se guarda `access_token` en localStorage para `Authorization: Bearer`.
 */

import { apiCredentialsInit } from './api-credentials';
import {
  requireHeydoctorApiBase,
  setStoredAccessToken,
  clearStoredAccessToken,
} from './heydoctor-api';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
}

/**
 * Login contra el backend Nest en Railway.
 * POST /api/auth/login
 */
/** Cierra sesión en el cliente (borra el JWT almacenado). */
export function logout(): void {
  clearStoredAccessToken();
}

export async function login(credentials: LoginCredentials): Promise<LoginResponse> {
  const base = requireHeydoctorApiBase();

  const res = await fetch(`${base}/api/auth/login`, {
    ...apiCredentialsInit,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(credentials),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || 'Login failed');
  }

  const data = (await res.json()) as LoginResponse;
  setStoredAccessToken(data.access_token);
  return data;
}
