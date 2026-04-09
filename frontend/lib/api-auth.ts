/**
 * Auth API - Login contra el backend Nest (Railway).
 * Usa NEXT_PUBLIC_API_URL para todas las llamadas.
 * Sesión: cookies HttpOnly (`heydoctor_session`, `refresh_token`) con credentials: 'include'.
 */

import { apiCredentialsInit } from './api-credentials';

const getApiBase = () =>
  (typeof window !== 'undefined' && (window as any).__API_URL__) ||
  process.env.NEXT_PUBLIC_API_URL ||
  '';

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
export async function login(credentials: LoginCredentials): Promise<LoginResponse> {
  const base = getApiBase();
  if (!base) {
    throw new Error('NEXT_PUBLIC_API_URL is not configured');
  }

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

  return res.json() as Promise<LoginResponse>;
}
