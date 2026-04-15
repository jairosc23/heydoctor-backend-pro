'use client';

import { useState, type CSSProperties, type FormEvent } from 'react';
import { revalidateDoctorsTag } from '../lib/actions/revalidate-doctors';
import {
  registerDoctor,
  type RegisterDoctorPayload,
} from '../lib/api-doctors-register';

export type DoctorOnboardingFormProps = {
  backendOrigin: string;
  onRegistered?: (info: { email: string; profileSlug: string }) => void;
};

export function DoctorOnboardingForm({
  backendOrigin,
  onRegistered,
}: DoctorOnboardingFormProps) {
  const [form, setForm] = useState<RegisterDoctorPayload>({
    name: '',
    email: '',
    specialty: '',
    clinic: '',
    password: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const r = await registerDoctor(backendOrigin, form);
      try {
        await revalidateDoctorsTag();
      } catch {
        // Sin App Router / next/cache el action puede fallar; el alta ya fue correcta.
      }
      setDone('Registro exitoso. Ya puede iniciar sesión.');
      onRegistered?.({ email: r.email, profileSlug: r.profileSlug });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      style={{ maxWidth: 420, padding: 16, fontFamily: 'system-ui, sans-serif' }}
    >
      <h2 style={{ fontSize: '1.15rem' }}>Alta de médico</h2>
      <p style={{ color: '#666', fontSize: '0.85rem' }}>
        Crea una clínica nueva y un usuario doctor. El email debe ser único en la plataforma.
      </p>
      {error && (
        <p style={{ color: '#b42318', fontSize: '0.9rem' }} role="alert">
          {error}
        </p>
      )}
      {done && (
        <p style={{ color: '#0d6d36', fontSize: '0.9rem' }} role="status">
          {done}
        </p>
      )}
      <label style={labelCss}>
        Nombre completo
        <input
          required
          minLength={2}
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          style={inputCss}
        />
      </label>
      <label style={labelCss}>
        Email
        <input
          required
          type="email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          style={inputCss}
        />
      </label>
      <label style={labelCss}>
        Especialidad
        <input
          required
          minLength={2}
          value={form.specialty}
          onChange={(e) => setForm((f) => ({ ...f, specialty: e.target.value }))}
          style={inputCss}
        />
      </label>
      <label style={labelCss}>
        Nombre de la clínica
        <input
          required
          minLength={2}
          value={form.clinic}
          onChange={(e) => setForm((f) => ({ ...f, clinic: e.target.value }))}
          style={inputCss}
        />
      </label>
      <label style={labelCss}>
        Contraseña (mín. 8 caracteres)
        <input
          required
          type="password"
          minLength={8}
          value={form.password}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          style={inputCss}
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        style={{
          marginTop: 12,
          padding: '10px 16px',
          fontWeight: 600,
          cursor: busy ? 'wait' : 'pointer',
        }}
      >
        {busy ? 'Enviando…' : 'Registrarse'}
      </button>
    </form>
  );
}

const labelCss: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  marginBottom: 12,
  fontSize: '0.88rem',
};

const inputCss: CSSProperties = {
  padding: '8px 10px',
  borderRadius: 6,
  border: '1px solid #ccc',
  fontSize: '1rem',
};
