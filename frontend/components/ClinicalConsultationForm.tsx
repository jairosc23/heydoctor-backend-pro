'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchConsultation,
  patchConsultation,
  type Consultation,
  type ConsultationStatus,
} from '../lib/api-consultations';
import {
  trackConsultationCompleted,
  trackConsultationStarted,
} from '../lib/analytics';
import { SmartDiagnosisPicker } from './SmartDiagnosisPicker';

const TERMINAL_STATUSES: ConsultationStatus[] = [
  'completed',
  'signed',
  'locked',
];

export type ClinicalConsultationFormProps = {
  consultationId: string;
  clinicId?: number | null;
  /** Síntomas libres para CDSS (p. ej. líneas del textarea). */
  symptomsForPanel?: string[];
  enableAutosave?: boolean;
  autosaveDebounceMs?: number;
  className?: string;
};

function statusLabel(s: ConsultationStatus): string {
  const map: Record<ConsultationStatus, string> = {
    draft: 'Borrador',
    in_progress: 'En curso',
    completed: 'Completada',
    signed: 'Firmada',
    locked: 'Cerrada',
  };
  return map[s] ?? s;
}

/**
 * Formulario clínico por secciones: motivo, síntomas, diagnóstico, plan, notas y estado.
 * Autosave opcional (PATCH parcial). Validación al avanzar estado de cierre (diagnóstico requerido en servidor).
 */
export function ClinicalConsultationForm({
  consultationId,
  clinicId,
  symptomsForPanel = [],
  enableAutosave = true,
  autosaveDebounceMs = 2000,
  className = '',
}: ClinicalConsultationFormProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autosaveState, setAutosaveState] = useState<'idle' | 'pending' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const [chiefComplaint, setChiefComplaint] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [treatmentPlan, setTreatmentPlan] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<ConsultationStatus>('draft');

  const hydrated = useRef(false);
  const startedTracked = useRef(false);
  const lastServerStatus = useRef<ConsultationStatus | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSynced = useRef<string>('');

  const applyConsultation = useCallback((c: Consultation) => {
    setChiefComplaint(c.chiefComplaint ?? '');
    setSymptoms(c.symptoms ?? '');
    setDiagnosis(c.diagnosis ?? '');
    setTreatmentPlan(c.treatmentPlan ?? '');
    setNotes(c.notes ?? '');
    setStatus(c.status);
    lastServerStatus.current = c.status;
    lastSynced.current = JSON.stringify({
      chiefComplaint: c.chiefComplaint ?? '',
      symptoms: c.symptoms ?? '',
      diagnosis: c.diagnosis ?? '',
      treatmentPlan: c.treatmentPlan ?? '',
      notes: c.notes ?? '',
      status: c.status,
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const c = await fetchConsultation(consultationId);
        if (!cancelled) {
          applyConsultation(c);
          if (!startedTracked.current) {
            startedTracked.current = true;
            void trackConsultationStarted(consultationId);
          }
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) {
          setLoading(false);
          hydrated.current = true;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [consultationId, applyConsultation]);

  const persist = useCallback(
    async (patch: Parameters<typeof patchConsultation>[1], mode: 'manual' | 'auto') => {
      if (status === 'locked') return;
      if (mode === 'auto') setAutosaveState('pending');
      else setSaving(true);
      setError(null);
      try {
        const prev = lastServerStatus.current;
        const updated = await patchConsultation(consultationId, patch);
        if (
          prev != null &&
          TERMINAL_STATUSES.includes(updated.status) &&
          !TERMINAL_STATUSES.includes(prev)
        ) {
          void trackConsultationCompleted(consultationId, {
            status: updated.status,
          });
        }
        applyConsultation(updated);
        if (mode === 'auto') {
          setAutosaveState('saved');
          window.setTimeout(() => setAutosaveState('idle'), 1500);
        }
      } catch (e) {
        setError((e as Error).message);
        if (mode === 'auto') setAutosaveState('error');
      } finally {
        if (mode === 'manual') setSaving(false);
      }
    },
    [applyConsultation, consultationId, status],
  );

  useEffect(() => {
    if (!hydrated.current || !enableAutosave || status === 'locked') return;

    const snapshot = JSON.stringify({
      chiefComplaint,
      symptoms,
      diagnosis,
      treatmentPlan,
      notes,
      status,
    });
    if (snapshot === lastSynced.current) return;

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void persist(
        {
          chiefComplaint,
          symptoms,
          diagnosis,
          treatmentPlan,
          notes,
          status,
        },
        'auto',
      );
    }, autosaveDebounceMs);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [
    chiefComplaint,
    symptoms,
    diagnosis,
    treatmentPlan,
    notes,
    status,
    enableAutosave,
    autosaveDebounceMs,
    persist,
  ]);

  const handleStatusChange = (next: ConsultationStatus) => {
    if (TERMINAL_STATUSES.includes(next) && !diagnosis.trim()) {
      setError(
        'Indica un diagnóstico antes de completar, firmar o cerrar la consulta.',
      );
      return;
    }
    setError(null);
    setStatus(next);
  };

  const handleManualSave = () => {
    void persist(
      {
        chiefComplaint,
        symptoms,
        diagnosis,
        treatmentPlan,
        notes,
        status,
      },
      'manual',
    );
  };

  const locked = status === 'locked';
  const cdssSymptoms =
    symptomsForPanel.length > 0
      ? symptomsForPanel
      : symptoms
          .split(/[\n,;]+/)
          .map((s) => s.trim())
          .filter(Boolean);

  if (loading) {
    return (
      <div className={`rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-500 ${className}`}>
        Cargando consulta…
      </div>
    );
  }

  return (
    <div className={`space-y-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-4">
        <h2 className="text-lg font-semibold text-gray-900">Documentación clínica</h2>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {enableAutosave && !locked && (
            <span className="text-gray-500">
              {autosaveState === 'pending' && 'Guardando…'}
              {autosaveState === 'saved' && 'Guardado'}
              {autosaveState === 'error' && 'Error al guardar'}
            </span>
          )}
          <label className="flex items-center gap-2">
            <span className="text-gray-600">Estado</span>
            <select
              value={status}
              disabled={locked}
              onChange={(e) => handleStatusChange(e.target.value as ConsultationStatus)}
              className="rounded-md border border-gray-300 px-2 py-1 text-sm"
            >
              {(
                [
                  'draft',
                  'in_progress',
                  'completed',
                  'signed',
                  'locked',
                ] as ConsultationStatus[]
              ).map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={locked || saving}
            onClick={handleManualSave}
            className="rounded-md bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Guardar ahora'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      {locked && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          Esta consulta está cerrada; la edición está deshabilitada.
        </p>
      )}

      <section>
        <label className="block text-sm font-medium text-gray-700 mb-1">Motivo de consulta</label>
        <textarea
          value={chiefComplaint}
          onChange={(e) => setChiefComplaint(e.target.value)}
          disabled={locked}
          rows={3}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          placeholder="Motivo principal de la visita…"
        />
      </section>

      <section>
        <label className="block text-sm font-medium text-gray-700 mb-1">Síntomas</label>
        <textarea
          value={symptoms}
          onChange={(e) => setSymptoms(e.target.value)}
          disabled={locked}
          rows={4}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          placeholder="Descripción de síntomas, evolución…"
        />
      </section>

      <section>
        <label className="block text-sm font-medium text-gray-700 mb-2">Diagnóstico</label>
        <SmartDiagnosisPicker
          value={diagnosis}
          onChange={(item) => {
            const line = `${item.code} - ${item.description}`.trim();
            setDiagnosis(line);
          }}
          symptoms={cdssSymptoms}
          clinicId={clinicId}
          disabled={locked}
          placeholder="Buscar CIE-10 o describir…"
          className="w-full"
        />
        <textarea
          value={diagnosis}
          onChange={(e) => setDiagnosis(e.target.value)}
          disabled={locked}
          rows={3}
          className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          placeholder="Texto libre del diagnóstico / código"
        />
      </section>

      <section>
        <label className="block text-sm font-medium text-gray-700 mb-1">Plan de tratamiento</label>
        <textarea
          value={treatmentPlan}
          onChange={(e) => setTreatmentPlan(e.target.value)}
          disabled={locked}
          rows={4}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          placeholder="Medicación, estudios, controles, educación al paciente…"
        />
      </section>

      <section>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={locked}
          rows={4}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          placeholder="Notas adicionales, observaciones…"
        />
      </section>
    </div>
  );
}
