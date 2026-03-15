'use client';

import React, { useEffect, useState } from 'react';
import {
  fetchPatientReminders,
  createPatientReminder,
  updatePatientReminder,
  type PatientReminderData,
} from '../lib/api-stickiness';

interface Reminder {
  id: number;
  attributes?: Record<string, unknown>;
  message?: string;
  reminder_type?: string;
  due_date?: string;
  status?: string;
  patient?: number;
}

interface PatientRemindersProps {
  patientId: number | string;
  /** Crear recordatorio desde FollowUpSuggestions */
  onCreateFromSuggestion?: (message: string, dueDate: string) => void;
  className?: string;
}

/**
 * Módulo de recordatorios de pacientes.
 * Crear, mostrar pendientes, integrar con FollowUpSuggestions.
 */
export function PatientReminders({
  patientId,
  onCreateFromSuggestion,
  className = '',
}: PatientRemindersProps) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ message: '', due_date: '', reminder_type: 'follow_up' });

  const load = () => {
    setLoading(true);
    fetchPatientReminders(patientId)
      .then((data) => setReminders(Array.isArray(data) ? data : []))
      .catch(() => setReminders([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => load(), [patientId]);

  const normalize = (r: any): Reminder => ({
    id: r.id,
    attributes: r.attributes ?? r,
    message: r.attributes?.message ?? r.message,
    reminder_type: r.attributes?.reminder_type ?? r.reminder_type,
    due_date: r.attributes?.due_date ?? r.due_date,
    status: r.attributes?.status ?? r.status,
    patient: r.attributes?.patient ?? r.patient,
  });

  const handleCreate = async () => {
    if (!form.message?.trim() || !form.due_date) return;
    try {
      await createPatientReminder({
        patient: Number(patientId),
        message: form.message.trim(),
        due_date: form.due_date,
        reminder_type: form.reminder_type,
      });
      setForm({ message: '', due_date: '', reminder_type: 'follow_up' });
      setShowForm(false);
      load();
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateFromSuggestion = (message: string, timeframe: string) => {
    const due = new Date();
    if (timeframe.includes('2') && timeframe.includes('semana')) due.setDate(due.getDate() + 14);
    else if (timeframe.includes('1') && timeframe.includes('mes')) due.setMonth(due.getMonth() + 1);
    else due.setDate(due.getDate() + 14);
    setForm({ message, due_date: due.toISOString().slice(0, 10), reminder_type: 'follow_up' });
    setShowForm(true);
  };

  const handleMarkSent = async (id: number) => {
    try {
      await updatePatientReminder(id, { status: 'sent' });
      load();
    } catch (e) {
      console.error(e);
    }
  };

  const handleComplete = async (id: number) => {
    try {
      await updatePatientReminder(id, { status: 'completed' });
      load();
    } catch (e) {
      console.error(e);
    }
  };


  const list = reminders.map(normalize);
  const pending = list.filter((r) => r.status === 'pending');

  return (
    <div className={`rounded-lg border border-gray-200 p-3 ${className}`}>
      <h3 className="font-medium text-gray-700 mb-2">Recordatorios del paciente</h3>

      {showForm && (
        <div className="mb-3 p-2 bg-gray-50 rounded space-y-2">
          <input
            type="text"
            value={form.message}
            onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
            placeholder="Mensaje (ej: Follow-up en 2 semanas)"
            className="w-full px-2 py-1.5 border rounded text-sm"
          />
          <input
            type="date"
            value={form.due_date}
            onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
            className="w-full px-2 py-1.5 border rounded text-sm"
          />
          <div className="flex gap-2">
            <button type="button" onClick={handleCreate} className="px-3 py-1.5 bg-indigo-600 text-white rounded text-sm">
              Crear
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 border rounded text-sm">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {!showForm && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="text-sm text-indigo-600 hover:underline mb-2"
        >
          + Crear recordatorio
        </button>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Cargando...</p>
      ) : (
        <ul className="space-y-2">
          {list.map((r) => (
            <li key={r.id} className="text-sm border-l-2 border-gray-200 pl-2">
              <p>{r.message}</p>
              <p className="text-xs text-gray-500">
                {r.due_date ? new Date(r.due_date).toLocaleDateString() : ''} · {r.status ?? 'pending'}
              </p>
              {r.status === 'pending' && (
                <div className="flex gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => handleMarkSent(r.id)}
                    className="text-xs text-indigo-600"
                  >
                    Enviar notificación
                  </button>
                  <button type="button" onClick={() => handleComplete(r.id)} className="text-xs text-gray-500">
                    Completado
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {list.length === 0 && !loading && <p className="text-sm text-gray-500">Sin recordatorios</p>}
    </div>
  );
}
