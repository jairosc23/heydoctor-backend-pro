'use client';

/**
 * Ejemplo de formulario de login que llama al backend Nest en Railway.
 * Reemplaza tu formulario actual con este patrón.
 *
 * Uso:
 * 1. Importa: import { login } from '@/lib/api-auth';
 * 2. En onSubmit: const res = await login({ email, password });
 * 3. Guarda el JWT: localStorage.setItem('jwt', res.jwt);
 * 4. Redirige al dashboard
 */
import React, { useState } from 'react';
import { login } from '../lib/api-auth';

export function LoginFormExample() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await login({ email, password });
      if (typeof window !== 'undefined') {
        localStorage.setItem('jwt', res.jwt);
        localStorage.setItem('token', res.jwt); // compatibilidad
      }
      // Redirigir al dashboard
      window.location.href = '/dashboard';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Loading...' : 'Login'}
      </button>
    </form>
  );
}
